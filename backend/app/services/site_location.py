from __future__ import annotations

from fastapi import HTTPException, status
from fastapi.encoders import jsonable_encoder
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.constants import DBConstants
from app.models.employees import Employees
from app.models.site_location import SiteLocation
from app.schemas.site_location import (
    SiteLocationBase,
    SiteLocationCreate,
    SiteLocationUpdate,
)

SITE_LOCATION_NOT_FOUND_DETAIL = "Site location not found"
EMPLOYEE_NOT_FOUND_DETAIL = "Employee not found"
INVALID_REFERENCE_DETAIL = "Invalid reference data"


class SiteLocationService:
    @staticmethod
    def _commit_and_refresh(db: Session, instance: SiteLocation) -> None:
        """Helper method สำหรับจัดการ commit, refresh และ rollback"""
        try:
            db.commit()
            db.refresh(instance)
        except IntegrityError as e:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=INVALID_REFERENCE_DETAIL,
            ) from e

    @staticmethod
    def _get_employee_by_code(
        db: Session,
        employee_code: str,
    ) -> Employees | None:
        stmt = select(Employees).where(Employees.employee_code == employee_code)
        return db.scalar(stmt)

    @staticmethod
    def _validate_employee_reference(
        db: Session,
        employee_code: str,
    ) -> None:
        employee = SiteLocationService._get_employee_by_code(db, employee_code)
        if employee is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=EMPLOYEE_NOT_FOUND_DETAIL,
            )

    @staticmethod
    def create_site_location(
        db: Session,
        payload: SiteLocationCreate,
    ) -> SiteLocation:
        data = payload.model_dump()

        data["location_name"] = data["location_name"].strip()
        data["created_by"] = data["created_by"].strip()

        if data.get("location_detail") is not None:
            data["location_detail"] = data["location_detail"].strip()

        SiteLocationService._validate_employee_reference(db, data["created_by"])

        site_location = SiteLocation(**data)

        if site_location.mark_flag is None:
            site_location.mark_flag = False

        db.add(site_location)
        SiteLocationService._commit_and_refresh(db, site_location)

        return site_location

    @staticmethod
    def get_site_location_by_id(
        db: Session,
        location_id: int,
        include_deleted: bool = False,
    ) -> SiteLocation | None:
        stmt = select(SiteLocation).where(SiteLocation.location_id == location_id)

        if not include_deleted:
            stmt = stmt.where(SiteLocation.mark_flag.is_(False))

        return db.scalar(stmt)

    @staticmethod
    def get_site_locations(
        db: Session,
        skip: int = DBConstants.DEFAULT_PAGE_SKIP,
        limit: int = DBConstants.DEFAULT_PAGE_LIMIT,
        is_active: bool | None = None,
        location_name: str | None = None,
        include_deleted: bool = False,
    ) -> list[SiteLocation]:
        stmt = select(SiteLocation)

        if not include_deleted:
            stmt = stmt.where(SiteLocation.mark_flag.is_(False))

        if is_active is not None:
            stmt = stmt.where(SiteLocation.is_active == is_active)

        clean_location_name = location_name.strip() if location_name is not None else None
        if clean_location_name:
            stmt = stmt.where(SiteLocation.location_name.contains(clean_location_name))

        stmt = stmt.order_by(SiteLocation.location_id.asc()).offset(skip).limit(limit)
        return list(db.scalars(stmt).all())

    @staticmethod
    def update_site_location(
        db: Session,
        location_id: int,
        payload: SiteLocationUpdate,
    ) -> SiteLocation | None:
        site_location = SiteLocationService.get_site_location_by_id(
            db=db,
            location_id=location_id,
            include_deleted=False,
        )
        if site_location is None:
            return None

        update_data = payload.model_dump(exclude_unset=True)

        if "location_name" in update_data and update_data["location_name"] is not None:
            update_data["location_name"] = update_data["location_name"].strip()

        if "location_detail" in update_data and update_data["location_detail"] is not None:
            update_data["location_detail"] = update_data["location_detail"].strip()

        if "updated_by" in update_data and update_data["updated_by"] is not None:
            update_data["updated_by"] = update_data["updated_by"].strip()
            SiteLocationService._validate_employee_reference(db, update_data["updated_by"])

        validation_data = {
            "location_name": update_data.get("location_name", site_location.location_name),
            "latitude": update_data.get("latitude", site_location.latitude),
            "longitude": update_data.get("longitude", site_location.longitude),
            "radius_meter": update_data.get("radius_meter", site_location.radius_meter),
            "grace_meter": update_data.get("grace_meter", site_location.grace_meter),
            "location_detail": update_data.get("location_detail", site_location.location_detail),
            "is_active": update_data.get("is_active", site_location.is_active),
        }

        try:
            SiteLocationBase(**validation_data)
        except ValidationError as e:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=jsonable_encoder(e.errors()),
            ) from e

        for field, value in update_data.items():
            setattr(site_location, field, value)

        SiteLocationService._commit_and_refresh(db, site_location)

        return site_location

    @staticmethod
    def deactivate_site_location(
        db: Session,
        location_id: int,
        updated_by: str,
    ) -> SiteLocation | None:
        site_location = SiteLocationService.get_site_location_by_id(
            db=db,
            location_id=location_id,
            include_deleted=False,
        )
        if site_location is None:
            return None

        updated_by = updated_by.strip()
        SiteLocationService._validate_employee_reference(db, updated_by)

        site_location.is_active = False
        site_location.updated_by = updated_by

        SiteLocationService._commit_and_refresh(db, site_location)

        return site_location

    @staticmethod
    def activate_site_location(
        db: Session,
        location_id: int,
        updated_by: str,
    ) -> SiteLocation | None:
        site_location = SiteLocationService.get_site_location_by_id(
            db=db,
            location_id=location_id,
            include_deleted=False,
        )
        if site_location is None:
            return None

        updated_by = updated_by.strip()
        SiteLocationService._validate_employee_reference(db, updated_by)

        site_location.is_active = True
        site_location.updated_by = updated_by

        SiteLocationService._commit_and_refresh(db, site_location)

        return site_location

    @staticmethod
    def delete_site_location(
        db: Session,
        location_id: int,
        updated_by: str,
    ) -> SiteLocation | None:
        site_location = SiteLocationService.get_site_location_by_id(
            db=db,
            location_id=location_id,
            include_deleted=False,
        )
        if site_location is None:
            return None

        updated_by = updated_by.strip()
        SiteLocationService._validate_employee_reference(db, updated_by)

        site_location.mark_flag = True
        site_location.is_active = False
        site_location.updated_by = updated_by

        SiteLocationService._commit_and_refresh(db, site_location)

        return site_location