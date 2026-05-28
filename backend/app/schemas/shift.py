from __future__ import annotations

from datetime import date, datetime, time

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.core.constants import DBConstants


def _to_minutes(value: time) -> int:
    return value.hour * 60 + value.minute


def calculate_shift_duration_minutes(
    start_time: time,
    end_time: time,
    crosses_midnight: bool,
) -> int:
    start_minutes = _to_minutes(start_time)
    end_minutes = _to_minutes(end_time)

    if crosses_midnight:
        return DBConstants.SHIFT_MINUTES_PER_DAY - start_minutes + end_minutes

    return end_minutes - start_minutes


class ShiftBase(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    shift_name_en: str = Field(
        ...,
        min_length=1,
        max_length=DBConstants.SHIFT_NAME_LENGTH,
    )
    shift_name_th: str = Field(
        ...,
        min_length=1,
        max_length=DBConstants.SHIFT_NAME_LENGTH,
    )

    start_time: time
    end_time: time
    crosses_midnight: bool = False

    break_minutes: int = Field(
        default=0,
        ge=0,
        le=DBConstants.SHIFT_BREAK_MINUTES_MAX,
    )
    work_minutes: int = Field(
        ...,
        gt=0,
        le=DBConstants.SHIFT_WORK_MINUTES_MAX,
    )

    grace_in_minutes: int = Field(
        default=0,
        ge=0,
        le=DBConstants.SHIFT_GRACE_MINUTES_MAX,
    )
    grace_out_minutes: int = Field(
        default=0,
        ge=0,
        le=DBConstants.SHIFT_GRACE_MINUTES_MAX,
    )

    checkin_open_before_minutes: int = Field(
        default=0,
        ge=0,
        le=DBConstants.SHIFT_OPEN_WINDOW_MINUTES_MAX,
    )
    checkin_open_after_minutes: int = Field(
        default=0,
        ge=0,
        le=DBConstants.SHIFT_OPEN_WINDOW_MINUTES_MAX,
    )
    checkout_open_before_minutes: int = Field(
        default=0,
        ge=0,
        le=DBConstants.SHIFT_OPEN_WINDOW_MINUTES_MAX,
    )
    checkout_open_after_minutes: int = Field(
        default=0,
        ge=0,
        le=DBConstants.SHIFT_OPEN_WINDOW_MINUTES_MAX,
    )

    is_active: bool = True

    effective_from: date
    effective_to: date | None = None

    @model_validator(mode="after")
    def validate_shift_logic(self) -> "ShiftBase":
        if not self.crosses_midnight and self.end_time <= self.start_time:
            raise ValueError(
                "end_time must be greater than start_time when crosses_midnight is false"
            )

        if self.crosses_midnight and self.end_time >= self.start_time:
            raise ValueError(
                "end_time must be less than start_time when crosses_midnight is true"
            )

        shift_duration_minutes = calculate_shift_duration_minutes(
            start_time=self.start_time,
            end_time=self.end_time,
            crosses_midnight=self.crosses_midnight,
        )

        if self.break_minutes >= shift_duration_minutes:
            raise ValueError(
                "break_minutes must be less than total shift duration"
            )

        available_work_minutes = shift_duration_minutes - self.break_minutes
        if self.work_minutes > available_work_minutes:
            raise ValueError(
                "work_minutes must be less than or equal to shift duration minus break_minutes"
            )

        if self.effective_to is not None and self.effective_to < self.effective_from:
            raise ValueError(
                "effective_to must be greater than or equal to effective_from"
            )

        return self


class ShiftCreate(ShiftBase):
    created_by: str = Field(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )


class ShiftUpdate(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    shift_name_en: str | None = Field(
        default=None,
        min_length=1,
        max_length=DBConstants.SHIFT_NAME_LENGTH,
    )
    shift_name_th: str | None = Field(
        default=None,
        min_length=1,
        max_length=DBConstants.SHIFT_NAME_LENGTH,
    )

    start_time: time | None = None
    end_time: time | None = None
    crosses_midnight: bool | None = None

    break_minutes: int | None = Field(
        default=None,
        ge=0,
        le=DBConstants.SHIFT_BREAK_MINUTES_MAX,
    )
    work_minutes: int | None = Field(
        default=None,
        gt=0,
        le=DBConstants.SHIFT_WORK_MINUTES_MAX,
    )

    grace_in_minutes: int | None = Field(
        default=None,
        ge=0,
        le=DBConstants.SHIFT_GRACE_MINUTES_MAX,
    )
    grace_out_minutes: int | None = Field(
        default=None,
        ge=0,
        le=DBConstants.SHIFT_GRACE_MINUTES_MAX,
    )

    checkin_open_before_minutes: int | None = Field(
        default=None,
        ge=0,
        le=DBConstants.SHIFT_OPEN_WINDOW_MINUTES_MAX,
    )
    checkin_open_after_minutes: int | None = Field(
        default=None,
        ge=0,
        le=DBConstants.SHIFT_OPEN_WINDOW_MINUTES_MAX,
    )
    checkout_open_before_minutes: int | None = Field(
        default=None,
        ge=0,
        le=DBConstants.SHIFT_OPEN_WINDOW_MINUTES_MAX,
    )
    checkout_open_after_minutes: int | None = Field(
        default=None,
        ge=0,
        le=DBConstants.SHIFT_OPEN_WINDOW_MINUTES_MAX,
    )

    effective_from: date | None = None
    effective_to: date | None = None

    updated_by: str = Field(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )

    @model_validator(mode="after")
    def validate_effective_dates(self) -> "ShiftUpdate":
        if (
            self.effective_from is not None
            and self.effective_to is not None
            and self.effective_to < self.effective_from
        ):
            raise ValueError(
                "effective_to must be greater than or equal to effective_from"
            )

        return self


class ShiftAction(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    updated_by: str = Field(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )


class ShiftResponse(ShiftBase):
    model_config = ConfigDict(
        from_attributes=True,
        extra="forbid",
        str_strip_whitespace=True,
    )

    shift_id: int
    mark_flag: bool
    created_at: datetime
    updated_at: datetime
    created_by: str
    updated_by: str | None = None