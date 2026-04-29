from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.core.constants import DBConstants


class FaceProfileChangeBase(BaseModel):
    employee_code: str = Field(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )
    face_profile_id: int = Field(..., gt=0)
    user_name: str = Field(
        ...,
        max_length=DBConstants.USER_NAME_LENGTH,
    )
    action: str = Field(..., min_length=1)

    model_config = ConfigDict(extra="forbid")


class FaceProfileChangeCreate(FaceProfileChangeBase):
    pass


class FaceProfileChangeUpdate(BaseModel):
    employee_code: str | None = Field(
        default=None,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )
    face_profile_id: int | None = Field(default=None, gt=0)
    user_name: str | None = Field(
        default=None,
        max_length=DBConstants.USER_NAME_LENGTH,
    )
    action: str | None = Field(default=None, min_length=1)

    model_config = ConfigDict(extra="forbid")


class FaceProfileChangeResponse(FaceProfileChangeBase):
    face_profile_change_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)