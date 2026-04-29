from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.core.constants import DBConstants


class AuditLogBase(BaseModel):
    model_config = ConfigDict(extra="forbid")

    employee_code: str | None = Field(
        default=None,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )
    user_name: str = Field(
        ...,
        min_length=1,
        max_length=DBConstants.USER_NAME_LENGTH,
    )
    ip_address: str = Field(
        ...,
        min_length=1,
        max_length=DBConstants.IP_ADDRESS_LENGTH,
    )
    action: str = Field(..., min_length=1)


class AuditLogCreate(AuditLogBase):
    pass


class AuditLogResponse(AuditLogBase):
    log_id: int
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)