from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import DECIMAL, Date, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.mysql import LONGTEXT
from sqlalchemy.orm import Mapped, mapped_column

from app.core.constants import DBConstants
from app.core.orm import Base


IMAGE_TEXT_TYPE = Text().with_variant(LONGTEXT(), "mysql")


class TimeRecord(Base):
    __tablename__ = "time_record"

    time_record_id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    employee_code: Mapped[str] = mapped_column(
        String(DBConstants.EMPLOYEE_CODE_LENGTH),
        ForeignKey("employees.employee_code"),
        nullable=False,
        index=True,
    )

    shift_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("shifts.shift_id"),
        nullable=False,
        index=True,
    )

    work_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        index=True,
    )

    checkin_location_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("site_location.location_id"),
        nullable=True,
    )

    checkout_location_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("site_location.location_id"),
        nullable=True,
    )

    checkin: Mapped[str | None] = mapped_column(
        String(DBConstants.CHECK_TIME_LENGTH),
        nullable=True,
    )

    checkin_lat: Mapped[Decimal | None] = mapped_column(
        DECIMAL(8, 6),
        nullable=True,
    )

    checkin_lng: Mapped[Decimal | None] = mapped_column(
        DECIMAL(9, 6),
        nullable=True,
    )

    checkin_remark: Mapped[str | None] = mapped_column(
        String(DBConstants.REMARK_LENGTH),
        nullable=True,
    )

    images_checkin_1: Mapped[str | None] = mapped_column(
        IMAGE_TEXT_TYPE,
        nullable=True,
    )

    images_checkin_2: Mapped[str | None] = mapped_column(
        IMAGE_TEXT_TYPE,
        nullable=True,
    )

    checkout: Mapped[str | None] = mapped_column(
        String(DBConstants.CHECK_TIME_LENGTH),
        nullable=True,
    )

    checkout_lat: Mapped[Decimal | None] = mapped_column(
        DECIMAL(8, 6),
        nullable=True,
    )

    checkout_lng: Mapped[Decimal | None] = mapped_column(
        DECIMAL(9, 6),
        nullable=True,
    )

    checkout_remark: Mapped[str | None] = mapped_column(
        String(DBConstants.REMARK_LENGTH),
        nullable=True,
    )

    images_checkout_1: Mapped[str | None] = mapped_column(
        IMAGE_TEXT_TYPE,
        nullable=True,
    )

    images_checkout_2: Mapped[str | None] = mapped_column(
        IMAGE_TEXT_TYPE,
        nullable=True,
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