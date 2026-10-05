from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Computed,
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
    from app.models.time_record_image import TimeRecordImage
    from app.models.work_report import WorkReport
    from app.models.work_report_item_type import WorkReportItemType


class WorkReportItem(Base):
    __tablename__ = "work_report_item"

    __table_args__ = (
        UniqueConstraint(
            "work_report_id",
            "active_sequence_no",
            name="uq_work_report_item_active_sequence",
        ),
        Index(
            "ix_work_report_item_report",
            "work_report_id",
        ),
        Index(
            "ix_work_report_item_type_id",
            "work_item_type_id",
        ),
        Index(
            "ix_work_report_item_created_by",
            "created_by",
        ),
        Index(
            "ix_work_report_item_updated_by",
            "updated_by",
        ),
        Index(
            "ix_work_report_item_active_mark",
            "is_active",
            "mark_flag",
        ),
        CheckConstraint(
            "sequence_no > 0",
            name="chk_work_report_item_sequence",
        ),
    )

    work_report_item_id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    work_report_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey(
            "work_report.work_report_id",
            name="fk_work_report_item_report",
        ),
        nullable=False,
    )

    work_item_type_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey(
            "work_report_item_type.work_item_type_id",
            name="fk_work_report_item_type",
        ),
        nullable=False,
    )

    work_item_other: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
    )

    sequence_no: Mapped[int] = mapped_column(
        SMALLINT(unsigned=True),
        nullable=False,
    )

    work_item_detail: Mapped[str | None] = mapped_column(
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

    active_sequence_no: Mapped[int | None] = mapped_column(
        SMALLINT(unsigned=True),
        Computed(
            "CASE WHEN mark_flag = 0 THEN sequence_no ELSE NULL END",
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
        ForeignKey(
            "employees.employee_code",
            name="fk_work_report_item_created_by",
        ),
        nullable=False,
    )

    updated_by: Mapped[str | None] = mapped_column(
        String(DBConstants.EMPLOYEE_CODE_LENGTH),
        ForeignKey(
            "employees.employee_code",
            name="fk_work_report_item_updated_by",
        ),
        nullable=True,
    )

    # ============================================================
    # Work report
    # ============================================================

    work_report: Mapped["WorkReport"] = relationship(
        "WorkReport",
        back_populates="items",
    )

    # ============================================================
    # Work item type
    # ============================================================

    work_item_type: Mapped["WorkReportItemType"] = relationship(
        "WorkReportItemType",
        back_populates="work_report_items",
    )

    # ============================================================
    # Images
    # ============================================================

    images: Mapped[list["TimeRecordImage"]] = relationship(
        "TimeRecordImage",
        back_populates="work_report_item",
        cascade="all, delete-orphan",
        order_by="TimeRecordImage.sequence_no",
    )