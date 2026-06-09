from __future__ import annotations

from typing import Any, Optional

# from app.core.security import get_password_hash  # TODO: Enable when ready for hashing
from app.core.registries.response_helper import response
from app.models.employees import Employees as Employee
from sqlalchemy.orm import Session


class EmployeeAuthService:
    """Service layer for employee authentication operations."""

    @staticmethod
    def register_employee(
        db: Session,
        employee_code: str,
        password: str,
        email: Optional[str],
        first_name: str,
        last_name: str,
        phone_number: Optional[str],
        birth_date,
        role_id: int,
        name_prefix_id: int,
        field_id: int,
        department_id: int,
        division_id: int,
        position_id: int,
        shift_id: int,
        address_id: Optional[int] = None,
        routes_id: Optional[int] = None,
        start_date: Optional[Any] = None,
        leave_date: Optional[Any] = None,
        created_by: str = "SYSTEM",
    ) -> Employee:
        """
        Register a new employee.

        Raises:
            HTTPException: If employee_code or email already exists
        """

        existing = (
            db.query(Employee)
            .filter(Employee.employee_code == employee_code)
            .first()
        )

        if existing:
            raise response.error("CLIENT.ER_CLIENT_2004")

        if email:
            existing_email = (
                db.query(Employee)
                .filter(Employee.email == email.lower())
                .first()
            )

            if existing_email:
                raise response.error("CLIENT.ER_CLIENT_2004")

        # Store plaintext password for now.
        # TODO: เปลี่ยนเป็น hash password ก่อนใช้จริงใน production
        # hashed_password = get_password_hash(password)

        db_employee = Employee(
            employee_code=employee_code,
            password=password,
            email=email.lower() if email else None,
            first_name=first_name,
            last_name=last_name,
            phone_number=phone_number,
            birth_date=birth_date,
            role_id=role_id,
            name_prefix_id=name_prefix_id,
            field_id=field_id,
            department_id=department_id,
            division_id=division_id,
            position_id=position_id,
            shift_id=shift_id,
            address_id=address_id,
            routes_id=routes_id,
            start_date=start_date,
            leave_date=leave_date,
            is_active=True,
            created_by=created_by,
        )

        db.add(db_employee)
        db.commit()
        db.refresh(db_employee)

        return db_employee

    @staticmethod
    def authenticate_employee(
        db: Session,
        employee_code: str,
        password: str,
    ) -> Employee:
        """
        Authenticate employee by code and password.

        Returns:
            Employee object if authentication successful

        Raises:
            HTTPException: If authentication fails
        """

        employee = (
            db.query(Employee)
            .filter(Employee.employee_code == employee_code)
            .first()
        )

        if not employee:
            raise response.error("AUTH.ER_AUTH_1009")

        if employee.password != password:
            raise response.error("AUTH.ER_AUTH_1006")

        if not employee.is_active:
            raise response.error("AUTH.ER_AUTH_1007")

        return employee


employee_auth_service = EmployeeAuthService()