# app/schemas/time_record_image.py

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.core.constants import DBConstants


TimeRecordImageType = Literal[
    "checkin",
    "checkout",
]


class TimeRecordImageBase(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    image_type: TimeRecordImageType

    sequence_no: int = Field(
        ...,
        gt=0,
    )

    image_path: str = Field(
        ...,
        min_length=1,
        max_length=500,
    )


class TimeRecordImageCreate(TimeRecordImageBase):
    """
    Schema สำหรับการสร้างข้อมูลภายในระบบ

    Phase 1 ยังไม่มี endpoint สำหรับสร้างรูปโดยตรง
    TimeRecordService เป็นผู้กำหนด created_by
    """

    time_record_id: int = Field(
        ...,
        gt=0,
    )

    created_by: str = Field(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )


class TimeRecordImageResponse(TimeRecordImageBase):
    model_config = ConfigDict(
        from_attributes=True,
        extra="forbid",
        str_strip_whitespace=True,
    )

    time_record_image_id: int
    time_record_id: int

    created_at: datetime

    created_by: str = Field(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )