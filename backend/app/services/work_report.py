from __future__ import annotations

from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.constants import DBConstants
from app.core.error_messages import (
    CREATED_BY_EMPLOYEE_NOT_FOUND_DETAIL,
    INVALID_REFERENCE_DETAIL,
    TIME_RECORD_NOT_FOUND_DETAIL,
    UPDATED_BY_EMPLOYEE_NOT_FOUND_DETAIL,
    WORK_REPORT_ALREADY_EXISTS_DETAIL,
    WORK_REPORT_NOT_FOUND_DETAIL,
    WORK_REPORT_PURPOSE_NOT_FOUND_DETAIL,
)
from app.models.employees import Employees
from app.models.time_record import TimeRecord
from app.models.work_report import WorkReport
from app.models.work_report_purpose import WorkReportPurpose
from app.schemas.work_report import WorkReportCreate, WorkReportUpdate


class WorkReportService:
    @staticmethod
    def _is_deleted_or_inactive(record: Any) -> bool:
        if bool(getattr(record, "mark_flag", False)):
            return True

        if getattr(record, "is_active", True) is False:
            return True

        return False

    @staticmethod
    def _raise_not_found(detail: str) -> None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=detail,
        )

    @staticmethod
    def _get_employee(
        db: Session,
        employee_code: str,
    ) -> Employees | None:
        stmt = select(Employees).where(
            Employees.employee_code == employee_code,
        )
        return db.scalar(stmt)

    @staticmethod
    def _ensure_employee_exists(
        db: Session,
        employee_code: str,
        detail: str,
    ) -> Employees:
        employee = WorkReportService._get_employee(
            db=db,
            employee_code=employee_code,
        )

        if employee is None or WorkReportService._is_deleted_or_inactive(
            employee
        ):
            WorkReportService._raise_not_found(detail)

        return employee

    @staticmethod
    def _get_time_record(
        db: Session,
        time_record_id: int,
    ) -> TimeRecord | None:
        stmt = select(TimeRecord).where(
            TimeRecord.time_record_id == time_record_id,
        )
        return db.scalar(stmt)

    @staticmethod
    def _ensure_time_record_exists(
        db: Session,
        time_record_id: int,
    ) -> TimeRecord:
        time_record = WorkReportService._get_time_record(
            db=db,
            time_record_id=time_record_id,
        )

        if time_record is None:
            WorkReportService._raise_not_found(
                TIME_RECORD_NOT_FOUND_DETAIL
            )

        return time_record

    @staticmethod
    def _get_work_report_purpose(
        db: Session,
        purpose_id: int,
    ) -> WorkReportPurpose | None:
        stmt = select(WorkReportPurpose).where(
            WorkReportPurpose.purpose_id == purpose_id,
        )
        return db.scalar(stmt)

    @staticmethod
    def _ensure_work_report_purpose_exists(
        db: Session,
        purpose_id: int,
    ) -> WorkReportPurpose:
        work_report_purpose = WorkReportService._get_work_report_purpose(
            db=db,
            purpose_id=purpose_id,
        )

        if (
            work_report_purpose is None
            or WorkReportService._is_deleted_or_inactive(
                work_report_purpose
            )
        ):
            WorkReportService._raise_not_found(
                WORK_REPORT_PURPOSE_NOT_FOUND_DETAIL
            )

        return work_report_purpose

    @staticmethod
    def _get_existing_work_report(
        db: Session,
        work_report_id: int,
        include_deleted: bool = False,
        for_update: bool = False,
    ) -> WorkReport:
        stmt = select(WorkReport).where(
            WorkReport.work_report_id == work_report_id,
        )

        if not include_deleted:
            stmt = stmt.where(
                WorkReport.mark_flag.is_(False),
            )

        if for_update:
            stmt = stmt.with_for_update()

        work_report = db.scalar(stmt)

        if work_report is None:
            WorkReportService._raise_not_found(
                WORK_REPORT_NOT_FOUND_DETAIL
            )

        return work_report

    @staticmethod
    def _ensure_time_record_unique(
        db: Session,
        time_record_id: int,
    ) -> None:
        # ตรวจทุกแถว รวมรายการที่ soft delete แล้ว เพราะฐานข้อมูลกำหนด
        # UniqueConstraint ที่ time_record_id โดยตรง
        stmt = select(WorkReport.work_report_id).where(
            WorkReport.time_record_id == time_record_id,
        )

        if db.scalar(stmt) is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=WORK_REPORT_ALREADY_EXISTS_DETAIL,
            )

    @staticmethod
    def _commit_and_refresh(
        db: Session,
        instance: WorkReport,
    ) -> None:
        try:
            db.commit()
            db.refresh(instance)
        except IntegrityError as exc:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=INVALID_REFERENCE_DETAIL,
            ) from exc

    @staticmethod
    def create_work_report(
        db: Session,
        payload: WorkReportCreate,
    ) -> WorkReport:
        create_data = payload.model_dump()

        WorkReportService._ensure_employee_exists(
            db=db,
            employee_code=create_data["created_by"],
            detail=CREATED_BY_EMPLOYEE_NOT_FOUND_DETAIL,
        )

        WorkReportService._ensure_time_record_exists(
            db=db,
            time_record_id=create_data["time_record_id"],
        )

        WorkReportService._ensure_work_report_purpose_exists(
            db=db,
            purpose_id=create_data["purpose_id"],
        )

        WorkReportService._ensure_time_record_unique(
            db=db,
            time_record_id=create_data["time_record_id"],
        )

        work_report = WorkReport(
            **create_data,
            mark_flag=False,
        )

        db.add(work_report)

        WorkReportService._commit_and_refresh(
            db=db,
            instance=work_report,
        )

        return work_report

    @staticmethod
    def get_work_report_by_id(
        db: Session,
        work_report_id: int,
        include_deleted: bool = False,
    ) -> WorkReport:
        return WorkReportService._get_existing_work_report(
            db=db,
            work_report_id=work_report_id,
            include_deleted=include_deleted,
        )

    @staticmethod
    def get_work_report_by_time_record_id(
        db: Session,
        time_record_id: int,
        include_deleted: bool = False,
    ) -> WorkReport:
        stmt = select(WorkReport).where(
            WorkReport.time_record_id == time_record_id,
        )

        if not include_deleted:
            stmt = stmt.where(
                WorkReport.mark_flag.is_(False),
            )

        work_report = db.scalar(stmt)

        if work_report is None:
            WorkReportService._raise_not_found(
                WORK_REPORT_NOT_FOUND_DETAIL
            )

        return work_report

    @staticmethod
    def get_work_reports(
        db: Session,
        skip: int = DBConstants.DEFAULT_PAGE_SKIP,
        limit: int = DBConstants.DEFAULT_PAGE_LIMIT,
        time_record_id: int | None = None,
        purpose_id: int | None = None,
        is_active: bool | None = None,
        include_deleted: bool = False,
    ) -> list[WorkReport]:
        stmt = select(WorkReport)

        if not include_deleted:
            stmt = stmt.where(
                WorkReport.mark_flag.is_(False),
            )

        if time_record_id is not None:
            stmt = stmt.where(
                WorkReport.time_record_id == time_record_id,
            )

        if purpose_id is not None:
            stmt = stmt.where(
                WorkReport.purpose_id == purpose_id,
            )

        if is_active is not None:
            stmt = stmt.where(
                WorkReport.is_active.is_(is_active),
            )

        stmt = (
            stmt.order_by(
                WorkReport.created_at.desc(),
                WorkReport.work_report_id.desc(),
            )
            .offset(skip)
            .limit(limit)
        )

        return list(db.scalars(stmt).all())

    @staticmethod
    def update_work_report(
        db: Session,
        work_report_id: int,
        payload: WorkReportUpdate,
    ) -> WorkReport:
        work_report = WorkReportService._get_existing_work_report(
            db=db,
            work_report_id=work_report_id,
            include_deleted=False,
            for_update=True,
        )

        update_data = payload.model_dump(exclude_unset=True)

        WorkReportService._ensure_employee_exists(
            db=db,
            employee_code=update_data["updated_by"],
            detail=UPDATED_BY_EMPLOYEE_NOT_FOUND_DETAIL,
        )

        new_purpose_id = update_data.get(
            "purpose_id",
            work_report.purpose_id,
        )

        if new_purpose_id != work_report.purpose_id:
            WorkReportService._ensure_work_report_purpose_exists(
                db=db,
                purpose_id=new_purpose_id,
            )

        for field, value in update_data.items():
            setattr(work_report, field, value)

        WorkReportService._commit_and_refresh(
            db=db,
            instance=work_report,
        )

        return work_report

    @staticmethod
    def deactivate_work_report(
        db: Session,
        work_report_id: int,
        updated_by: str,
    ) -> WorkReport:
        work_report = WorkReportService._get_existing_work_report(
            db=db,
            work_report_id=work_report_id,
            include_deleted=False,
            for_update=True,
        )

        WorkReportService._ensure_employee_exists(
            db=db,
            employee_code=updated_by,
            detail=UPDATED_BY_EMPLOYEE_NOT_FOUND_DETAIL,
        )

        work_report.is_active = False
        work_report.updated_by = updated_by

        WorkReportService._commit_and_refresh(
            db=db,
            instance=work_report,
        )

        return work_report

    @staticmethod
    def activate_work_report(
        db: Session,
        work_report_id: int,
        updated_by: str,
    ) -> WorkReport:
        work_report = WorkReportService._get_existing_work_report(
            db=db,
            work_report_id=work_report_id,
            include_deleted=False,
            for_update=True,
        )

        WorkReportService._ensure_employee_exists(
            db=db,
            employee_code=updated_by,
            detail=UPDATED_BY_EMPLOYEE_NOT_FOUND_DETAIL,
        )

        work_report.is_active = True
        work_report.updated_by = updated_by

        WorkReportService._commit_and_refresh(
            db=db,
            instance=work_report,
        )

        return work_report

    @staticmethod
    def delete_work_report(
        db: Session,
        work_report_id: int,
        updated_by: str,
    ) -> WorkReport:
        work_report = WorkReportService._get_existing_work_report(
            db=db,
            work_report_id=work_report_id,
            include_deleted=False,
            for_update=True,
        )

        WorkReportService._ensure_employee_exists(
            db=db,
            employee_code=updated_by,
            detail=UPDATED_BY_EMPLOYEE_NOT_FOUND_DETAIL,
        )

        work_report.mark_flag = True
        work_report.is_active = False
        work_report.updated_by = updated_by

        WorkReportService._commit_and_refresh(
            db=db,
            instance=work_report,
        )

        return work_report