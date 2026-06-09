from __future__ import annotations

from app.schemas.auth import auth as auth_schema
from app.schemas.auth import password as password_schema

EmployeeInfo = getattr(auth_schema, "EmployeeInfo", None)
EmployeeLogin = getattr(auth_schema, "EmployeeLogin", None)
EmployeeRegister = getattr(auth_schema, "EmployeeRegister", None)
EmployeeResponse = getattr(auth_schema, "EmployeeResponse", None)
LoginRequest = getattr(auth_schema, "LoginRequest", None)
LoginResponse = getattr(auth_schema, "LoginResponse", None)
LogoutResponse = getattr(auth_schema, "LogoutResponse", None)

ChangePasswordRequest = getattr(password_schema, "ChangePasswordRequest", None)
ForgotPasswordRequest = getattr(password_schema, "ForgotPasswordRequest", None)
MessageResponse = getattr(password_schema, "MessageResponse", None)
ResetPasswordRequest = getattr(password_schema, "ResetPasswordRequest", None)

__all__ = [
    "ChangePasswordRequest",
    "EmployeeInfo",
    "EmployeeLogin",
    "EmployeeRegister",
    "EmployeeResponse",
    "ForgotPasswordRequest",
    "LoginRequest",
    "LoginResponse",
    "LogoutResponse",
    "MessageResponse",
    "ResetPasswordRequest",
]