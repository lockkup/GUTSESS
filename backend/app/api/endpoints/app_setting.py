# app/api/endpoints/app_setting.py

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core import get_db

router = APIRouter(tags=["App Settings"])


ATTENDANCE_ENABLE_FACE_VERIFY = "attendance_enable_face_verify"
GEO_DESIRED_ACCURACY_M = "geo_desired_accuracy_m"
GEO_MAX_ACCURACY_M = "geo_max_accuracy_m"
GEO_WATCH_WINDOW_MS = "geo_watch_window_ms"
GEO_HARD_TIMEOUT_MS = "geo_hard_timeout_ms"

REQUIRED_KEYS = [
    ATTENDANCE_ENABLE_FACE_VERIFY,
    GEO_DESIRED_ACCURACY_M,
    GEO_MAX_ACCURACY_M,
    GEO_WATCH_WINDOW_MS,
    GEO_HARD_TIMEOUT_MS,
]


def _to_bool(value: str, key: str) -> bool:
    raw = str(value).strip().lower()

    if raw in {"1", "true", "yes", "y", "on"}:
        return True

    if raw in {"0", "false", "no", "n", "off"}:
        return False

    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail=f"Invalid boolean app_setting value: {key}",
    )


def _to_positive_int(value: str, key: str) -> int:
    try:
        number = int(str(value).strip())
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Invalid number app_setting value: {key}",
        ) from exc

    if number <= 0:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Invalid number app_setting value: {key}",
        )

    return number


def _get_setting_map(db: Session) -> dict[str, str]:
    rows = db.execute(
        text(
            """
            SELECT setting_key, setting_value
            FROM app_setting
            WHERE setting_key IN :setting_keys
              AND is_active = 1
              AND mark_flag = 0
            """
        ),
        {"setting_keys": tuple(REQUIRED_KEYS)},
    ).mappings().all()

    setting_map = {
        str(row["setting_key"]): str(row["setting_value"])
        for row in rows
    }

    missing_keys = [
        key
        for key in REQUIRED_KEYS
        if key not in setting_map
    ]

    if missing_keys:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Missing app_setting keys: {', '.join(missing_keys)}",
        )

    return setting_map


@router.get(
    "/attendance-location",
    status_code=status.HTTP_200_OK,
)
def get_attendance_location_setting(
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    setting_map = _get_setting_map(db)

    return {
        "enable_face_verify": _to_bool(
            setting_map[ATTENDANCE_ENABLE_FACE_VERIFY],
            ATTENDANCE_ENABLE_FACE_VERIFY,
        ),
        "geo": {
            "desiredAccuracyM": _to_positive_int(
                setting_map[GEO_DESIRED_ACCURACY_M],
                GEO_DESIRED_ACCURACY_M,
            ),
            "maxAccuracyM": _to_positive_int(
                setting_map[GEO_MAX_ACCURACY_M],
                GEO_MAX_ACCURACY_M,
            ),
            "watchWindowMs": _to_positive_int(
                setting_map[GEO_WATCH_WINDOW_MS],
                GEO_WATCH_WINDOW_MS,
            ),
            "hardTimeoutMs": _to_positive_int(
                setting_map[GEO_HARD_TIMEOUT_MS],
                GEO_HARD_TIMEOUT_MS,
            ),
        },
    }