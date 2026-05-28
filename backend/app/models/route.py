from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.constants import DBConstants
from app.core.orm import Base


class Route(Base):
    __tablename__ = "routes"

    route_id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    route_name: Mapped[str] = mapped_column(
        String(DBConstants.ROUTE_NAME_LENGTH),
        nullable=False,
    )

    field_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("fields.field_id"),
        nullable=False,
        index=True,
    )

    department_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("departments.department_id"),
        nullable=False,
        index=True,
    )

    division_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("divisions.division_id"),
        nullable=False,
        index=True,
    )

    sector_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("sectors.sector_id"),
        nullable=False,
        index=True,
    )

    zone_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("zones.zone_id"),
        nullable=False,
        index=True,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default=text("1"),
        index=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.now(),
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    created_by: Mapped[str] = mapped_column(
        String(DBConstants.EMPLOYEE_CODE_LENGTH),
        ForeignKey("employees.employee_code"),
        nullable=False,
        index=True,
    )

    updated_by: Mapped[str | None] = mapped_column(
        String(DBConstants.EMPLOYEE_CODE_LENGTH),
        ForeignKey("employees.employee_code"),
        nullable=True,
        index=True,
    )