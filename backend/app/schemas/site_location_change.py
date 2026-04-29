from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.core.constants import DBConstants


class SiteLocationChangeBase(BaseModel):
    model_config = ConfigDict(extra="forbid")

    employee_code: str = Field(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )
    location_id: int = Field(..., gt=0)
    user_name: str = Field(
        ...,
        max_length=DBConstants.USER_NAME_LENGTH,
    )
    action: str = Field(..., min_length=1)


class SiteLocationChangeCreate(SiteLocationChangeBase):
    pass


class SiteLocationChangeUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    employee_code: str | None = Field(
        default=None,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )
    location_id: int | None = Field(default=None, gt=0)
    user_name: str | None = Field(
        default=None,
        max_length=DBConstants.USER_NAME_LENGTH,
    )
    action: str | None = Field(default=None, min_length=1)


class SiteLocationChangeResponse(SiteLocationChangeBase):
    location_log_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)