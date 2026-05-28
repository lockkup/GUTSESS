from __future__ import annotations

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field

from app.core.constants import DBConstants


class CheckpointScheduleChangeAction(str, Enum):
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"


class CheckpointScheduleChangeBase(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    employee_code: str = Field(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )

    schedule_id: int = Field(..., gt=0)

    action: CheckpointScheduleChangeAction


class CheckpointScheduleChangeCreate(CheckpointScheduleChangeBase):
    pass


class CheckpointScheduleChangeResponse(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
        extra="forbid",
    )

    checkpoint_schedule_change_id: int

    employee_code: str = Field(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )

    schedule_id: int = Field(..., gt=0)

    user_name: str = Field(
        ...,
        min_length=1,
        max_length=DBConstants.USER_NAME_LENGTH,
    )

    action: CheckpointScheduleChangeAction

    created_at: datetime