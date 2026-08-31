from __future__ import annotations

from datetime import date, datetime
from typing import Literal, TypeAlias

from pydantic import BaseModel, ConfigDict, Field


PatrolStatus: TypeAlias = Literal[
    "completed",
    "in_progress",
    "pending",
]

# ใช้สำหรับกรองรายงานเท่านั้น
# pending_reserved / pending_takeover ไม่ใช่ assignment_status ในฐานข้อมูล
PatrolReportStatusFilter: TypeAlias = Literal[
    "completed",
    "in_progress",
    "pending",
    "pending_reserved",
    "pending_takeover",
]

PatrolNotificationLevel: TypeAlias = Literal[
    "none",
    "yellow",
    "orange",
    "red",
    "green",
]


class PatrolReportResponse(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    id: int = Field(..., ge=1)

    contractCode: str
    siteName: str
    status: PatrolStatus

    # ข้อมูลการจองจาก checkpoint_assignment
    # การจองไม่เปลี่ยน status ซึ่งยังคงเป็น pending
    reservedBy: str | None = None
    reservedAt: datetime | None = None

    # ผู้ตรวจของ Assignment ลูกตรวจแทน
    # มาจาก checkpoint_assignment.updated_by
    # สถานะจริงในฐานข้อมูลยังคงเป็น pending
    takeoverBy: str | None = None

    # ใช้สำหรับตัวกรองรายงาน
    departmentId: int | None = Field(default=None, ge=1)
    divisionId: int | None = Field(default=None, ge=1)
    routeId: int | None = Field(default=None, ge=1)
    locationId: int | None = Field(default=None, ge=1)

    # effective_from จาก vw_checkin_report
    effectiveFrom: date | None = None

    # by_contract จาก vw_checkin_report
    # รอบตรวจตามสัญญาจ้าง เช่น 3, 5, 7, 15, 30 วัน
    byContract: int | None = Field(default=None, ge=1)

    # plan_day จาก vw_checkin_report
    # เป็นรอบที่เรากำหนดให้สายตรวจ ไม่ใช้คำนวณแจ้งเตือนตามสัญญา
    planDay: int | None = Field(default=None, ge=1)

    # คำนวณเพิ่มใน Backend
    # ไม่จำเป็นต้องมีใน vw_checkin_report
    lastInspectionDate: date | None = None
    daysWithoutInspection: int | None = Field(default=None, ge=0)

    # none    = ไม่แจ้งเตือน
    # yellow  = เหลือง
    # orange  = ส้ม
    # red     = แดง
    # green   = เข้าตรวจแล้ว จาก time_record
    #
    # ให้เป็น None ได้ เพื่อรองรับกรณี Backend ไม่มีการแจ้งเตือนในรอบนั้น
    # Frontend มี normalizeNotificationLevel() แปลง None เป็น "none" อยู่แล้ว
    notificationLevel: PatrolNotificationLevel | None = "none"
    notificationText: str | None = None

    # shift_name_th -> shiftLabel
    shiftLabel: str

    # work_date -> dateText
    # ใช้แสดงผลเท่านั้น เช่น วันพุธที่ 20 พฤษภาคม 2569
    dateText: str

    # started_at -> checkInTime
    # completed_at -> checkOutTime
    #
    # คงไว้ชั่วคราวเพื่อกันกระทบ service/frontend เดิม
    # หน้า Report ใหม่ไม่จำเป็นต้องใช้สอง field นี้แล้ว
    checkInTime: str | None = None
    checkOutTime: str | None = None

    # started_datetime -> checkInDateTime
    # completed_datetime -> checkOutDateTime
    #
    # ใช้แสดงวันเวลาเข้า/ออกจริง เช่น:
    # 2026-06-17 00:26:47
    # Frontend format เป็น 17 มิ.ย. 2569 00:26
    checkInDateTime: datetime | None = None
    checkOutDateTime: datetime | None = None

    # รูปภาพเวลาเข้า / เวลาออก
    #
    # Backend service จะอ่านค่าจาก vw_checkin_report เช่น:
    # - images_checkin_1
    # - images_checkin_2
    # - images_checkout_1
    # - images_checkout_2
    #
    # แล้ว map ออกมาเป็นชื่อกลางให้ Frontend ใช้:
    # - checkInImageUrl
    # - checkOutImageUrl
    #
    # ระยะสั้น:
    # รองรับได้ทั้ง URL, path และ data:image/jpeg;base64,...
    # เช่น:
    # - /uploads/time-record/checkin/xxx.jpg
    # - https://domain.com/uploads/time-record/checkin/xxx.jpg
    # - data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ...
    #
    # ระยะยาว:
    # แนะนำให้เก็บรูปเป็นไฟล์ แล้วส่ง URL/path มาแทน base64
    # เพราะ base64 ทำให้ response ใหญ่และโหลดรายงานช้า
    checkInImageUrl: str | None = None
    checkOutImageUrl: str | None = None

    # employee_code / position_name ใช้แสดงผู้ดำเนินการ
    employeeCode: str | None = None
    positionName: str | None = None

    # position_name หรือชื่อผู้ดำเนินการ -> operatorName
    operatorName: str | None = None

    # contact_detail -> contactDetail
    # call_status -> callStatus
    # call_note -> callNote
    contactDetail: str | None = None
    callStatus: int | None = Field(default=None, ge=1, le=3)
    callNote: str | None = None

    scheduleText: str = "-"


class PatrolDepartmentOption(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    departmentId: int = Field(..., ge=1)
    departmentName: str


class PatrolDivisionOption(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    divisionId: int = Field(..., ge=1)
    divisionName: str
    departmentId: int | None = Field(default=None, ge=1)


class PatrolRouteOption(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    routeId: int = Field(..., ge=1)
    routeName: str
    departmentId: int | None = Field(default=None, ge=1)
    divisionId: int | None = Field(default=None, ge=1)


class PatrolLocationOption(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    locationId: int = Field(..., ge=1)
    contractCode: str
    locationName: str
    routeId: int | None = Field(default=None, ge=1)
    departmentId: int | None = Field(default=None, ge=1)
    divisionId: int | None = Field(default=None, ge=1)


class PatrolEmployeeOption(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    employeeCode: str
    employeeName: str | None = None
    positionName: str | None = None


class PatrolReportFilterOptionsResponse(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    departments: list[PatrolDepartmentOption] = Field(default_factory=list)
    divisions: list[PatrolDivisionOption] = Field(default_factory=list)
    routes: list[PatrolRouteOption] = Field(default_factory=list)
    locations: list[PatrolLocationOption] = Field(default_factory=list)
    employees: list[PatrolEmployeeOption] = Field(default_factory=list)
