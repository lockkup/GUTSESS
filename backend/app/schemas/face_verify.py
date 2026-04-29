from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from app.core.constants import DBConstants


class FaceVerifyRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    employee_code: str = Field(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )
    face_embedding: list[float] = Field(
        ...,
        min_length=128,
        max_length=128,
    )


class FaceVerifyResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    is_match: bool
    message: str | None = None
    distance: float | None = None
    threshold: float | None = None