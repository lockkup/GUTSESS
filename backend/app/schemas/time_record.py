from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.core.constants import DBConstants


def _validate_lat_lng(
    lat: Decimal | None,
    lng: Decimal | None,
    lat_name: str,
    lng_name: str,
) -> None:
    if lat is not None and not (Decimal("-90") <= lat <= Decimal("90")):
        raise ValueError(f"{lat_name} must be between -90 and 90")
    if lng is not None and not (Decimal("-180") <= lng <= Decimal("180")):
        raise ValueError(f"{lng_name} must be between -180 and 180")


# ==========================================
# 1) Base Schema
# ==========================================
class TimeRecordBase(BaseModel):
    model_config = ConfigDict(extra="forbid")

    employee_code: str = Field(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )
    shift_id: int = Field(..., gt=0)
    work_date: date


# ==========================================
# 2) Check-in
# ==========================================
class TimeRecordCheckIn(TimeRecordBase):
    checkin_location_id: int | None = Field(default=None, gt=0)

    checkin: str = Field(
        ...,
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

    @model_validator(mode="after")
    def validate_coordinates(self):
        _validate_lat_lng(
            self.checkin_lat,
            self.checkin_lng,
            "checkin_lat",
            "checkin_lng",
        )
        return self


# ==========================================
# 3) Check-out
# ==========================================
class TimeRecordCheckOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    checkout_location_id: int | None = Field(default=None, gt=0)

    checkout: str = Field(
        ...,
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

    updated_by: str | None = Field(
        default=None,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )

    @model_validator(mode="after")
    def validate_coordinates(self):
        _validate_lat_lng(
            self.checkout_lat,
            self.checkout_lng,
            "checkout_lat",
            "checkout_lng",
        )
        return self


# ==========================================
# 4) Full Response
# ==========================================
class TimeRecordResponse(TimeRecordBase):
    time_record_id: int

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

    created_at: datetime
    updated_at: datetime
    created_by: str
    updated_by: str | None = None

    model_config = ConfigDict(from_attributes=True, extra="forbid")


# ==========================================
# 5) List Item Response
# ==========================================
class TimeRecordListItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    time_record_id: int
    work_date: date

    location_id: int | None = None
    location_name: str

    status_code: str = Field(..., max_length=50)
    status_text: str = Field(..., max_length=100)

    checkin: str | None = None
    checkout: str | None = None