from __future__ import annotations

import contextvars
import logging
import threading
from typing import Optional

from fastapi import Request

from app.core.registries import ACTION_REGISTRY, RESPONSE_REGISTRY
from app.schemas.audit_logs import AuditLogCreate
from app.services.audit_logs import AuditLogService

_logger = logging.getLogger(__name__)
_service = AuditLogService()


# ─── Request context (auto-injected from middleware) ────────────────────────

_current_request: contextvars.ContextVar[Optional[Request]] = contextvars.ContextVar(
    "current_request", default=None
)
_current_user_name: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    "current_user_name", default=None
)
_current_employee_code: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    "current_employee_code", default=None
)


def set_audit_context(
    *, request: Request, user_name: str, employee_code: Optional[str] = None
) -> None:
    """Called by middleware to set the current audit context for this request."""
    _current_request.set(request)
    _current_user_name.set(user_name)
    _current_employee_code.set(employee_code)


def clear_audit_context() -> None:
    """Called by middleware after the request completes."""
    _current_request.set(None)
    _current_user_name.set(None)
    _current_employee_code.set(None)


# ─── Request context helpers ──────────────────────────────────────────────────


def get_client_ip(request: Request) -> str:
    """Extract the real client IP, respecting X-Forwarded-For proxies."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def get_geo_info(
    request: Request,
) -> tuple[Optional[str], Optional[str], Optional[str]]:
    """
    Return (latitude, longitude, geo_status) from request headers.
    Frontend sends X-Latitude / X-Longitude on success, or X-Geo-Status on denial.
    """
    lat = request.headers.get("X-Latitude")
    lng = request.headers.get("X-Longitude")
    status = request.headers.get("X-Geo-Status") or None
    if lat and lng:
        return lat, lng, "available"
    return None, None, status


_UA_DEVICE_MAP = [
    ("iPad", "iPad"),
    ("iPhone", "iPhone"),
    ("Android", "Android"),
]
_UA_OS_MAP = [
    ("Windows NT", "Windows"),
    ("Macintosh", "macOS"),
    ("iPhone", "iOS"),
    ("iPad", "iOS"),
    ("Android", "Android"),
    ("Linux", "Linux"),
]


def get_device_info(request: Request) -> tuple[str, str]:
    """Return (device_name, os_name) by parsing the User-Agent header."""
    ua = request.headers.get("User-Agent", "")
    device = next((d for kw, d in _UA_DEVICE_MAP if kw in ua), "Desktop")
    os_name = next((o for kw, o in _UA_OS_MAP if kw in ua), "Unknown")
    return device, os_name


def _extract_request_context(request: Optional[Request]) -> dict:
    """
    Build a combined ip_address string: {ip}/{geo}/{device}
    Examples:
      171.6.207.133/Latitude : 13.726 Longitude : 100.595/iPhone
      49.230.145.155/User denied the request for Geolocation./Windows
      1.2.3.4/unavailable/Desktop
    Returns ``{"ip_address": "unknown/unavailable/Desktop"}`` if no request.
    """
    if request is None:
        return {"ip_address": "unknown/unavailable/Desktop"}

    ip = get_client_ip(request)
    lat, lng, geo_status = get_geo_info(request)
    device, _os = get_device_info(request)

    if lat and lng:
        geo_part = f"Latitude : {lat} Longitude : {lng}"
    elif geo_status:
        geo_part = geo_status
    else:
        geo_part = "unavailable"

    return {"ip_address": f"{ip}/{geo_part}/{device}"}


# ─── Audit wrapper ────────────────────────────────────────────────────────────


def _resolve_context(
    request: Optional[Request],
    user_name: Optional[str],
    employee_code: Optional[str],
) -> tuple[Request, str, Optional[str]]:
    """Fall back to middleware-injected context when args are not passed."""
    req = request or _current_request.get()
    un = user_name or _current_user_name.get() or "SYSTEM"
    ec = employee_code or _current_employee_code.get()
    return req, un, ec


class _AuditWrapper:
    """
    Thin façade over AuditLogService.
    All writes are fire-and-forget (errors are logged, never raised).
    """

    # ── raw write ────────────────────────────────────────────────────────────

    def log(
        self,
        *,
        action: str,
        user_name: str,
        ip_address: str,
        employee_code: Optional[str] = None,
    ) -> None:
        """Persist one audit entry. Safe to call anywhere — never blocks the request.

        The DB write is executed in a background daemon thread so failures
        cannot delay or break request processing. Exceptions from the write
        are logged but not propagated.
        """
        payload = AuditLogCreate(
            employee_code=employee_code,
            user_name=user_name,
            ip_address=ip_address,
            action=action,
        )

        def _worker(p: AuditLogCreate) -> None:
            try:
                _service.create(p)
            except Exception as exc:  # pragma: no cover - audit must not raise
                _logger.error(
                    "audit.log failed in background thread: %s", exc, exc_info=True
                )

        try:
            t = threading.Thread(target=_worker, args=(payload,), daemon=True)
            t.start()
        except Exception as exc:  # pragma: no cover
            _logger.error(
                "failed to start audit background thread: %s", exc, exc_info=True
            )

    # ── action helper ────────────────────────────────────────────────────────

    def action(
        self,
        category: str,
        key: str,
        *,
        request: Optional[Request] = None,
        user_name: Optional[str] = None,
        employee_code: Optional[str] = None,
        **fmt_kwargs,
    ) -> None:
        """
        Look up an action in ACTION_REGISTRY and write it to audit_logs.

        Extra keyword arguments are interpolated into the message template,
        e.g. audit.action("DATA", "ACT_DAT_001", resource="employee", ...).

        Format: [ACT_KEY]ACTION_NAME | message

        If ``request``, ``user_name``, or ``employee_code`` are omitted they
        are automatically pulled from the middleware-injected audit context.
        """
        req, un, ec = _resolve_context(request, user_name, employee_code)
        try:
            entry = ACTION_REGISTRY[category][key]
            message_template: str = entry["message"]
            action_name: str = entry["action"]
            message = (
                message_template.format(**fmt_kwargs)
                if fmt_kwargs
                else message_template
            )
            full_action = f"[{key}]{action_name} | {message}"
        except KeyError:
            full_action = f"[UNKNOWN] {category}.{key}"

        self.log(
            action=full_action,
            user_name=un,
            employee_code=ec,
            **_extract_request_context(req),
        )

    # ── action with error details ────────────────────────────────────────────

    def action_with_error(
        self,
        category: str,
        key: str,
        *,
        request: Optional[Request] = None,
        user_name: Optional[str] = None,
        employee_code: Optional[str] = None,
        error_category: str,
        error_key: str,
        **fmt_kwargs,
    ) -> None:
        """
        Log action with detailed error information.
        Format: [ACT_KEY]ACTION | message | ERROR_KEY | ERROR_TYPE | ERROR_MESSAGE
        """
        req, un, ec = _resolve_context(request, user_name, employee_code)
        try:
            # Get action entry
            action_entry = ACTION_REGISTRY[category][key]
            action_name: str = action_entry["action"]
            message_template: str = action_entry["message"]
            message = (
                message_template.format(**fmt_kwargs)
                if fmt_kwargs
                else message_template
            )

            # Get error entry
            error_entry = RESPONSE_REGISTRY[error_category][error_key]
            error_type = error_entry["error"]
            error_message = error_entry["message"]

            # Format: [ACT_KEY]ACTION | message | ERROR_KEY | ERROR_TYPE | ERROR_MESSAGE
            full_action = f"[{key}]{action_name} | {message} | {error_key} | {error_type} | {error_message}"
        except KeyError:
            full_action = (
                f"[UNKNOWN] {category}.{key} | Error: {error_category}.{error_key}"
            )

        self.log(
            action=full_action,
            user_name=un,
            employee_code=ec,
            **_extract_request_context(req),
        )

    # ── error helper ─────────────────────────────────────────────────────────

    def error(
        self,
        category: str,
        key: str,
        *,
        request: Optional[Request] = None,
        user_name: Optional[str] = None,
        employee_code: Optional[str] = None,
        detail: str = "",
    ) -> None:
        """
        Look up an error in RESPONSE_REGISTRY and write it as an audit entry.
        Useful for auditing security violations, 404s, rate-limit hits, etc.
        """
        req, un, ec = _resolve_context(request, user_name, employee_code)
        try:
            entry = RESPONSE_REGISTRY[category][key]
            code = entry["code"]
            http_status = entry["http_status"]
            message = entry["message"]
            contacts_list = entry.get("contacts", [])
            contacts_str = ", ".join(
                f"{c.get('team') or c.get('role')} <{c.get('email')}>"
                for c in contacts_list
            )
            full_action = (
                f"[ERR-{code}] HTTP {http_status} | {message}"
                + (f" | detail={detail}" if detail else "")
                + (f" | contacts={contacts_str}" if contacts_str else "")
            )
        except KeyError:
            full_action = f"[ERR-UNKNOWN] {category}.{key}" + (
                f" | detail={detail}" if detail else ""
            )

        self.log(
            action=full_action,
            user_name=un,
            employee_code=ec,
            **_extract_request_context(req),
        )


# ─── Singleton ────────────────────────────────────────────────────────────────
audit = _AuditWrapper()
