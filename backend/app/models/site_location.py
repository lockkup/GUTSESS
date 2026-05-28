from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Index, Integer, String, text
from sqlalchemy.dialects.mysql import DECIMAL, SMALLINT
from sqlalchemy.orm import Mapped, mapped_column

from app.core.constants import DBConstants
from app.core.orm import Base


class SiteLocation(Base):
    __tablename__ = "site_location"

    __table_args__ = (
        Index(
            "ix_site_location_lookup",
            "mark_flag",
            "is_active",
            "contract_code",
        ),
        Index(
            "ix_site_location_effective_range",
            "effective_from",
            "effective_to",
            "mark_flag",
        ),
    )

    location_id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    contract_code: Mapped[str] = mapped_column(
        String(DBConstants.CONTRACT_CODE_LENGTH),
        nullable=False,
        index=True,
    )

    location_name: Mapped[str] = mapped_column(
        String(DBConstants.LOCATION_NAME_LENGTH),
        nullable=False,
        index=True,
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

    by_contract: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
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