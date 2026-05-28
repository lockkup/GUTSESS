from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.core.constants import DBConstants


class CheckpointScheduleItemBase(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    schedule_id: int = Field(..., gt=0)

    route_site_location_id: int = Field(..., gt=0)

    sequence_no: int = Field(
        default=1,
        ge=1,
        le=DBConstants.UNSIGNED_SMALLINT_MAX,
    )

    plan_day: int = Field(
        ...,
        ge=1,
        le=DBConstants.UNSIGNED_SMALLINT_MAX,
        description="รอบแผน เช่น 3, 7, 15, 30",
    )

    require_call: bool = Field(
        default=False,
        description="ต้องโทรหรือไม่",
    )

    is_active: bool = Field(
        default=True,
        description="สถานะใช้งาน TRUE = เปิดใช้งาน, FALSE = ปิดใช้งาน",
    )


class CheckpointScheduleItemCreate(CheckpointScheduleItemBase):
    created_by: str = Field(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )


class CheckpointScheduleItemUpdate(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    schedule_id: int | None = Field(
        default=None,
        gt=0,
    )

    route_site_location_id: int | None = Field(
        default=None,
        gt=0,
    )

    sequence_no: int | None = Field(
        default=None,
        ge=1,
        le=DBConstants.UNSIGNED_SMALLINT_MAX,
    )

    plan_day: int | None = Field(
        default=None,
        ge=1,
        le=DBConstants.UNSIGNED_SMALLINT_MAX,
        description="รอบแผน เช่น 3, 7, 15, 30",
    )

    require_call: bool | None = Field(
        default=None,
        description="ต้องโทรหรือไม่",
    )

    is_active: bool | None = Field(
        default=None,
        description="สถานะใช้งาน TRUE = เปิดใช้งาน, FALSE = ปิดใช้งาน",
    )

    updated_by: str = Field(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )


class CheckpointScheduleItemAction(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    updated_by: str = Field(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )


class CheckpointScheduleItemResponse(CheckpointScheduleItemBase):
    model_config = ConfigDict(from_attributes=True)

    schedule_item_id: int

    mark_flag: bool

    created_at: datetime

    updated_at: datetime

    created_by: str

    updated_by: str | None = None