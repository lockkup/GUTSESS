from __future__ import annotations

from fastapi import HTTPException, status
from fastapi.encoders import jsonable_encoder
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.constants import DBConstants
from app.models.employees import Employees
from app.models.route import Route
from app.models.site_location import SiteLocation
from app.models.route_site_location import RouteSiteLocation
from app.schemas.route_site_location import (
    RouteSiteLocationBase,
    RouteSiteLocationCreate,
    RouteSiteLocationUpdate,
)

ROUTE_SITE_LOCATION_NOT_FOUND_DETAIL = "Route site location not found"
EMPLOYEE_NOT_FOUND_DETAIL = "Employee not found"
ROUTE_NOT_FOUND_DETAIL = "Route not found"
SITE_LOCATION_NOT_FOUND_DETAIL = "Site location not found"
INVALID_REFERENCE_DETAIL = "Invalid reference data"
DUPLICATE_ROUTE_SITE_LOCATION_DETAIL = "Route site location already exists"


class RouteSiteLocationService:
    @staticmethod
    def _commit(db: Session) -> None:
        try:
            db.commit()
        except IntegrityError as e:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=INVALID_REFERENCE_DETAIL,
            ) from e
        except SQLAlchemyError as e:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database error: {str(e)}",
            ) from e

    @staticmethod
    def _commit_and_refresh(db: Session, instance: RouteSiteLocation) -> None:
        try:
            db.commit()
            db.refresh(instance)
        except IntegrityError as e:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=INVALID_REFERENCE_DETAIL,
            ) from e
        except SQLAlchemyError as e:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database error: {str(e)}",
            ) from e

    @staticmethod
    def _get_employee_by_code(
        db: Session,
        employee_code: str,
    ) -> Employees | None:
        stmt = select(Employees).where(Employees.employee_code == employee_code)
        return db.scalar(stmt)

    @staticmethod
    def _get_route_by_id(
        db: Session,
        route_id: int,
    ) -> Route | None:
        stmt = select(Route).where(Route.route_id == route_id)
        return db.scalar(stmt)

    @staticmethod
    def _get_site_location_by_id(
        db: Session,
        site_location_id: int,
    ) -> SiteLocation | None:
        stmt = select(SiteLocation).where(
            SiteLocation.location_id == site_location_id
        )
        return db.scalar(stmt)

    @staticmethod
    def _validate_employee_reference(
        db: Session,
        employee_code: str,
    ) -> None:
        employee_code = employee_code.strip()

        employee = RouteSiteLocationService._get_employee_by_code(db, employee_code)
        if employee is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=EMPLOYEE_NOT_FOUND_DETAIL,
            )

    @staticmethod
    def _validate_route_reference(
        db: Session,
        route_id: int,
    ) -> None:
        route = RouteSiteLocationService._get_route_by_id(db, route_id)
        if route is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=ROUTE_NOT_FOUND_DETAIL,
            )

    @staticmethod
    def _validate_site_location_reference(
        db: Session,
        site_location_id: int,
    ) -> None:
        site_location = RouteSiteLocationService._get_site_location_by_id(
            db,
            site_location_id,
        )
        if site_location is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=SITE_LOCATION_NOT_FOUND_DETAIL,
            )

    @staticmethod
    def _validate_duplicate_mapping(
        db: Session,
        routes_id: int,
        site_location_id: int,
        effective_from,
        exclude_id: int | None = None,
    ) -> None:
        stmt = select(RouteSiteLocation).where(
            RouteSiteLocation.routes_id == routes_id,
            RouteSiteLocation.site_location_id == site_location_id,
            RouteSiteLocation.effective_from == effective_from,
        )

        if exclude_id is not None:
            stmt = stmt.where(
                RouteSiteLocation.route_site_location_id != exclude_id
            )

        existing = db.scalar(stmt)
        if existing is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=DUPLICATE_ROUTE_SITE_LOCATION_DETAIL,
            )

    @staticmethod
    def create_route_site_location(
        db: Session,
        payload: RouteSiteLocationCreate,
    ) -> RouteSiteLocation:
        data = payload.model_dump()

        data["created_by"] = data["created_by"].strip()

        RouteSiteLocationService._validate_employee_reference(db, data["created_by"])
        RouteSiteLocationService._validate_route_reference(db, data["routes_id"])
        RouteSiteLocationService._validate_site_location_reference(
            db,
            data["site_location_id"],
        )
        RouteSiteLocationService._validate_duplicate_mapping(
            db=db,
            routes_id=data["routes_id"],
            site_location_id=data["site_location_id"],
            effective_from=data["effective_from"],
        )

        route_site_location = RouteSiteLocation(**data)

        db.add(route_site_location)
        RouteSiteLocationService._commit_and_refresh(db, route_site_location)

        return route_site_location

    @staticmethod
    def get_route_site_locations(
        db: Session,
        skip: int = 0,
        limit: int = DBConstants.DEFAULT_PAGE_LIMIT,
        routes_id: int | None = None,
        site_location_id: int | None = None,
    ) -> list[RouteSiteLocation]:
        stmt = select(RouteSiteLocation)

        if routes_id is not None:
            stmt = stmt.where(RouteSiteLocation.routes_id == routes_id)

        if site_location_id is not None:
            stmt = stmt.where(
                RouteSiteLocation.site_location_id == site_location_id
            )

        stmt = (
            stmt.order_by(RouteSiteLocation.route_site_location_id.asc())
            .offset(skip)
            .limit(limit)
        )

        return list(db.scalars(stmt).all())

    @staticmethod
    def get_route_site_location_by_id(
        db: Session,
        route_site_location_id: int,
    ) -> RouteSiteLocation | None:
        stmt = select(RouteSiteLocation).where(
            RouteSiteLocation.route_site_location_id == route_site_location_id
        )
        return db.scalar(stmt)

    @staticmethod
    def update_route_site_location(
        db: Session,
        route_site_location_id: int,
        payload: RouteSiteLocationUpdate,
    ) -> RouteSiteLocation | None:
        route_site_location = RouteSiteLocationService.get_route_site_location_by_id(
            db=db,
            route_site_location_id=route_site_location_id,
        )
        if route_site_location is None:
            return None

        update_data = payload.model_dump(exclude_unset=True)

        if "updated_by" in update_data and update_data["updated_by"] is not None:
            update_data["updated_by"] = update_data["updated_by"].strip()
            RouteSiteLocationService._validate_employee_reference(
                db,
                update_data["updated_by"],
            )

        if "routes_id" in update_data and update_data["routes_id"] is not None:
            RouteSiteLocationService._validate_route_reference(
                db,
                update_data["routes_id"],
            )

        if (
            "site_location_id" in update_data
            and update_data["site_location_id"] is not None
        ):
            RouteSiteLocationService._validate_site_location_reference(
                db,
                update_data["site_location_id"],
            )

        validation_data = {
            "routes_id": update_data.get("routes_id", route_site_location.routes_id),
            "site_location_id": update_data.get(
                "site_location_id",
                route_site_location.site_location_id,
            ),
            "effective_from": update_data.get(
                "effective_from",
                route_site_location.effective_from,
            ),
            "effective_to": update_data.get(
                "effective_to",
                route_site_location.effective_to,
            ),
        }

        try:
            RouteSiteLocationBase(**validation_data)
        except ValidationError as e:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=jsonable_encoder(e.errors()),
            ) from e

        RouteSiteLocationService._validate_duplicate_mapping(
            db=db,
            routes_id=validation_data["routes_id"],
            site_location_id=validation_data["site_location_id"],
            effective_from=validation_data["effective_from"],
            exclude_id=route_site_location_id,
        )

        for field, value in update_data.items():
            setattr(route_site_location, field, value)

        RouteSiteLocationService._commit_and_refresh(db, route_site_location)

        return route_site_location

    @staticmethod
    def delete_route_site_location(
        db: Session,
        route_site_location_id: int,
        updated_by: str,
    ) -> RouteSiteLocation | None:
        route_site_location = RouteSiteLocationService.get_route_site_location_by_id(
            db=db,
            route_site_location_id=route_site_location_id,
        )
        if route_site_location is None:
            return None

        updated_by = updated_by.strip()
        RouteSiteLocationService._validate_employee_reference(db, updated_by)

        db.delete(route_site_location)
        RouteSiteLocationService._commit(db)

        return route_site_location