from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.mysql import SMALLINT
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.constants import DBConstants
from app.core.orm import Base

if TYPE_CHECKING:
    from app.models.work_report import WorkReport


class WorkReportPurpose(Base):
    __tablename__ = "work_report_purpose"

    __table_args__ = (
        UniqueConstraint(
            "purpose_code",
            name="uq_work_report_purpose_code",
        ),
        Index(
            "ix_work_report_purpose_active_order",
            "is_active",
            "mark_flag",
            "display_order",
        ),
    )

    purpose_id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    purpose_code: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
    )

    purpose_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    display_order: Mapped[int] = mapped_column(
        SMALLINT(unsigned=True),
        nullable=False,
        default=0,
        server_default=text("0"),
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
        index=True,
    )

    updated_by: Mapped[str | None] = mapped_column(
        String(DBConstants.EMPLOYEE_CODE_LENGTH),
        ForeignKey("employees.employee_code"),
        nullable=True,
        index=True,
    )

    # ============================================================
    # Work reports
    # ============================================================

    work_reports: Mapped[list["WorkReport"]] = relationship(
        "WorkReport",
        back_populates="purpose",
    )