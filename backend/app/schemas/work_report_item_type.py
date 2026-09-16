from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.core.constants import DBConstants


_NON_NULLABLE_UPDATE_FIELDS = (
    "work_item_code",
    "work_item_name",
    "require_detail",
    "display_order",
    "is_active",
)


class WorkReportItemTypeBase(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    work_item_code: str = Field(
        ...,
        min_length=1,
        max_length=30,
    )

    work_item_name: str = Field(
        ...,
        min_length=1,
        max_length=100,
    )

    require_detail: bool = Field(
        default=False,
        description=(
            "กำหนดว่ารายการงานต้องกรอกรายละเอียดเพิ่มเติมหรือไม่"
        ),
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


class WorkReportItemTypeCreate(WorkReportItemTypeBase):
    created_by: str = Field(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )


class WorkReportItemTypeUpdate(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    work_item_code: str | None = Field(
        default=None,
        min_length=1,
        max_length=30,
    )

    work_item_name: str | None = Field(
        default=None,
        min_length=1,
        max_length=100,
    )

    require_detail: bool | None = None

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


class WorkReportItemTypeAction(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    updated_by: str = Field(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )


class WorkReportItemTypeResponse(WorkReportItemTypeBase):
    model_config = ConfigDict(
        from_attributes=True,
        extra="forbid",
        str_strip_whitespace=True,
    )

    work_item_type_id: int = Field(
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