from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.constants import DBConstants
from app.models.route import Route


class RouteService:
    @staticmethod
    def get_routes(
        db: Session,
        skip: int = DBConstants.DEFAULT_PAGE_SKIP,
        limit: int = DBConstants.DEFAULT_PAGE_LIMIT,
        is_active: bool | None = None,
    ) -> list[Route]:
        stmt = select(Route)

        if is_active is not None:
            stmt = stmt.where(Route.is_active == is_active)

        stmt = stmt.order_by(Route.route_id.asc()).offset(skip).limit(limit)

        return list(db.scalars(stmt).all())

    @staticmethod
    def get_route_by_id(
        db: Session,
        route_id: int,
    ) -> Route | None:
        stmt = select(Route).where(Route.route_id == route_id)

        return db.scalar(stmt)