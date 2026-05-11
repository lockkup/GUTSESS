from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from app.core.constants import DBConstants


class RouteBase(BaseModel):
    model_config = ConfigDict(extra="forbid")

    route_id: int = Field(..., gt=0, examples=[1])
    route_name: str = Field(
        ...,
        max_length=DBConstants.LOCATION_NAME_LENGTH,
        examples=["เส้นทาง 1"],
    )
    is_active: bool = Field(
        default=True,
        examples=[True],
    )


class RouteResponse(RouteBase):
    model_config = ConfigDict(from_attributes=True)