# app/schemas/time_record.py

from __future__ import annotations

import re
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.core.constants import DBConstants
from app.core.error_messages import INVALID_CHECK_TIME_FORMAT_DETAIL


_CHECK_TIME_PATTERN = re.compile(
    r"^(?:"
    r"([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?"
    r"|"
    r"\d{4}-\d{2}-\d{2}[ T]([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?"
    r")$"
)


def _validate_check_time_format(value: str) -> str:
    cleaned_value = value.strip()

    if not _CHECK_TIME_PATTERN.match(cleaned_value):
        raise ValueError(INVALID_CHECK_TIME_FORMAT_DETAIL)

    return cleaned_value


def _validate_lat_lng(
    lat: Decimal | None,
    lng: Decimal | None,
    lat_name: str,
    lng_name: str,
) -> None:
    if (lat is None) != (lng is None):
        raise ValueError(f"{lat_name} and {lng_name} must be provided together")

    if lat is not None and not (Decimal("-90") <= lat <= Decimal("90")):
        raise ValueError(f"{lat_name} must be between -90 and 90")

    if lng is not None and not (Decimal("-180") <= lng <= Decimal("180")):
        raise ValueError(f"{lng_name} must be between -180 and 180")


class TimeRecordBase(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    employee_code: str = Field(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )

    work_date: date


class TimeRecordCheckIn(TimeRecordBase):
    # ใช้เฉพาะกรณีมาจากตารางงานสายตรวจ
    # ถ้าเป็นลงเวลาเข้า-ออกงานปกติ ไม่ต้องส่ง shift_id
    shift_id: int | None = Field(default=None, gt=0)

    # ใช้เฉพาะกรณีมาจากตารางงานสายตรวจ
    # ถ้าเป็นลงเวลาเข้า-ออกงานปกติ ไม่ต้องส่ง assignment_id
    assignment_id: int | None = Field(default=None, gt=0)

    current_latitude: Decimal = Field(..., ge=Decimal("-90"), le=Decimal("90"))
    current_longitude: Decimal = Field(..., ge=Decimal("-180"), le=Decimal("180"))
    gps_accuracy: Decimal | None = Field(default=None, ge=0)

    checkin: str = Field(
        ...,
        min_length=1,
        max_length=DBConstants.CHECK_TIME_LENGTH,
    )

    checkin_lat: Decimal | None = None
    checkin_lng: Decimal | None = None

    checkin_remark: str | None = Field(
        default=None,
        max_length=DBConstants.REMARK_LENGTH,
    )

    images_checkin_1: str | None = None
    images_checkin_2: str | None = None

    created_by: str = Field(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )

    @field_validator("checkin")
    @classmethod
    def validate_checkin_format(cls, value: str) -> str:
        return _validate_check_time_format(value)

    @model_validator(mode="after")
    def validate_coordinates(self) -> "TimeRecordCheckIn":
        _validate_lat_lng(
            lat=self.checkin_lat,
            lng=self.checkin_lng,
            lat_name="checkin_lat",
            lng_name="checkin_lng",
        )
        return self


class TimeRecordCheckOut(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    # ใช้เฉพาะกรณีออกงานจากตารางงานสายตรวจ
    # ถ้าเป็นออกงานปกติ ไม่ต้องส่ง shift_id
    shift_id: int | None = Field(default=None, gt=0)

    # ใช้เฉพาะกรณีออกงานจากตารางงานสายตรวจ
    # ถ้าเป็นออกงานปกติ ไม่ต้องส่ง assignment_id
    assignment_id: int | None = Field(default=None, gt=0)

    current_latitude: Decimal = Field(..., ge=Decimal("-90"), le=Decimal("90"))
    current_longitude: Decimal = Field(..., ge=Decimal("-180"), le=Decimal("180"))
    gps_accuracy: Decimal | None = Field(default=None, ge=0)

    checkout: str = Field(
        ...,
        min_length=1,
        max_length=DBConstants.CHECK_TIME_LENGTH,
    )

    checkout_lat: Decimal | None = None
    checkout_lng: Decimal | None = None

    checkout_remark: str | None = Field(
        default=None,
        max_length=DBConstants.REMARK_LENGTH,
    )

    images_checkout_1: str | None = None
    images_checkout_2: str | None = None

    updated_by: str = Field(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )

    @field_validator("checkout")
    @classmethod
    def validate_checkout_format(cls, value: str) -> str:
        return _validate_check_time_format(value)

    @model_validator(mode="after")
    def validate_coordinates(self) -> "TimeRecordCheckOut":
        _validate_lat_lng(
            lat=self.checkout_lat,
            lng=self.checkout_lng,
            lat_name="checkout_lat",
            lng_name="checkout_lng",
        )
        return self


class TimeRecordResponse(TimeRecordBase):
    model_config = ConfigDict(
        from_attributes=True,
        extra="forbid",
        str_strip_whitespace=True,
    )

    time_record_id: int

    # ใช้รองรับข้อมูลรายงานตามผลัด
    # ข้อมูลเก่าหรือ attendance ปกติ อาจเป็น NULL
    shift_id: int | None = None

    checkin_location_id: int | None = None
    checkout_location_id: int | None = None

    checkin: str | None = None
    checkin_lat: Decimal | None = None
    checkin_lng: Decimal | None = None
    checkin_remark: str | None = None
    images_checkin_1: str | None = None
    images_checkin_2: str | None = None

    checkout: str | None = None
    checkout_lat: Decimal | None = None
    checkout_lng: Decimal | None = None
    checkout_remark: str | None = None
    images_checkout_1: str | None = None
    images_checkout_2: str | None = None

    # ปรับเป็น nullable เพื่อรองรับข้อมูลเก่าในฐานข้อมูล
    # ถ้า record เก่า created_at / updated_at / created_by เป็น NULL
    # จะไม่ทำให้ FastAPI response validation error เป็น 500
    created_at: datetime | None = None
    updated_at: datetime | None = None
    created_by: str | None = None
    updated_by: str | None = None


class TimeRecordListItemResponse(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
        extra="forbid",
        str_strip_whitespace=True,
    )

    time_record_id: int
    work_date: date

    # เผื่อ list-items ส่ง shift_id กลับมาด้วย
    shift_id: int | None = None

    location_id: int | None = None

    location_name: str = Field(
        ...,
        max_length=DBConstants.LOCATION_NAME_LENGTH,
    )

    status_code: str = Field(
        ...,
        max_length=DBConstants.TIME_RECORD_STATUS_CODE_LENGTH,
    )

    status_text: str = Field(
        ...,
        max_length=DBConstants.TIME_RECORD_STATUS_TEXT_LENGTH,
    )

    checkin: str | None = None
    checkout: str | None = None