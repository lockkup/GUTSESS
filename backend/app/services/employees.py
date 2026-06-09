# backend/app/services/employees.py
from __future__ import annotations

from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.inspection import inspect as sa_inspect
from sqlalchemy.orm import Session

from app.core.constants import DBConstants
from app.core.error_messages import EMPLOYEE_NOT_FOUND_DETAIL
from app.models.employees import Employees


def employee_to_dict(employee: Employees) -> dict[str, Any]:
    """
    แปลง SQLAlchemy model เป็น dict
    ใช้แทน row.__dict__ เพื่อไม่ติด _sa_instance_state
    """
    return {
        attr.key: getattr(employee, attr.key)
        for attr in sa_inspect(employee).mapper.column_attrs
    }


class EmployeesService:
    @staticmethod
    def get_employees(
        db: Session,
        skip: int = DBConstants.DEFAULT_PAGE_SKIP,
        limit: int = DBConstants.DEFAULT_PAGE_LIMIT,
    ) -> list[Employees]:
        stmt = (
            select(Employees)
            .where(Employees.is_active.is_(True))
            .order_by(Employees.employee_code.asc())
            .offset(skip)
            .limit(limit)
        )

        return list(db.scalars(stmt).all())

    @staticmethod
    def get_employee_by_code(
        db: Session,
        employee_code: str,
    ) -> Employees:
        stmt = (
            select(Employees)
            .where(
                Employees.employee_code == employee_code,
                Employees.is_active.is_(True),
            )
        )

        employee = db.scalar(stmt)

        if employee is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=EMPLOYEE_NOT_FOUND_DETAIL,
            )

        return employee

    @staticmethod
    def get_employee_by_code_or_none(
        db: Session,
        employee_code: str,
    ) -> Employees | None:
        """
        ใช้กับระบบ login/auth:
        - เจอ = คืน Employees
        - ไม่เจอ = คืน None
        - ไม่ throw error เพื่อให้ auth service สร้าง error message เอง
        """
        stmt = select(Employees).where(Employees.employee_code == employee_code)

        return db.scalar(stmt)

    @staticmethod
    def get_active_employee_by_code_or_none(
        db: Session,
        employee_code: str,
    ) -> Employees | None:
        stmt = (
            select(Employees)
            .where(
                Employees.employee_code == employee_code,
                Employees.is_active.is_(True),
            )
        )

        return db.scalar(stmt)

    @staticmethod
    def get_employee_display_name(employee: Employees) -> str:
        first_name = getattr(employee, "first_name", "") or ""
        last_name = getattr(employee, "last_name", "") or ""
        email = getattr(employee, "email", "") or ""
        employee_code = getattr(employee, "employee_code", "") or ""

        return f"{first_name} {last_name}".strip() or email or employee_code


class EmployeeService:
    """
    Compatibility class สำหรับโค้ด login ของทีม
    แต่ยังใช้ model/session ของโปรเจกต์เราเป็นหลัก

    หมายเหตุ:
    - ไม่เปิด create/update/delete employee ใน service นี้ก่อน
    - เพราะตาราง employees เป็นของระบบหลัก/ทีมอื่น
    - ถ้าต้องการเปิด register จริง ค่อยทำแยกและตรวจ field ให้ตรง DB ก่อน
    """

    def list_employees(
        self,
        db: Session,
        department_id: int | None = None,
        division_id: int | None = None,
        field_id: int | None = None,
        role_id: int | None = None,
        is_active: bool | None = None,
    ) -> list[dict[str, Any]]:
        stmt = select(Employees)

        if department_id is not None:
            stmt = stmt.where(Employees.department_id == department_id)

        if division_id is not None:
            stmt = stmt.where(Employees.division_id == division_id)

        if field_id is not None:
            stmt = stmt.where(Employees.field_id == field_id)

        if role_id is not None:
            stmt = stmt.where(Employees.role_id == role_id)

        if is_active is not None:
            stmt = stmt.where(Employees.is_active == is_active)

        stmt = stmt.order_by(Employees.employee_code.asc())

        employees = list(db.scalars(stmt).all())

        return [employee_to_dict(employee) for employee in employees]

    def get_employee(
        self,
        db: Session,
        employee_code: str,
        active_only: bool = False,
    ) -> dict[str, Any]:
        if active_only:
            employee = EmployeesService.get_active_employee_by_code_or_none(
                db,
                employee_code,
            )
        else:
            employee = EmployeesService.get_employee_by_code_or_none(
                db,
                employee_code,
            )

        if employee is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=EMPLOYEE_NOT_FOUND_DETAIL,
            )

        return employee_to_dict(employee)

    def get_employee_model(
        self,
        db: Session,
        employee_code: str,
        active_only: bool = False,
    ) -> Employees:
        if active_only:
            employee = EmployeesService.get_active_employee_by_code_or_none(
                db,
                employee_code,
            )
        else:
            employee = EmployeesService.get_employee_by_code_or_none(
                db,
                employee_code,
            )

        if employee is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=EMPLOYEE_NOT_FOUND_DETAIL,
            )

        return employee

    def create_employee(self, *args: Any, **kwargs: Any) -> dict[str, Any]:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="ระบบนี้ยังไม่เปิดให้สร้างพนักงานจาก Auth Service",
        )

    def update_employee(self, *args: Any, **kwargs: Any) -> dict[str, Any]:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="ระบบนี้ยังไม่เปิดให้อัปเดตพนักงานจาก Auth Service",
        )

    def delete_employee(self, *args: Any, **kwargs: Any) -> dict[str, Any]:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="ระบบนี้ยังไม่เปิดให้ลบพนักงานจาก Auth Service",
        )


# instance เผื่อไฟล์ทีม import ใช้งานแบบ object
employees_service = EmployeesService()
employee_service = EmployeeService()