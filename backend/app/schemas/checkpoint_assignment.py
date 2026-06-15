# app/schemas/checkpoint_assignment.py
from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.core.constants import DBConstants


AssignmentStatus = Literal[
    "pending",
    "in_progress",
    "completed",
    "cancelled",
    "repaired",
]


class CheckpointAssignmentBase(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    work_date: date

    schedule_item_id: int = Field(..., gt=0)

    due_datetime: datetime | None = None

    # True = เปิดใช้งาน, False = ปิดใช้งาน
    # ไม่ใช่ soft delete
    is_active: bool = Field(default=True)


class CheckpointAssignmentCreate(CheckpointAssignmentBase):
    created_by: str = Field(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )


class CheckpointAssignmentUpdate(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    work_date: date | None = None

    schedule_item_id: int | None = Field(
        default=None,
        gt=0,
    )

    due_datetime: datetime | None = None

    is_active: bool | None = None

    updated_by: str = Field(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )

    @model_validator(mode="after")
    def validate_not_null_fields(self) -> "CheckpointAssignmentUpdate":
        for field_name in ("work_date", "schedule_item_id", "is_active"):
            if field_name in self.model_fields_set and getattr(self, field_name) is None:
                raise ValueError(f"{field_name} cannot be null")

        return self


class CheckpointAssignmentAction(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    updated_by: str = Field(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )


class CheckpointAssignmentRecheck(CheckpointAssignmentAction):
    # ต้องระบุวันตรวจซ้ำใหม่
    # ไม่ควรดึง work_date จากงานเดิมอัตโนมัติ เพราะ recheck อาจคนละวัน
    work_date: date

    due_datetime: datetime | None = None

    recheck_reason: str = Field(
        ...,
        min_length=1,
        max_length=DBConstants.REMARK_LENGTH,
    )


class CheckpointAssignmentResponse(CheckpointAssignmentBase):
    model_config = ConfigDict(from_attributes=True)

    assignment_id: int

    # ใช้ผูกกับ time_record ที่เกิดจากการเช็คอินสายตรวจ
    # create/update assignment ปกติไม่ต้องส่งค่านี้
    time_record_id: int | None = None

    parent_assignment_id: int | None = None

    # ใช้กันปัญหา MySQL UNIQUE + NULL
    # งานหลัก = 0
    # งาน recheck = parent_assignment_id
    parent_assignment_key: int

    # งานหลัก = 0
    # recheck ครั้งแรก = 1
    # recheck ซ้อน = 2, 3, ...
    recheck_depth: int

    assignment_status: AssignmentStatus

    started_at: datetime | None = None
    started_by: str | None = None

    completed_at: datetime | None = None
    completed_by: str | None = None

    recheck_reason: str | None = None

    mark_flag: bool

    created_at: datetime

    updated_at: datetime

    created_by: str

    updated_by: str | None = None


class CheckpointAssignmentDailyResponse(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
        extra="forbid",
        str_strip_whitespace=True,
    )

    assignment_id: int

    work_date: date

    schedule_item_id: int

    # ใช้ให้ frontend รู้ว่างานนี้เป็นผลัดไหน
    # ดึงจาก checkpoint_schedule_item.shift_id
    # เพื่อไม่ต้อง hardcode day=1 / night=2 ที่ frontend
    shift_id: int | None = None

    # ใช้ให้ frontend รู้ว่างานนี้มี time_record ผูกอยู่หรือยัง
    time_record_id: int | None = None

    unit_name: str

    plan_day: int

    require_call: bool

    assignment_status: AssignmentStatus

    has_call: bool = False

    due_datetime: datetime | None = None

    # ใช้แจ้งเตือนว่าเลยกำหนดตรวจหรือยัง
    is_overdue: bool = False
    overdue_text: str | None = None

    started_at: datetime | None = None
    started_by: str | None = None

    completed_at: datetime | None = None
    completed_by: str | None = None

    is_active: bool

    sequence_no: int

    route_site_location_id: int

    contract_code: str | None = None

    location_name: str | None = None

    # ใช้ให้ frontend ปิด/เปิดปุ่มดำเนินการตามช่วงเวลาของกะ
    # true = กดปุ่มเข้าตรวจ/ออกตรวจได้
    # false = ห้ามกด และให้แสดง action_disabled_reason
    can_action: bool = False

    # เหตุผลที่ปุ่มถูกปิด เช่น
    # "ยังไม่ถึงช่วงเวลาของผลัดกลางคืน"
    # "หมดช่วงเวลาของผลัดกลางวันแล้ว"
    # "ไม่พบข้อมูลผลัดของตารางงานสายตรวจ"
    action_disabled_reason: str | None = None

    # true = เวลาปัจจุบันอยู่ในช่วง start_time - end_time ของกะนี้
    is_shift_time_allowed: bool = False

    # เวลาเริ่มกะจากตาราง shifts เช่น "08:01:00"
    shift_start_time: str | None = None

    # เวลาสิ้นสุดกะจากตาราง shifts เช่น "20:00:00"
    shift_end_time: str | None = None

    # true = กะข้ามวัน เช่น 20:01 - 08:00
    crosses_midnight: bool | None = None


class CheckpointMapLocationResponse(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
        extra="forbid",
        str_strip_whitespace=True,
    )

    contract_code: str

    location_name: str

    latitude: float | None = None

    longitude: float | None = None

    radius_meter: int | None = None

    grace_meter: int | None = None

    # หมายเหตุ / รายละเอียดเพิ่มเติมจาก site_location.location_detail
    location_detail: str | None = None
