"""
RESPONSE_REGISTRY — structured API response catalogue for both errors and successes.

Each entry carries:
  type        — "error" | "success"
  http_status — HTTP status code to return (errors) or that was returned (success)
  message     — human-readable description (may contain {placeholders})
  error       — [error only] machine-readable error slug
  contacts    — [error only] numbered dict of responsible contacts, each with:
                  role  : team / role name
                  email : contact email
  action_code — [success only] corresponding ACTION_REGISTRY code for audit logging

Usage
-----
from app.core.registries import RESPONSE_REGISTRY

# Error
entry = RESPONSE_REGISTRY["CLIENT"]["ER_CLIENT_2002"]
raise HTTPException(status_code=entry["http_status"], detail=entry["message"])

# Success
entry = RESPONSE_REGISTRY["AUTH"]["SC_AUTH_001"]
"""

from __future__ import annotations

RESPONSE_REGISTRY: dict[str, dict[str, dict]] = {
    # ═══════════════════════════════════════════════════════════════════════
    # AUTH — Authentication & Account
    # ═══════════════════════════════════════════════════════════════════════
    "AUTH": {
        # ── Errors ──────────────────────────────────────────────────────
        "ER_AUTH_1001": {
            "type": "error",
            "http_status": 401,
            "error": "UNAUTHORIZED",
            "message": "จำเป็นต้องยืนยันตัวตน โปรดเข้าสู่ระบบ.",
            "contacts": [{"team": "SEC_OPS", "email": "sec-ops@gutsess.com"}],
        },
        "ER_AUTH_1002": {
            "type": "error",
            "http_status": 403,
            "error": "FORBIDDEN",
            "message": "Access denied. Insufficient permissions.",
            "contacts": [{"team": "SEC_OPS", "email": "sec-ops@gutsess.com"}],
        },
        "ER_AUTH_1003": {
            "type": "error",
            "http_status": 401,
            "error": "TOKEN_EXPIRED",
            "message": "Session expired. Please refresh your token.",
            "contacts": [{"team": "SEC_OPS", "email": "sec-ops@gutsess.com"}],
        },
        "ER_AUTH_1004": {
            "type": "error",
            "http_status": 407,
            "error": "PROXY_AUTH_REQUIRED",
            "message": "Proxy authentication required.",
            "contacts": [{"team": "INFRA_CORE", "email": "infra@gutsess.com"}],
        },
        "ER_AUTH_1005": {
            "type": "error",
            "http_status": 511,
            "error": "NETWORK_AUTH_REQUIRED",
            "message": "Network authentication required to gain access.",
            "contacts": [{"team": "INFRA_CORE", "email": "infra@gutsess.com"}],
        },
        "ER_AUTH_1006": {
            "type": "error",
            "http_status": 401,
            "error": "INVALID_CREDENTIALS",
            "message": "รหัสผ่านไม่ถูกต้อง",
            "contacts": [],
        },
        "ER_AUTH_1007": {
            "type": "error",
            "http_status": 403,
            "error": "ACCOUNT_INACTIVE",
            "message": "Account is inactive. Please contact administrator.",
            "contacts": [{"team": "SEC_OPS", "email": "sec-ops@gutsess.com"}],
        },
        "ER_AUTH_1008": {
            "type": "error",
            "http_status": 403,
            "error": "ACCOUNT_LOCKED",
            "message": "Account is locked due to multiple failed login attempts.",
            "contacts": [{"team": "SEC_OPS", "email": "sec-ops@gutsess.com"}],
        },
        "ER_AUTH_1009": {
            "type": "error",
            "http_status": 404,
            "error": "EMPLOYEE_NOT_FOUND",
            "message": "ไม่พบรหัสพนักงานในระบบ โปรดติดต่อฝ่ายทรัพยากรบุคคล.",
            "contacts": [],
        },
        "ER_AUTH_1010": {
            "type": "error",
            "http_status": 403,
            "error": "ACCOUNT_INACTIVE_FORGOT_PASSWORD",
            "message": "Employee account is inactive. Please contact Human Resources.",
            "contacts": [{"team": "HR_OPS", "email": "hr@gutsess.com"}],
        },
        "ER_AUTH_1011": {
            "type": "error",
            "http_status": 400,
            "error": "NO_EMAIL_REGISTERED",
            "message": "ไม่พบอีเมลที่ลงทะเบียนไว้สำหรับรหัสพนักงานนี้ โปรดติดต่อฝ่ายทรัพยากรบุคคล.",
            "contacts": [{"team": "HR_OPS", "email": "hr@gutsess.com"}],
        },
        "ER_AUTH_1012": {
            "type": "error",
            "http_status": 401,
            "error": "INVALID_OLD_PASSWORD",
            "message": "รหัสผ่านล่าสุดไม่ถูกต้อง",
            "contacts": [],
        },
        # ── Successes ────────────────────────────────────────────────────
        "SC_AUTH_001": {
            "type": "success",
            "http_status": 200,
            "message": "Login successful",
            "action_code": "ACT_AUTH_003",
        },
        "SC_AUTH_002": {
            "type": "success",
            "http_status": 200,
            "message": "Logout successful",
            "action_code": "ACT_AUTH_006",
        },
        "SC_AUTH_003": {
            "type": "success",
            "http_status": 201,
            "message": "Employee registered successfully",
            "action_code": "ACT_DAT_001",
        },
        "SC_AUTH_004": {
            "type": "success",
            "http_status": 200,
            "message": "Password changed successfully",
            "action_code": "ACT_AUTH_011",
        },
        "SC_AUTH_005": {
            "type": "success",
            "http_status": 200,
            "message": "Password reset email sent successfully to {email}",
            "action_code": "ACT_AUTH_009",
        },
    },
    # ═══════════════════════════════════════════════════════════════════════
    # DATA — CRUD operations (shared across resources)
    # ═══════════════════════════════════════════════════════════════════════
    "DATA": {
        # ── Successes ────────────────────────────────────────────────────
        "SC_DAT_001": {
            "type": "success",
            "http_status": 201,
            "message": "{resource} created successfully",
            "action_code": "ACT_DAT_001",
        },
        "SC_DAT_002": {
            "type": "success",
            "http_status": 200,
            "message": "{resource} updated successfully",
            "action_code": "ACT_DAT_002",
        },
        "SC_DAT_003": {
            "type": "success",
            "http_status": 200,
            "message": "{resource} deleted successfully",
            "action_code": "ACT_DAT_003",
        },
        "SC_DAT_004": {
            "type": "success",
            "http_status": 200,
            "message": "{resource} retrieved successfully",
        },
        "SC_DAT_005": {
            "type": "success",
            "http_status": 200,
            "message": "{resource} list retrieved successfully",
        },
    },
    # ═══════════════════════════════════════════════════════════════════════
    # CLIENT — 4xx client errors
    # ═══════════════════════════════════════════════════════════════════════
    "CLIENT": {
        "ER_CLIENT_2001": {
            "type": "error",
            "http_status": 400,
            "error": "BAD_REQUEST",
            "message": "The request was malformed or invalid.",
            "contacts": [{"team": "FE_DEV", "email": "fe-dev@gutsess.com"}],
        },
        "ER_CLIENT_2002": {
            "type": "error",
            "http_status": 404,
            "error": "NOT_FOUND",
            "message": "The requested resource could not be found.",
            "contacts": [{"team": "FE_DEV", "email": "fe-dev@gutsess.com"}],
        },
        "ER_CLIENT_2003": {
            "type": "error",
            "http_status": 405,
            "error": "METHOD_NOT_ALLOWED",
            "message": "HTTP method not supported for this endpoint.",
            "contacts": [{"team": "BE_DEV", "email": "be-dev@gutsess.com"}],
        },
        "ER_CLIENT_2004": {
            "type": "error",
            "http_status": 409,
            "error": "CONFLICT",
            "message": "Resource conflict detected (e.g., duplicate entry).",
            "contacts": [{"team": "BE_DEV", "email": "be-dev@gutsess.com"}],
        },
        "ER_CLIENT_2005": {
            "type": "error",
            "http_status": 422,
            "error": "UNPROCESSABLE_ENTITY",
            "message": "Validation failed for the provided data.",
            "contacts": [{"team": "BE_DEV", "email": "be-dev@gutsess.com"}],
        },
        "ER_CLIENT_2006": {
            "type": "error",
            "http_status": 429,
            "error": "TOO_MANY_REQUESTS",
            "message": "Rate limit exceeded. Please try again later.",
            "contacts": [{"team": "INFRA_CORE", "email": "infra@gutsess.com"}],
        },
        "ER_CLIENT_2007": {
            "type": "error",
            "http_status": 410,
            "error": "GONE",
            "message": "Resource is no longer available at this address.",
            "contacts": [{"team": "BE_DEV", "email": "be-dev@gutsess.com"}],
        },
        "ER_CLIENT_2008": {
            "type": "error",
            "http_status": 411,
            "error": "LENGTH_REQUIRED",
            "message": "Content-Length header is missing.",
            "contacts": [{"team": "BE_DEV", "email": "be-dev@gutsess.com"}],
        },
        "ER_CLIENT_2009": {
            "type": "error",
            "http_status": 412,
            "error": "PRECONDITION_FAILED",
            "message": "Request headers do not meet server preconditions.",
            "contacts": [{"team": "BE_DEV", "email": "be-dev@gutsess.com"}],
        },
        "ER_CLIENT_2010": {
            "type": "error",
            "http_status": 413,
            "error": "PAYLOAD_TOO_LARGE",
            "message": "The request body exceeds size limits.",
            "contacts": [{"team": "INFRA_CORE", "email": "infra@gutsess.com"}],
        },
        "ER_CLIENT_2011": {
            "type": "error",
            "http_status": 414,
            "error": "URI_TOO_LONG",
            "message": "The request URI is too long.",
            "contacts": [{"team": "FE_DEV", "email": "fe-dev@gutsess.com"}],
        },
        "ER_CLIENT_2012": {
            "type": "error",
            "http_status": 415,
            "error": "UNSUPPORTED_MEDIA_TYPE",
            "message": "Unsupported media format provided.",
            "contacts": [{"team": "BE_DEV", "email": "be-dev@gutsess.com"}],
        },
        "ER_CLIENT_2013": {
            "type": "error",
            "http_status": 417,
            "error": "EXPECTATION_FAILED",
            "message": "Server cannot meet Expect header requirements.",
            "contacts": [{"team": "BE_CORE", "email": "be-core@gutsess.com"}],
        },
        "ER_CLIENT_2014": {
            "type": "error",
            "http_status": 421,
            "error": "MISDIRECTED_REQUEST",
            "message": "Request sent to a server unable to produce a response.",
            "contacts": [{"team": "INFRA_CORE", "email": "infra@gutsess.com"}],
        },
        "ER_CLIENT_2015": {
            "type": "error",
            "http_status": 423,
            "error": "LOCKED",
            "message": "The resource is currently locked.",
            "contacts": [{"team": "BE_DEV", "email": "be-dev@gutsess.com"}],
        },
        "ER_CLIENT_2016": {
            "type": "error",
            "http_status": 424,
            "error": "FAILED_DEPENDENCY",
            "message": "Request failed due to failure of a previous request.",
            "contacts": [{"team": "BE_DEV", "email": "be-dev@gutsess.com"}],
        },
        "ER_CLIENT_2017": {
            "type": "error",
            "http_status": 426,
            "error": "UPGRADE_REQUIRED",
            "message": "Please upgrade to a newer protocol.",
            "contacts": [{"team": "SEC_OPS", "email": "sec-ops@gutsess.com"}],
        },
        "ER_CLIENT_2018": {
            "type": "error",
            "http_status": 451,
            "error": "UNAVAILABLE_FOR_LEGAL_REASONS",
            "message": "Resource blocked for legal reasons.",
            "contacts": [{"team": "LEGAL_OPS", "email": "legal@gutsess.com"}],
        },
    },
    # ═══════════════════════════════════════════════════════════════════════
    # BACKEND — 5xx server errors
    # ═══════════════════════════════════════════════════════════════════════
    "BACKEND": {
        "ER_BACKEND_3001": {
            "type": "error",
            "http_status": 500,
            "error": "INTERNAL_ERROR",
            "message": "An unexpected internal server error occurred.",
            "contacts": [{"team": "BE_CORE", "email": "be-core@gutsess.com"}],
        },
        "ER_BACKEND_3002": {
            "type": "error",
            "http_status": 501,
            "error": "NOT_IMPLEMENTED",
            "message": "This feature is not yet implemented.",
            "contacts": [{"team": "BE_CORE", "email": "be-core@gutsess.com"}],
        },
        "ER_BACKEND_3003": {
            "type": "error",
            "http_status": 502,
            "error": "BAD_GATEWAY",
            "message": "Received an invalid response from the upstream server.",
            "contacts": [{"team": "INFRA_CORE", "email": "infra@gutsess.com"}],
        },
        "ER_BACKEND_3004": {
            "type": "error",
            "http_status": 503,
            "error": "SERVICE_UNAVAILABLE",
            "message": "Server is temporarily offline for maintenance.",
            "contacts": [{"team": "INFRA_CORE", "email": "infra@gutsess.com"}],
        },
        "ER_BACKEND_3005": {
            "type": "error",
            "http_status": 504,
            "error": "GATEWAY_TIMEOUT",
            "message": "Upstream server timed out.",
            "contacts": [{"team": "INFRA_CORE", "email": "infra@gutsess.com"}],
        },
        "ER_BACKEND_3006": {
            "type": "error",
            "http_status": 505,
            "error": "HTTP_VERSION_NOT_SUPPORTED",
            "message": "HTTP version used is not supported.",
            "contacts": [{"team": "INFRA_CORE", "email": "infra@gutsess.com"}],
        },
        "ER_BACKEND_3007": {
            "type": "error",
            "http_status": 506,
            "error": "VARIANT_ALSO_NEGOTIATES",
            "message": "Internal configuration error in content negotiation.",
            "contacts": [{"team": "BE_CORE", "email": "be-core@gutsess.com"}],
        },
        "ER_BACKEND_3008": {
            "type": "error",
            "http_status": 507,
            "error": "INSUFFICIENT_STORAGE",
            "message": "Server is out of storage space.",
            "contacts": [{"team": "INFRA_CORE", "email": "infra@gutsess.com"}],
        },
        "ER_BACKEND_3009": {
            "type": "error",
            "http_status": 508,
            "error": "LOOP_DETECTED",
            "message": "Infinite loop detected during processing.",
            "contacts": [{"team": "BE_CORE", "email": "be-core@gutsess.com"}],
        },
    },
    # ═══════════════════════════════════════════════════════════════════════
    # DB — Database & persistence errors
    # ═══════════════════════════════════════════════════════════════════════
    "DB": {
        "ER_DB_501": {
            "type": "error",
            "http_status": 504,
            "error": "CONNECT_FAIL",
            "message": "Database connection timeout.",
            "contacts": [{"team": "DB_ADMIN", "email": "db-admin@gutsess.com"}],
        },
        "ER_DB_502": {
            "type": "error",
            "http_status": 503,
            "error": "HOST_BLOCKED",
            "message": "Database host is temporarily blocked due to connection errors. Please contact DB Admin.",
            "contacts": [{"team": "DB_ADMIN", "email": "db-admin@gutsess.com"}],
        },
        "ER_DB_6060": {
            "type": "error",
            "http_status": 500,
            "error": "QUERY_ERROR",
            "message": "Database query execution failed.",
            "contacts": [{"team": "DB_DEV", "email": "db-dev@gutsess.com"}],
        },
        "ER_DB_6061": {
            "type": "error",
            "http_status": 500,
            "error": "DATA_CORRUPTION",
            "message": "Data integrity check failed.",
            "contacts": [{"team": "DB_ADMIN", "email": "db-admin@gutsess.com"}],
        },
    },
    # ═══════════════════════════════════════════════════════════════════════
    # PAYMENT — Payment / billing errors
    # ═══════════════════════════════════════════════════════════════════════
    "PAYMENT": {
        "ER_PAYMENT_7001": {
            "type": "error",
            "http_status": 402,
            "error": "PAYMENT_REQUIRED",
            "message": "Payment is required to access this resource.",
            "contacts": [{"team": "BILLING_BE", "email": "billing@gutsess.com"}],
        },
    },
}
