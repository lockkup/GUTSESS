from __future__ import annotations

from typing import Final


class DBConstants:
    EMPLOYEE_CODE_LENGTH: Final[int] = 6
    FIRST_NAME_LENGTH: Final[int] = 150
    LAST_NAME_LENGTH: Final[int] = 150
    USER_NAME_LENGTH: Final[int] = 150
    IP_ADDRESS_LENGTH: Final[int] = 255
    SHIFT_NAME_LENGTH: Final[int] = 10
    LOCATION_NAME_LENGTH: Final[int] = 150
    LOCATION_DETAIL_LENGTH: Final[int] = 255
    CHECK_TIME_LENGTH: Final[int] = 20
    REMARK_LENGTH: Final[int] = 255
    FACE_REFERENCE_IMAGE_LENGTH: Final[int] = 255

    DEFAULT_PAGE_SKIP: Final[int] = 0
    DEFAULT_PAGE_LIMIT: Final[int] = 100
    MAX_PAGE_LIMIT: Final[int] = 1000

    DEFAULT_RADIUS_METER: Final[int] = 100
    DEFAULT_GRACE_METER: Final[int] = 0


INVALID_REFERENCE_DETAIL: Final[str] = "Invalid employees reference"