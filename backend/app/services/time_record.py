from __future__ import annotations

from datetime import date

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.constants import DBConstants
from app.models.employees import Employees
from app.models.shift import Shift
from app.models.site_location import SiteLocation
from app.models.time_record import TimeRecord
from app.schemas.time_record import (
    TimeRecordCheckIn,
    TimeRecordCheckOut,
    TimeRecordListItemResponse,
)


class TimeRecordService:
    @staticmethod
    def _get_employee(db: Session, employee_code: str) -> Employees | None:
        stmt = select(Employees).where(Employees.employee_code == employee_code)
        return db.scalar(stmt)

    @staticmethod
    def _get_shift(db: Session, shift_id: int) -> Shift | None:
        stmt = select(Shift).where(Shift.shift_id == shift_id)
        return db.scalar(stmt)

    @staticmethod
    def _get_site_location(db: Session, location_id: int) -> SiteLocation | None:
        stmt = select(SiteLocation).where(SiteLocation.location_id == location_id)
        return db.scalar(stmt)

    @staticmethod
    def _get_status_code(time_record: TimeRecord) -> str:
        if time_record.checkin is None and time_record.checkout is None:
            return "pending"
        if time_record.checkin is not None and time_record.checkout is None:
            return "in_progress"
        return "completed"

    @staticmethod
    def _get_status_text(status_code: str) -> str:
        status_map = {
            "pending": "รอดำเนินการเข้าตรวจ",
            "in_progress": "อยู่ระหว่างการเข้าตรวจ",
            "completed": "ตรวจแล้ว",
        }
        return status_map.get(status_code, "ไม่ทราบสถานะ")

    @staticmethod
    def create_time_record(
        db: Session,
        payload: TimeRecordCheckIn,
    ) -> TimeRecord:
        employee = TimeRecordService._get_employee(db, payload.employee_code)
        if employee is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Employee not found",
            )

        shift = TimeRecordService._get_shift(db, payload.shift_id)
        if shift is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Shift not found",
            )

        if payload.checkin_location_id is not None:
            site_location = TimeRecordService._get_site_location(
                db,
                payload.checkin_location_id,
            )
            if site_location is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Check-in location not found",
                )

        created_by_employee = TimeRecordService._get_employee(db, payload.created_by)
        if created_by_employee is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Created by employee not found",
            )

        open_time_record = TimeRecordService.get_open_time_record_by_employee(
            db,
            payload.employee_code,
        )
        if open_time_record is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Open time record already exists for this employee",
            )

        time_record = TimeRecord(**payload.model_dump())

        try:
            db.add(time_record)
            db.commit()
            db.refresh(time_record)
        except IntegrityError as exc:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid time record reference data",
            ) from exc

        return time_record

    @staticmethod
    def get_time_record_by_id(
        db: Session,
        time_record_id: int,
    ) -> TimeRecord | None:
        stmt = select(TimeRecord).where(TimeRecord.time_record_id == time_record_id)
        return db.scalar(stmt)

    @staticmethod
    def get_open_time_record_by_employee(
        db: Session,
        employee_code: str,
    ) -> TimeRecord | None:
        stmt = (
            select(TimeRecord)
            .where(TimeRecord.employee_code == employee_code)
            .where(TimeRecord.checkout.is_(None))
            .order_by(TimeRecord.created_at.desc(), TimeRecord.time_record_id.desc())
        )
        return db.scalar(stmt)

    @staticmethod
    def get_time_records(
        db: Session,
        skip: int = DBConstants.DEFAULT_PAGE_SKIP,
        limit: int = DBConstants.DEFAULT_PAGE_LIMIT,
        employee_code: str | None = None,
        shift_id: int | None = None,
        work_date: date | None = None,
    ) -> list[TimeRecord]:
        stmt = select(TimeRecord)

        if employee_code is not None and employee_code.strip():
            stmt = stmt.where(TimeRecord.employee_code == employee_code.strip())

        if shift_id is not None:
            stmt = stmt.where(TimeRecord.shift_id == shift_id)

        if work_date is not None:
            stmt = stmt.where(TimeRecord.work_date == work_date)

        stmt = (
            stmt.order_by(
                TimeRecord.created_at.desc(),
                TimeRecord.time_record_id.desc(),
            )
            .offset(skip)
            .limit(limit)
        )

        return list(db.scalars(stmt).all())

    @staticmethod
    def get_time_record_list_items(
        db: Session,
        skip: int = DBConstants.DEFAULT_PAGE_SKIP,
        limit: int = DBConstants.DEFAULT_PAGE_LIMIT,
        employee_code: str | None = None,
        shift_id: int | None = None,
        work_date: date | None = None,
    ) -> list[TimeRecordListItemResponse]:
        stmt = (
            select(TimeRecord, SiteLocation)
            .outerjoin(
                SiteLocation,
                TimeRecord.checkin_location_id == SiteLocation.location_id,
            )
        )

        if employee_code is not None and employee_code.strip():
            stmt = stmt.where(TimeRecord.employee_code == employee_code.strip())

        if shift_id is not None:
            stmt = stmt.where(TimeRecord.shift_id == shift_id)

        if work_date is not None:
            stmt = stmt.where(TimeRecord.work_date == work_date)

        stmt = (
            stmt.order_by(
                TimeRecord.created_at.desc(),
                TimeRecord.time_record_id.desc(),
            )
            .offset(skip)
            .limit(limit)
        )

        rows = db.execute(stmt).all()

        results: list[TimeRecordListItemResponse] = []
        for time_record, site_location in rows:
            status_code = TimeRecordService._get_status_code(time_record)
            status_text = TimeRecordService._get_status_text(status_code)

            results.append(
                TimeRecordListItemResponse(
                    time_record_id=time_record.time_record_id,
                    work_date=time_record.work_date,
                    location_id=site_location.location_id if site_location else None,
                    location_name=site_location.location_name if site_location else "-",
                    status_code=status_code,
                    status_text=status_text,
                    checkin=time_record.checkin,
                    checkout=time_record.checkout,
                )
            )

        return results

    @staticmethod
    def update_time_record(
        db: Session,
        time_record_id: int,
        payload: TimeRecordCheckOut,
    ) -> TimeRecord | None:
        time_record = TimeRecordService.get_time_record_by_id(db, time_record_id)
        if time_record is None:
            return None

        if time_record.checkout is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Time record already checked out",
            )

        if payload.checkout_location_id is not None:
            site_location = TimeRecordService._get_site_location(
                db,
                payload.checkout_location_id,
            )
            if site_location is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Check-out location not found",
                )

        if payload.updated_by is not None:
            updated_by_employee = TimeRecordService._get_employee(
                db,
                payload.updated_by,
            )
            if updated_by_employee is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Updated by employee not found",
                )

        update_data = payload.model_dump(exclude_unset=True)

        allowed_fields = {
            "checkout_location_id",
            "checkout",
            "checkout_lat",
            "checkout_lng",
            "checkout_remark",
            "images_checkout_1",
            "images_checkout_2",
            "updated_by",
        }

        for field, value in update_data.items():
            if field in allowed_fields:
                setattr(time_record, field, value)

        try:
            db.commit()
            db.refresh(time_record)
        except IntegrityError as exc:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid time record update data",
            ) from exc

        return time_record