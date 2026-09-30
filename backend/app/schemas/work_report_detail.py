from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.core.constants import DBConstants


_NON_NULLABLE_UPDATE_FIELDS = (
    "section_no",
    "sequence_no",
    "detail",
    "is_active",
)


class WorkReportDetailBase(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    work_report_id: int = Field(
        ...,
        gt=0,
    )

    section_no: int = Field(
        ...,
        ge=3,
        le=4,
        description="เลขหัวข้อของรายงาน รองรับเฉพาะข้อ 3 และข้อ 4",
    )

    sequence_no: int = Field(
        ...,
        gt=0,
    )

    detail: str = Field(
        ...,
        min_length=1,
        max_length=500,
    )

    is_active: bool = Field(
        default=True,
        description=(
            "สถานะใช้งาน TRUE = เปิดใช้งาน, "
            "FALSE = ปิดใช้งาน"
        ),
    )


class WorkReportDetailCreate(WorkReportDetailBase):
    created_by: str = Field(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )


class WorkReportDetailUpdate(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    section_no: int | None = Field(
        default=None,
        ge=3,
        le=4,
        description="เลขหัวข้อของรายงาน รองรับเฉพาะข้อ 3 และข้อ 4",
    )

    sequence_no: int | None = Field(
        default=None,
        gt=0,
    )

    detail: str | None = Field(
        default=None,
        min_length=1,
        max_length=500,
    )

    is_active: bool | None = None

    updated_by: str = Field(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )

    @model_validator(mode="before")
    @classmethod
    def validate_no_null_for_required_db_fields(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data

        null_fields = [
            field
            for field in _NON_NULLABLE_UPDATE_FIELDS
            if field in data and data[field] is None
        ]

        if null_fields:
            raise ValueError(
                f"{', '.join(null_fields)} cannot be null"
            )

        return data


class WorkReportDetailAction(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    updated_by: str = Field(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )


class WorkReportDetailResponse(WorkReportDetailBase):
    model_config = ConfigDict(
        from_attributes=True,
        extra="forbid",
        str_strip_whitespace=True,
    )

    work_report_detail_id: int = Field(
        ...,
        gt=0,
    )

    mark_flag: bool

    created_at: datetime
    updated_at: datetime

    created_by: str = Field(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )

    updated_by: str | None = Field(
        default=None,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )