# app/services/app_setting.py

from __future__ import annotations

from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.orm import Session


class AppSettingService:
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

    @staticmethod
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

    @staticmethod
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

    @classmethod
    def _get_setting_map(cls, db: Session) -> dict[str, str]:
        rows = db.execute(
            text(
                """
                SELECT setting_key, setting_value
                FROM app_setting
                WHERE setting_key IN (
                    :attendance_enable_face_verify,
                    :geo_desired_accuracy_m,
                    :geo_max_accuracy_m,
                    :geo_watch_window_ms,
                    :geo_hard_timeout_ms
                )
                  AND is_active = 1
                  AND mark_flag = 0
                """
            ),
            {
                "attendance_enable_face_verify": cls.ATTENDANCE_ENABLE_FACE_VERIFY,
                "geo_desired_accuracy_m": cls.GEO_DESIRED_ACCURACY_M,
                "geo_max_accuracy_m": cls.GEO_MAX_ACCURACY_M,
                "geo_watch_window_ms": cls.GEO_WATCH_WINDOW_MS,
                "geo_hard_timeout_ms": cls.GEO_HARD_TIMEOUT_MS,
            },
        ).mappings().all()

        setting_map = {
            str(row["setting_key"]): str(row["setting_value"])
            for row in rows
        }

        missing_keys = [
            key
            for key in cls.REQUIRED_KEYS
            if key not in setting_map
        ]

        if missing_keys:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Missing app_setting keys: {', '.join(missing_keys)}",
            )

        return setting_map

    @classmethod
    def get_attendance_location_setting(cls, db: Session) -> dict[str, Any]:
        setting_map = cls._get_setting_map(db)

        return {
            "enable_face_verify": cls._to_bool(
                setting_map[cls.ATTENDANCE_ENABLE_FACE_VERIFY],
                cls.ATTENDANCE_ENABLE_FACE_VERIFY,
            ),
            "geo": {
                "desiredAccuracyM": cls._to_positive_int(
                    setting_map[cls.GEO_DESIRED_ACCURACY_M],
                    cls.GEO_DESIRED_ACCURACY_M,
                ),
                "maxAccuracyM": cls._to_positive_int(
                    setting_map[cls.GEO_MAX_ACCURACY_M],
                    cls.GEO_MAX_ACCURACY_M,
                ),
                "watchWindowMs": cls._to_positive_int(
                    setting_map[cls.GEO_WATCH_WINDOW_MS],
                    cls.GEO_WATCH_WINDOW_MS,
                ),
                "hardTimeoutMs": cls._to_positive_int(
                    setting_map[cls.GEO_HARD_TIMEOUT_MS],
                    cls.GEO_HARD_TIMEOUT_MS,
                ),
            },
        }