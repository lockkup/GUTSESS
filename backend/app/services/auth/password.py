from app.core.db.engine import get_session
from app.core.registries.response_helper import response
from app.models.employees import Employees as Employee
from app.services.email import (
    send_change_password_notification_email,
    send_plain_password_email,
)
from fastapi import BackgroundTasks, HTTPException
from sqlalchemy import select, update


def send_reset_for_employee_code(
    employee_code: str,
    background_tasks: BackgroundTasks,
    send_plain_password: bool = False,
) -> dict:
    """
    Lookup employee by employee_code and enqueue an email with the plain password.

    Returns dict with status info:
    {
        "found": bool,
        "email_sent": bool,
        "reason": str | None,
        "employee_name": str | None,
        "email": str | None
    }
    """
    with get_session() as session:
        row = session.execute(
            select(Employee).where(Employee.employee_code == employee_code)
        ).scalar_one_or_none()

        if not row:
            return {
                "found": False,
                "email_sent": False,
                "reason": "Employee not found",
                "employee_name": None,
                "email": None,
            }

        if not row.is_active:
            return {
                "found": True,
                "email_sent": False,
                "reason": "Employee account is inactive",
                "employee_name": f"{row.first_name} {row.last_name}".strip()
                or row.employee_code,
                "email": row.email,
            }

        if not row.email:
            return {
                "found": True,
                "email_sent": False,
                "reason": "Employee has no email registered",
                "employee_name": f"{row.first_name} {row.last_name}".strip()
                or row.employee_code,
                "email": None,
            }

        name = f"{row.first_name} {row.last_name}".strip() or row.employee_code

        background_tasks.add_task(
            send_plain_password_email,
            row.email,
            name,
            row.password,
            row.employee_code,
        )

        return {
            "found": True,
            "email_sent": True,
            "reason": None,
            "employee_name": name,
            "email": row.email,
        }


def change_employee_password(
    employee_code: str,
    old_password: str,
    new_password: str,
    background_tasks: BackgroundTasks,
) -> None:
    """
    Change an employee's password after verifying the old password.
    Sends a notification email with the new password.

    Raises:
        HTTPException: If employee not found, old password wrong, or account inactive.
    """
    with get_session() as session:
        row = session.execute(
            select(Employee).where(Employee.employee_code == employee_code)
        ).scalar_one_or_none()

        if not row:
            raise response.error("AUTH.ER_AUTH_1009")

        if not row.is_active:
            raise response.error("AUTH.ER_AUTH_1010")

        if row.password != old_password:
            raise response.error("AUTH.ER_AUTH_1012")

        if row.password == new_password:
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "SAME_PASSWORD",
                    "message": "รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม",
                    "contacts": [
                        {
                            "team": "SEC_OPS",
                            "email": "sec-ops@gutsess.com",
                        }
                    ],
                },
            )

        employee_name = f"{row.first_name} {row.last_name}".strip() or row.employee_code
        employee_email = row.email

        stmt = (
            update(Employee)
            .where(Employee.employee_code == employee_code)
            .values(password=new_password)
        )

        session.execute(stmt)
        session.commit()

        if employee_email:
            background_tasks.add_task(
                send_change_password_notification_email,
                employee_email,
                employee_name,
                new_password,
                employee_code,
            )