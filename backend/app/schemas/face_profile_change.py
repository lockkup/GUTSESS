from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.core.constants import DBConstants


class FaceProfileChangeBase(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    employee_code: str = Field(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )

    face_profile_id: int = Field(..., gt=0)

    user_name: str = Field(
        ...,
        min_length=1,
        max_length=DBConstants.USER_NAME_LENGTH,
    )

    action: str = Field(
        ...,
        min_length=1,
        max_length=DBConstants.FACE_PROFILE_CHANGE_ACTION_LENGTH,
    )


class FaceProfileChangeCreate(FaceProfileChangeBase):
    pass


class FaceProfileChangeResponse(FaceProfileChangeBase):
    model_config = ConfigDict(
        from_attributes=True,
        extra="forbid",
        str_strip_whitespace=True,
    )

    face_profile_change_id: int
    created_at: datetime