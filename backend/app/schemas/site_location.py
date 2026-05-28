from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.core.constants import DBConstants


class SiteLocationBase(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    contract_code: str = Field(
        ...,
        min_length=1,
        max_length=DBConstants.CONTRACT_CODE_LENGTH,
    )

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

    effective_from: date

    effective_to: date | None = None

    by_contract: int | None = Field(
        default=None,
        ge=1,
    )

    is_active: bool = True

    @model_validator(mode="after")
    def validate_effective_dates(self):
        if self.effective_to is not None and self.effective_to < self.effective_from:
            raise ValueError(
                "effective_to must be greater than or equal to effective_from"
            )
        return self


class SiteLocationCreate(SiteLocationBase):
    created_by: str = Field(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )


class SiteLocationUpdate(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    contract_code: str | None = Field(
        default=None,
        min_length=1,
        max_length=DBConstants.CONTRACT_CODE_LENGTH,
    )

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

    radius_meter: int | None = Field(
        default=None,
        ge=0,
    )

    grace_meter: int | None = Field(
        default=None,
        ge=0,
    )

    location_detail: str | None = Field(
        default=None,
        max_length=DBConstants.LOCATION_DETAIL_LENGTH,
    )

    effective_from: date | None = None

    effective_to: date | None = None

    by_contract: int | None = Field(
        default=None,
        ge=1,
    )

    is_active: bool | None = None

    updated_by: str = Field(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )

    @model_validator(mode="after")
    def validate_effective_dates(self):
        if (
            self.effective_from is not None
            and self.effective_to is not None
            and self.effective_to < self.effective_from
        ):
            raise ValueError(
                "effective_to must be greater than or equal to effective_from"
            )
        return self


class SiteLocationAction(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    updated_by: str = Field(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )


class SiteLocationResponse(SiteLocationBase):
    model_config = ConfigDict(
        from_attributes=True,
        extra="forbid",
    )

    location_id: int
    mark_flag: bool
    created_at: datetime
    updated_at: datetime
    created_by: str
    updated_by: str | None = None