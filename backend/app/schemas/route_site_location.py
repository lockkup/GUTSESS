from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.core.constants import DBConstants


class RouteSiteLocationBase(BaseModel):
    model_config = ConfigDict(extra="forbid")

    routes_id: int = Field(..., gt=0)
    site_location_id: int = Field(..., gt=0)
    effective_from: date
    effective_to: date | None = None

    @model_validator(mode="after")
    def validate_date_range(self) -> "RouteSiteLocationBase":
        if self.effective_to is not None and self.effective_to < self.effective_from:
            raise ValueError(
                "effective_to must be greater than or equal to effective_from"
            )
        return self


class RouteSiteLocationCreate(RouteSiteLocationBase):
    created_by: str = Field(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )


class RouteSiteLocationUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    routes_id: int | None = Field(None, gt=0)
    site_location_id: int | None = Field(None, gt=0)
    effective_from: date | None = None
    effective_to: date | None = None

    updated_by: str = Field(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )

    @model_validator(mode="after")
    def validate_partial_date_range(self) -> "RouteSiteLocationUpdate":
        if (
            self.effective_from is not None
            and self.effective_to is not None
            and self.effective_to < self.effective_from
        ):
            raise ValueError(
                "effective_to must be greater than or equal to effective_from"
            )
        return self


class RouteSiteLocationResponse(RouteSiteLocationBase):
    route_site_location_id: int
    created_at: datetime
    updated_at: datetime
    created_by: str
    updated_by: str | None = None

    model_config = ConfigDict(from_attributes=True)