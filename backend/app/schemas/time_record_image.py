# app/schemas/time_record_image.py

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.core.constants import DBConstants


TimeRecordImageType = Literal[
    "checkin",
    "checkout",
    "work_report",
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

    Service เป็นผู้กำหนด created_by
    """

    time_record_id: int = Field(
        ...,
        gt=0,
    )

    work_report_item_id: int | None = Field(
        default=None,
        gt=0,
    )

    created_by: str = Field(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )

    @model_validator(mode="after")
    def validate_work_report_item(self) -> "TimeRecordImageCreate":
        if (
            self.image_type == "work_report"
            and self.work_report_item_id is None
        ):
            raise ValueError(
                "work_report_item_id is required "
                "when image_type is 'work_report'"
            )

        if (
            self.image_type in {"checkin", "checkout"}
            and self.work_report_item_id is not None
        ):
            raise ValueError(
                "work_report_item_id is only allowed "
                "when image_type is 'work_report'"
            )

        return self


class TimeRecordImageResponse(TimeRecordImageBase):
    model_config = ConfigDict(
        from_attributes=True,
        extra="forbid",
        str_strip_whitespace=True,
    )

    time_record_image_id: int
    time_record_id: int
    work_report_item_id: int | None

    created_at: datetime

    created_by: str = Field(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )