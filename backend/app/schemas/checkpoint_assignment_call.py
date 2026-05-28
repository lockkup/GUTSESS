from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.core.constants import DBConstants


CALL_STATUS_DESCRIPTION = (
    "1=ปกติไม่ต้องเข้าหน้างาน, "
    "2=ผิดปกติไม่ต้องเข้าหน้างาน, "
    "3=ผิดปกติต้องเข้าหน้างาน"
)


class CheckpointAssignmentCallBase(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    assignment_id: int = Field(..., gt=0)

    contact_detail: str = Field(
        ...,
        min_length=1,
        description="รายชื่อผู้ติดต่อพร้อมเบอร์ทั้งหมด",
    )

    call_status: int = Field(
        ...,
        ge=1,
        le=3,
        description=CALL_STATUS_DESCRIPTION,
    )

    call_note: str | None = None

    is_active: bool = Field(default=True)


class CheckpointAssignmentCallCreate(CheckpointAssignmentCallBase):
    call_datetime: datetime | None = None

    created_by: str = Field(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )


class CheckpointAssignmentCallUpdate(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    assignment_id: int | None = Field(default=None, gt=0)

    call_datetime: datetime | None = None

    contact_detail: str | None = Field(
        default=None,
        min_length=1,
    )

    call_status: int | None = Field(
        default=None,
        ge=1,
        le=3,
        description=CALL_STATUS_DESCRIPTION,
    )

    call_note: str | None = None

    is_active: bool | None = None

    updated_by: str = Field(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )


class CheckpointAssignmentCallAction(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    updated_by: str = Field(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )


class CheckpointAssignmentCallResponse(CheckpointAssignmentCallBase):
    model_config = ConfigDict(from_attributes=True)

    assignment_call_id: int

    call_datetime: datetime

    mark_flag: bool

    created_by: str
    updated_by: str | None = None

    created_at: datetime
    updated_at: datetime