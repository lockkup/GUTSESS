from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class RoleBase(BaseModel):
    role_name: str = Field(..., max_length=100)
    created_by: str = Field(..., max_length=6)


class RoleCreate(RoleBase):
    pass


class RoleUpdate(BaseModel):
    role_name: Optional[str] = Field(None, max_length=100)
    updated_by: str = Field(..., max_length=6)


class RoleResponse(RoleBase):
    role_id: int
    created_at: Optional[datetime]
    updated_at: Optional[datetime]
    updated_by: Optional[str]

    model_config = ConfigDict(from_attributes=True)