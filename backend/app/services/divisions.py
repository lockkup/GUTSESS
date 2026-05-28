from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.constants import DBConstants
from app.core.error_messages import DIVISION_NOT_FOUND_DETAIL
from app.models.divisions import Divisions


class DivisionsService:
    @staticmethod
    def get_division(
        db: Session,
        division_id: int,
        include_inactive: bool = False,
    ) -> Divisions:
        stmt = select(Divisions).where(
            Divisions.division_id == division_id,
        )

        if not include_inactive:
            stmt = stmt.where(Divisions.is_active.is_(True))

        division = db.scalar(stmt)

        if division is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=DIVISION_NOT_FOUND_DETAIL,
            )

        return division

    @staticmethod
    def get_divisions(
        db: Session,
        skip: int = DBConstants.DEFAULT_PAGE_SKIP,
        limit: int = DBConstants.DEFAULT_PAGE_LIMIT,
        field_id: int | None = None,
        department_id: int | None = None,
        include_inactive: bool = False,
    ) -> list[Divisions]:
        stmt = select(Divisions)

        if not include_inactive:
            stmt = stmt.where(Divisions.is_active.is_(True))

        if field_id is not None:
            stmt = stmt.where(Divisions.field_id == field_id)

        if department_id is not None:
            stmt = stmt.where(Divisions.department_id == department_id)

        stmt = (
            stmt.order_by(
                Divisions.field_id.asc(),
                Divisions.department_id.asc(),
                Divisions.division_name.asc(),
                Divisions.division_id.asc(),
            )
            .offset(skip)
            .limit(limit)
        )

        return list(db.scalars(stmt).all())