"""
response_helper — convenience helpers for raising errors / returning success
using the centralised RESPONSE_REGISTRY.

Usage in services
-----------------
    from app.core.registries.response_helper import response

    # Instead of:
    #   entry = ERROR_REGISTRY["CLIENT"]["ER_CLIENT_2002"]
    #   raise HTTPException(status_code=entry["http_status"], detail=entry["message"])

    # Do:
    raise response.error("CLIENT.ER_CLIENT_2002")

    # For success returns (standardised envelope):
    return response.success(data, "DATA.SC_DAT_001", resource="employee")
    return response.success({"detail": "Done"})
"""

from __future__ import annotations

from fastapi import HTTPException

from app.core.registries import RESPONSE_REGISTRY

# ── Error helper ─────────────────────────────────────────────────────────────


def error(key: str, **fmt_kwargs):
    """
    Look up *key* (``"CATEGORY.CODE"``) in RESPONSE_REGISTRY and
    raise an ``HTTPException`` with the configured status and detail dict.

    Examples
    --------
    raise response.error("CLIENT.ER_CLIENT_2004")
    raise response.error("AUTH.ER_AUTH_1009")
    """
    category, code = key.split(".", 1)
    try:
        entry = RESPONSE_REGISTRY[category][code]
    except KeyError:
        raise HTTPException(
            status_code=500,
            detail=f"Unknown response key: {key}",
        )

    message = entry["message"]
    if fmt_kwargs:
        message = message.format(**fmt_kwargs)

    raise HTTPException(
        status_code=entry["http_status"],
        detail={
            "error": entry.get("error", ""),
            "message": message,
            "contacts": entry.get("contacts", []),
        },
    )


# ── Success helper ───────────────────────────────────────────────────────────


def success(data=None, key=None, **fmt_kwargs):
    """
    Return a standardised success envelope dict.

    If *key* is provided it is looked up in RESPONSE_REGISTRY so the
    envelope includes ``status``, ``code``, ``message``, and ``data``.

    If *key* is ``None`` the envelope just contains ``{"status": "success"}``
    plus *data* if given.

    Examples
    --------
    return response.success(employee.__dict__, "DATA.SC_DAT_001", resource="employee")
    return response.success(key="AUTH.SC_AUTH_001")
    return response.success({"detail": "done"})
    """
    result = {"status": "success"}

    if key:
        category, code = key.split(".", 1)
        try:
            entry = RESPONSE_REGISTRY[category][code]
        except KeyError:
            result["code"] = code
            result["message"] = ""
        else:
            message = entry["message"]
            if fmt_kwargs:
                message = message.format(**fmt_kwargs)
            result["code"] = code
            result["message"] = message

    if data is not None:
        result["data"] = data

    return result


# ── Singleton-style convenience ──────────────────────────────────────────────


class _ResponseHelper:
    """Provides ``response.error(...)`` and ``response.success(...)``."""

    @staticmethod
    def error(key: str, **fmt_kwargs):
        return error(key, **fmt_kwargs)

    @staticmethod
    def success(data=None, key=None, **fmt_kwargs):
        return success(data, key, **fmt_kwargs)


response = _ResponseHelper()
__all__ = ["response", "error", "success"]
