from app.api.dependencies import active_employee_required
from app.core.audit_logger import _extract_request_context, audit
from app.core.db.engine import get_db
from app.models.departments import Department
from app.models.employees import Employees as Employee
from app.models.name_prefixs import NamePrefix
from app.models.positions import Position
from app.models.roles import Role
from app.schemas.auth.auth import (
    EmployeeLogin,
    EmployeeRegister,
    EmployeeResponse,
    LoginResponse,
    LogoutResponse,
)
from app.services.auth.auth import employee_auth_service
from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

router = APIRouter(prefix="/auth", tags=["auth"])


# Employee registration
@router.post(
    "/register", response_model=EmployeeResponse, status_code=status.HTTP_201_CREATED
)
async def employee_register(
    request: Request, employee_data: EmployeeRegister, db: Session = Depends(get_db)
):
    # Delegate to service layer
    db_employee = employee_auth_service.register_employee(
        db=db,
        employee_code=employee_data.employee_code,
        password=employee_data.password,
        email=employee_data.email,
        first_name=employee_data.first_name,
        last_name=employee_data.last_name,
        phone_number=employee_data.phone_number,
        birth_date=employee_data.birth_date,
        role_id=employee_data.role_id,
        name_prefix_id=employee_data.name_prefix_id,
        field_id=employee_data.field_id,
        department_id=employee_data.department_id,
        division_id=employee_data.division_id,
        position_id=employee_data.position_id,
        shift_id=employee_data.shift_id,
        address_id=employee_data.address_id,
        routes_id=employee_data.routes_id,
        start_date=employee_data.start_date,
        leave_date=employee_data.leave_date,
    )

    # Audit registration success
    employee_full_name = (
        f"{db_employee.first_name} {db_employee.last_name}".strip()
        or db_employee.email
        or db_employee.employee_code
    )

    audit.log(
        action=f"[AUTH_REGISTER] Employee registered: {db_employee.employee_code}",
        user_name=employee_full_name,
        employee_code=db_employee.employee_code,
        **_extract_request_context(request),
    )

    return db_employee


# Employee login
@router.post("/login", response_model=LoginResponse)
async def employee_login(
    request: Request, credentials: EmployeeLogin, db: Session = Depends(get_db)
):
    # Look up employee for audit log name
    employee_lookup = (
        db.query(Employee)
        .filter(Employee.employee_code == credentials.employee_code)
        .first()
    )

    if employee_lookup:
        user_name = (
            f"{employee_lookup.first_name} {employee_lookup.last_name}".strip()
            or employee_lookup.email
            or credentials.employee_code
        )
    else:
        user_name = credentials.employee_code

    # Audit login attempt
    audit.action(
        "AUTH",
        "ACT_AUTH_001",
        request=request,
        user_name=user_name,
        employee_code=credentials.employee_code if employee_lookup else None,
        resource="Employee",
    )

    # Authenticate via service
    employee = employee_auth_service.authenticate_employee(
        db=db,
        employee_code=credentials.employee_code,
        password=credentials.password,
    )

    # Audit login success
    employee_full_name = (
        f"{employee.first_name} {employee.last_name}".strip()
        or employee.email
        or employee.employee_code
    )

    audit.action(
        "AUTH",
        "ACT_AUTH_003",
        request=request,
        user_name=employee_full_name,
        employee_code=employee.employee_code,
        resource="Employee",
    )

    # Resolve names instead of IDs
    db_role = db.query(Role).filter(Role.role_id == employee.role_id).first()

    db_position = (
        db.query(Position)
        .filter(Position.position_id == employee.position_id)
        .first()
    )

    db_prefix = (
        db.query(NamePrefix)
        .filter(NamePrefix.prefix_id == employee.name_prefix_id)
        .first()
    )

    db_dept = (
        db.query(Department)
        .filter(Department.department_id == employee.department_id)
        .first()
    )

    role_name = db_role.role_name if db_role else ""
    position_name = db_position.position_name if db_position else ""
    prefix_name = db_prefix.prefix_name if db_prefix else ""
    department_name = db_dept.department_name if db_dept else ""

    # ดึงค่าเขต/สายตรวจจาก Employees
    # ใช้ getattr เพื่อกัน error ถ้าบาง environment ยังไม่มี column นี้ใน model
    employee_department_id = getattr(employee, "department_id", None)
    employee_position_id = getattr(employee, "position_id", None)
    employee_division_id = getattr(employee, "division_id", None)
    employee_routes_id = getattr(employee, "routes_id", None)

    # Return employee info only (no tokens)
    return {
        "employee": {
            "employee_code": employee.employee_code,
            "email": employee.email,
            "first_name": employee.first_name,
            "last_name": employee.last_name,
            "role_name": role_name,
            "name_prefix": prefix_name,
            "position_name": position_name,
            "department_id": employee_department_id,
            "position_id": employee_position_id,
            "department_name": department_name,

            # เพิ่มสำหรับให้ Frontend รู้ว่า user มีเขต/สายตรวจหรือไม่
            "division_id": employee_division_id,

            # ฝั่ง DB ใช้ชื่อ routes_id แต่ Frontend ใช้ route_id ได้ง่ายกว่า
            # จึงส่งให้ทั้ง 2 ชื่อ เพื่อไม่กระทบโค้ดเดิม
            "route_id": employee_routes_id,
            "routes_id": employee_routes_id,
        },
        "message": "Login successful",
    }


# Employee logout (no token revocation, just audit logging)
@router.post("/logout", response_model=LogoutResponse)
@active_employee_required
async def employee_logout(
    current_employee: Employee = None,
    request: Request = None,
    db: Session = Depends(get_db),
):
    user_name = (
        f"{current_employee.first_name} {current_employee.last_name}".strip()
        or current_employee.email
        or current_employee.employee_code
    )

    # Single success audit — attempt is implied (no failure path)
    audit.action(
        "AUTH",
        "ACT_AUTH_006",
        request=request,
        user_name=user_name,
        employee_code=current_employee.employee_code,
        resource="Employee",
    )

    return {"message": "Successfully logged out", "tokens_revoked": 0}