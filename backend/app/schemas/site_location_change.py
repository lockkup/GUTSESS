from __future__ import annotations

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field

from app.core.constants import DBConstants


class SiteLocationChangeAction(str, Enum):
    CREATE = "create"
    UPDATE = "update"
    ACTIVATE = "activate"
    DEACTIVATE = "deactivate"
    DELETE = "delete"


class SiteLocationChangeBase(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    employee_code: str = Field(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )

    location_id: int = Field(..., gt=0)

    action: SiteLocationChangeAction


class SiteLocationChangeCreate(SiteLocationChangeBase):
    pass


class SiteLocationChangeResponse(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
        extra="forbid",
        str_strip_whitespace=True,
    )

    location_log_id: int

    employee_code: str = Field(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )

    location_id: int = Field(..., gt=0)

    user_name: str = Field(
        ...,
        min_length=1,
        max_length=DBConstants.USER_NAME_LENGTH,
    )

    action: SiteLocationChangeAction

    created_at: datetime