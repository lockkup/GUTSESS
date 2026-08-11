from __future__ import annotations

from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, computed_field, model_validator

from app.core.constants import DBConstants


ReportExportType = Literal[
    "patrol_report",
]

ReportExportJobStatus = Literal[
    "queued",
    "processing",
    "completed",
    "failed",
    "cancelled",
    "expired",
]

PatrolReportPlanMode = Literal[
    "planned",
    "outside_plan",
]

PatrolReportShiftType = Literal[
    "all",
    "day",
    "night",
]

PatrolReportStatusFilter = Literal[
    "all",
    "completed",
    "completed_call",
    "in_progress",
    "pending",
]

PatrolReportReservationStatus = Literal[
    "all",
    "reserved",
    "unreserved",
]


class PatrolReportExportFilter(BaseModel):
    """
    Filter ณ เวลาที่ผู้ใช้กดสร้าง PDF

    Worker จะใช้ค่าใน filters_json เพื่อดึงข้อมูลรายงานใหม่จาก Backend
    ห้ามส่ง rows หรือรูปภาพทั้งหมดจาก Frontend มาเก็บใน Job
    """

    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    workday_start: date
    workday_end: date

    department_id: int = Field(..., gt=0)
    division_id: int = Field(..., gt=0)

    route_id: int | None = Field(default=None, gt=0)
    location_id: int | None = Field(default=None, gt=0)

    employee_code: str | None = Field(
        default=None,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )

    plan_modes: list[PatrolReportPlanMode] = Field(
        default_factory=lambda: ["planned"],
        min_length=1,
        max_length=2,
    )
    shift_type: PatrolReportShiftType = "all"
    status: PatrolReportStatusFilter = "all"

    # ใช้ร่วมกับ status="pending"
    #
    # all        = ไม่กรองข้อมูลการจอง
    # reserved   = เฉพาะรายการที่มีผู้จอง
    # unreserved = เฉพาะรายการที่ยังไม่มีผู้จอง
    #
    # ไม่ใช่ assignment_status ใหม่ในฐานข้อมูล
    reservation_status: PatrolReportReservationStatus = "all"

    keyword: str = Field(
        default="",
        max_length=DBConstants.REPORT_EXPORT_KEYWORD_LENGTH,
    )

    @model_validator(mode="before")
    @classmethod
    def normalize_legacy_plan_mode(cls, data: Any) -> Any:
        """
        รองรับ Job เก่าที่ filters_json ยังใช้ plan_mode ค่าเดียว
        โดยแปลงเป็น plan_modes ก่อนตรวจสอบข้อมูล
        """

        if not isinstance(data, dict):
            return data

        normalized_data = dict(data)

        if "plan_mode" in normalized_data:
            if "plan_modes" in normalized_data:
                raise ValueError(
                    "Use either plan_mode or plan_modes, not both",
                )

            normalized_data["plan_modes"] = [
                normalized_data.pop("plan_mode"),
            ]

        return normalized_data

    @model_validator(mode="after")
    def validate_filters(self) -> "PatrolReportExportFilter":
        if self.workday_end < self.workday_start:
            raise ValueError(
                "workday_end must be greater than or equal to workday_start",
            )

        if len(set(self.plan_modes)) != len(self.plan_modes):
            raise ValueError(
                "plan_modes must not contain duplicate values",
            )

        return self


class PatrolReportExportCreate(BaseModel):
    """
    Request สำหรับ POST /patrol-report-exports/

    report_type ไม่รับจาก Frontend เพราะ endpoint นี้รองรับ
    patrol_report เพียงประเภทเดียวในตอนนี้
    """

    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    filters: PatrolReportExportFilter

    # true = รวมรูปเวลาเข้า/ออกใน PDF
    include_images: bool = Field(default=True)

    # รหัสพนักงานของผู้ใช้งานที่ Login อยู่จริง
    requested_by: str = Field(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )


class PatrolReportExportAction(BaseModel):
    """
    Request สำหรับ cancel / retry / delete
    """

    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    updated_by: str = Field(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )


class PatrolReportExportResponse(BaseModel):
    """
    Response สำหรับสร้าง Job, Poll สถานะ, History, Cancel และ Retry
    """

    model_config = ConfigDict(
        from_attributes=True,
        extra="forbid",
        str_strip_whitespace=True,
    )

    report_export_job_id: int
    report_type: ReportExportType

    filters_json: dict[str, Any]

    include_images: bool
    job_status: ReportExportJobStatus

    progress_current: int = Field(ge=0)
    progress_total: int = Field(ge=0)

    file_relative_path: str | None = None
    download_filename: str | None = None
    file_size_bytes: int | None = Field(default=None, ge=0)

    error_message: str | None = None

    started_at: datetime | None = None
    completed_at: datetime | None = None
    expires_at: datetime | None = None

    requested_by: str
    updated_by: str | None = None

    mark_flag: bool

    created_at: datetime
    updated_at: datetime

    @computed_field
    @property
    def progress_percent(self) -> int:
        if self.job_status == "completed":
            return 100

        if self.progress_total <= 0:
            return 0

        return min(
            100,
            max(
                0,
                int((self.progress_current / self.progress_total) * 100),
            ),
        )

    @computed_field
    @property
    def download_ready(self) -> bool:
        return (
            self.job_status == "completed"
            and bool(self.file_relative_path)
            and bool(self.download_filename)
        )