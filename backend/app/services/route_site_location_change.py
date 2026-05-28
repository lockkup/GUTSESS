from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.error_messages import (
    EMPLOYEE_NOT_FOUND_DETAIL,
    ROUTE_SITE_LOCATION_CHANGE_NOT_FOUND_DETAIL,
    ROUTE_SITE_LOCATION_NOT_FOUND_DETAIL,
)
from app.models.employees import Employees
from app.models.route_site_location import RouteSiteLocation
from app.models.route_site_location_change import RouteSiteLocationChange
from app.schemas.route_site_location_change import RouteSiteLocationChangeCreate


class RouteSiteLocationChangeService:
    @staticmethod
    def _ensure_employee_exists(
        db: Session,
        employee_code: str,
    ) -> None:
        stmt = select(Employees.employee_code).where(
            Employees.employee_code == employee_code,
        )

        if db.scalar(stmt) is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=EMPLOYEE_NOT_FOUND_DETAIL,
            )

    @staticmethod
    def _ensure_route_site_location_exists(
        db: Session,
        route_site_location_id: int,
    ) -> None:
        stmt = select(RouteSiteLocation.route_site_location_id).where(
            RouteSiteLocation.route_site_location_id == route_site_location_id,
        )

        if db.scalar(stmt) is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=ROUTE_SITE_LOCATION_NOT_FOUND_DETAIL,
            )

    @staticmethod
    def _ensure_exists(
        db: Session,
        route_site_location_change_id: int,
    ) -> RouteSiteLocationChange:
        stmt = select(RouteSiteLocationChange).where(
            RouteSiteLocationChange.route_site_location_change_id
            == route_site_location_change_id,
        )
        record = db.scalar(stmt)

        if record is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=ROUTE_SITE_LOCATION_CHANGE_NOT_FOUND_DETAIL,
            )

        return record

    @staticmethod
    def create_route_site_location_change(
        db: Session,
        payload: RouteSiteLocationChangeCreate,
    ) -> RouteSiteLocationChange:
        """
        ใช้สำหรับ service หลักเรียกภายในเท่านั้น
        ไม่ควรเปิดให้ frontend เรียกสร้างประวัติโดยตรง
        """

        RouteSiteLocationChangeService._ensure_employee_exists(
            db=db,
            employee_code=payload.employee_code,
        )
        RouteSiteLocationChangeService._ensure_route_site_location_exists(
            db=db,
            route_site_location_id=payload.route_site_location_id,
        )

        record = RouteSiteLocationChange(
            **payload.model_dump(),
        )

        db.add(record)
        db.commit()
        db.refresh(record)

        return record

    @staticmethod
    def get_route_site_location_changes(
        db: Session,
        skip: int = 0,
        limit: int = 100,
    ) -> list[RouteSiteLocationChange]:
        stmt = (
            select(RouteSiteLocationChange)
            .order_by(RouteSiteLocationChange.route_site_location_change_id.desc())
            .offset(skip)
            .limit(limit)
        )

        return list(db.scalars(stmt).all())

    @staticmethod
    def get_route_site_location_change_by_id(
        db: Session,
        route_site_location_change_id: int,
    ) -> RouteSiteLocationChange:
        return RouteSiteLocationChangeService._ensure_exists(
            db=db,
            route_site_location_change_id=route_site_location_change_id,
        )