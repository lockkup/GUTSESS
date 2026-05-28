from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.core.constants import DBConstants
from app.core.error_messages import INVALID_EFFECTIVE_DATE_DETAIL


class RouteSiteLocationBase(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    routes_id: int = Field(..., ge=1)
    division_id: int = Field(..., ge=1)
    location_id: int = Field(..., ge=1)

    effective_from: date
    effective_to: date | None = None

    is_active: bool = True
    mark_flag: bool = False

    @model_validator(mode="after")
    def validate_effective_date(self) -> "RouteSiteLocationBase":
        if self.effective_to is not None and self.effective_to < self.effective_from:
            raise ValueError(INVALID_EFFECTIVE_DATE_DETAIL)

        return self


class RouteSiteLocationCreate(RouteSiteLocationBase):
    created_by: str = Field(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )


class RouteSiteLocationUpdate(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    routes_id: int | None = Field(default=None, ge=1)
    division_id: int | None = Field(default=None, ge=1)
    location_id: int | None = Field(default=None, ge=1)

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
    def validate_effective_date(self) -> "RouteSiteLocationUpdate":
        if (
            self.effective_from is not None
            and self.effective_to is not None
            and self.effective_to < self.effective_from
        ):
            raise ValueError(INVALID_EFFECTIVE_DATE_DETAIL)

        return self


class RouteSiteLocationAction(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    updated_by: str = Field(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )


class RouteSiteLocationResponse(RouteSiteLocationBase):
    model_config = ConfigDict(
        from_attributes=True,
        extra="forbid",
        str_strip_whitespace=True,
    )

    route_site_location_id: int

    created_at: datetime
    updated_at: datetime

    created_by: str
    updated_by: str | None = None