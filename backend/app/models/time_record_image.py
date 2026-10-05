# app/models/time_record_image.py

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    SmallInteger,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.constants import DBConstants
from app.core.orm import Base


if TYPE_CHECKING:
    from app.models.checkpoint_assignment_call import (
        CheckpointAssignmentCall,
    )
    from app.models.time_record import TimeRecord
    from app.models.work_report_item import WorkReportItem


class TimeRecordImage(Base):
    __tablename__ = "time_record_image"

    __table_args__ = (
        # ======================================================
        # รูปของ Time Record
        # ======================================================
        UniqueConstraint(
            "time_record_id",
            "image_type",
            "image_scope_id",
            "sequence_no",
            name="uq_time_record_image_scope_sequence",
        ),

        # ======================================================
        # รูปของบันทึกการโทร
        # ======================================================
        UniqueConstraint(
            "assignment_call_id",
            "image_type",
            "image_scope_id",
            "sequence_no",
            name=(
                "uq_time_record_image_"
                "assignment_call_scope_sequence"
            ),
        ),

        # ======================================================
        # sequence_no ต้องมากกว่า 0
        # ======================================================
        CheckConstraint(
            "sequence_no > 0",
            name="ck_time_record_image_sequence_no_positive",
        ),

        # ======================================================
        # รูป 1 รายการต้องอ้างอิง
        # Time Record หรือ Assignment Call
        # อย่างใดอย่างหนึ่งเท่านั้น
        #
        # Time Record:
        #   time_record_id != NULL
        #   assignment_call_id = NULL
        #
        # Record Call:
        #   time_record_id = NULL
        #   assignment_call_id != NULL
        #   work_report_item_id = NULL
        #
        # Work Report ยังคงอยู่ฝั่ง Time Record ตามเดิม
        # ======================================================
        CheckConstraint(
            """
            (
                time_record_id IS NOT NULL
                AND assignment_call_id IS NULL
            )
            OR
            (
                time_record_id IS NULL
                AND assignment_call_id IS NOT NULL
                AND work_report_item_id IS NULL
            )
            """,
            name="ck_time_record_image_parent_reference",
        ),

        # ======================================================
        # Indexes
        # ======================================================
        Index(
            "ix_time_record_image_time_record_type",
            "time_record_id",
            "image_type",
        ),

        Index(
            "ix_time_record_image_work_report_item",
            "work_report_item_id",
        ),

        Index(
            "ix_time_record_image_assignment_call",
            "assignment_call_id",
        ),
    )

    # ============================================================
    # Primary Key
    # ============================================================

    time_record_image_id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    # ============================================================
    # Time Record
    #
    # nullable=True เพราะรูปจากบันทึกการโทร
    # จะไม่มี time_record_id
    # ============================================================

    time_record_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey(
            "time_record.time_record_id",
            name="fk_time_record_image_time_record",
            ondelete="CASCADE",
        ),
        nullable=True,
        index=True,
    )

    # ============================================================
    # Work Report
    # ============================================================

    work_report_item_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey(
            "work_report_item.work_report_item_id",
            name="fk_time_record_image_work_report_item",
            ondelete="CASCADE",
        ),
        nullable=True,
    )

    # ============================================================
    # Checkpoint Assignment Call
    #
    # ใช้สำหรับรูปจากหน้าบันทึกรายละเอียดการโทร
    # ============================================================

    assignment_call_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey(
            "checkpoint_assignment_call.assignment_call_id",
            name="fk_time_record_image_assignment_call",
            ondelete="CASCADE",
        ),
        nullable=True,
    )

    # ============================================================
    # Image
    # ============================================================

    image_type: Mapped[str] = mapped_column(
        String(
            DBConstants.TIME_RECORD_IMAGE_TYPE_LENGTH
        ),
        nullable=False,
    )

    image_scope_id: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default=text("0"),
    )

    sequence_no: Mapped[int] = mapped_column(
        SmallInteger,
        nullable=False,
    )

    image_path: Mapped[str] = mapped_column(
        String(
            DBConstants.TIME_RECORD_IMAGE_PATH_LENGTH
        ),
        nullable=False,
    )

    # ============================================================
    # Audit
    # ============================================================

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
    )

    created_by: Mapped[str] = mapped_column(
        String(DBConstants.EMPLOYEE_CODE_LENGTH),
        ForeignKey(
            "employees.employee_code",
            name="fk_time_record_image_created_by",
        ),
        nullable=False,
        index=True,
    )

    # ============================================================
    # Relationships
    # ============================================================

    time_record: Mapped["TimeRecord | None"] = relationship(
        "TimeRecord",
        back_populates="images",
    )

    work_report_item: Mapped[
        "WorkReportItem | None"
    ] = relationship(
        "WorkReportItem",
        back_populates="images",
    )

    assignment_call: Mapped[
        "CheckpointAssignmentCall | None"
    ] = relationship(
        "CheckpointAssignmentCall",
        back_populates="images",
    )