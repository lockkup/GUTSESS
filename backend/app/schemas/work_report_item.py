from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.core.constants import DBConstants


MAX_WORK_REPORT_ITEM_IMAGES = 5

_NON_NULLABLE_UPDATE_FIELDS = (
    "work_item_type_id",
    "sequence_no",
    "is_active",
)


class WorkReportItemBase(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    work_report_id: int = Field(
        ...,
        gt=0,
    )

    work_item_type_id: int = Field(
        ...,
        gt=0,
    )

    work_item_other: str | None = Field(
        default=None,
        max_length=150,
    )

    sequence_no: int = Field(
        ...,
        ge=1,
        le=65_535,
    )

    work_item_detail: str | None = Field(
        default=None,
        max_length=500,
    )

    is_active: bool = Field(
        default=True,
        description=(
            "สถานะใช้งาน TRUE = เปิดใช้งาน, "
            "FALSE = ปิดใช้งาน"
        ),
    )


class WorkReportItemCreate(WorkReportItemBase):
    created_by: str = Field(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )


class WorkReportItemUpdate(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    work_item_type_id: int | None = Field(
        default=None,
        gt=0,
    )

    work_item_other: str | None = Field(
        default=None,
        max_length=150,
    )

    sequence_no: int | None = Field(
        default=None,
        ge=1,
        le=65_535,
    )

    work_item_detail: str | None = Field(
        default=None,
        max_length=500,
    )

    is_active: bool | None = None

    updated_by: str = Field(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )

    @model_validator(mode="before")
    @classmethod
    def validate_no_null_for_required_db_fields(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data

        null_fields = [
            field
            for field in _NON_NULLABLE_UPDATE_FIELDS
            if field in data and data[field] is None
        ]

        if null_fields:
            raise ValueError(f"{', '.join(null_fields)} cannot be null")

        return data


class WorkReportItemAction(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    updated_by: str = Field(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )


class WorkReportItemImagesSave(BaseModel):
    """
    Payload สำหรับบันทึก/แก้ไขรูปของ Work Report Item

    รองรับ 2 รูปแบบ

    1) Legacy mode
       - ไม่ส่ง image_ids
       - image_base64_values คือรูปสุดท้ายทั้งหมด

    2) Differential mode
       - image_ids ต้องเรียงตำแหน่งตรงกับ image_base64_values
       - int  = รูปเดิม ให้คงรูป/row เดิมไว้
       - None = รูปใหม่ หรือรูปที่ใช้แทนรูปเดิม
       - deleted_image_ids = id ของรูปเดิมที่ผู้ใช้ลบหรือเปลี่ยนออก
    """

    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    image_base64_values: list[str] = Field(
        default_factory=list,
        max_length=MAX_WORK_REPORT_ITEM_IMAGES,
    )

    image_ids: list[int | None] | None = Field(
        default=None,
        max_length=MAX_WORK_REPORT_ITEM_IMAGES,
    )

    deleted_image_ids: list[int] = Field(
        default_factory=list,
        max_length=MAX_WORK_REPORT_ITEM_IMAGES,
    )

    updated_by: str = Field(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )

    @model_validator(mode="after")
    def validate_image_changes(self) -> "WorkReportItemImagesSave":
        if self.image_ids is not None:
            if len(self.image_ids) != len(self.image_base64_values):
                raise ValueError(
                    "image_ids must have the same length as "
                    "image_base64_values"
                )

            existing_image_ids = [
                image_id
                for image_id in self.image_ids
                if image_id is not None
            ]

            if len(existing_image_ids) != len(set(existing_image_ids)):
                raise ValueError("image_ids contains duplicate image id")

            for image_id in existing_image_ids:
                if image_id <= 0:
                    raise ValueError("image_ids must contain positive ids")

            for image_id, image_value in zip(
                self.image_ids,
                self.image_base64_values,
            ):
                if image_id is None and not image_value.strip():
                    raise ValueError(
                        "new image must contain image_base64 value"
                    )

        if len(self.deleted_image_ids) != len(
            set(self.deleted_image_ids)
        ):
            raise ValueError(
                "deleted_image_ids contains duplicate image id"
            )

        if any(image_id <= 0 for image_id in self.deleted_image_ids):
            raise ValueError(
                "deleted_image_ids must contain positive ids"
            )

        if self.image_ids is not None:
            existing_image_id_set = {
                image_id
                for image_id in self.image_ids
                if image_id is not None
            }
            deleted_image_id_set = set(self.deleted_image_ids)

            if existing_image_id_set & deleted_image_id_set:
                raise ValueError(
                    "the same image cannot be kept and deleted "
                    "in one request"
                )

        return self


class WorkReportItemResponse(WorkReportItemBase):
    model_config = ConfigDict(
        from_attributes=True,
        extra="forbid",
        str_strip_whitespace=True,
    )

    work_report_item_id: int = Field(
        ...,
        gt=0,
    )

    active_sequence_no: int | None = Field(
        default=None,
        ge=1,
        le=65_535,
    )

    mark_flag: bool

    created_at: datetime
    updated_at: datetime

    created_by: str = Field(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )

    updated_by: str | None = Field(
        default=None,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )