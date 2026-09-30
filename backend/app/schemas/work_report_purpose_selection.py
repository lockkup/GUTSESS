

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.core.constants import DBConstants


_NON_NULLABLE_UPDATE_FIELDS = (
    "purpose_id",
    "is_active",
)


class WorkReportPurposeSelectionBase(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    work_report_id: int = Field(
        ...,
        gt=0,
    )

    purpose_id: int = Field(
        ...,
        gt=0,
    )

    purpose_detail: str | None = Field(
        default=None,
        max_length=500,
    )

    is_active: bool = Field(
        default=True,
        description=(
            "สถานะใช้งาน TRUE = เปิดใช้งาน, "
            "FALSE = ปิดใช้งาน"
        ),
    )


class WorkReportPurposeSelectionCreate(
    WorkReportPurposeSelectionBase
):
    pass


class WorkReportPurposeSelectionUpdate(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    purpose_id: int | None = Field(
        default=None,
        gt=0,
    )

    purpose_detail: str | None = Field(
        default=None,
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
            raise ValueError(f"{', '.join(null_fields)} cannot be null")

        return data


class WorkReportPurposeSelectionAction(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    updated_by: str = Field(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )


class WorkReportPurposeSelectionResponse(
    WorkReportPurposeSelectionBase
):
    model_config = ConfigDict(
        from_attributes=True,
        extra="forbid",
        str_strip_whitespace=True,
    )

    work_report_purpose_selection_id: int = Field(
        ...,
        gt=0,
    )

    active_purpose_id: int | None = Field(
        default=None,
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
