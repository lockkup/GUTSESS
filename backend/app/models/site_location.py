from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, func, text
from sqlalchemy.dialects.mysql import DECIMAL, SMALLINT
from sqlalchemy.orm import Mapped, mapped_column

from app.core.constants import DBConstants
from app.core.orm import Base


class SiteLocation(Base):
    __tablename__ = "site_location"

    location_id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    location_name: Mapped[str] = mapped_column(
        String(DBConstants.LOCATION_NAME_LENGTH),
        nullable=False,
    )

    latitude: Mapped[Decimal] = mapped_column(
        DECIMAL(8, 6),
        nullable=False,
    )

    longitude: Mapped[Decimal] = mapped_column(
        DECIMAL(9, 6),
        nullable=False,
    )

    radius_meter: Mapped[int] = mapped_column(
        SMALLINT(unsigned=True),
        nullable=False,
        default=DBConstants.DEFAULT_RADIUS_METER,
        server_default=text(str(DBConstants.DEFAULT_RADIUS_METER)),
    )

    grace_meter: Mapped[int] = mapped_column(
        SMALLINT(unsigned=True),
        nullable=False,
        default=DBConstants.DEFAULT_GRACE_METER,
        server_default=text(str(DBConstants.DEFAULT_GRACE_METER)),
    )

    location_detail: Mapped[str | None] = mapped_column(
        String(DBConstants.LOCATION_DETAIL_LENGTH),
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

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.current_timestamp(),
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.current_timestamp(),
        onupdate=func.current_timestamp(),
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