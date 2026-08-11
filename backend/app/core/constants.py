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

    PATROL_AREA_SEARCH_KEYWORD_LENGTH: Final[int] = 255
    PATROL_AREA_SEARCH_DEFAULT_LIMIT: Final[int] = 20
    PATROL_AREA_SEARCH_MAX_LIMIT: Final[int] = 100

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

    # =========================
    # Report Export Job
    # =========================
    # ตัวอย่าง: patrol_report
    REPORT_EXPORT_TYPE_LENGTH: Final[int] = 50

    # ตัวอย่าง: guts_ess.patrol_report.production
    REPORT_EXPORT_QUEUE_KEY_LENGTH: Final[int] = 100

    # queued / processing / completed / failed / cancelled / expired
    REPORT_EXPORT_JOB_STATUS_LENGTH: Final[int] = 20
    # ตัวอย่าง: patrol_report
    REPORT_EXPORT_TYPE_LENGTH: Final[int] = 50

    # queued / processing / completed / failed / cancelled / expired
    REPORT_EXPORT_JOB_STATUS_LENGTH: Final[int] = 20

    # เก็บ relative path เท่านั้น เช่น
    # reports/patrol_report_20260620_000001.pdf
    REPORT_EXPORT_FILE_PATH_LENGTH: Final[int] = 500

    # ชื่อไฟล์ที่ Browser ดาวน์โหลด
    REPORT_EXPORT_FILENAME_LENGTH: Final[int] = 255

    # คำค้นหารหัสสัญญา / จุดรักษาการณ์
    REPORT_EXPORT_KEYWORD_LENGTH: Final[int] = 255

    DEFAULT_PAGE_SKIP: Final[int] = 0
    DEFAULT_PAGE_LIMIT: Final[int] = 100
    MAX_PAGE_LIMIT: Final[int] = 1000

    DEFAULT_RADIUS_METER: Final[int] = 10
    DEFAULT_GRACE_METER: Final[int] = 0

    UNSIGNED_SMALLINT_MAX: Final[int] = 65535


class PatrolReportConstants:
    # Database view / table
    VIEW_NAME: Final[str] = "vw_checkin_report"

    # MySQL locale
    MYSQL_THAI_LOCALE: Final[str] = "th_TH"

    # Notification calculation
    MAX_CYCLE_LENGTH_DAYS: Final[int] = 15

    # Default display / state
    DEFAULT_NOTIFICATION_LEVEL: Final[str] = "none"

    # Patrol status values
    STATUS_COMPLETED: Final[str] = "completed"
    STATUS_IN_PROGRESS: Final[str] = "in_progress"
    STATUS_PENDING: Final[str] = "pending"

    # Patrol report order
    STATUS_ORDER_IN_PROGRESS: Final[int] = 1
    STATUS_ORDER_PENDING: Final[int] = 2
    STATUS_ORDER_COMPLETED: Final[int] = 3
    STATUS_ORDER_OTHER: Final[int] = 4

    # Optional columns in vw_checkin_report
    COLUMN_PLAN_DAY: Final[str] = "plan_day"
    COLUMN_CONTACT_DETAIL: Final[str] = "contact_detail"
    COLUMN_CALL_STATUS: Final[str] = "call_status"
    COLUMN_CALL_NOTE: Final[str] = "call_note"

    # Required report columns
    COLUMN_CONTRACT_CODE: Final[str] = "contract_code"
    COLUMN_LOCATION_NAME: Final[str] = "location_name"
    COLUMN_SHIFT_NAME_TH: Final[str] = "shift_name_th"
    COLUMN_ASSIGNMENT_STATUS: Final[str] = "assignment_status"
    COLUMN_WORK_DATE: Final[str] = "work_date"
    COLUMN_STARTED_AT: Final[str] = "started_at"
    COLUMN_COMPLETED_AT: Final[str] = "completed_at"
    COLUMN_EMPLOYEE_CODE: Final[str] = "employee_code"
    COLUMN_POSITION_NAME: Final[str] = "position_name"
    COLUMN_EFFECTIVE_FROM: Final[str] = "effective_from"
    COLUMN_BY_CONTRACT: Final[str] = "by_contract"
    COLUMN_WORKDAY: Final[str] = "workday"
    COLUMN_DEPARTMENT_ID: Final[str] = "department_id"
    COLUMN_DIVISION_ID: Final[str] = "division_id"
    COLUMN_ROUTE_ID: Final[str] = "route_id"
    COLUMN_LOCATION_ID: Final[str] = "location_id"
    COLUMN_SHIFT_ID: Final[str] = "shift_id"