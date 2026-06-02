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

    role_id: int | None = None
    name_prefix_id: int | None = None

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

    birth_date: date | None = None

    email: str | None = Field(
        default=None,
        max_length=DBConstants.EMAIL_LENGTH,
    )
    phone_number: str | None = Field(
        default=None,
        max_length=DBConstants.PHONE_NUMBER_LENGTH,
    )

    address_id: int | None = None

    # ตาราง employees เป็นของทีมอื่น ข้อมูลบางคนอาจเป็น NULL ได้
    field_id: int | None = None
    department_id: int | None = None
    division_id: int | None = None
    position_id: int | None = None

    routes_id: int | None = None

    # ไม่ใช้ shift_id จาก employees ใน flow ลงเวลา
    # เปิด nullable ไว้เพื่อไม่ให้ response พังถ้าข้อมูลเป็น NULL
    shift_id: int | None = None

    start_date: date | None = None
    leave_date: date | None = None

    is_active: bool | None = None

    created_at: datetime | None = None
    updated_at: datetime | None = None

    created_by: str | None = Field(
        default=None,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )
    updated_by: str | None = Field(
        default=None,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )