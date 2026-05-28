from __future__ import annotations

from typing import Final


class DBConstants:
    EMPLOYEE_CODE_LENGTH: Final[int] = 6
    PASSWORD_LENGTH: Final[int] = 6

    FIRST_NAME_LENGTH: Final[int] = 150
    LAST_NAME_LENGTH: Final[int] = 150
    USER_NAME_LENGTH: Final[int] = 150
    EMAIL_LENGTH: Final[int] = 100
    PHONE_NUMBER_LENGTH: Final[int] = 10
    IP_ADDRESS_LENGTH: Final[int] = 255

    SHIFT_NAME_LENGTH: Final[int] = 10
    SHIFT_CHANGE_ACTION_LENGTH: Final[int] = 50
    SHIFT_MINUTES_PER_DAY: Final[int] = 1440
    SHIFT_WORK_MINUTES_MAX: Final[int] = 1440
    SHIFT_BREAK_MINUTES_MAX: Final[int] = 1440
    SHIFT_GRACE_MINUTES_MAX: Final[int] = 1440
    SHIFT_OPEN_WINDOW_MINUTES_MAX: Final[int] = 1440

    CONTRACT_CODE_LENGTH: Final[int] = 15
    LOCATION_NAME_LENGTH: Final[int] = 150
    LOCATION_DETAIL_LENGTH: Final[int] = 255
    SITE_LOCATION_CHANGE_ACTION_LENGTH: Final[int] = 50

    ROUTE_NAME_LENGTH: Final[int] = 150
    DIVISION_NAME_LENGTH: Final[int] = 150
    ROUTE_SITE_LOCATION_CHANGE_ACTION_LENGTH: Final[int] = 50

    CHECK_TIME_LENGTH: Final[int] = 20
    CHECK_TIME_INPUT_FORMATS: Final[tuple[str, ...]] = (
        "%H:%M",
        "%H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%dT%H:%M",
        "%Y-%m-%dT%H:%M:%S",
    )
    REMARK_LENGTH: Final[int] = 255

    TIME_RECORD_STATUS_CODE_LENGTH: Final[int] = 50
    TIME_RECORD_STATUS_TEXT_LENGTH: Final[int] = 100

    FACE_REFERENCE_IMAGE_LENGTH: Final[int] = 255
    FACE_EMBEDDING_DIMENSION: Final[int] = 128
    FACE_PENDING_EMBEDDING_VALUE: Final[str] = "PENDING_EMBEDDING"
    FACE_VERIFY_THRESHOLD: Final[float] = 0.45
    FACE_PROFILE_CHANGE_ACTION_LENGTH: Final[int] = 50

    CHECKPOINT_SCHEDULE_NAME_LENGTH: Final[int] = 100
    CHECKPOINT_SCHEDULE_CHANGE_ACTION_LENGTH: Final[int] = 50
    CHECKPOINT_SCHEDULE_ITEM_CHANGE_ACTION_LENGTH: Final[int] = 50

    CHECKPOINT_ASSIGNMENT_STATUS_LENGTH: Final[int] = 30
    CHECKPOINT_ASSIGNMENT_CHANGE_ACTION_LENGTH: Final[int] = 50
    CHECKPOINT_CONTACT_PHONE_LENGTH: Final[int] = 30

    DEFAULT_PAGE_SKIP: Final[int] = 0
    DEFAULT_PAGE_LIMIT: Final[int] = 100
    MAX_PAGE_LIMIT: Final[int] = 1000

    DEFAULT_RADIUS_METER: Final[int] = 10
    DEFAULT_GRACE_METER: Final[int] = 0

    UNSIGNED_SMALLINT_MAX: Final[int] = 65535