# backend/app/core/security/__init__.py
from __future__ import annotations

from app.core.security.auth import get_password_hash
from app.core.security.request_actor import extract_actor_employee_code
from app.core.security.reset_password import (
    create_reset_token,
    decode_reset_token,
)
from app.core.security.security import (
    create_access_token,
    hash_password,
    verify_password,
)


def get_actor_code_from_request(request):
    return extract_actor_employee_code(request)


def get_request_actor_code(request):
    return extract_actor_employee_code(request)


def extract_actor_code(request):
    return extract_actor_employee_code(request)


create_reset_password_token = create_reset_token
verify_reset_password_token = decode_reset_token
verify_reset_token = decode_reset_token


__all__ = [
    "hash_password",
    "get_password_hash",
    "verify_password",
    "create_access_token",
    "extract_actor_employee_code",
    "get_actor_code_from_request",
    "get_request_actor_code",
    "extract_actor_code",
    "create_reset_token",
    "decode_reset_token",
    "create_reset_password_token",
    "verify_reset_password_token",
    "verify_reset_token",
]