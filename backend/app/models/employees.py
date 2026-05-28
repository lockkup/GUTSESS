from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, String, text
from sqlalchemy.dialects.mysql import LONGTEXT
from sqlalchemy.orm import Mapped, mapped_column

from app.core.constants import DBConstants
from app.core.orm import Base


class Employees(Base):
    __tablename__ = "employees"

    employee_code: Mapped[str] = mapped_column(
        String(DBConstants.EMPLOYEE_CODE_LENGTH),
        primary_key=True,
        index=True,
    )

    password: Mapped[str] = mapped_column(
        String(DBConstants.PASSWORD_LENGTH),
        nullable=False,
    )

    role_id: Mapped[int] = mapped_column(
        nullable=False,
    )

    name_prefix_id: Mapped[int] = mapped_column(
        nullable=False,
    )

    first_name: Mapped[str] = mapped_column(
        String(DBConstants.FIRST_NAME_LENGTH),
        nullable=False,
    )

    last_name: Mapped[str] = mapped_column(
        String(DBConstants.LAST_NAME_LENGTH),
        nullable=False,
    )

    profile_image_path: Mapped[str | None] = mapped_column(
        LONGTEXT,
        nullable=True,
    )

    profile_image_updated_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )

    birth_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
    )

    email: Mapped[str | None] = mapped_column(
        String(DBConstants.EMAIL_LENGTH),
        unique=True,
        nullable=True,
    )

    phone_number: Mapped[str | None] = mapped_column(
        String(DBConstants.PHONE_NUMBER_LENGTH),
        nullable=True,
    )

    address_id: Mapped[int | None] = mapped_column(
        nullable=True,
    )

    field_id: Mapped[int] = mapped_column(
        nullable=False,
    )

    department_id: Mapped[int] = mapped_column(
        nullable=False,
    )

    division_id: Mapped[int] = mapped_column(
        nullable=False,
    )

    position_id: Mapped[int] = mapped_column(
        nullable=False,
    )

    routes_id: Mapped[int | None] = mapped_column(
        nullable=True,
    )

    shift_id: Mapped[int] = mapped_column(
        nullable=False,
    )

    start_date: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
    )

    leave_date: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
    )

    is_active: Mapped[bool] = mapped_column(
        default=True,
        server_default=text("1"),
        nullable=False,
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