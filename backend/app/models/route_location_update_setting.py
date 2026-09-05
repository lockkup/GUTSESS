from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.mysql import BIGINT, TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column

from app.core.constants import DBConstants
from app.core.orm import Base


class RouteLocationUpdateSetting(Base):
    __tablename__ = "route_location_update_setting"

    __table_args__ = (
        UniqueConstraint(
            "department_id",
            "division_id",
            "route_id",
            name="uq_route_location_update_setting",
        ),
        {"mysql_engine": "InnoDB"},
    )

    id: Mapped[int] = mapped_column(
        BIGINT(unsigned=True),
        primary_key=True,
        autoincrement=True,
    )

    department_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey(
            "departments.department_id",
            name="fk_route_location_update_setting_department",
        ),
        nullable=False,
    )

    division_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey(
            "divisions.division_id",
            name="fk_route_location_update_setting_division",
        ),
        nullable=False,
    )

    route_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey(
            "routes.route_id",
            name="fk_route_location_update_setting_route",
        ),
        nullable=False,
    )

    # อนุญาตทั้งการแก้พิกัดจาก GPS และการแก้ไขระยะรัศมี
    allow_location_update: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default=text("0"),
    )

    effective_from: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
    )

    effective_to: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default=text("1"),
    )

    mark_flag: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default=text("0"),
    )

    created_by: Mapped[str | None] = mapped_column(
        String(DBConstants.EMPLOYEE_CODE_LENGTH),
        nullable=True,
    )

    updated_by: Mapped[str | None] = mapped_column(
        String(DBConstants.EMPLOYEE_CODE_LENGTH),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP,
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
    )

    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP,
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"),
    )