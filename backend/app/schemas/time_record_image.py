# app/schemas/time_record_image.py

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    model_validator,
)

from app.core.constants import DBConstants


TimeRecordImageType = Literal[
    "checkin",
    "checkout",
    "work_report",
    "checkpoint_call",
]


class TimeRecordImageBase(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    image_type: TimeRecordImageType

    image_scope_id: int = Field(
        default=0,
        ge=0,
    )

    sequence_no: int = Field(
        ...,
        gt=0,
    )

    image_path: str = Field(
        ...,
        min_length=1,
        max_length=DBConstants.TIME_RECORD_IMAGE_PATH_LENGTH,
    )


class TimeRecordImageCreate(TimeRecordImageBase):
    """
    Schema สำหรับการสร้างข้อมูลภายในระบบ

    Service เป็นผู้กำหนด created_by

    รูป Time Record:
    - checkin
    - checkout
    - work_report

    ใช้ time_record_id

    รูปบันทึกการโทร:
    - checkpoint_call

    ใช้ assignment_call_id
    """

    time_record_id: int | None = Field(
        default=None,
        gt=0,
    )

    work_report_item_id: int | None = Field(
        default=None,
        gt=0,
    )

    assignment_call_id: int | None = Field(
        default=None,
        gt=0,
    )

    created_by: str = Field(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )

    @model_validator(mode="after")
    def validate_image_reference(
        self,
    ) -> "TimeRecordImageCreate":
        # ======================================================
        # รูป Check-in / Check-out
        # ======================================================
        if self.image_type in {
            "checkin",
            "checkout",
        }:
            if self.time_record_id is None:
                raise ValueError(
                    "time_record_id is required "
                    "when image_type is 'checkin' or 'checkout'"
                )

            if self.work_report_item_id is not None:
                raise ValueError(
                    "work_report_item_id is only allowed "
                    "when image_type is 'work_report'"
                )

            if self.assignment_call_id is not None:
                raise ValueError(
                    "assignment_call_id is only allowed "
                    "when image_type is 'checkpoint_call'"
                )

        # ======================================================
        # รูป Work Report
        # ======================================================
        elif self.image_type == "work_report":
            if self.time_record_id is None:
                raise ValueError(
                    "time_record_id is required "
                    "when image_type is 'work_report'"
                )

            if self.work_report_item_id is None:
                raise ValueError(
                    "work_report_item_id is required "
                    "when image_type is 'work_report'"
                )

            if self.assignment_call_id is not None:
                raise ValueError(
                    "assignment_call_id is only allowed "
                    "when image_type is 'checkpoint_call'"
                )

        # ======================================================
        # รูปบันทึกการโทร
        # ======================================================
        elif self.image_type == "checkpoint_call":
            if self.assignment_call_id is None:
                raise ValueError(
                    "assignment_call_id is required "
                    "when image_type is 'checkpoint_call'"
                )

            if self.time_record_id is not None:
                raise ValueError(
                    "time_record_id must be null "
                    "when image_type is 'checkpoint_call'"
                )

            if self.work_report_item_id is not None:
                raise ValueError(
                    "work_report_item_id must be null "
                    "when image_type is 'checkpoint_call'"
                )

            if (
                self.sequence_no
                > DBConstants.CHECKPOINT_CALL_MAX_IMAGES
            ):
                raise ValueError(
                    "checkpoint_call supports a maximum "
                    f"of {DBConstants.CHECKPOINT_CALL_MAX_IMAGES} images"
                )

            if self.image_scope_id != 0:
                raise ValueError(
                    "image_scope_id must be 0 "
                    "when image_type is 'checkpoint_call'"
                )

        return self


class TimeRecordImageResponse(TimeRecordImageBase):
    model_config = ConfigDict(
        from_attributes=True,
        extra="forbid",
        str_strip_whitespace=True,
    )

    time_record_image_id: int

    time_record_id: int | None

    work_report_item_id: int | None

    assignment_call_id: int | None

    created_at: datetime

    created_by: str = Field(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )