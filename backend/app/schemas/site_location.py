from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.core.constants import DBConstants


class SiteLocationBase(BaseModel):
    model_config = ConfigDict(extra="forbid")

    location_name: str = Field(
        ...,
        min_length=1,
        max_length=DBConstants.LOCATION_NAME_LENGTH,
    )

    latitude: Decimal = Field(
        ...,
        ge=Decimal("-90"),
        le=Decimal("90"),
    )
    longitude: Decimal = Field(
        ...,
        ge=Decimal("-180"),
        le=Decimal("180"),
    )

    radius_meter: int = Field(
        default=DBConstants.DEFAULT_RADIUS_METER,
        ge=0,
    )
    grace_meter: int = Field(
        default=DBConstants.DEFAULT_GRACE_METER,
        ge=0,
    )

    location_detail: str | None = Field(
        default=None,
        max_length=DBConstants.LOCATION_DETAIL_LENGTH,
    )

    is_active: bool = Field(default=True)


class SiteLocationCreate(SiteLocationBase):
    created_by: str = Field(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )


class SiteLocationUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    location_name: str | None = Field(
        default=None,
        min_length=1,
        max_length=DBConstants.LOCATION_NAME_LENGTH,
    )

    latitude: Decimal | None = Field(
        default=None,
        ge=Decimal("-90"),
        le=Decimal("90"),
    )
    longitude: Decimal | None = Field(
        default=None,
        ge=Decimal("-180"),
        le=Decimal("180"),
    )

    radius_meter: int | None = Field(default=None, ge=0)
    grace_meter: int | None = Field(default=None, ge=0)

    location_detail: str | None = Field(
        default=None,
        max_length=DBConstants.LOCATION_DETAIL_LENGTH,
    )

    is_active: bool | None = Field(default=None)

    updated_by: str = Field(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )


class SiteLocationResponse(SiteLocationBase):
    location_id: int
    mark_flag: bool
    created_at: datetime
    updated_at: datetime
    created_by: str
    updated_by: str | None = None

    model_config = ConfigDict(from_attributes=True)