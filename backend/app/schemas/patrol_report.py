from __future__ import annotations

from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


PatrolStatus = Literal["completed", "in_progress", "pending"]
PatrolNotificationLevel = Literal["none", "yellow", "orange", "red"]


class PatrolReportResponse(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    id: int = Field(..., ge=1)

    contractCode: str
    siteName: str
    status: PatrolStatus

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
    notificationLevel: PatrolNotificationLevel = "none"
    notificationText: str | None = None

    # shift_name_th -> shiftLabel
    shiftLabel: str

    # work_date -> dateText
    # ใช้แสดงผลเท่านั้น เช่น วันพุธที่ 20 พฤษภาคม 2569
    dateText: str

    # started_at -> checkInTime
    # completed_at -> checkOutTime
    checkInTime: str | None = None
    checkOutTime: str | None = None

    # position_name -> operatorName
    operatorName: str | None = None

    # contact_detail -> contactDetail
    # call_status -> callStatus
    # call_note -> callNote
    contactDetail: str | None = None
    callStatus: int | None = Field(default=None, ge=1, le=3)
    callNote: str | None = None

    scheduleText: str = "-"