from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Text,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.constants import DBConstants
from app.core.orm import Base


class ReportExportJob(Base):
    """
    เก็บคิวและประวัติการสร้างไฟล์รายงานจาก Backend

    ตารางนี้ไม่ได้เก็บแถวข้อมูลรายงานจริง
    ข้อมูลรายงานต้องดึงจาก vw_checkin_report ตาม filters_json
    """

    __tablename__ = "report_export_job"

    __table_args__ = (
        CheckConstraint(
            """
            job_status IN (
                'queued',
                'processing',
                'completed',
                'failed',
                'cancelled',
                'expired'
            )
            """,
            name="ck_report_export_job_status",
        ),
        CheckConstraint(
            "progress_current >= 0",
            name="ck_report_export_job_progress_current",
        ),
        CheckConstraint(
            "progress_total >= 0",
            name="ck_report_export_job_progress_total",
        ),
        CheckConstraint(
            "progress_total = 0 OR progress_current <= progress_total",
            name="ck_report_export_job_progress_range",
        ),
        CheckConstraint(
            "file_size_bytes IS NULL OR file_size_bytes >= 0",
            name="ck_report_export_job_file_size",
        ),
        # Worker ใช้ index นี้เพื่อหา Job ที่รอสร้างตามลำดับเวลา
        Index(
            "ix_report_export_job_worker_queue",
            "job_status",
            "mark_flag",
            "created_at",
        ),
        # ใช้กับหน้า history / รายงานที่ผู้ใช้เคยสั่งสร้าง
        Index(
            "ix_report_export_job_requested_by_history",
            "requested_by",
            "mark_flag",
            "created_at",
        ),
    )

    report_export_job_id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    # ปัจจุบันใช้ patrol_report แต่เผื่อรองรับรายงานประเภทอื่นในอนาคต
    report_type: Mapped[str] = mapped_column(
        String(DBConstants.REPORT_EXPORT_TYPE_LENGTH),
        nullable=False,
        default="patrol_report",
        server_default=text("'patrol_report'"),
    )

    # เก็บ filter ที่ผู้ใช้เลือก ณ เวลาสั่ง Export
    # เช่น workday_start, workday_end, department_id, division_id,
    # route_id, location_id, employee_code, plan_mode, shift, status, keyword
    filters_json: Mapped[dict[str, Any]] = mapped_column(
        JSON,
        nullable=False,
    )

    # true = สร้าง PDF พร้อม thumbnail รูปเวลาเข้า/ออก
    include_images: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default=text("1"),
    )

    # queued / processing / completed / failed / cancelled / expired
    job_status: Mapped[str] = mapped_column(
        String(DBConstants.REPORT_EXPORT_JOB_STATUS_LENGTH),
        nullable=False,
        default="queued",
        server_default=text("'queued'"),
    )

    # Worker อัปเดตความคืบหน้าระหว่างสร้างไฟล์
    progress_current: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default=text("0"),
    )

    progress_total: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default=text("0"),
    )

    # ห้ามเก็บ absolute path หรือเปิด path เป็น public URL
    # ตัวอย่าง: reports/patrol_report_20260620_000001.pdf
    file_relative_path: Mapped[str | None] = mapped_column(
        String(DBConstants.REPORT_EXPORT_FILE_PATH_LENGTH),
        nullable=True,
    )

    # ชื่อไฟล์ที่ส่งกลับใน Content-Disposition ตอน Download
    download_filename: Mapped[str | None] = mapped_column(
        String(DBConstants.REPORT_EXPORT_FILENAME_LENGTH),
        nullable=True,
    )

    file_size_bytes: Mapped[int | None] = mapped_column(
        BigInteger,
        nullable=True,
    )

    # เก็บเฉพาะข้อความ error ที่ปลอดภัยต่อผู้ใช้ / ผู้ดูแลระบบ
    error_message: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    started_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )

    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )

    # เมื่อหมดอายุ Worker/Cleanup จะลบไฟล์จริงและเปลี่ยน job_status เป็น expired
    expires_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
        index=True,
    )

    # ผู้ใช้ที่สั่งสร้าง Job
    # ใช้ requested_by แทน created_by เพื่อให้สื่อความหมายตรงกับงาน Export
    requested_by: Mapped[str] = mapped_column(
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

    # ไม่มี is_active:
    # สถานะชีวิตของ Job ควบคุมด้วย job_status
    # mark_flag ใช้สำหรับ soft delete / ซ่อนประวัติ Job
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
        server_default=text("CURRENT_TIMESTAMP"),
        server_onupdate=text("CURRENT_TIMESTAMP"),
    )
