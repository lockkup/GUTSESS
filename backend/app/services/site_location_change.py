from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy import exists, select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.constants import DBConstants
from app.core.error_messages import (
    DATABASE_ERROR_DETAIL,
    EMPLOYEE_NOT_FOUND_DETAIL,
    INVALID_REFERENCE_DETAIL,
    SITE_LOCATION_CHANGE_NOT_FOUND_DETAIL,
    SITE_LOCATION_NOT_FOUND_DETAIL,
)
from app.models.employees import Employees
from app.models.site_location import SiteLocation
from app.models.site_location_change import SiteLocationChange
from app.schemas.site_location_change import SiteLocationChangeCreate


class SiteLocationChangeService:
    @staticmethod
    def _get_employee_or_404(
        db: Session,
        employee_code: str,
    ) -> Employees:
        normalized_employee_code = employee_code.strip()

        stmt = select(Employees).where(
            Employees.employee_code == normalized_employee_code,
        )

        employee = db.scalar(stmt)

        if employee is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=EMPLOYEE_NOT_FOUND_DETAIL,
            )

        return employee

    @staticmethod
    def _ensure_site_location_exists(
        db: Session,
        location_id: int,
    ) -> None:
        stmt = select(
            exists().where(
                SiteLocation.location_id == location_id,
            ),
        )

        if not db.scalar(stmt):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=SITE_LOCATION_NOT_FOUND_DETAIL,
            )

    @staticmethod
    def _build_user_name(employee: Employees) -> str:
        user_name = getattr(employee, "user_name", None)

        if isinstance(user_name, str) and user_name.strip():
            return user_name.strip()

        first_name = getattr(employee, "first_name", "") or ""
        last_name = getattr(employee, "last_name", "") or ""

        full_name = f"{first_name} {last_name}".strip()

        if full_name:
            return full_name

        return employee.employee_code

    @staticmethod
    def create_site_location_change(
        db: Session,
        payload: SiteLocationChangeCreate,
        *,
        commit: bool = True,
    ) -> SiteLocationChange:
        """
        ใช้สำหรับให้ service อื่นเรียกสร้างประวัติเท่านั้น
        ไม่ควรเปิดเป็น public POST endpoint จาก frontend โดยตรง

        ถ้าต้องการให้ site_location และ site_location_change อยู่ใน transaction เดียวกัน
        ให้ service หลักเรียกด้วย commit=False แล้ว commit ที่ service หลัก
        """

        normalized_employee_code = payload.employee_code.strip()

        employee = SiteLocationChangeService._get_employee_or_404(
            db=db,
            employee_code=normalized_employee_code,
        )

        SiteLocationChangeService._ensure_site_location_exists(
            db=db,
            location_id=payload.location_id,
        )

        site_location_change = SiteLocationChange(
            employee_code=normalized_employee_code,
            location_id=payload.location_id,
            user_name=SiteLocationChangeService._build_user_name(employee),
            action=payload.action.value,
        )

        try:
            db.add(site_location_change)

            if commit:
                db.commit()
                db.refresh(site_location_change)
            else:
                db.flush()
        except IntegrityError as exc:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=INVALID_REFERENCE_DETAIL,
            ) from exc
        except SQLAlchemyError as exc:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=DATABASE_ERROR_DETAIL,
            ) from exc

        return site_location_change

    @staticmethod
    def get_site_location_change_by_id(
        db: Session,
        location_log_id: int,
    ) -> SiteLocationChange:
        stmt = select(SiteLocationChange).where(
            SiteLocationChange.location_log_id == location_log_id,
        )

        site_location_change = db.scalar(stmt)

        if site_location_change is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=SITE_LOCATION_CHANGE_NOT_FOUND_DETAIL,
            )

        return site_location_change

    @staticmethod
    def get_site_location_changes(
        db: Session,
        skip: int = DBConstants.DEFAULT_PAGE_SKIP,
        limit: int = DBConstants.DEFAULT_PAGE_LIMIT,
        employee_code: str | None = None,
        location_id: int | None = None,
    ) -> list[SiteLocationChange]:
        stmt = select(SiteLocationChange)

        clean_employee_code = (
            employee_code.strip()
            if employee_code is not None
            else None
        )

        if clean_employee_code:
            stmt = stmt.where(
                SiteLocationChange.employee_code == clean_employee_code,
            )

        if location_id is not None:
            stmt = stmt.where(
                SiteLocationChange.location_id == location_id,
            )

        stmt = (
            stmt.order_by(
                SiteLocationChange.created_at.desc(),
                SiteLocationChange.location_log_id.desc(),
            )
            .offset(skip)
            .limit(limit)
        )

        return list(db.scalars(stmt).all())