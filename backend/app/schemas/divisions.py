from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class DivisionResponse(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
        extra="forbid",
        str_strip_whitespace=True,
    )

    division_id: int
    division_name: str
    field_id: int
    department_id: int
    is_active: bool

    created_at: datetime
    updated_at: datetime

    created_by: str
    updated_by: str | None = None