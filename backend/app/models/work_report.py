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
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.constants import DBConstants
from app.core.orm import Base

if TYPE_CHECKING:
    from app.models.work_report_item import WorkReportItem
    from app.models.work_report_purpose import WorkReportPurpose


class WorkReport(Base):
    __tablename__ = "work_report"

    __table_args__ = (
        UniqueConstraint(
            "time_record_id",
            name="uq_work_report_time_record",
        ),
        Index(
            "ix_work_report_active_mark",
            "is_active",
            "mark_flag",
        ),
    )

    work_report_id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    time_record_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("time_record.time_record_id"),
        nullable=False,
    )

    purpose_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("work_report_purpose.purpose_id"),
        nullable=False,
        index=True,
    )

    additional_note: Mapped[str | None] = mapped_column(
        String(500),
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
    # Purpose
    # ============================================================

    purpose: Mapped["WorkReportPurpose"] = relationship(
        "WorkReportPurpose",
        back_populates="work_reports",
    )

    # ============================================================
    # Work report items
    # ============================================================

    items: Mapped[list["WorkReportItem"]] = relationship(
        "WorkReportItem",
        back_populates="work_report",
        cascade="all, delete-orphan",
        order_by="WorkReportItem.sequence_no",
    )
