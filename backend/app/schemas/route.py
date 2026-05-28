from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.core.constants import DBConstants


class RouteBase(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    route_name: str = Field(
        ...,
        min_length=1,
        max_length=DBConstants.ROUTE_NAME_LENGTH,
        examples=["เส้นทาง 1"],
    )

    is_active: bool = Field(
        default=True,
        examples=[True],
    )


class RouteResponse(RouteBase):
    model_config = ConfigDict(
        from_attributes=True,
        extra="forbid",
        str_strip_whitespace=True,
    )

    route_id: int = Field(
        ...,
        gt=0,
        examples=[1],
    )


class RouteDetailResponse(RouteResponse):
    model_config = ConfigDict(
        from_attributes=True,
        extra="forbid",
        str_strip_whitespace=True,
    )

    field_id: int = Field(..., gt=0, examples=[1])
    department_id: int = Field(..., gt=0, examples=[1])
    division_id: int = Field(..., gt=0, examples=[1])
    sector_id: int = Field(..., gt=0, examples=[1])
    zone_id: int = Field(..., gt=0, examples=[1])

    created_at: datetime = Field(
        ...,
        examples=["2026-05-13T10:30:00"],
    )

    updated_at: datetime = Field(
        ...,
        examples=["2026-05-13T10:30:00"],
    )

    created_by: str = Field(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        examples=["036259"],
    )

    updated_by: str | None = Field(
        default=None,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        examples=["036259"],
    )