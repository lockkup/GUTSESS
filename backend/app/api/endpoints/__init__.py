from fastapi import APIRouter

from .audit_log import router as audit_log_router
from .employees import router as employees_router
from .face_profile import router as face_profile_router
from .face_profile_change import router as face_profile_change_router
from .shift import router as shift_router
from .shift_change import router as shift_change_router
from .site_location import router as site_location_router
from .site_location_change import router as site_location_change_router
from .time_record import router as time_record_router

api_router = APIRouter()

api_router.include_router(
    audit_log_router,
    prefix="/audit-logs",
    tags=["audit_logs"],
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