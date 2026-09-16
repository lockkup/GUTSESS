

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.core.constants import DBConstants


_NON_NULLABLE_UPDATE_FIELDS = (
    "purpose_code",
    "purpose_name",
    "display_order",
    "is_active",
)


class WorkReportPurposeBase(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    purpose_code: str = Field(
        ...,
        min_length=1,
        max_length=30,
    )

    purpose_name: str = Field(
        ...,
        min_length=1,
        max_length=100,
    )

    display_order: int = Field(
        default=0,
        ge=0,
        le=65_535,
    )

    is_active: bool = Field(
        default=True,
        description=(
            "สถานะใช้งาน TRUE = เปิดใช้งาน, "
            "FALSE = ปิดใช้งาน"
        ),
    )


class WorkReportPurposeCreate(WorkReportPurposeBase):
    created_by: str = Field(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )


class WorkReportPurposeUpdate(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    purpose_code: str | None = Field(
        default=None,
        min_length=1,
        max_length=30,
    )

    purpose_name: str | None = Field(
        default=None,
        min_length=1,
        max_length=100,
    )

    display_order: int | None = Field(
        default=None,
        ge=0,
        le=65_535,
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
            raise ValueError(f"{', '.join(null_fields)} cannot be null")

        return data


class WorkReportPurposeAction(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    updated_by: str = Field(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )


class WorkReportPurposeResponse(WorkReportPurposeBase):
    model_config = ConfigDict(
        from_attributes=True,
        extra="forbid",
        str_strip_whitespace=True,
    )

    purpose_id: int = Field(
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