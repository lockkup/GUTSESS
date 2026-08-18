from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Index, Integer, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.constants import DBConstants
from app.core.orm import Base


class RouteSiteLocation(Base):
    __tablename__ = "route_site_location"

    __table_args__ = (
        Index(
            "ix_route_site_location_lookup",
            "routes_id",
            "division_id",
            "location_id",
            "mark_flag",
            "is_active",
        ),
        Index(
            "ix_route_site_location_effective_range",
            "routes_id",
            "division_id",
            "location_id",
            "effective_from",
            "effective_to",
            "mark_flag",
        ),
    )

    route_site_location_id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    routes_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("routes.route_id"),
        nullable=False,
        index=True,
    )

    division_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("divisions.division_id"),
        nullable=False,
        index=True,
    )

    location_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("site_location.location_id"),
        nullable=False,
        index=True,
    )

    effective_from: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        index=True,
    )

    effective_to: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
        index=True,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default=text("1"),
        index=True,
    )

    mark_flag: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default=text("0"),
        index=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"),
    )

    created_by: Mapped[str] = mapped_column(
        String(DBConstants.EMPLOYEE_CODE_LENGTH),
        ForeignKey("employees.employee_code"),
        nullable=False,
    )

    updated_by: Mapped[str | None] = mapped_column(
        String(DBConstants.EMPLOYEE_CODE_LENGTH),
        ForeignKey("employees.employee_code"),
        nullable=True,
    )