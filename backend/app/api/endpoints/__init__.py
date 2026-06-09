from fastapi import APIRouter

from .app_setting import router as app_setting_router
from .audit_logs import router as audit_logs_router
from .auth import router as auth_router
from .checkpoint_assignment import router as checkpoint_assignment_router
from .checkpoint_assignment_call import router as checkpoint_assignment_call_router
from .checkpoint_assignment_change import router as checkpoint_assignment_change_router
from .checkpoint_schedule import router as checkpoint_schedule_router
from .checkpoint_schedule_change import router as checkpoint_schedule_change_router
from .checkpoint_schedule_item import router as checkpoint_schedule_item_router
from .checkpoint_schedule_item_change import router as checkpoint_schedule_item_change_router
from .divisions import router as divisions_router
from .employees import router as employees_router
from .face_profile import router as face_profile_router
from .face_profile_change import router as face_profile_change_router
from .password import router as password_router
from .patrol_report import router as patrol_report_router
from .route import router as route_router
from .route_site_location import router as route_site_location_router
from .route_site_location_change import router as route_site_location_change_router
from .shift import router as shift_router
from .shift_change import router as shift_change_router
from .site_location import router as site_location_router
from .site_location_change import router as site_location_change_router
from .time_record import router as time_record_router

api_router = APIRouter()

api_router.include_router(auth_router)
api_router.include_router(password_router)

api_router.include_router(
    app_setting_router,
    prefix="/app-settings",
    tags=["app_settings"],
)

api_router.include_router(
    audit_logs_router,
    prefix="/audit-logs",
    tags=["audit_logs"],
)

api_router.include_router(
    checkpoint_assignment_router,
    prefix="/checkpoint-assignments",
    tags=["checkpoint_assignments"],
)

api_router.include_router(
    checkpoint_assignment_call_router,
    prefix="/checkpoint-assignment-calls",
    tags=["checkpoint_assignment_calls"],
)

api_router.include_router(
    checkpoint_assignment_change_router,
    prefix="/checkpoint-assignment-changes",
    tags=["checkpoint_assignment_changes"],
)

api_router.include_router(
    checkpoint_schedule_router,
    prefix="/checkpoint-schedules",
    tags=["checkpoint_schedules"],
)

api_router.include_router(
    checkpoint_schedule_change_router,
    prefix="/checkpoint-schedule-changes",
    tags=["checkpoint_schedule_changes"],
)

api_router.include_router(
    checkpoint_schedule_item_router,
    prefix="/checkpoint-schedule-items",
    tags=["checkpoint_schedule_items"],
)

api_router.include_router(
    checkpoint_schedule_item_change_router,
    prefix="/checkpoint-schedule-item-changes",
    tags=["checkpoint_schedule_item_changes"],
)

api_router.include_router(
    divisions_router,
    prefix="/divisions",
    tags=["divisions"],
)

api_router.include_router(
    employees_router,
    prefix="/employees",
    tags=["employees"],
)

api_router.include_router(
    face_profile_router,
    prefix="/face-profiles",
    tags=["face_profiles"],
)

api_router.include_router(
    face_profile_change_router,
    prefix="/face-profile-changes",
    tags=["face_profile_changes"],
)

api_router.include_router(
    patrol_report_router,
    prefix="/reports",
    tags=["reports"],
)

api_router.include_router(
    route_router,
    prefix="/routes",
    tags=["routes"],
)

api_router.include_router(
    route_site_location_router,
    prefix="/route-site-locations",
    tags=["route_site_locations"],
)

api_router.include_router(
    route_site_location_change_router,
    prefix="/route-site-location-changes",
    tags=["route_site_location_changes"],
)

api_router.include_router(
    shift_router,
    prefix="/shifts",
    tags=["shifts"],
)

api_router.include_router(
    shift_change_router,
    prefix="/shift-changes",
    tags=["shift_changes"],
)

api_router.include_router(
    site_location_router,
    prefix="/site-locations",
    tags=["site_locations"],
)

api_router.include_router(
    site_location_change_router,
    prefix="/site-location-changes",
    tags=["site_location_changes"],
)

api_router.include_router(
    time_record_router,
    prefix="/time-records",
    tags=["time_records"],
)