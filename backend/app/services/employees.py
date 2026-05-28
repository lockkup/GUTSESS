from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.constants import DBConstants
from app.core.error_messages import EMPLOYEE_NOT_FOUND_DETAIL
from app.models.employees import Employees


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