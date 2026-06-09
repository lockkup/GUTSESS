from typing import Optional

from pydantic import BaseModel, Field


class ForgotPasswordRequest(BaseModel):
    employee_code: str = Field(..., min_length=6, max_length=6)
    # Legacy behavior: when true, send the current password to the user's email
    # (insecure; use only for backwards compatibility)
    send_plain_password: bool = False


class ChangePasswordRequest(BaseModel):
    employee_code: str = Field(..., min_length=6, max_length=6)
    old_password: str = Field(..., min_length=6, max_length=6)
    new_password: str = Field(..., min_length=6, max_length=6)


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=1, max_length=6)


class MessageResponse(BaseModel):
    message: str
