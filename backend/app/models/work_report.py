from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    CheckConstraint,
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
    from app.models.work_report_purpose_selection import (
        WorkReportPurposeSelection,
    )


class WorkReport(Base):
    __tablename__ = "work_report"

    __table_args__ = (
        UniqueConstraint(
            "time_record_id",
            name="uq_work_report_time_record",
        ),
        UniqueConstraint(
            "document_no",
            name="uq_work_report_document_no",
        ),
        CheckConstraint(
            "report_status IN ('active', 'cancelled')",
            name="ck_work_report_status",
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

    document_no: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )

    additional_note: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    # ============================================================
    # Report status
    # active    = รายงานปกติ
    # cancelled = ยกเลิกบันทึกรายงาน แต่ข้อมูลยังคงอยู่
    # ============================================================

    report_status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="active",
        server_default=text("'active'"),
    )

    # ============================================================
    # Client / representative signature
    # ============================================================

    client_first_name: Mapped[str | None] = mapped_column(
        String(DBConstants.FIRST_NAME_LENGTH),
        nullable=True,
    )

    client_last_name: Mapped[str | None] = mapped_column(
        String(DBConstants.LAST_NAME_LENGTH),
        nullable=True,
    )

    client_position: Mapped[str | None] = mapped_column(
        String(DBConstants.WORK_REPORT_SIGNATURE_POSITION_LENGTH),
        nullable=True,
    )

    signature_path: Mapped[str | None] = mapped_column(
        String(DBConstants.WORK_REPORT_SIGNATURE_PATH_LENGTH),
        nullable=True,
    )

    signature_datetime: Mapped[datetime | None] = mapped_column(
        DateTime,
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
        server_default=text(
            "CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
        ),
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
    # Purpose selections
    # ============================================================

    purpose_selections: Mapped[
        list["WorkReportPurposeSelection"]
    ] = relationship(
        "WorkReportPurposeSelection",
        back_populates="work_report",
        cascade="all, delete-orphan",
        order_by="WorkReportPurposeSelection.purpose_id",
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