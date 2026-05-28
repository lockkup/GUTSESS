from __future__ import annotations

from datetime import date
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import exists, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.constants import DBConstants
from app.core.error_messages import (
    CONTRACT_CODE_ALREADY_EXISTS_DETAIL,
    EMPLOYEE_NOT_FOUND_DETAIL,
    INVALID_EFFECTIVE_DATE_DETAIL,
    INVALID_REFERENCE_DETAIL,
    SITE_LOCATION_NOT_FOUND_DETAIL,
)
from app.models.employees import Employees
from app.models.site_location import SiteLocation
from app.schemas.site_location import (
    SiteLocationCreate,
    SiteLocationUpdate,
)


class SiteLocationService:
    @staticmethod
    def _commit(
        db: Session,
        site_location: SiteLocation | None = None,
    ) -> None:
        try:
            db.commit()

            if site_location is not None:
                db.refresh(site_location)

        except IntegrityError as exc:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=INVALID_REFERENCE_DETAIL,
            ) from exc

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
        SiteLocationService._ensure_exists(
            db=db,
            column=Employees.employee_code,
            value=employee_code,
            error_detail=EMPLOYEE_NOT_FOUND_DETAIL,
        )

    @staticmethod
    def _validate_effective_dates(
        effective_from: date,
        effective_to: date | None,
    ) -> None:
        if effective_to is not None and effective_to < effective_from:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=INVALID_EFFECTIVE_DATE_DETAIL,
            )

    @staticmethod
    def _ensure_contract_code_unique(
        db: Session,
        contract_code: str,
        exclude_location_id: int | None = None,
    ) -> None:
        conditions = [
            SiteLocation.contract_code == contract_code,
            SiteLocation.mark_flag.is_(False),
        ]

        if exclude_location_id is not None:
            conditions.append(SiteLocation.location_id != exclude_location_id)

        stmt = select(exists().where(*conditions))

        if db.scalar(stmt):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=CONTRACT_CODE_ALREADY_EXISTS_DETAIL,
            )

    @staticmethod
    def _get_existing_site_location(
        db: Session,
        location_id: int,
        include_deleted: bool = False,
    ) -> SiteLocation:
        stmt = select(SiteLocation).where(
            SiteLocation.location_id == location_id,
        )

        if not include_deleted:
            stmt = stmt.where(SiteLocation.mark_flag.is_(False))

        site_location = db.scalar(stmt)

        if site_location is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=SITE_LOCATION_NOT_FOUND_DETAIL,
            )

        return site_location

    @staticmethod
    def create_site_location(
        db: Session,
        payload: SiteLocationCreate,
    ) -> SiteLocation:
        data = payload.model_dump()

        SiteLocationService._validate_employee_exists(
            db=db,
            employee_code=data["created_by"],
        )

        SiteLocationService._ensure_contract_code_unique(
            db=db,
            contract_code=data["contract_code"],
        )

        SiteLocationService._validate_effective_dates(
            effective_from=data["effective_from"],
            effective_to=data["effective_to"],
        )

        site_location = SiteLocation(
            **data,
            mark_flag=False,
        )

        db.add(site_location)

        SiteLocationService._commit(
            db=db,
            site_location=site_location,
        )

        return site_location

    @staticmethod
    def get_site_location_by_id(
        db: Session,
        location_id: int,
        include_deleted: bool = False,
    ) -> SiteLocation:
        return SiteLocationService._get_existing_site_location(
            db=db,
            location_id=location_id,
            include_deleted=include_deleted,
        )

    @staticmethod
    def get_site_locations(
        db: Session,
        skip: int = DBConstants.DEFAULT_PAGE_SKIP,
        limit: int = DBConstants.DEFAULT_PAGE_LIMIT,
        is_active: bool | None = None,
        contract_code: str | None = None,
        location_name: str | None = None,
        by_contract: int | None = None,
        effective_from: date | None = None,
        effective_to: date | None = None,
        include_deleted: bool = False,
    ) -> list[SiteLocation]:
        if effective_from is not None and effective_to is not None:
            SiteLocationService._validate_effective_dates(
                effective_from=effective_from,
                effective_to=effective_to,
            )

        stmt = select(SiteLocation)

        if not include_deleted:
            stmt = stmt.where(SiteLocation.mark_flag.is_(False))

        if is_active is not None:
            stmt = stmt.where(SiteLocation.is_active.is_(is_active))

        clean_contract_code = (
            contract_code.strip() if contract_code is not None else None
        )
        if clean_contract_code:
            stmt = stmt.where(SiteLocation.contract_code == clean_contract_code)

        clean_location_name = (
            location_name.strip() if location_name is not None else None
        )
        if clean_location_name:
            stmt = stmt.where(SiteLocation.location_name.contains(clean_location_name))

        if by_contract is not None:
            stmt = stmt.where(SiteLocation.by_contract == by_contract)

        if effective_from is not None:
            stmt = stmt.where(
                or_(
                    SiteLocation.effective_to.is_(None),
                    SiteLocation.effective_to >= effective_from,
                )
            )

        if effective_to is not None:
            stmt = stmt.where(SiteLocation.effective_from <= effective_to)

        stmt = (
            stmt.order_by(
                SiteLocation.location_id.asc(),
            )
            .offset(skip)
            .limit(limit)
        )

        return list(db.scalars(stmt).all())

    @staticmethod
    def update_site_location(
        db: Session,
        location_id: int,
        payload: SiteLocationUpdate,
    ) -> SiteLocation:
        site_location = SiteLocationService._get_existing_site_location(
            db=db,
            location_id=location_id,
            include_deleted=False,
        )

        update_data = payload.model_dump(exclude_unset=True)
        updated_by = update_data.pop("updated_by")

        SiteLocationService._validate_employee_exists(
            db=db,
            employee_code=updated_by,
        )

        new_contract_code = update_data.get(
            "contract_code",
            site_location.contract_code,
        )
        new_effective_from = update_data.get(
            "effective_from",
            site_location.effective_from,
        )
        new_effective_to = update_data.get(
            "effective_to",
            site_location.effective_to,
        )

        if new_contract_code != site_location.contract_code:
            SiteLocationService._ensure_contract_code_unique(
                db=db,
                contract_code=new_contract_code,
                exclude_location_id=location_id,
            )

        SiteLocationService._validate_effective_dates(
            effective_from=new_effective_from,
            effective_to=new_effective_to,
        )

        for field, value in update_data.items():
            setattr(site_location, field, value)

        site_location.updated_by = updated_by

        SiteLocationService._commit(
            db=db,
            site_location=site_location,
        )

        return site_location

    @staticmethod
    def deactivate_site_location(
        db: Session,
        location_id: int,
        updated_by: str,
    ) -> SiteLocation:
        SiteLocationService._validate_employee_exists(
            db=db,
            employee_code=updated_by,
        )

        site_location = SiteLocationService._get_existing_site_location(
            db=db,
            location_id=location_id,
            include_deleted=False,
        )

        site_location.is_active = False
        site_location.updated_by = updated_by

        SiteLocationService._commit(
            db=db,
            site_location=site_location,
        )

        return site_location

    @staticmethod
    def activate_site_location(
        db: Session,
        location_id: int,
        updated_by: str,
    ) -> SiteLocation:
        SiteLocationService._validate_employee_exists(
            db=db,
            employee_code=updated_by,
        )

        site_location = SiteLocationService._get_existing_site_location(
            db=db,
            location_id=location_id,
            include_deleted=False,
        )

        site_location.is_active = True
        site_location.updated_by = updated_by

        SiteLocationService._commit(
            db=db,
            site_location=site_location,
        )

        return site_location

    @staticmethod
    def delete_site_location(
        db: Session,
        location_id: int,
        updated_by: str,
    ) -> None:
        SiteLocationService._validate_employee_exists(
            db=db,
            employee_code=updated_by,
        )

        site_location = SiteLocationService._get_existing_site_location(
            db=db,
            location_id=location_id,
            include_deleted=False,
        )

        site_location.mark_flag = True
        site_location.is_active = False
        site_location.updated_by = updated_by

        SiteLocationService._commit(db=db)