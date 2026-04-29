from __future__ import annotations

from datetime import date, datetime, time

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.core.constants import DBConstants


class ShiftBase(BaseModel):
    model_config = ConfigDict(extra="forbid")

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

    break_minutes: int = Field(0, ge=0)
    work_minutes: int = Field(..., ge=0)

    grace_in_minutes: int = Field(0, ge=0)
    grace_out_minutes: int = Field(0, ge=0)

    checkin_open_before_minutes: int = Field(0, ge=0)
    checkin_open_after_minutes: int = Field(0, ge=0)
    checkout_open_before_minutes: int = Field(0, ge=0)
    checkout_open_after_minutes: int = Field(0, ge=0)

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
    model_config = ConfigDict(extra="forbid")

    shift_name_en: str | None = Field(
        None,
        min_length=1,
        max_length=DBConstants.SHIFT_NAME_LENGTH,
    )
    shift_name_th: str | None = Field(
        None,
        min_length=1,
        max_length=DBConstants.SHIFT_NAME_LENGTH,
    )

    start_time: time | None = None
    end_time: time | None = None
    crosses_midnight: bool | None = None

    break_minutes: int | None = Field(None, ge=0)
    work_minutes: int | None = Field(None, ge=0)

    grace_in_minutes: int | None = Field(None, ge=0)
    grace_out_minutes: int | None = Field(None, ge=0)

    checkin_open_before_minutes: int | None = Field(None, ge=0)
    checkin_open_after_minutes: int | None = Field(None, ge=0)
    checkout_open_before_minutes: int | None = Field(None, ge=0)
    checkout_open_after_minutes: int | None = Field(None, ge=0)

    is_active: bool | None = None

    effective_from: date | None = None
    effective_to: date | None = None

    updated_by: str = Field(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )

    @model_validator(mode="after")
    def validate_partial_shift_logic(self) -> "ShiftUpdate":
        if (
            self.crosses_midnight is not None
            and self.start_time is not None
            and self.end_time is not None
        ):
            if not self.crosses_midnight and self.end_time <= self.start_time:
                raise ValueError(
                    "end_time must be greater than start_time when crosses_midnight is false"
                )

            if self.crosses_midnight and self.end_time >= self.start_time:
                raise ValueError(
                    "end_time must be less than start_time when crosses_midnight is true"
                )

        if (
            self.effective_from is not None
            and self.effective_to is not None
            and self.effective_to < self.effective_from
        ):
            raise ValueError(
                "effective_to must be greater than or equal to effective_from"
            )

        return self


class ShiftResponse(ShiftBase):
    shift_id: int
    mark_flag: bool
    created_at: datetime
    updated_at: datetime
    created_by: str
    updated_by: str | None = None

    model_config = ConfigDict(from_attributes=True)