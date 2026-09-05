from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import exists, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.constants import DBConstants
from app.core.error_messages import (
    DIVISION_NOT_FOUND_DETAIL,
    DUPLICATE_ROUTE_LOCATION_UPDATE_SETTING_DETAIL,
    EMPLOYEE_NOT_FOUND_DETAIL,
    INVALID_EFFECTIVE_DATE_DETAIL,
    INVALID_REFERENCE_DETAIL,
    ROUTE_LOCATION_UPDATE_SETTING_NOT_FOUND_DETAIL,
    ROUTE_NOT_FOUND_DETAIL,
)
from app.models.departments import Department
from app.models.divisions import Divisions
from app.models.employees import Employees
from app.models.route import Route
from app.models.route_location_update_setting import RouteLocationUpdateSetting
from app.schemas.route_location_update_setting import (
    RouteLocationUpdateSettingCreate,
    RouteLocationUpdateSettingUpdate,
)


class RouteLocationUpdateSettingService:
    @staticmethod
    def _get_thai_date() -> date:
        return datetime.now(timezone(timedelta(hours=7))).date()

    @staticmethod
    def _ensure_exists(
        db: Session,
        column: Any,
        value: Any,
        error_detail: str,
    ) -> None:
        stmt = select(exists().where(column == value))

        if not db.scalar(stmt):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=error_detail,
            )

    @staticmethod
    def _validate_employee_exists(
        db: Session,
        employee_code: str,
    ) -> None:
        RouteLocationUpdateSettingService._ensure_exists(
            db=db,
            column=Employees.employee_code,
            value=employee_code,
            error_detail=EMPLOYEE_NOT_FOUND_DETAIL,
        )

    @staticmethod
    def _validate_scope_exists(
        db: Session,
        department_id: int,
        division_id: int,
        route_id: int,
    ) -> None:
        references = (
            (Department.department_id, department_id, INVALID_REFERENCE_DETAIL),
            (Divisions.division_id, division_id, DIVISION_NOT_FOUND_DETAIL),
            (Route.route_id, route_id, ROUTE_NOT_FOUND_DETAIL),
        )

        for column, value, error_detail in references:
            RouteLocationUpdateSettingService._ensure_exists(
                db=db,
                column=column,
                value=value,
                error_detail=error_detail,
            )

    @staticmethod
    def _validate_effective_dates(
        effective_from: date | None,
        effective_to: date | None,
    ) -> None:
        if (
            effective_from is not None
            and effective_to is not None
            and effective_to < effective_from
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=INVALID_EFFECTIVE_DATE_DETAIL,
            )

    @staticmethod
    def _validate_not_null_fields(update_data: dict[str, Any]) -> None:
        not_null_fields = (
            "department_id",
            "division_id",
            "route_id",
            "allow_location_update",
            "is_active",
            "mark_flag",
        )

        if any(
            field in update_data and update_data[field] is None
            for field in not_null_fields
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=INVALID_REFERENCE_DETAIL,
            )

    @staticmethod
    def _validate_no_duplicate_setting(
        db: Session,
        department_id: int,
        division_id: int,
        route_id: int,
        exclude_id: int | None = None,
    ) -> None:
        # UNIQUE ของตารางครอบคลุมทั้งรายการที่ใช้งาน ปิดใช้งาน และ soft delete
        conditions = [
            RouteLocationUpdateSetting.department_id == department_id,
            RouteLocationUpdateSetting.division_id == division_id,
            RouteLocationUpdateSetting.route_id == route_id,
        ]

        if exclude_id is not None:
            conditions.append(RouteLocationUpdateSetting.id != exclude_id)

        stmt = select(exists().where(*conditions))

        if db.scalar(stmt):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=DUPLICATE_ROUTE_LOCATION_UPDATE_SETTING_DETAIL,
            )

    @staticmethod
    def _apply_effective_date_filter(stmt: Any, work_date: date) -> Any:
        # NULL หมายถึงไม่จำกัดขอบเขตด้านนั้น และนับรวมวันเริ่มกับวันสิ้นสุด
        return stmt.where(
            or_(
                RouteLocationUpdateSetting.effective_from.is_(None),
                RouteLocationUpdateSetting.effective_from <= work_date,
            ),
            or_(
                RouteLocationUpdateSetting.effective_to.is_(None),
                RouteLocationUpdateSetting.effective_to >= work_date,
            ),
        )

    @staticmethod
    def _commit(
        db: Session,
        setting: RouteLocationUpdateSetting | None = None,
    ) -> None:
        try:
            db.commit()

            if setting is not None:
                db.refresh(setting)
        except IntegrityError as exc:
            db.rollback()

            # รองรับ duplicate key ที่เกิดจากคำขอพร้อมกันใน MySQL
            error_code = getattr(exc.orig, "errno", None)
            if error_code is None:
                args = getattr(exc.orig, "args", ())
                error_code = args[0] if args else None

            if error_code == 1062:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=DUPLICATE_ROUTE_LOCATION_UPDATE_SETTING_DETAIL,
                ) from exc

            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=INVALID_REFERENCE_DETAIL,
            ) from exc

    @staticmethod
    def get_route_location_update_setting(
        db: Session,
        setting_id: int,
        include_deleted: bool = False,
    ) -> RouteLocationUpdateSetting:
        stmt = select(RouteLocationUpdateSetting).where(
            RouteLocationUpdateSetting.id == setting_id
        )

        if not include_deleted:
            stmt = stmt.where(RouteLocationUpdateSetting.mark_flag.is_(False))

        setting = db.scalar(stmt)

        if setting is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=ROUTE_LOCATION_UPDATE_SETTING_NOT_FOUND_DETAIL,
            )

        return setting

    @staticmethod
    def get_route_location_update_settings(
        db: Session,
        skip: int = DBConstants.DEFAULT_PAGE_SKIP,
        limit: int = DBConstants.DEFAULT_PAGE_LIMIT,
        department_id: int | None = None,
        division_id: int | None = None,
        route_id: int | None = None,
        allow_location_update: bool | None = None,
        is_active: bool | None = None,
        include_deleted: bool = False,
        only_effective: bool = False,
        work_date: date | None = None,
    ) -> list[RouteLocationUpdateSetting]:
        stmt = select(RouteLocationUpdateSetting)

        if not include_deleted:
            stmt = stmt.where(RouteLocationUpdateSetting.mark_flag.is_(False))

        for column, value in (
            (RouteLocationUpdateSetting.department_id, department_id),
            (RouteLocationUpdateSetting.division_id, division_id),
            (RouteLocationUpdateSetting.route_id, route_id),
        ):
            if value is not None:
                stmt = stmt.where(column == value)

        if allow_location_update is not None:
            stmt = stmt.where(
                RouteLocationUpdateSetting.allow_location_update.is_(allow_location_update)
            )

        if is_active is not None:
            stmt = stmt.where(RouteLocationUpdateSetting.is_active.is_(is_active))

        if only_effective:
            stmt = RouteLocationUpdateSettingService._apply_effective_date_filter(
                stmt=stmt,
                work_date=work_date or RouteLocationUpdateSettingService._get_thai_date(),
            )

        stmt = (
            stmt.order_by(
                RouteLocationUpdateSetting.department_id.asc(),
                RouteLocationUpdateSetting.division_id.asc(),
                RouteLocationUpdateSetting.route_id.asc(),
                RouteLocationUpdateSetting.id.desc(),
            )
            .offset(skip)
            .limit(limit)
        )

        return list(db.scalars(stmt).all())

    @staticmethod
    def get_allowed_route_location_update_setting(
        db: Session,
        department_id: int,
        division_id: int,
        route_id: int,
    ) -> RouteLocationUpdateSetting | None:
        """คืน Setting ที่อนุญาตวันนี้ตามเวลาไทย หรือ None เมื่อไม่อนุญาต.

        ตรวจเฉพาะ Setting; ผู้เรียกต้องตรวจสิทธิ์พนักงานต่อหน่วยงาน/งานที่เลือก
        และหา scope จากข้อมูลฝั่ง Backend ก่อนเรียก ห้ามเชื่อ scope จาก Frontend.
        ก่อนบันทึกพิกัด/รัศมีต้องเรียกตรวจซ้ำ ไม่ใช้ผลตรวจเก่าจากหน้า Modal.
        """
        stmt = select(RouteLocationUpdateSetting).where(
            RouteLocationUpdateSetting.department_id == department_id,
            RouteLocationUpdateSetting.division_id == division_id,
            RouteLocationUpdateSetting.route_id == route_id,
            RouteLocationUpdateSetting.allow_location_update.is_(True),
            RouteLocationUpdateSetting.is_active.is_(True),
            RouteLocationUpdateSetting.mark_flag.is_(False),
        )
        stmt = RouteLocationUpdateSettingService._apply_effective_date_filter(
            stmt=stmt,
            work_date=RouteLocationUpdateSettingService._get_thai_date(),
        )

        return db.scalar(stmt)

    @staticmethod
    def create_route_location_update_setting(
        db: Session,
        payload: RouteLocationUpdateSettingCreate,
    ) -> RouteLocationUpdateSetting:
        RouteLocationUpdateSettingService._validate_employee_exists(
            db=db,
            employee_code=payload.created_by,
        )
        RouteLocationUpdateSettingService._validate_scope_exists(
            db=db,
            department_id=payload.department_id,
            division_id=payload.division_id,
            route_id=payload.route_id,
        )
        RouteLocationUpdateSettingService._validate_effective_dates(
            effective_from=payload.effective_from,
            effective_to=payload.effective_to,
        )
        RouteLocationUpdateSettingService._validate_no_duplicate_setting(
            db=db,
            department_id=payload.department_id,
            division_id=payload.division_id,
            route_id=payload.route_id,
        )

        setting = RouteLocationUpdateSetting(**payload.model_dump())
        db.add(setting)
        RouteLocationUpdateSettingService._commit(db=db, setting=setting)

        return setting

    @staticmethod
    def update_route_location_update_setting(
        db: Session,
        setting_id: int,
        payload: RouteLocationUpdateSettingUpdate,
    ) -> RouteLocationUpdateSetting:
        RouteLocationUpdateSettingService._validate_employee_exists(
            db=db,
            employee_code=payload.updated_by,
        )
        setting = RouteLocationUpdateSettingService.get_route_location_update_setting(
            db=db,
            setting_id=setting_id,
        )
        update_data = payload.model_dump(
            exclude_unset=True,
            exclude={"updated_by"},
        )
        RouteLocationUpdateSettingService._validate_not_null_fields(update_data)

        new_department_id = update_data.get("department_id", setting.department_id)
        new_division_id = update_data.get("division_id", setting.division_id)
        new_route_id = update_data.get("route_id", setting.route_id)
        new_effective_from = update_data.get("effective_from", setting.effective_from)
        new_effective_to = update_data.get("effective_to", setting.effective_to)

        RouteLocationUpdateSettingService._validate_scope_exists(
            db=db,
            department_id=new_department_id,
            division_id=new_division_id,
            route_id=new_route_id,
        )
        RouteLocationUpdateSettingService._validate_effective_dates(
            effective_from=new_effective_from,
            effective_to=new_effective_to,
        )
        RouteLocationUpdateSettingService._validate_no_duplicate_setting(
            db=db,
            department_id=new_department_id,
            division_id=new_division_id,
            route_id=new_route_id,
            exclude_id=setting_id,
        )

        # ตรวจข้อมูลทั้งหมดก่อนเปลี่ยน ORM object
        for field, value in update_data.items():
            setattr(setting, field, value)

        setting.updated_by = payload.updated_by
        RouteLocationUpdateSettingService._commit(db=db, setting=setting)

        return setting

    @staticmethod
    def delete_route_location_update_setting(
        db: Session,
        setting_id: int,
        updated_by: str,
    ) -> None:
        RouteLocationUpdateSettingService._validate_employee_exists(
            db=db,
            employee_code=updated_by,
        )
        setting = RouteLocationUpdateSettingService.get_route_location_update_setting(
            db=db,
            setting_id=setting_id,
        )

        setting.updated_by = updated_by
        setting.mark_flag = True
        RouteLocationUpdateSettingService._commit(db=db)

    @staticmethod
    def deactivate_route_location_update_setting(
        db: Session,
        setting_id: int,
        updated_by: str,
    ) -> RouteLocationUpdateSetting:
        RouteLocationUpdateSettingService._validate_employee_exists(
            db=db,
            employee_code=updated_by,
        )
        setting = RouteLocationUpdateSettingService.get_route_location_update_setting(
            db=db,
            setting_id=setting_id,
        )

        if setting.is_active is False:
            return setting

        setting.updated_by = updated_by
        setting.is_active = False
        RouteLocationUpdateSettingService._commit(db=db, setting=setting)

        return setting

    @staticmethod
    def activate_route_location_update_setting(
        db: Session,
        setting_id: int,
        updated_by: str,
    ) -> RouteLocationUpdateSetting:
        RouteLocationUpdateSettingService._validate_employee_exists(
            db=db,
            employee_code=updated_by,
        )
        setting = RouteLocationUpdateSettingService.get_route_location_update_setting(
            db=db,
            setting_id=setting_id,
        )

        if setting.is_active is True:
            return setting

        setting.updated_by = updated_by
        setting.is_active = True
        RouteLocationUpdateSettingService._commit(db=db, setting=setting)

        return setting