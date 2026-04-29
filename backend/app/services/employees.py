from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.employees import Employees
from app.schemas.employees import EmployeesCreate


class EmployeesService:
    @staticmethod
    def create_employees(db: Session, payload: EmployeesCreate) -> Employees:
        existing = db.get(Employees, payload.employee_code)
        if existing:
            raise ValueError(f"Employees '{payload.employee_code}' already exists")

        employees = Employees(
            employee_code=payload.employee_code,
            first_name=payload.first_name,
            last_name=payload.last_name,
            is_active=payload.is_active,
        )

        db.add(employees)
        db.commit()
        db.refresh(employees)

        return employees

    @staticmethod
    def get_employees(
        db: Session,
        skip: int = 0,
        limit: int = 100,
    ) -> list[Employees]:
        stmt = (
            select(Employees)
            .order_by(Employees.employee_code.asc())
            .offset(skip)
            .limit(limit)
        )

        return list(db.scalars(stmt).all())

    @staticmethod
    def get_employee_by_code(
        db: Session,
        employee_code: str,
    ) -> Employees | None:
        return db.get(Employees, employee_code)

    # เผื่อไฟล์อื่นเคยเรียกชื่อเดิมไว้ จะได้ไม่พัง
    @staticmethod
    def get_employees_by_code(
        db: Session,
        employee_code: str,
    ) -> Employees | None:
        return EmployeesService.get_employee_by_code(
            db=db,
            employee_code=employee_code,
        )