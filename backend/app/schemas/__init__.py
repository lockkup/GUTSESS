from app.schemas.audit_logs import (
    AuditLogBase,
    AuditLogCreate,
    AuditLogResponse,
)
from app.schemas.checkpoint_assignment import (
    CheckpointAssignmentBase,
    CheckpointAssignmentCreate,
    CheckpointAssignmentResponse,
    CheckpointAssignmentUpdate,
)
from app.schemas.checkpoint_location import (
    VerifyCheckpointLocationRequest,
    VerifyCheckpointLocationResponse,
)
from app.schemas.checkpoint_assignment_call import (
    CheckpointAssignmentCallBase,
    CheckpointAssignmentCallCreate,
    CheckpointAssignmentCallResponse,
    CheckpointAssignmentCallUpdate,
)
from app.schemas.checkpoint_assignment_change import (
    CheckpointAssignmentChangeBase,
    CheckpointAssignmentChangeCreate,
    CheckpointAssignmentChangeResponse,
)
from app.schemas.checkpoint_schedule import (
    CheckpointScheduleBase,
    CheckpointScheduleCreate,
    CheckpointScheduleResponse,
    CheckpointScheduleUpdate,
)
from app.schemas.checkpoint_schedule_change import (
    CheckpointScheduleChangeBase,
    CheckpointScheduleChangeCreate,
    CheckpointScheduleChangeResponse,
)
from app.schemas.checkpoint_schedule_item import (
    CheckpointScheduleItemBase,
    CheckpointScheduleItemCreate,
    CheckpointScheduleItemResponse,
    CheckpointScheduleItemUpdate,
)
from app.schemas.checkpoint_schedule_item_change import (
    CheckpointScheduleItemChangeBase,
    CheckpointScheduleItemChangeCreate,
    CheckpointScheduleItemChangeResponse,
)
from app.schemas.departments import (
    DepartmentBase,
    DepartmentCreate,
    DepartmentResponse,
    DepartmentUpdate,
)
from app.schemas.divisions import DivisionResponse
from app.schemas.employee_permissions import (
    EmployeePermissionBase,
    EmployeePermissionCreate,
    EmployeePermissionResponse,
    EmployeePermissionUpdate,
)
from app.schemas.employees import (
    EmployeeBase,
    EmployeeCreate,
    EmployeeResponse,
    EmployeesResponse,
    EmployeeUpdate,
)
from app.schemas.face_profile import (
    FaceProfileBase,
    FaceProfileCreate,
    FaceProfileListResponse,
    FaceProfileResponse,
    FaceProfileUpdate,
)
from app.schemas.face_profile_change import (
    FaceProfileChangeBase,
    FaceProfileChangeCreate,
    FaceProfileChangeResponse,
)
from app.schemas.name_prefixs import (
    NamePrefixBase,
    NamePrefixCreate,
    NamePrefixResponse,
    NamePrefixUpdate,
)
from app.schemas.patrol_area import PatrolAreaSearchResponse
from app.schemas.patrol_report import (
    PatrolReportResponse,
    PatrolStatus,
)
from app.schemas.patrol_report_export import (
    PatrolReportExportAction,
    PatrolReportExportCreate,
    PatrolReportExportFilter,
    PatrolReportExportResponse,
    PatrolReportPlanMode,
    PatrolReportShiftType,
    PatrolReportStatusFilter,
    ReportExportJobStatus,
    ReportExportType,
)
from app.schemas.positions import (
    PositionBase,
    PositionCreate,
    PositionResponse,
    PositionUpdate,
)
from app.schemas.roles import (
    RoleBase,
    RoleCreate,
    RoleResponse,
    RoleUpdate,
)
from app.schemas.route import (
    RouteBase,
    RouteResponse,
)
from app.schemas.route_location_update_setting import (
    RouteLocationUpdateSettingAction,
    RouteLocationUpdateSettingBase,
    RouteLocationUpdateSettingCreate,
    RouteLocationUpdateSettingResponse,
    RouteLocationUpdateSettingUpdate,
)
from app.schemas.route_site_location import (
    RouteSiteLocationBase,
    RouteSiteLocationCreate,
    RouteSiteLocationResponse,
    RouteSiteLocationUpdate,
)
from app.schemas.route_site_location_change import (
    RouteSiteLocationChangeBase,
    RouteSiteLocationChangeCreate,
    RouteSiteLocationChangeResponse,
)
from app.schemas.shift import (
    ShiftBase,
    ShiftCreate,
    ShiftResponse,
    ShiftUpdate,
)
from app.schemas.shift_change import (
    ShiftChangeBase,
    ShiftChangeCreate,
    ShiftChangeResponse,
)
from app.schemas.site_location import (
    SiteLocationBase,
    SiteLocationCreate,
    SiteLocationResponse,
    SiteLocationUpdate,
)
from app.schemas.site_location_change import (
    SiteLocationChangeBase,
    SiteLocationChangeCreate,
    SiteLocationChangeResponse,
)
from app.schemas.time_record import (
    TimeRecordBase,
    TimeRecordCheckIn,
    TimeRecordCheckOut,
    TimeRecordListItemResponse,
    TimeRecordResponse,
)
from app.schemas.time_record_image import (
    TimeRecordImageBase,
    TimeRecordImageCreate,
    TimeRecordImageResponse,
)

# ============================================================
# Auth schemas ของระบบ Login ทีม
# ใช้ alias เพื่อไม่ให้ชื่อ EmployeeResponse ชนกับ employees.py
# ============================================================

try:
    from app.schemas.auth.auth import (
        EmployeeLogin,
        EmployeeRegister,
        EmployeeResponse as AuthEmployeeResponse,
        LoginResponse,
        LogoutResponse,
    )
except Exception:
    EmployeeLogin = None
    EmployeeRegister = None
    AuthEmployeeResponse = None
    LoginResponse = None
    LogoutResponse = None


__all__ = [
    "AuditLogBase",
    "AuditLogCreate",
    "AuditLogResponse",
    "CheckpointAssignmentBase",
    "CheckpointAssignmentCreate",
    "CheckpointAssignmentUpdate",
    "CheckpointAssignmentResponse",
    "VerifyCheckpointLocationRequest",
    "VerifyCheckpointLocationResponse",
    "CheckpointAssignmentCallBase",
    "CheckpointAssignmentCallCreate",
    "CheckpointAssignmentCallUpdate",
    "CheckpointAssignmentCallResponse",
    "CheckpointAssignmentChangeBase",
    "CheckpointAssignmentChangeCreate",
    "CheckpointAssignmentChangeResponse",
    "CheckpointScheduleBase",
    "CheckpointScheduleCreate",
    "CheckpointScheduleUpdate",
    "CheckpointScheduleResponse",
    "CheckpointScheduleChangeBase",
    "CheckpointScheduleChangeCreate",
    "CheckpointScheduleChangeResponse",
    "CheckpointScheduleItemBase",
    "CheckpointScheduleItemCreate",
    "CheckpointScheduleItemUpdate",
    "CheckpointScheduleItemResponse",
    "CheckpointScheduleItemChangeBase",
    "CheckpointScheduleItemChangeCreate",
    "CheckpointScheduleItemChangeResponse",
    "DepartmentBase",
    "DepartmentCreate",
    "DepartmentUpdate",
    "DepartmentResponse",
    "DivisionResponse",
    "EmployeePermissionBase",
    "EmployeePermissionCreate",
    "EmployeePermissionUpdate",
    "EmployeePermissionResponse",
    "EmployeeBase",
    "EmployeeCreate",
    "EmployeeUpdate",
    "EmployeeResponse",
    "EmployeesResponse",
    "FaceProfileBase",
    "FaceProfileCreate",
    "FaceProfileUpdate",
    "FaceProfileListResponse",
    "FaceProfileResponse",
    "FaceProfileChangeBase",
    "FaceProfileChangeCreate",
    "FaceProfileChangeResponse",
    "NamePrefixBase",
    "NamePrefixCreate",
    "NamePrefixUpdate",
    "NamePrefixResponse",
    "PatrolAreaSearchResponse",
    "PatrolReportResponse",
    "PatrolStatus",
    "PatrolReportExportAction",
    "PatrolReportExportCreate",
    "PatrolReportExportFilter",
    "PatrolReportExportResponse",
    "PatrolReportPlanMode",
    "PatrolReportShiftType",
    "PatrolReportStatusFilter",
    "ReportExportJobStatus",
    "ReportExportType",
    "PositionBase",
    "PositionCreate",
    "PositionUpdate",
    "PositionResponse",
    "RoleBase",
    "RoleCreate",
    "RoleUpdate",
    "RoleResponse",
    "RouteBase",
    "RouteResponse",
    "RouteLocationUpdateSettingBase",
    "RouteLocationUpdateSettingCreate",
    "RouteLocationUpdateSettingUpdate",
    "RouteLocationUpdateSettingAction",
    "RouteLocationUpdateSettingResponse",
    "RouteSiteLocationBase",
    "RouteSiteLocationCreate",
    "RouteSiteLocationUpdate",
    "RouteSiteLocationResponse",
    "RouteSiteLocationChangeBase",
    "RouteSiteLocationChangeCreate",
    "RouteSiteLocationChangeResponse",
    "ShiftBase",
    "ShiftCreate",
    "ShiftUpdate",
    "ShiftResponse",
    "ShiftChangeBase",
    "ShiftChangeCreate",
    "ShiftChangeResponse",
    "SiteLocationBase",
    "SiteLocationCreate",
    "SiteLocationUpdate",
    "SiteLocationResponse",
    "SiteLocationChangeBase",
    "SiteLocationChangeCreate",
    "SiteLocationChangeResponse",
    "TimeRecordBase",
    "TimeRecordCheckIn",
    "TimeRecordCheckOut",
    "TimeRecordListItemResponse",
    "TimeRecordResponse",
    "TimeRecordImageBase",
    "TimeRecordImageCreate",
    "TimeRecordImageResponse",
    "EmployeeLogin",
    "EmployeeRegister",
    "AuthEmployeeResponse",
    "LoginResponse",
    "LogoutResponse",
]
