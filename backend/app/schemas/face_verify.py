from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from app.core.constants import DBConstants


class FaceVerifyRequest(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
        allow_inf_nan=False,
    )

    employee_code: str = Field(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )

    face_embedding: list[float] = Field(
        ...,
        min_length=DBConstants.FACE_EMBEDDING_DIMENSION,
        max_length=DBConstants.FACE_EMBEDDING_DIMENSION,
    )


class FaceVerifyResponse(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        allow_inf_nan=False,
    )

    is_match: bool
    message: str | None = None
    distance: float | None = None
    threshold: float | None = None