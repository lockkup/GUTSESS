from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, computed_field

from app.core.constants import DBConstants


PENDING_EMBEDDING_VALUE = "PENDING_EMBEDDING"


class FaceProfileBase(BaseModel):
    model_config = ConfigDict(extra="forbid")
    is_active: bool = Field(default=True)


class FaceProfileCreate(FaceProfileBase):
    employee_code: str = Field(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )
    created_by: str = Field(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )


class FaceProfileUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    is_active: bool | None = None
    updated_by: str = Field(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )


class FaceProfileListResponse(BaseModel):
    face_profile_id: int
    employee_code: str
    reference_image: str
    is_active: bool
    mark_flag: bool
    created_at: datetime
    updated_at: datetime
    created_by: str
    updated_by: str | None = None

    face_embedding: str | None = Field(default=None, exclude=True)

    model_config = ConfigDict(from_attributes=True)

    @computed_field
    @property
    def reference_image_url(self) -> str | None:
        if not self.reference_image:
            return None

        normalized_path = self.reference_image.lstrip("/").replace("\\", "/")
        return f"/{normalized_path}"

    @computed_field
    @property
    def has_embedding(self) -> bool:
        face_embedding = (self.face_embedding or "").strip()
        return bool(face_embedding and face_embedding != PENDING_EMBEDDING_VALUE)

    @computed_field
    @property
    def embedding_status(self) -> str:
        face_embedding = (self.face_embedding or "").strip()

        if not self.reference_image:
            return "not_uploaded"

        if not face_embedding:
            return "pending"

        if face_embedding == PENDING_EMBEDDING_VALUE:
            return "pending"

        return "ready"


class FaceProfileResponse(FaceProfileListResponse):
    face_embedding: str | None = Field(default=None, exclude=False)