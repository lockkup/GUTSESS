from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.core.constants import DBConstants
from app.core.error_messages import (
    CHECKPOINT_SCHEDULE_DAY_REQUIRED_DETAIL,
    INVALID_EFFECTIVE_DATE_DETAIL,
)


class CheckpointScheduleBase(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    schedule_name: str = Field(
        ...,
        min_length=1,
        max_length=DBConstants.CHECKPOINT_SCHEDULE_NAME_LENGTH,
    )

    shift_id: int = Field(..., gt=0)

    is_mon: bool = False
    is_tue: bool = False
    is_wed: bool = False
    is_thu: bool = False
    is_fri: bool = False
    is_sat: bool = False
    is_sun: bool = False

    is_active: bool = Field(
        default=True,
        description="สถานะใช้งาน TRUE = เปิดใช้งาน, FALSE = ปิดใช้งาน",
    )

    effective_from: date
    effective_to: date | None = None

    @model_validator(mode="after")
    def validate_date_range(self) -> "CheckpointScheduleBase":
        if self.effective_to is not None and self.effective_to < self.effective_from:
            raise ValueError(INVALID_EFFECTIVE_DATE_DETAIL)

        return self

    @model_validator(mode="after")
    def validate_at_least_one_day(self) -> "CheckpointScheduleBase":
        if not any(
            (
                self.is_mon,
                self.is_tue,
                self.is_wed,
                self.is_thu,
                self.is_fri,
                self.is_sat,
                self.is_sun,
            )
        ):
            raise ValueError(CHECKPOINT_SCHEDULE_DAY_REQUIRED_DETAIL)

        return self


class CheckpointScheduleCreate(CheckpointScheduleBase):
    created_by: str = Field(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )


class CheckpointScheduleUpdate(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    schedule_name: str | None = Field(
        default=None,
        min_length=1,
        max_length=DBConstants.CHECKPOINT_SCHEDULE_NAME_LENGTH,
    )

    shift_id: int | None = Field(
        default=None,
        gt=0,
    )

    is_mon: bool | None = None
    is_tue: bool | None = None
    is_wed: bool | None = None
    is_thu: bool | None = None
    is_fri: bool | None = None
    is_sat: bool | None = None
    is_sun: bool | None = None

    is_active: bool | None = Field(
        default=None,
        description="สถานะใช้งาน TRUE = เปิดใช้งาน, FALSE = ปิดใช้งาน",
    )

    effective_from: date | None = None
    effective_to: date | None = None

    updated_by: str = Field(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )

    @model_validator(mode="after")
    def validate_date_range(self) -> "CheckpointScheduleUpdate":
        if (
            self.effective_from is not None
            and self.effective_to is not None
            and self.effective_to < self.effective_from
        ):
            raise ValueError(INVALID_EFFECTIVE_DATE_DETAIL)

        return self


class CheckpointScheduleAction(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    updated_by: str = Field(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )


class CheckpointScheduleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    schedule_id: int

    schedule_name: str
    shift_id: int

    is_mon: bool
    is_tue: bool
    is_wed: bool
    is_thu: bool
    is_fri: bool
    is_sat: bool
    is_sun: bool

    is_active: bool
    mark_flag: bool

    effective_from: date
    effective_to: date | None = None

    created_at: datetime
    updated_at: datetime

    created_by: str
    updated_by: str | None = None