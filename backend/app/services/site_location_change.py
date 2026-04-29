from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.constants import DBConstants
from app.models.employees import Employees
from app.models.site_location import SiteLocation
from app.models.site_location_change import SiteLocationChange
from app.schemas.site_location_change import (
    SiteLocationChangeCreate,
    SiteLocationChangeUpdate,
)

SITE_LOCATION_CHANGE_NOT_FOUND_DETAIL = "Site location change not found"
EMPLOYEE_NOT_FOUND_DETAIL = "Employee not found"
SITE_LOCATION_NOT_FOUND_DETAIL = "Site location not found"
INVALID_REFERENCE_DETAIL = "Invalid reference data"


class SiteLocationChangeService:
    @staticmethod
    def _get_employee_by_code(
        db: Session,
        employee_code: str,
    ) -> Employees | None:
        stmt = select(Employees).where(Employees.employee_code == employee_code)
        return db.scalar(stmt)

    @staticmethod
    def _get_site_location_by_id(
        db: Session,
        location_id: int,
    ) -> SiteLocation | None:
        stmt = select(SiteLocation).where(SiteLocation.location_id == location_id)
        return db.scalar(stmt)

    @staticmethod
    def _validate_references(
        db: Session,
        employee_code: str,
        location_id: int,
    ) -> None:
        employee = SiteLocationChangeService._get_employee_by_code(db, employee_code)
        if employee is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=EMPLOYEE_NOT_FOUND_DETAIL,
            )

        site_location = SiteLocationChangeService._get_site_location_by_id(
            db,
            location_id,
        )
        if site_location is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=SITE_LOCATION_NOT_FOUND_DETAIL,
            )

    @staticmethod
    def create_site_location_change(
        db: Session,
        payload: SiteLocationChangeCreate,
    ) -> SiteLocationChange:
        employee_code = payload.employee_code.strip()
        user_name = payload.user_name.strip()
        action = payload.action.strip()

        SiteLocationChangeService._validate_references(
            db=db,
            employee_code=employee_code,
            location_id=payload.location_id,
        )

        site_location_change = SiteLocationChange(
            employee_code=employee_code,
            location_id=payload.location_id,
            user_name=user_name,
            action=action,
        )

        try:
            db.add(site_location_change)
            db.commit()
            db.refresh(site_location_change)
        except IntegrityError:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=INVALID_REFERENCE_DETAIL,
            )

        return site_location_change

    @staticmethod
    def get_site_location_change_by_id(
        db: Session,
        location_log_id: int,
    ) -> SiteLocationChange | None:
        stmt = select(SiteLocationChange).where(
            SiteLocationChange.location_log_id == location_log_id,
        )
        return db.scalar(stmt)

    @staticmethod
    def get_site_location_changes(
        db: Session,
        skip: int = 0,
        limit: int = DBConstants.DEFAULT_PAGE_LIMIT,
        employee_code: str | None = None,
        location_id: int | None = None,
    ) -> list[SiteLocationChange]:
        stmt = select(SiteLocationChange)

        clean_employee_code = employee_code.strip() if employee_code is not None else None
        if clean_employee_code:
            stmt = stmt.where(SiteLocationChange.employee_code == clean_employee_code)

        if location_id is not None:
            stmt = stmt.where(SiteLocationChange.location_id == location_id)

        stmt = (
            stmt.order_by(
                SiteLocationChange.updated_at.desc(),
                SiteLocationChange.location_log_id.desc(),
            )
            .offset(skip)
            .limit(limit)
        )

        return list(db.scalars(stmt).all())

    @staticmethod
    def update_site_location_change(
        db: Session,
        location_log_id: int,
        payload: SiteLocationChangeUpdate,
    ) -> SiteLocationChange | None:
        site_location_change = SiteLocationChangeService.get_site_location_change_by_id(
            db,
            location_log_id,
        )
        if site_location_change is None:
            return None

        update_data = payload.model_dump(exclude_unset=True)

        if "employee_code" in update_data and update_data["employee_code"] is not None:
            update_data["employee_code"] = update_data["employee_code"].strip()

        if "user_name" in update_data and update_data["user_name"] is not None:
            update_data["user_name"] = update_data["user_name"].strip()

        if "action" in update_data and update_data["action"] is not None:
            update_data["action"] = update_data["action"].strip()

        next_employee_code = update_data.get(
            "employee_code",
            site_location_change.employee_code,
        )
        next_location_id = update_data.get(
            "location_id",
            site_location_change.location_id,
        )

        SiteLocationChangeService._validate_references(
            db=db,
            employee_code=next_employee_code,
            location_id=next_location_id,
        )

        for field, value in update_data.items():
            setattr(site_location_change, field, value)

        try:
            db.commit()
            db.refresh(site_location_change)
        except IntegrityError:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=INVALID_REFERENCE_DETAIL,
            )

        return site_location_change