from app.api.dependencies import active_employee_required
from app.core.audit_logger import audit
from app.core.db.engine import get_db, get_session
from app.core.registries.response_helper import response
from app.models.employees import Employees as Employee
from app.schemas.auth.password import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    MessageResponse,
)
from app.services.auth.password import (
    change_employee_password,
    send_reset_for_employee_code,
)
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

router = APIRouter(prefix="/auth", tags=["auth"])


# ─── Forgot Password ─────────────────────────────────────────────────────────


@router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password(
    req: Request,
    request: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
):
    try:
        # Look up employee first to get their name for audit log
        with get_session() as session:
            employee = session.execute(
                select(Employee).where(Employee.employee_code == request.employee_code)
            ).scalar_one_or_none()

            if employee:
                user_name = (
                    f"{employee.first_name} {employee.last_name}".strip()
                    or employee.email
                    or request.employee_code
                )
            else:
                user_name = request.employee_code

        # Audit attempt with employee name
        audit.action(
            "AUTH",
            "ACT_AUTH_007",
            request=req,
            user_name=user_name,
            employee_code=request.employee_code if employee else None,
            resource="Employee",
        )

        # Delegate lookup + enqueue to service
        result = send_reset_for_employee_code(
            request.employee_code,
            background_tasks,
            send_plain_password=request.send_plain_password,
        )

        # Log based on result
        if result["email_sent"]:
            audit.action(
                "AUTH",
                "ACT_AUTH_009",
                request=req,
                user_name=result["employee_name"],
                employee_code=request.employee_code,
                resource="Employee",
                email=result["email"],
            )

            return MessageResponse(
                message=(
                    "ส่งรหัสผ่านไปยังอีเมลเรียบร้อยแล้ว "
                    "กรุณาตรวจสอบอีเมลที่ลงทะเบียนไว้"
                )
            )

        # Failed - employee not found, inactive, or no email
        audit.action(
            "AUTH",
            "ACT_AUTH_008",
            request=req,
            user_name=result.get("employee_name") or request.employee_code,
            employee_code=request.employee_code if result["found"] else None,
            resource="Employee",
            reason=result["reason"],
        )

        if result["reason"] == "Employee not found":
            raise response.error("AUTH.ER_AUTH_1009")

        if result["reason"] == "Employee account is inactive":
            raise response.error("AUTH.ER_AUTH_1010")

        if result["reason"] == "Employee has no email registered":
            raise response.error("AUTH.ER_AUTH_1011")

        raise response.error("BACKEND.ER_BACKEND_3001")

    except HTTPException:
        raise
    except Exception as e:
        audit.error(
            "BACKEND",
            "ER_BACKEND_3001",
            request=req,
            user_name=request.employee_code,
            detail=str(e),
        )
        raise response.error("BACKEND.ER_BACKEND_3001") from e


# ─── Change Password ─────────────────────────────────────────────────────────


@router.post("/change-password", response_model=MessageResponse)
@active_employee_required
async def change_password(
    req: Request,
    request: ChangePasswordRequest,
    background_tasks: BackgroundTasks,
    current_employee: Employee = None,
    db: Session = Depends(get_db),
):
    user_name = (
        f"{current_employee.first_name} {current_employee.last_name}".strip()
        or current_employee.email
        or current_employee.employee_code
    )

    # Audit change attempt
    audit.action(
        "AUTH",
        "ACT_AUTH_010",
        request=req,
        user_name=user_name,
        employee_code=current_employee.employee_code,
        resource="Employee",
    )

    try:
        # Delegate to service, uses its own session internally
        change_employee_password(
            employee_code=current_employee.employee_code,
            old_password=request.old_password,
            new_password=request.new_password,
            background_tasks=background_tasks,
        )
    except HTTPException:
        raise
    except Exception as e:
        audit.error(
            "BACKEND",
            "ER_BACKEND_3001",
            request=req,
            user_name=user_name,
            detail=str(e),
        )
        raise response.error("BACKEND.ER_BACKEND_3001") from e

    # Audit success
    audit.action(
        "AUTH",
        "ACT_AUTH_011",
        request=req,
        user_name=user_name,
        employee_code=current_employee.employee_code,
        resource="Employee",
    )

    return MessageResponse(message="เปลี่ยนรหัสผ่านสำเร็จ")