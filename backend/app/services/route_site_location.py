from __future__ import annotations

from datetime import date
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import exists, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.constants import DBConstants
from app.core.error_messages import (
    DIVISION_NOT_FOUND_DETAIL,
    DUPLICATE_ROUTE_SITE_LOCATION_DETAIL,
    EMPLOYEE_NOT_FOUND_DETAIL,
    INVALID_EFFECTIVE_DATE_DETAIL,
    INVALID_REFERENCE_DETAIL,
    ROUTE_NOT_FOUND_DETAIL,
    ROUTE_SITE_LOCATION_NOT_FOUND_DETAIL,
    SITE_LOCATION_NOT_FOUND_DETAIL,
)
from app.models.divisions import Divisions
from app.models.employees import Employees
from app.models.route import Route
from app.models.route_site_location import RouteSiteLocation
from app.models.site_location import SiteLocation
from app.schemas.route_site_location import (
    RouteSiteLocationCreate,
    RouteSiteLocationUpdate,
)


class RouteSiteLocationService:
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
        RouteSiteLocationService._ensure_exists(
            db=db,
            column=Employees.employee_code,
            value=employee_code,
            error_detail=EMPLOYEE_NOT_FOUND_DETAIL,
        )

    @staticmethod
    def _validate_updated_by(
        db: Session,
        updated_by: str,
    ) -> None:
        RouteSiteLocationService._validate_employee_exists(
            db=db,
            employee_code=updated_by,
        )

    @staticmethod
    def _validate_route_exists(
        db: Session,
        route_id: int,
    ) -> None:
        RouteSiteLocationService._ensure_exists(
            db=db,
            column=Route.route_id,
            value=route_id,
            error_detail=ROUTE_NOT_FOUND_DETAIL,
        )

    @staticmethod
    def _validate_division_exists(
        db: Session,
        division_id: int,
    ) -> None:
        RouteSiteLocationService._ensure_exists(
            db=db,
            column=Divisions.division_id,
            value=division_id,
            error_detail=DIVISION_NOT_FOUND_DETAIL,
        )

    @staticmethod
    def _validate_site_location_exists(
        db: Session,
        location_id: int,
    ) -> None:
        RouteSiteLocationService._ensure_exists(
            db=db,
            column=SiteLocation.location_id,
            value=location_id,
            error_detail=SITE_LOCATION_NOT_FOUND_DETAIL,
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
    def _validate_no_overlapping_mapping(
        db: Session,
        routes_id: int,
        division_id: int,
        location_id: int,
        effective_from: date,
        effective_to: date | None,
        exclude_id: int | None = None,
    ) -> None:
        conditions = [
            RouteSiteLocation.routes_id == routes_id,
            RouteSiteLocation.division_id == division_id,
            RouteSiteLocation.location_id == location_id,
            RouteSiteLocation.mark_flag.is_(False),
            or_(
                RouteSiteLocation.effective_to.is_(None),
                RouteSiteLocation.effective_to >= effective_from,
            ),
        ]

        if effective_to is not None:
            conditions.append(RouteSiteLocation.effective_from <= effective_to)

        if exclude_id is not None:
            conditions.append(RouteSiteLocation.route_site_location_id != exclude_id)

        stmt = select(exists().where(*conditions))

        if db.scalar(stmt):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=DUPLICATE_ROUTE_SITE_LOCATION_DETAIL,
            )

    @staticmethod
    def _apply_effective_date_filter(
        stmt: Any,
        work_date: date,
    ) -> Any:
        return stmt.where(
            RouteSiteLocation.effective_from <= work_date,
            or_(
                RouteSiteLocation.effective_to.is_(None),
                RouteSiteLocation.effective_to >= work_date,
            ),
        )

    @staticmethod
    def _commit(
        db: Session,
        route_site_location: RouteSiteLocation | None = None,
    ) -> None:
        try:
            db.commit()

            if route_site_location is not None:
                db.refresh(route_site_location)
        except IntegrityError as exc:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=INVALID_REFERENCE_DETAIL,
            ) from exc

    @staticmethod
    def get_route_site_location(
        db: Session,
        route_site_location_id: int,
        include_deleted: bool = False,
    ) -> RouteSiteLocation:
        stmt = select(RouteSiteLocation).where(
            RouteSiteLocation.route_site_location_id == route_site_location_id
        )

        if not include_deleted:
            stmt = stmt.where(RouteSiteLocation.mark_flag.is_(False))

        route_site_location = db.scalar(stmt)

        if route_site_location is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=ROUTE_SITE_LOCATION_NOT_FOUND_DETAIL,
            )

        return route_site_location

    @staticmethod
    def get_route_site_locations(
        db: Session,
        skip: int = DBConstants.DEFAULT_PAGE_SKIP,
        limit: int = DBConstants.DEFAULT_PAGE_LIMIT,
        routes_id: int | None = None,
        division_id: int | None = None,
        location_id: int | None = None,
        is_active: bool | None = None,
        include_deleted: bool = False,
        only_effective: bool = False,
        work_date: date | None = None,
    ) -> list[RouteSiteLocation]:
        stmt = select(RouteSiteLocation)

        if not include_deleted:
            stmt = stmt.where(RouteSiteLocation.mark_flag.is_(False))

        if routes_id is not None:
            stmt = stmt.where(RouteSiteLocation.routes_id == routes_id)

        if division_id is not None:
            stmt = stmt.where(RouteSiteLocation.division_id == division_id)

        if location_id is not None:
            stmt = stmt.where(RouteSiteLocation.location_id == location_id)

        if is_active is not None:
            stmt = stmt.where(RouteSiteLocation.is_active.is_(is_active))

        if only_effective:
            stmt = RouteSiteLocationService._apply_effective_date_filter(
                stmt=stmt,
                work_date=work_date or date.today(),
            )

        stmt = (
            stmt.order_by(
                RouteSiteLocation.routes_id.asc(),
                RouteSiteLocation.division_id.asc(),
                RouteSiteLocation.location_id.asc(),
                RouteSiteLocation.effective_from.desc(),
                RouteSiteLocation.route_site_location_id.desc(),
            )
            .offset(skip)
            .limit(limit)
        )

        return list(db.scalars(stmt).all())

    @staticmethod
    def create_route_site_location(
        db: Session,
        payload: RouteSiteLocationCreate,
    ) -> RouteSiteLocation:
        RouteSiteLocationService._validate_employee_exists(
            db=db,
            employee_code=payload.created_by,
        )

        RouteSiteLocationService._validate_route_exists(
            db=db,
            route_id=payload.routes_id,
        )

        RouteSiteLocationService._validate_division_exists(
            db=db,
            division_id=payload.division_id,
        )

        RouteSiteLocationService._validate_site_location_exists(
            db=db,
            location_id=payload.location_id,
        )

        RouteSiteLocationService._validate_effective_dates(
            effective_from=payload.effective_from,
            effective_to=payload.effective_to,
        )

        RouteSiteLocationService._validate_no_overlapping_mapping(
            db=db,
            routes_id=payload.routes_id,
            division_id=payload.division_id,
            location_id=payload.location_id,
            effective_from=payload.effective_from,
            effective_to=payload.effective_to,
        )

        route_site_location = RouteSiteLocation(**payload.model_dump())

        db.add(route_site_location)
        RouteSiteLocationService._commit(
            db=db,
            route_site_location=route_site_location,
        )

        return route_site_location

    @staticmethod
    def update_route_site_location(
        db: Session,
        route_site_location_id: int,
        payload: RouteSiteLocationUpdate,
    ) -> RouteSiteLocation:
        RouteSiteLocationService._validate_updated_by(
            db=db,
            updated_by=payload.updated_by,
        )

        route_site_location = RouteSiteLocationService.get_route_site_location(
            db=db,
            route_site_location_id=route_site_location_id,
        )

        update_data = payload.model_dump(
            exclude_unset=True,
            exclude={"updated_by"},
        )

        new_routes_id = update_data.get("routes_id", route_site_location.routes_id)
        new_division_id = update_data.get(
            "division_id",
            route_site_location.division_id,
        )
        new_location_id = update_data.get("location_id", route_site_location.location_id)
        new_effective_from = update_data.get(
            "effective_from",
            route_site_location.effective_from,
        )
        new_effective_to = update_data.get(
            "effective_to",
            route_site_location.effective_to,
        )

        if "routes_id" in update_data:
            RouteSiteLocationService._validate_route_exists(
                db=db,
                route_id=new_routes_id,
            )

        if "division_id" in update_data:
            RouteSiteLocationService._validate_division_exists(
                db=db,
                division_id=new_division_id,
            )

        if "location_id" in update_data:
            RouteSiteLocationService._validate_site_location_exists(
                db=db,
                location_id=new_location_id,
            )

        RouteSiteLocationService._validate_effective_dates(
            effective_from=new_effective_from,
            effective_to=new_effective_to,
        )

        RouteSiteLocationService._validate_no_overlapping_mapping(
            db=db,
            routes_id=new_routes_id,
            division_id=new_division_id,
            location_id=new_location_id,
            effective_from=new_effective_from,
            effective_to=new_effective_to,
            exclude_id=route_site_location_id,
        )

        for field, value in update_data.items():
            setattr(route_site_location, field, value)

        route_site_location.updated_by = payload.updated_by

        RouteSiteLocationService._commit(
            db=db,
            route_site_location=route_site_location,
        )

        return route_site_location

    @staticmethod
    def delete_route_site_location(
        db: Session,
        route_site_location_id: int,
        updated_by: str,
    ) -> None:
        RouteSiteLocationService._validate_updated_by(
            db=db,
            updated_by=updated_by,
        )

        route_site_location = RouteSiteLocationService.get_route_site_location(
            db=db,
            route_site_location_id=route_site_location_id,
        )

        route_site_location.updated_by = updated_by
        route_site_location.mark_flag = True

        RouteSiteLocationService._commit(db=db)

    @staticmethod
    def deactivate_route_site_location(
        db: Session,
        route_site_location_id: int,
        updated_by: str,
    ) -> RouteSiteLocation:
        RouteSiteLocationService._validate_updated_by(
            db=db,
            updated_by=updated_by,
        )

        route_site_location = RouteSiteLocationService.get_route_site_location(
            db=db,
            route_site_location_id=route_site_location_id,
        )

        if route_site_location.is_active is False:
            return route_site_location

        route_site_location.updated_by = updated_by
        route_site_location.is_active = False

        RouteSiteLocationService._commit(
            db=db,
            route_site_location=route_site_location,
        )

        return route_site_location

    @staticmethod
    def activate_route_site_location(
        db: Session,
        route_site_location_id: int,
        updated_by: str,
    ) -> RouteSiteLocation:
        RouteSiteLocationService._validate_updated_by(
            db=db,
            updated_by=updated_by,
        )

        route_site_location = RouteSiteLocationService.get_route_site_location(
            db=db,
            route_site_location_id=route_site_location_id,
        )

        if route_site_location.is_active is True:
            return route_site_location

        RouteSiteLocationService._validate_no_overlapping_mapping(
            db=db,
            routes_id=route_site_location.routes_id,
            division_id=route_site_location.division_id,
            location_id=route_site_location.location_id,
            effective_from=route_site_location.effective_from,
            effective_to=route_site_location.effective_to,
            exclude_id=route_site_location_id,
        )

        route_site_location.updated_by = updated_by
        route_site_location.is_active = True

        RouteSiteLocationService._commit(
            db=db,
            route_site_location=route_site_location,
        )

        return route_site_location