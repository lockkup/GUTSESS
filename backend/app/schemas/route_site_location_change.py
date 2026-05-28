from __future__ import annotations

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field

from app.core.constants import DBConstants


class RouteSiteLocationChangeAction(str, Enum):
    CREATE = "CREATE"
    UPDATE = "UPDATE"
    DELETE = "DELETE"
    RESTORE = "RESTORE"


class RouteSiteLocationChangeBase(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
        use_enum_values=True,
    )

    employee_code: str = Field(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )

    route_site_location_id: int = Field(
        ...,
        gt=0,
    )

    user_name: str = Field(
        ...,
        min_length=1,
        max_length=DBConstants.USER_NAME_LENGTH,
    )

    action: RouteSiteLocationChangeAction


class RouteSiteLocationChangeCreate(RouteSiteLocationChangeBase):
    pass


class RouteSiteLocationChangeResponse(RouteSiteLocationChangeBase):
    model_config = ConfigDict(
        from_attributes=True,
        extra="forbid",
        str_strip_whitespace=True,
        use_enum_values=True,
    )

    route_site_location_change_id: int
    created_at: datetime