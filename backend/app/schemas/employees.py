from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.core.constants import DBConstants


# ============================================================
# ใช้กับระบบเดิมของโปรเจกต์คุณ
# ห้ามลบ เพราะ endpoint เดิมอาจ import EmployeesResponse อยู่
# ============================================================


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

    # ชื่อสำหรับใช้แสดงผลบนหน้าเว็บ
    # ค่าเหล่านี้ต้องมาจากการ JOIN ใน EmployeesService
    field_name: str | None = None
    division_name: str | None = None
    route_name: str | None = None

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


# ============================================================
# Compatibility schemas จากระบบ Login ของทีม
# เป็น Pydantic schema เท่านั้น ไม่ได้สร้างตาราง employees ใหม่
# ============================================================


class EmployeeBase(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
        str_strip_whitespace=True,
    )

    password: str = Field(
        ...,
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
    field_id: int | None = None
    department_id: int | None = None
    division_id: int | None = None
    position_id: int | None = None
    routes_id: int | None = None
    shift_id: int | None = None

    is_active: bool = True

    start_date: date | None = None
    leave_date: date | None = None

    created_by: str = Field(
        ...,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )


class EmployeeCreate(EmployeeBase):
    employee_code: str = Field(
        ...,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )


class EmployeeUpdate(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
        str_strip_whitespace=True,
    )

    password: str | None = Field(
        default=None,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )

    role_id: int | None = None
    name_prefix_id: int | None = None

    first_name: str | None = Field(
        default=None,
        max_length=DBConstants.FIRST_NAME_LENGTH,
    )
    last_name: str | None = Field(
        default=None,
        max_length=DBConstants.LAST_NAME_LENGTH,
    )

    profile_image_path: str | None = None
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
    field_id: int | None = None
    department_id: int | None = None
    division_id: int | None = None
    position_id: int | None = None
    routes_id: int | None = None
    shift_id: int | None = None

    is_active: bool | None = None

    start_date: date | None = None
    leave_date: date | None = None

    updated_by: str | None = Field(
        default=None,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )


class EmployeeResponse(EmployeeBase):
    employee_code: str

    profile_image_updated_at: datetime | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    updated_by: str | None = None

    model_config = ConfigDict(from_attributes=True)
