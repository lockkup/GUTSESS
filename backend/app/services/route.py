from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.route import Route


class RouteService:
    @staticmethod
    def get_routes(
        db: Session,
        skip: int = 0,
        limit: int = 100,
    ) -> list[Route]:
        stmt = (
            select(Route)
            .order_by(Route.route_id.asc())
            .offset(skip)
            .limit(limit)
        )
        return list(db.scalars(stmt).all())

    @staticmethod
    def get_route_by_id(
        db: Session,
        route_id: int,
    ) -> Route | None:
        return db.get(Route, route_id)