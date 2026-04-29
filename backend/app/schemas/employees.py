from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from app.core.constants import DBConstants


class EmployeesBase(BaseModel):
    model_config = ConfigDict(extra="forbid")

    employee_code: str = Field(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        examples=["632070"],
    )
    first_name: str = Field(
        ...,
        max_length=DBConstants.FIRST_NAME_LENGTH,
        examples=["สุพจน์"],
    )
    last_name: str = Field(
        ...,
        max_length=DBConstants.LAST_NAME_LENGTH,
        examples=["หอมดอก"],
    )
    is_active: bool = Field(
        default=True,
        examples=[True],
    )


class EmployeesCreate(EmployeesBase):
    pass


class EmployeesUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    first_name: str | None = Field(
        default=None,
        max_length=DBConstants.FIRST_NAME_LENGTH,
        examples=["สุพจน์"],
    )
    last_name: str | None = Field(
        default=None,
        max_length=DBConstants.LAST_NAME_LENGTH,
        examples=["หอมดอก"],
    )
    is_active: bool | None = Field(
        default=None,
        examples=[True],
    )


class EmployeesResponse(EmployeesBase):
    model_config = ConfigDict(from_attributes=True)