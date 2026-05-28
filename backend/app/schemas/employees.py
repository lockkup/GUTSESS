from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.core.constants import DBConstants


class EmployeesResponse(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
        extra="forbid",
        str_strip_whitespace=True,
    )

    employee_code: str = Field(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )

    role_id: int
    name_prefix_id: int

    first_name: str = Field(
        ...,
        max_length=DBConstants.FIRST_NAME_LENGTH,
    )
    last_name: str = Field(
        ...,
        max_length=DBConstants.LAST_NAME_LENGTH,
    )

    profile_image_path: str | None = None
    profile_image_updated_at: datetime | None = None

    birth_date: date

    email: str | None = Field(
        default=None,
        max_length=DBConstants.EMAIL_LENGTH,
    )
    phone_number: str | None = Field(
        default=None,
        max_length=DBConstants.PHONE_NUMBER_LENGTH,
    )

    address_id: int | None = None

    field_id: int
    department_id: int
    division_id: int
    position_id: int

    routes_id: int | None = None

    shift_id: int

    start_date: date | None = None
    leave_date: date | None = None

    is_active: bool

    created_at: datetime
    updated_at: datetime

    created_by: str = Field(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )
    updated_by: str | None = Field(
        default=None,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )