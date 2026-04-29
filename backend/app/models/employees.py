from __future__ import annotations

from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.constants import DBConstants
from app.core.orm import Base


class Employees(Base):
    __tablename__ = "employees"

    employee_code: Mapped[str] = mapped_column(
        String(DBConstants.EMPLOYEE_CODE_LENGTH),
        primary_key=True,
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

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )