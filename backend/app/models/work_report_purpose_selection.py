

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    Computed,
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
    from app.models.work_report import WorkReport
    from app.models.work_report_purpose import WorkReportPurpose


class WorkReportPurposeSelection(Base):
    __tablename__ = "work_report_purpose_selection"

    __table_args__ = (
        UniqueConstraint(
            "work_report_id",
            "active_purpose_id",
            name="uq_work_report_purpose_selection_active",
        ),
        Index(
            "ix_work_report_purpose_selection_report",
            "work_report_id",
        ),
        Index(
            "ix_work_report_purpose_selection_purpose",
            "purpose_id",
        ),
        Index(
            "ix_work_report_purpose_selection_created_by",
            "created_by",
        ),
        Index(
            "ix_work_report_purpose_selection_updated_by",
            "updated_by",
        ),
        Index(
            "ix_work_report_purpose_selection_active_mark",
            "is_active",
            "mark_flag",
        ),
    )

    work_report_purpose_selection_id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    work_report_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey(
            "work_report.work_report_id",
            ondelete="CASCADE",
        ),
        nullable=False,
    )

    purpose_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("work_report_purpose.purpose_id"),
        nullable=False,
    )

    purpose_detail: Mapped[str | None] = mapped_column(
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

    active_purpose_id: Mapped[int | None] = mapped_column(
        Integer,
        Computed(
            "CASE WHEN mark_flag = 0 THEN purpose_id ELSE NULL END",
            persisted=True,
        ),
        nullable=True,
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

    # ============================================================
    # Work report
    # ============================================================

    work_report: Mapped["WorkReport"] = relationship(
        "WorkReport",
        back_populates="purpose_selections",
    )

    # ============================================================
    # Purpose
    # ============================================================

    purpose: Mapped["WorkReportPurpose"] = relationship(
        "WorkReportPurpose",
        back_populates="work_report_purpose_selections",
    )