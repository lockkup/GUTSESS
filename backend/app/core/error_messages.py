from __future__ import annotations

from typing import Final


# =========================================================
# Common
# =========================================================
DATABASE_ERROR_DETAIL: Final[str] = "Database error"
INVALID_REFERENCE_DETAIL: Final[str] = "Invalid reference data"
INVALID_EFFECTIVE_DATE_DETAIL: Final[str] = (
    "effective_to must be greater than or equal to effective_from"
)


# =========================================================
# Employee
# =========================================================
EMPLOYEE_NOT_FOUND_DETAIL: Final[str] = "Employee not found"
EMPLOYEE_ALREADY_EXISTS_DETAIL: Final[str] = "Employee already exists"
CREATED_BY_EMPLOYEE_NOT_FOUND_DETAIL: Final[str] = (
    "Created by employee not found"
)
UPDATED_BY_EMPLOYEE_NOT_FOUND_DETAIL: Final[str] = (
    "Updated by employee not found"
)


# =========================================================
# Audit log
# =========================================================
AUDIT_LOG_NOT_FOUND_DETAIL: Final[str] = "Audit log not found"


# =========================================================
# Site location
# =========================================================
SITE_LOCATION_NOT_FOUND_DETAIL: Final[str] = "Site location not found"
SITE_LOCATION_CHANGE_NOT_FOUND_DETAIL: Final[str] = "Site location change not found"
CONTRACT_CODE_ALREADY_EXISTS_DETAIL: Final[str] = "Contract code already exists"
CHECKIN_LOCATION_NOT_FOUND_DETAIL: Final[str] = "Check-in location not found"
CHECKOUT_LOCATION_NOT_FOUND_DETAIL: Final[str] = "Check-out location not found"

INVALID_COORDINATES_DETAIL: Final[str] = "ข้อมูลพิกัดไม่ถูกต้อง"
SITE_LOCATION_COORDINATES_NOT_FOUND_DETAIL: Final[str] = (
    "จุดรักษาการณ์นี้ยังไม่มีพิกัด latitude/longitude"
)
CHECKPOINT_OUT_OF_AREA_TEMPLATE: Final[str] = (
    "คุณอยู่นอกพื้นที่จุดรักษาการณ์ "
    "{location_name} "
    "ระยะห่างประมาณ {distance_meter} เมตร"
)
ATTENDANCE_OUT_OF_AREA_TEMPLATE: Final[str] = (
    "คุณอยู่นอกพื้นที่ลงเวลา "
    "จุดที่ใกล้ที่สุดคือ {location_name} "
    "ระยะห่างประมาณ {distance_meter} เมตร"
)


# =========================================================
# Shift
# =========================================================
SHIFT_NOT_FOUND_DETAIL: Final[str] = "Shift not found"
SHIFT_CHANGE_NOT_FOUND_DETAIL: Final[str] = "Shift change not found"
DUPLICATE_SHIFT_DETAIL: Final[str] = "Shift already exists"


# =========================================================
# Route
# =========================================================
DIVISION_NOT_FOUND_DETAIL: Final[str] = "Division not found"
ROUTE_NOT_FOUND_DETAIL: Final[str] = "Route not found"
ROUTE_SITE_LOCATION_NOT_FOUND_DETAIL: Final[str] = "Route site location not found"
ROUTE_SITE_LOCATION_CHANGE_NOT_FOUND_DETAIL: Final[str] = (
    "Route site location change not found"
)
DUPLICATE_ROUTE_SITE_LOCATION_DETAIL: Final[str] = "Route site location already exists"


# =========================================================
# Face profile
# =========================================================
FACE_PROFILE_NOT_FOUND_DETAIL: Final[str] = "Face profile not found"
FACE_PROFILE_CHANGE_NOT_FOUND_DETAIL: Final[str] = "Face profile change not found"
FACE_PROFILE_ALREADY_EXISTS_DETAIL: Final[str] = "Face profile already exists"
FACE_PROFILE_INACTIVE_DETAIL: Final[str] = "Face profile is inactive"

REFERENCE_IMAGE_REQUIRED_DETAIL: Final[str] = "Reference image is required"
UPLOADED_FILE_MUST_BE_IMAGE_DETAIL: Final[str] = "Uploaded file must be an image"

FACE_EMBEDDING_REQUIRED_DETAIL: Final[str] = "Face embedding is required"
FACE_EMBEDDING_MUST_BE_LIST_DETAIL: Final[str] = (
    "Face embedding must be a list"
)
FACE_EMBEDDING_MUST_BE_NUMBERS_DETAIL: Final[str] = (
    "Face embedding values must be numbers"
)
FACE_EMBEDDING_MUST_BE_FINITE_DETAIL: Final[str] = (
    "Face embedding values must be finite numbers"
)
FACE_EMBEDDING_MUST_BE_VALID_JSON_DETAIL: Final[str] = (
    "Face embedding must be valid JSON"
)
FACE_EMBEDDING_INVALID_DIMENSION_DETAIL: Final[str] = (
    "Face embedding must contain 128 values"
)
FACE_EMBEDDING_PENDING_DETAIL: Final[str] = (
    "Face embedding is pending"
)

STORED_FACE_EMBEDDING_NOT_FOUND_DETAIL: Final[str] = (
    "Stored face embedding not found"
)
STORED_FACE_EMBEDDING_INVALID_JSON_DETAIL: Final[str] = (
    "Stored face embedding is invalid JSON"
)

EMBEDDING_DIMENSION_MISMATCH_DETAIL: Final[str] = (
    FACE_EMBEDDING_INVALID_DIMENSION_DETAIL
)

FACE_MATCHED_DETAIL: Final[str] = "Face matched"
FACE_NOT_MATCHED_DETAIL: Final[str] = "Face not matched"
FACE_VERIFY_FAILED_DETAIL: Final[str] = "Face verification failed"

# Backward-compatible aliases
FACE_REFERENCE_IMAGE_REQUIRED_DETAIL: Final[str] = REFERENCE_IMAGE_REQUIRED_DETAIL


# =========================================================
# Time record
# =========================================================
TIME_RECORD_NOT_FOUND_DETAIL: Final[str] = "Time record not found"
OPEN_TIME_RECORD_NOT_FOUND_DETAIL: Final[str] = "Open time record not found"
OPEN_TIME_RECORD_ALREADY_EXISTS_DETAIL: Final[str] = (
    "Open time record already exists for this employee"
)
TIME_RECORD_ALREADY_CHECKED_OUT_DETAIL: Final[str] = "Time record already checked out"
INVALID_TIME_RECORD_REFERENCE_DETAIL: Final[str] = (
    "Invalid time record reference data"
)
INVALID_TIME_RECORD_UPDATE_DETAIL: Final[str] = "Invalid time record update data"
INVALID_CHECK_TIME_FORMAT_DETAIL: Final[str] = (
    "Check time must be HH:MM, HH:MM:SS, "
    "YYYY-MM-DD HH:MM, YYYY-MM-DD HH:MM:SS, "
    "YYYY-MM-DDTHH:MM, or YYYY-MM-DDTHH:MM:SS"
)
CHECKOUT_BEFORE_CHECKIN_DETAIL: Final[str] = (
    "Checkout time must be greater than or equal to checkin time"
)

CHECKPOINT_CHECKIN_SHIFT_NOT_FOUND_DETAIL: Final[str] = (
    "ไม่พบข้อมูลผลัดสำหรับการลงเวลางานสายตรวจ"
)
CHECKPOINT_CHECKOUT_SHIFT_NOT_FOUND_DETAIL: Final[str] = (
    "ไม่พบข้อมูลผลัดสำหรับการออกงานสายตรวจ"
)
CHECKPOINT_ASSIGNMENT_SHIFT_NOT_FOUND_DETAIL: Final[str] = (
    "ไม่พบข้อมูลผลัดของงานสายตรวจ"
)


# =========================================================
# Checkpoint schedule
# =========================================================
CHECKPOINT_SCHEDULE_NOT_FOUND_DETAIL: Final[str] = "Checkpoint schedule not found"
CHECKPOINT_SCHEDULE_CHANGE_NOT_FOUND_DETAIL: Final[str] = (
    "Checkpoint schedule change not found"
)
CHECKPOINT_SCHEDULE_DAY_REQUIRED_DETAIL: Final[str] = (
    "At least one schedule day must be selected"
)
DUPLICATE_CHECKPOINT_SCHEDULE_DETAIL: Final[str] = (
    "Checkpoint schedule already exists"
)


# =========================================================
# Checkpoint schedule item
# =========================================================
CHECKPOINT_SCHEDULE_ITEM_NOT_FOUND_DETAIL: Final[str] = (
    "Checkpoint schedule item not found"
)
CHECKPOINT_SCHEDULE_ITEM_CHANGE_NOT_FOUND_DETAIL: Final[str] = (
    "Checkpoint schedule item change not found"
)
DUPLICATE_CHECKPOINT_SCHEDULE_ITEM_DETAIL: Final[str] = (
    "Checkpoint schedule item already exists"
)
INVALID_CHECKPOINT_SCHEDULE_ITEM_UPDATE_DETAIL: Final[str] = (
    "Invalid checkpoint schedule item update data"
)


# =========================================================
# Checkpoint assignment
# =========================================================
CHECKPOINT_ASSIGNMENT_NOT_FOUND_DETAIL: Final[str] = "Checkpoint assignment not found"
CHECKPOINT_ASSIGNMENT_CHANGE_NOT_FOUND_DETAIL: Final[str] = (
    "Checkpoint assignment change not found"
)
DUPLICATE_CHECKPOINT_ASSIGNMENT_DETAIL: Final[str] = (
    "Checkpoint assignment already exists"
)
INVALID_CHECKPOINT_ASSIGNMENT_STATE_TRANSITION_DETAIL: Final[str] = (
    "Invalid checkpoint assignment state transition"
)
INACTIVE_CHECKPOINT_ASSIGNMENT_DETAIL: Final[str] = (
    "Checkpoint assignment is inactive"
)
CHECKPOINT_ASSIGNMENT_NOT_EDITABLE_DETAIL: Final[str] = (
    "Checkpoint assignment cannot be edited in current status"
)
CHECKPOINT_ASSIGNMENT_RECHECK_ALREADY_EXISTS_DETAIL: Final[str] = (
    "Checkpoint assignment recheck already exists"
)
INVALID_CHECKPOINT_ASSIGNMENT_CHANGE_ACTION_DETAIL: Final[str] = (
    "Invalid checkpoint assignment change action"
)


# =========================================================
# Checkpoint assignment call
# =========================================================
CHECKPOINT_ASSIGNMENT_CALL_NOT_FOUND_DETAIL: Final[str] = (
    "Checkpoint assignment call not found"
)
DUPLICATE_CHECKPOINT_ASSIGNMENT_CALL_DETAIL: Final[str] = (
    "Checkpoint assignment call already exists"
)
INVALID_CHECKPOINT_ASSIGNMENT_CALL_UPDATE_DETAIL: Final[str] = (
    "Invalid checkpoint assignment call update data"
)


# =========================================================
# Patrol report
# =========================================================
PATROL_REPORT_FETCH_FAILED_DETAIL: Final[str] = (
    "Unable to fetch patrol report"
)
PATROL_REPORT_DATE_REQUIRED_DETAIL: Final[str] = (
    "กรุณาระบุวันที่รายงาน"
)
PATROL_REPORT_INVALID_DATE_RANGE_DETAIL: Final[str] = (
    "วันที่เริ่มต้นต้องไม่มากกว่าวันที่สิ้นสุด"
)