"""
ACTION_REGISTRY — canonical audit-log action codes and human labels.

Usage
-----
from app.core.registries import ACTION_REGISTRY

entry   = ACTION_REGISTRY["AUTH"]["LOGIN"]
code    = entry["code"]      # "AUTH_001"
message = entry["message"]   # "User logged in"

# For entries with placeholders, interpolate at call-time:
# ACTION_REGISTRY["DATA"]["CREATE"]["message"].format(resource="employee")
"""

from __future__ import annotations

ACTION_REGISTRY: dict[str, dict[str, dict]] = {
    "AUTH": {
        "ACT_AUTH_001": {
            "action": "LOGIN_ATTEMPT",
            "message": "{resource} Attempt to Login",
        },
        "ACT_AUTH_002": {
            "action": "LOGIN_FAILED",
            "message": "{resource} Login attempt failed",
        },
        "ACT_AUTH_003": {
            "action": "LOGIN_SUCCESS",
            "message": "{resource} Login successful",
        },
        "ACT_AUTH_004": {
            "action": "LOGOUT_ATTEMPT",
            "message": "{resource} Attempt to Logout",
        },
        "ACT_AUTH_005": {
            "action": "LOGOUT_FAILED",
            "message": "{resource} Logout failed",
        },
        "ACT_AUTH_006": {
            "action": "LOGOUT_SUCCESS",
            "message": "{resource} Logout successful",
        },
        "ACT_AUTH_007": {
            "action": "FORGOT_PASSWORD_ATTEMPT",
            "message": "{resource} attempted forgot-password request",
        },
        "ACT_AUTH_008": {
            "action": "FORGOT_PASSWORD_FAILED",
            "message": "{resource} Forgot-password request failed - {reason}",
        },
        "ACT_AUTH_009": {
            "action": "FORGOT_PASSWORD_EMAIL_SENT",
            "message": "{resource} Password reset email sent successfully to {email}",
        },
        "ACT_AUTH_010": {
            "action": "CHANGE_PASSWORD_ATTEMPT",
            "message": "{resource} attempted to change password",
        },
        "ACT_AUTH_011": {
            "action": "CHANGE_PASSWORD_SUCCESS",
            "message": "{resource} changed password successfully",
        },
        "ACT_AUTH_012": {
            "action": "RESET_PASSWORD_SUCCESS",
            "message": "Password reset successful",
        },
        "ACT_AUTH_013": {
            "action": "ACCOUNT_LOCKED",
            "message": "Account locked after repeated failures",
        },
    },
    "ATTENDANCE": {
        "ACT_ATT_001": {"action": "CLOCK_IN", "message": "Clock-in recorded"},
        "ACT_ATT_002": {"action": "CLOCK_OUT", "message": "Clock-out recorded"},
        "ACT_ATT_003": {"action": "CLOCK_IN_LATE", "message": "Late clock-in recorded"},
        "ACT_ATT_004": {
            "action": "CLOCK_OUT_EARLY",
            "message": "Early clock-out recorded",
        },
    },
    "DATA": {
        "ACT_DAT_001": {"action": "CREATE", "message": "Resource created: {resource}"},
        "ACT_DAT_002": {
            "action": "UPDATE",
            "message": "Resource updated: {resource} (id={id})",
        },
        "ACT_DAT_003": {
            "action": "DELETE",
            "message": "Resource deleted: {resource} (id={id})",
        },
        "ACT_DAT_004": {
            "action": "APPROVE",
            "message": "Resource approved: {resource} (id={id})",
        },
        "ACT_DAT_005": {
            "action": "REJECT",
            "message": "Resource rejected: {resource} (id={id})",
        },
        "ACT_DAT_006": {
            "action": "BULK_CREATE",
            "message": "Bulk create: {resource} ({count} records)",
        },
        "ACT_DAT_007": {
            "action": "BULK_DELETE",
            "message": "Bulk delete: {resource} ({count} records)",
        },
        "ACT_DAT_008": {"action": "EXPORT", "message": "Data exported: {resource}"},
        "ACT_DAT_009": {"action": "IMPORT", "message": "Data imported: {resource}"},
    },
    "SYSTEM": {
        "ACT_SYS_001": {"action": "STARTUP", "message": "Application started"},
        "ACT_SYS_002": {"action": "SHUTDOWN", "message": "Application stopped"},
        "ACT_SYS_003": {
            "action": "CONFIG_CHANGE",
            "message": "System configuration changed",
        },
        "ACT_SYS_004": {
            "action": "DB_MIGRATION",
            "message": "Database migration executed",
        },
    },
    "OTHER": {
        "ACT_OTH_001": {
            "action": "NEW FEARUEE",
            "message": "Seasonal OF Raining Season",
        },
    },
}
