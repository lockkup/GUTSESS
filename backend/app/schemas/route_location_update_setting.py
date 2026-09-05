from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.core.constants import DBConstants
from app.core.error_messages import INVALID_EFFECTIVE_DATE_DETAIL


class RouteLocationUpdateSettingBase(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    department_id: int = Field(..., ge=1)
    division_id: int = Field(..., ge=1)
    route_id: int = Field(..., ge=1)

    # อนุญาตทั้งการแก้พิกัดจาก GPS และการแก้ไขระยะรัศมี
    allow_location_update: bool = False

    effective_from: date | None = None
    effective_to: date | None = None

    is_active: bool = True
    mark_flag: bool = False

    @model_validator(mode="after")
    def validate_effective_date(self) -> "RouteLocationUpdateSettingBase":
        if (
            self.effective_from is not None
            and self.effective_to is not None
            and self.effective_to < self.effective_from
        ):
            raise ValueError(INVALID_EFFECTIVE_DATE_DETAIL)

        return self


class RouteLocationUpdateSettingCreate(RouteLocationUpdateSettingBase):
    created_by: str = Field(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )


class RouteLocationUpdateSettingUpdate(BaseModel):
    """Service ใช้ exclude_unset=True เพื่อแยกฟิลด์ที่ไม่ส่งกับฟิลด์ที่ส่ง null.

    วันที่อนุญาตให้ส่ง null ได้ตาม Model ส่วนฟิลด์ NOT NULL ต้องตรวจใน Service.
    ต้องตรวจช่วงวันที่ซ้ำหลังรวมค่าที่ส่งมากับข้อมูลเดิมก่อนบันทึก.
    """

    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    department_id: int | None = Field(default=None, ge=1)
    division_id: int | None = Field(default=None, ge=1)
    route_id: int | None = Field(default=None, ge=1)

    allow_location_update: bool | None = None

    effective_from: date | None = None
    effective_to: date | None = None

    is_active: bool | None = None
    mark_flag: bool | None = None

    updated_by: str = Field(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )

    @model_validator(mode="after")
    def validate_effective_date(self) -> "RouteLocationUpdateSettingUpdate":
        if (
            self.effective_from is not None
            and self.effective_to is not None
            and self.effective_to < self.effective_from
        ):
            raise ValueError(INVALID_EFFECTIVE_DATE_DETAIL)

        return self


class RouteLocationUpdateSettingAction(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    updated_by: str = Field(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )


class RouteLocationUpdateSettingResponse(RouteLocationUpdateSettingBase):
    model_config = ConfigDict(
        from_attributes=True,
        extra="forbid",
        str_strip_whitespace=True,
    )

    id: int

    created_at: datetime
    updated_at: datetime

    created_by: str | None = None
    updated_by: str | None = None
