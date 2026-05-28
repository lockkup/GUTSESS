from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.core.constants import DBConstants


class CheckpointScheduleItemChangeBase(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    employee_code: str = Field(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )

    schedule_item_id: int = Field(..., gt=0)

    action: str = Field(
        ...,
        min_length=1,
        max_length=DBConstants.CHECKPOINT_SCHEDULE_ITEM_CHANGE_ACTION_LENGTH,
    )


class CheckpointScheduleItemChangeCreate(CheckpointScheduleItemChangeBase):
    pass


class CheckpointScheduleItemChangeResponse(CheckpointScheduleItemChangeBase):
    model_config = ConfigDict(
        from_attributes=True,
        extra="forbid",
        str_strip_whitespace=True,
    )

    checkpoint_schedule_item_change_id: int

    user_name: str = Field(
        ...,
        min_length=1,
        max_length=DBConstants.USER_NAME_LENGTH,
    )

    created_at: datetime