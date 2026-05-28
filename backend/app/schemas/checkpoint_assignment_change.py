from __future__ import annotations

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field

from app.core.constants import DBConstants


class CheckpointAssignmentChangeAction(str, Enum):
    CREATED = "created"
    UPDATED = "updated"
    CANCELLED = "cancelled"
    DELETED = "deleted"
    STATUS_CHANGED = "status_changed"
    RECHECK_CREATED = "recheck_created"


class CheckpointAssignmentChangeBase(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    employee_code: str = Field(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )

    assignment_id: int = Field(..., gt=0)

    user_name: str = Field(
        ...,
        min_length=1,
        max_length=DBConstants.USER_NAME_LENGTH,
    )

    action: CheckpointAssignmentChangeAction = Field(...)


class CheckpointAssignmentChangeCreate(CheckpointAssignmentChangeBase):
    pass


class CheckpointAssignmentChangeResponse(CheckpointAssignmentChangeBase):
    model_config = ConfigDict(
        from_attributes=True,
        extra="forbid",
        str_strip_whitespace=True,
    )

    checkpoint_assignment_change_id: int
    created_at: datetime