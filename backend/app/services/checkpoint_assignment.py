from __future__ import annotations

from datetime import date, datetime, time, timedelta
from math import atan2, cos, radians, sin, sqrt
from typing import Any, ClassVar, Final, Literal
from zoneinfo import ZoneInfo

from fastapi import HTTPException, status
from sqlalchemy import and_, exists, func, or_, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, aliased

from app.core.constants import DBConstants
from app.core.error_messages import (
    CHECKPOINT_ASSIGNMENT_NOT_EDITABLE_DETAIL,
    CHECKPOINT_ASSIGNMENT_NOT_FOUND_DETAIL,
    CHECKPOINT_ASSIGNMENT_RECHECK_ALREADY_EXISTS_DETAIL,
    CHECKPOINT_SCHEDULE_ITEM_NOT_FOUND_DETAIL,
    DUPLICATE_CHECKPOINT_ASSIGNMENT_DETAIL,
    EMPLOYEE_NOT_FOUND_DETAIL,
    INACTIVE_CHECKPOINT_ASSIGNMENT_DETAIL,
    INVALID_CHECKPOINT_ASSIGNMENT_STATE_TRANSITION_DETAIL,
    INVALID_REFERENCE_DETAIL,
)
from app.models.checkpoint_assignment import CheckpointAssignment
from app.models.checkpoint_assignment_call import CheckpointAssignmentCall
from app.models.checkpoint_schedule_item import CheckpointScheduleItem
from app.models.divisions import Divisions
from app.models.employees import Employees
from app.models.route import Route
from app.models.route_site_location import RouteSiteLocation
from app.models.site_location import SiteLocation
from app.schemas.checkpoint_assignment import (
    AssignmentStatus,
    CheckpointAreaOptionResponse,
    CheckpointAssignmentCreate,
    CheckpointAssignmentDailyResponse,
    CheckpointAssignmentRecheck,
    CheckpointAssignmentReservationAction,
    CheckpointAssignmentUpdate,
    CheckpointMapLocationResponse,
)
from app.schemas.checkpoint_location import (
    VerifyCheckpointLocationRequest,
    VerifyCheckpointLocationResponse,
)


_PARENT_ASSIGNMENT_ROOT_KEY: Final[int] = 0
_ACTIVE_UNIQUE_KEY: Final[int] = 0
_BANGKOK_TIMEZONE: Final[str] = "Asia/Bangkok"

ShiftType = Literal["day", "night"]

_OVERDUE_STATUSES: Final[frozenset[str]] = frozenset(
    {
        "pending",
        "in_progress",
    }
)

_CLOSED_STATUSES: Final[frozenset[str]] = frozenset(
    {
        "completed",
        "cancelled",
        "repaired",
    }
)

_ALLOWED_STATUS_TRANSITIONS: Final[dict[str, set[str]]] = {
    "pending": {"in_progress"},
    "in_progress": {"completed"},
    "completed": {"repaired"},
    "repaired": set(),
}


class CheckpointAssignmentService:
    UPDATE_ALLOWED_STATUSES: ClassVar[frozenset[str]] = frozenset({"pending"})
    DELETE_ALLOWED_STATUSES: ClassVar[frozenset[str]] = frozenset({"pending"})

    @staticmethod
    def _now_bangkok_naive() -> datetime:
        return datetime.now(ZoneInfo(_BANGKOK_TIMEZONE)).replace(tzinfo=None)

    @staticmethod
    def _parent_assignment_key(parent_assignment_id: int | None) -> int:
        return parent_assignment_id or _PARENT_ASSIGNMENT_ROOT_KEY

    @staticmethod
    def _as_bool(value: Any) -> bool:
        if isinstance(value, bool):
            return value

        if isinstance(value, int):
            return value == 1

        if isinstance(value, str):
            return value.strip().lower() in {"1", "true", "t", "yes", "y"}

        return bool(value)

    @staticmethod
    def _normalize_time(value: Any) -> time | None:
        if value is None:
            return None

        if isinstance(value, time):
            return value.replace(tzinfo=None)

        if isinstance(value, datetime):
            return value.time().replace(tzinfo=None)

        if isinstance(value, timedelta):
            total_seconds = int(value.total_seconds()) % 86400
            hour = total_seconds // 3600
            minute = (total_seconds % 3600) // 60
            second = total_seconds % 60
            return time(hour=hour, minute=minute, second=second)

        value_text = str(value).strip()
        if not value_text:
            return None

        for fmt in ("%H:%M:%S", "%H:%M"):
            try:
                return datetime.strptime(value_text, fmt).time()
            except ValueError:
                continue

        return None

    @staticmethod
    def _format_time(value: time | None) -> str | None:
        if value is None:
            return None

        return value.strftime("%H:%M:%S")

    @staticmethod
    def _build_unit_name(
        contract_code: str | None,
        location_name: str | None,
    ) -> str:
        clean_contract_code = (contract_code or "").strip()
        clean_location_name = (location_name or "").strip()

        if clean_contract_code and clean_location_name:
            return f"{clean_contract_code}-{clean_location_name}"

        if clean_contract_code:
            return clean_contract_code

        return clean_location_name

    @staticmethod
    def _build_shift_name_for_message(
        shift_id: int | None,
        shift_name_th: str | None,
    ) -> str:
        clean_shift_name = (shift_name_th or "").strip()

        if clean_shift_name:
            if clean_shift_name.startswith("ผลัด"):
                return clean_shift_name

            return f"ผลัด{clean_shift_name}"

        if shift_id == 1:
            return "ผลัดกลางวัน"

        if shift_id == 2:
            return "ผลัดกลางคืน"

        return "ผลัดนี้"

    @staticmethod
    def _get_shift_window_info(
        db: Session,
        shift_id: int | None,
    ) -> dict[str, Any] | None:
        if shift_id is None:
            return None

        stmt = text(
            """
            SELECT
                shift_id,
                shift_name_th,
                start_time,
                end_time,
                crosses_midnight
            FROM shifts
            WHERE shift_id = :shift_id
              AND COALESCE(mark_flag, 0) = 0
              AND COALESCE(is_active, 1) = 1
            LIMIT 1
            """
        )

        row = db.execute(stmt, {"shift_id": shift_id}).mappings().first()

        if row is None:
            return None

        start_time = CheckpointAssignmentService._normalize_time(row["start_time"])
        end_time = CheckpointAssignmentService._normalize_time(row["end_time"])

        if start_time is None or end_time is None:
            return None

        crosses_midnight = CheckpointAssignmentService._as_bool(
            row["crosses_midnight"]
        )

        return {
            "shift_id": int(row["shift_id"]),
            "shift_name_th": row["shift_name_th"],
            "start_time": start_time,
            "end_time": end_time,
            "crosses_midnight": crosses_midnight,
        }

    @staticmethod
    def _build_shift_datetime_window(
        work_date: date,
        start_time: time,
        end_time: time,
        crosses_midnight: bool,
    ) -> tuple[datetime, datetime]:
        start_datetime = datetime.combine(work_date, start_time)
        end_datetime = datetime.combine(work_date, end_time)

        if crosses_midnight or end_time <= start_time:
            end_datetime = end_datetime + timedelta(days=1)

        return start_datetime, end_datetime

    @staticmethod
    def _is_now_in_shift_window(
        now: datetime,
        work_date: date,
        start_time: time,
        end_time: time,
        crosses_midnight: bool,
    ) -> bool:
        start_datetime, end_datetime = (
            CheckpointAssignmentService._build_shift_datetime_window(
                work_date=work_date,
                start_time=start_time,
                end_time=end_time,
                crosses_midnight=crosses_midnight,
            )
        )

        return start_datetime <= now <= end_datetime

    @staticmethod
    def _build_shift_time_reason(
        now: datetime,
        work_date: date,
        shift_id: int | None,
        shift_name_th: str | None,
        start_time: time,
        end_time: time,
        crosses_midnight: bool,
    ) -> str:
        start_datetime, end_datetime = (
            CheckpointAssignmentService._build_shift_datetime_window(
                work_date=work_date,
                start_time=start_time,
                end_time=end_time,
                crosses_midnight=crosses_midnight,
            )
        )

        shift_name = CheckpointAssignmentService._build_shift_name_for_message(
            shift_id=shift_id,
            shift_name_th=shift_name_th,
        )

        if now < start_datetime:
            return f"ยังไม่ถึงช่วงเวลาของ{shift_name}"

        if now > end_datetime:
            return f"หมดช่วงเวลาของ{shift_name}แล้ว"

        return f"ไม่อยู่ในช่วงเวลาของ{shift_name}"

    @staticmethod
    def _build_action_state_for_shift(
        db: Session,
        work_date: date,
        shift_id: int | None,
        assignment_status: str | None,
        is_active: bool,
        now: datetime,
    ) -> dict[str, Any]:
        default_state: dict[str, Any] = {
            "can_action": False,
            "action_disabled_reason": None,
            "is_shift_time_allowed": False,
            "shift_start_time": None,
            "shift_end_time": None,
            "crosses_midnight": None,
        }

        if assignment_status in _CLOSED_STATUSES:
            return default_state

        if not is_active:
            default_state["action_disabled_reason"] = (
                "ตารางงานสายตรวจนี้ถูกปิดใช้งานแล้ว"
            )
            return default_state

        if assignment_status == "in_progress":
            default_state["can_action"] = True
            default_state["is_shift_time_allowed"] = True
            return default_state

        if assignment_status != "pending":
            return default_state

        if shift_id is None:
            default_state["action_disabled_reason"] = (
                "ไม่พบข้อมูลผลัดของตารางงานสายตรวจ"
            )
            return default_state

        shift_info = CheckpointAssignmentService._get_shift_window_info(
            db=db,
            shift_id=shift_id,
        )

        if shift_info is None:
            default_state["action_disabled_reason"] = (
                "ไม่พบข้อมูลช่วงเวลาของผลัดนี้"
            )
            return default_state

        start_time = shift_info["start_time"]
        end_time = shift_info["end_time"]
        crosses_midnight = bool(shift_info["crosses_midnight"])

        default_state["shift_start_time"] = CheckpointAssignmentService._format_time(
            start_time
        )
        default_state["shift_end_time"] = CheckpointAssignmentService._format_time(
            end_time
        )
        default_state["crosses_midnight"] = crosses_midnight

        is_shift_time_allowed = CheckpointAssignmentService._is_now_in_shift_window(
            now=now,
            work_date=work_date,
            start_time=start_time,
            end_time=end_time,
            crosses_midnight=crosses_midnight,
        )

        default_state["is_shift_time_allowed"] = is_shift_time_allowed

        if is_shift_time_allowed:
            default_state["can_action"] = True
            default_state["action_disabled_reason"] = None
            return default_state

        default_state["can_action"] = False
        default_state["action_disabled_reason"] = (
            CheckpointAssignmentService._build_shift_time_reason(
                now=now,
                work_date=work_date,
                shift_id=shift_id,
                shift_name_th=shift_info.get("shift_name_th"),
                start_time=start_time,
                end_time=end_time,
                crosses_midnight=crosses_midnight,
            )
        )

        return default_state

    @staticmethod
    def _ensure_start_in_shift_window(
        db: Session,
        checkpoint_assignment: CheckpointAssignment,
    ) -> None:
        stmt = (
            select(CheckpointScheduleItem.shift_id)
            .where(
                CheckpointScheduleItem.schedule_item_id
                == checkpoint_assignment.schedule_item_id
            )
            .limit(1)
        )

        shift_id_raw = db.scalar(stmt)
        shift_id = int(shift_id_raw) if shift_id_raw is not None else None

        now = CheckpointAssignmentService._now_bangkok_naive()

        action_state = CheckpointAssignmentService._build_action_state_for_shift(
            db=db,
            work_date=checkpoint_assignment.work_date,
            shift_id=shift_id,
            assignment_status=checkpoint_assignment.assignment_status,
            is_active=bool(checkpoint_assignment.is_active),
            now=now,
        )

        if not bool(action_state["can_action"]):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=action_state["action_disabled_reason"]
                or "ไม่สามารถดำเนินการนอกช่วงเวลาของผลัดนี้ได้",
            )

    @staticmethod
    def _is_overdue(
        assignment_status: str | None,
        due_datetime: datetime | None,
        now: datetime,
    ) -> bool:
        if assignment_status not in _OVERDUE_STATUSES:
            return False

        if due_datetime is None:
            return False

        return due_datetime < now

    @staticmethod
    def _build_overdue_text(
        assignment_status: str | None,
        is_overdue: bool,
    ) -> str | None:
        if not is_overdue:
            return None

        if assignment_status == "pending":
            return "ไม่เข้าตรวจตามกำหนด"

        if assignment_status == "in_progress":
            return "ยังไม่ออกตรวจตามกำหนด"

        return None

    @staticmethod
    def _calculate_distance_meter(
        lat1: float,
        lng1: float,
        lat2: float,
        lng2: float,
    ) -> float:
        earth_radius_m = 6371000

        d_lat = radians(lat2 - lat1)
        d_lng = radians(lng2 - lng1)

        a = (
            sin(d_lat / 2) ** 2
            + cos(radians(lat1))
            * cos(radians(lat2))
            * sin(d_lng / 2) ** 2
        )

        c = 2 * atan2(sqrt(a), sqrt(1 - a))

        return earth_radius_m * c

    @staticmethod
    def _is_duplicate_integrity_error(exc: IntegrityError) -> bool:
        original_error = exc.orig
        error_args = getattr(original_error, "args", ())
        error_code = error_args[0] if error_args else None

        if error_code == 1062:
            return True

        error_text = str(original_error).lower()

        return (
            "duplicate entry" in error_text
            or "duplicate key" in error_text
            or "unique constraint" in error_text
            or "unique failed" in error_text
        )

    @staticmethod
    def _commit(
        db: Session,
        duplicate_detail: str | None = None,
    ) -> None:
        try:
            db.commit()
        except IntegrityError as exc:
            db.rollback()

            if (
                duplicate_detail
                and CheckpointAssignmentService._is_duplicate_integrity_error(exc)
            ):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=duplicate_detail,
                ) from exc

            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=INVALID_REFERENCE_DETAIL,
            ) from exc

    @staticmethod
    def _commit_and_refresh(
        db: Session,
        checkpoint_assignment: CheckpointAssignment,
        duplicate_detail: str | None = None,
    ) -> CheckpointAssignment:
        CheckpointAssignmentService._commit(
            db=db,
            duplicate_detail=duplicate_detail,
        )
        db.refresh(checkpoint_assignment)

        return checkpoint_assignment

    @staticmethod
    def _ensure_exists(
        db: Session,
        column: Any,
        value: Any,
        error_detail: str,
    ) -> None:
        stmt = select(exists().where(column == value))

        if not db.scalar(stmt):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=error_detail,
            )

    @staticmethod
    def _ensure_employee_exists(
        db: Session,
        employee_code: str,
    ) -> None:
        CheckpointAssignmentService._ensure_exists(
            db=db,
            column=Employees.employee_code,
            value=employee_code,
            error_detail=EMPLOYEE_NOT_FOUND_DETAIL,
        )

    @staticmethod
    def _get_active_employee_for_daily_filter(
        db: Session,
        employee_code: str,
    ) -> Employees | None:
        clean_employee_code = employee_code.strip()

        if not clean_employee_code:
            return None

        stmt = select(Employees).where(
            Employees.employee_code == clean_employee_code
        )

        employee_is_active_column = getattr(Employees, "is_active", None)
        if employee_is_active_column is not None:
            stmt = stmt.where(employee_is_active_column.is_(True))

        return db.scalar(stmt)

    @staticmethod
    def _ensure_daily_scope_exists(
        db: Session,
        division_id: int,
        route_id: int,
        field_id: int | None,
        department_id: int | None,
        work_date: date,
    ) -> None:
        stmt = (
            select(RouteSiteLocation.route_site_location_id)
            .select_from(RouteSiteLocation)
            .join(
                Divisions,
                Divisions.division_id == RouteSiteLocation.division_id,
            )
            .join(
                Route,
                Route.route_id == RouteSiteLocation.routes_id,
            )
            .where(
                RouteSiteLocation.division_id == division_id,
                RouteSiteLocation.routes_id == route_id,
                RouteSiteLocation.mark_flag.is_(False),
                RouteSiteLocation.is_active.is_(True),
                Divisions.is_active.is_(True),
                Route.is_active.is_(True),
                or_(
                    RouteSiteLocation.effective_from.is_(None),
                    RouteSiteLocation.effective_from <= work_date,
                ),
                or_(
                    RouteSiteLocation.effective_to.is_(None),
                    RouteSiteLocation.effective_to >= work_date,
                ),
            )
            .limit(1)
        )

        if field_id is not None:
            stmt = stmt.where(
                Divisions.field_id == field_id,
            )

        if department_id is not None:
            stmt = stmt.where(
                Divisions.department_id == department_id,
            )

        if db.scalar(stmt) is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=INVALID_REFERENCE_DETAIL,
            )

    @staticmethod
    def _ensure_schedule_item_exists(
        db: Session,
        schedule_item_id: int,
    ) -> None:
        CheckpointAssignmentService._ensure_exists(
            db=db,
            column=CheckpointScheduleItem.schedule_item_id,
            value=schedule_item_id,
            error_detail=CHECKPOINT_SCHEDULE_ITEM_NOT_FOUND_DETAIL,
        )

    @staticmethod
    def _ensure_not_duplicate(
        db: Session,
        work_date: date,
        schedule_item_id: int,
        parent_assignment_id: int | None = None,
        exclude_assignment_id: int | None = None,
        duplicate_detail: str = DUPLICATE_CHECKPOINT_ASSIGNMENT_DETAIL,
    ) -> None:
        parent_assignment_key = CheckpointAssignmentService._parent_assignment_key(
            parent_assignment_id=parent_assignment_id,
        )

        conditions = [
            CheckpointAssignment.work_date == work_date,
            CheckpointAssignment.schedule_item_id == schedule_item_id,
            CheckpointAssignment.parent_assignment_key == parent_assignment_key,
            CheckpointAssignment.active_unique_key == _ACTIVE_UNIQUE_KEY,
            CheckpointAssignment.mark_flag.is_(False),
        ]

        if exclude_assignment_id is not None:
            conditions.append(
                CheckpointAssignment.assignment_id != exclude_assignment_id
            )

        stmt = select(exists().where(*conditions))

        if db.scalar(stmt):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=duplicate_detail,
            )

    @staticmethod
    def _ensure_active_for_start(
        checkpoint_assignment: CheckpointAssignment,
    ) -> None:
        if not checkpoint_assignment.is_active:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=INACTIVE_CHECKPOINT_ASSIGNMENT_DETAIL,
            )

    @staticmethod
    def _ensure_editable(
        checkpoint_assignment: CheckpointAssignment,
    ) -> None:
        if (
            checkpoint_assignment.assignment_status
            not in CheckpointAssignmentService.UPDATE_ALLOWED_STATUSES
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=CHECKPOINT_ASSIGNMENT_NOT_EDITABLE_DETAIL,
            )

    @staticmethod
    def _ensure_deletable(
        checkpoint_assignment: CheckpointAssignment,
    ) -> None:
        if (
            checkpoint_assignment.assignment_status
            not in CheckpointAssignmentService.DELETE_ALLOWED_STATUSES
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=INVALID_CHECKPOINT_ASSIGNMENT_STATE_TRANSITION_DETAIL,
            )

    @staticmethod
    def _transition_status(
        checkpoint_assignment: CheckpointAssignment,
        next_status: str,
        updated_by: str,
    ) -> None:
        current_status = checkpoint_assignment.assignment_status

        if next_status not in _ALLOWED_STATUS_TRANSITIONS.get(current_status, set()):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=INVALID_CHECKPOINT_ASSIGNMENT_STATE_TRANSITION_DETAIL,
            )

        checkpoint_assignment.assignment_status = next_status
        checkpoint_assignment.updated_by = updated_by

    @staticmethod
    def _set_action_metadata(
        checkpoint_assignment: CheckpointAssignment,
        employee_code: str,
        at_field: str,
        by_field: str,
    ) -> None:
        action_time = CheckpointAssignmentService._now_bangkok_naive()

        setattr(checkpoint_assignment, at_field, action_time)
        setattr(checkpoint_assignment, by_field, employee_code)

    @staticmethod
    def get_checkpoint_area_options(
        db: Session,
        employee_code: str,
    ) -> list[CheckpointAreaOptionResponse]:
        employee = (
            CheckpointAssignmentService._get_active_employee_for_daily_filter(
                db=db,
                employee_code=employee_code,
            )
        )

        if employee is None:
            return []

        field_id = getattr(employee, "field_id", None)
        department_id = getattr(employee, "department_id", None)
        employee_division_id = getattr(employee, "division_id", None)
        employee_route_id = getattr(employee, "routes_id", None)

        if field_id is None or department_id is None:
            return []

        effective_date = CheckpointAssignmentService._now_bangkok_naive().date()

        stmt = (
            select(
                Divisions.division_id.label("division_id"),
                Route.route_id.label("route_id"),
                Divisions.division_name.label("division_name"),
                Route.route_name.label("route_name"),
            )
            .select_from(RouteSiteLocation)
            .join(
                Divisions,
                Divisions.division_id == RouteSiteLocation.division_id,
            )
            .join(
                Route,
                Route.route_id == RouteSiteLocation.routes_id,
            )
            .where(
                Divisions.field_id == field_id,
                Divisions.department_id == department_id,
                Divisions.is_active.is_(True),
                Route.is_active.is_(True),
                RouteSiteLocation.mark_flag.is_(False),
                RouteSiteLocation.is_active.is_(True),
                or_(
                    RouteSiteLocation.effective_from.is_(None),
                    RouteSiteLocation.effective_from <= effective_date,
                ),
                or_(
                    RouteSiteLocation.effective_to.is_(None),
                    RouteSiteLocation.effective_to >= effective_date,
                ),
            )
            .distinct()
            .order_by(
                Divisions.division_name.asc(),
                Route.route_name.asc(),
            )
        )

        rows = db.execute(stmt).mappings().all()

        return [
            CheckpointAreaOptionResponse(
                division_id=int(row["division_id"]),
                route_id=int(row["route_id"]),
                division_name=str(row["division_name"] or "").strip(),
                route_name=str(row["route_name"] or "").strip(),
                is_home=(
                    row["division_id"] == employee_division_id
                    and row["route_id"] == employee_route_id
                ),
            )
            for row in rows
        ]

    @staticmethod
    def get_checkpoint_map_location(
        db: Session,
        contract_code: str,
        location_name: str,
    ) -> CheckpointMapLocationResponse:
        clean_contract_code = contract_code.strip()
        clean_location_name = location_name.strip()

        if not clean_contract_code or not clean_location_name:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="กรุณาระบุรหัสสัญญาและชื่อหน่วยงาน",
            )

        stmt = (
            select(
                SiteLocation.contract_code.label("contract_code"),
                SiteLocation.location_name.label("location_name"),
                SiteLocation.latitude.label("latitude"),
                SiteLocation.longitude.label("longitude"),
                SiteLocation.radius_meter.label("radius_meter"),
                SiteLocation.grace_meter.label("grace_meter"),
                SiteLocation.location_detail.label("location_detail"),
            )
            .where(
                func.trim(SiteLocation.contract_code) == clean_contract_code,
                func.trim(SiteLocation.location_name) == clean_location_name,
                SiteLocation.mark_flag.is_(False),
                SiteLocation.is_active.is_(True),
            )
            .order_by(SiteLocation.location_id.desc())
            .limit(1)
        )

        row = db.execute(stmt).mappings().first()

        if row is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="ไม่พบพิกัดของหน่วยงานนี้",
            )

        latitude_raw = row["latitude"]
        longitude_raw = row["longitude"]

        latitude = float(latitude_raw) if latitude_raw is not None else None
        longitude = float(longitude_raw) if longitude_raw is not None else None

        radius_meter_raw = row["radius_meter"]
        grace_meter_raw = row["grace_meter"]

        radius_meter = (
            int(radius_meter_raw)
            if radius_meter_raw is not None
            else None
        )
        grace_meter = (
            int(grace_meter_raw)
            if grace_meter_raw is not None
            else None
        )

        location_detail = str(row["location_detail"] or "").strip() or None

        return CheckpointMapLocationResponse(
            contract_code=str(row["contract_code"] or "").strip(),
            location_name=str(row["location_name"] or "").strip(),
            latitude=latitude,
            longitude=longitude,
            radius_meter=radius_meter,
            grace_meter=grace_meter,
            location_detail=location_detail,
        )

    @staticmethod
    def get_checkpoint_assignment(
        db: Session,
        assignment_id: int,
        include_deleted: bool = False,
    ) -> CheckpointAssignment:
        stmt = select(CheckpointAssignment).where(
            CheckpointAssignment.assignment_id == assignment_id
        )

        if not include_deleted:
            stmt = stmt.where(CheckpointAssignment.mark_flag.is_(False))

        checkpoint_assignment = db.scalar(stmt)

        if checkpoint_assignment is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=CHECKPOINT_ASSIGNMENT_NOT_FOUND_DETAIL,
            )

        return checkpoint_assignment

    @staticmethod
    def _get_checkpoint_assignment_for_update(
        db: Session,
        assignment_id: int,
    ) -> CheckpointAssignment:
        stmt = (
            select(CheckpointAssignment)
            .where(
                CheckpointAssignment.assignment_id == assignment_id,
                CheckpointAssignment.mark_flag.is_(False),
            )
            .with_for_update()
        )

        checkpoint_assignment = db.scalar(stmt)

        if checkpoint_assignment is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=CHECKPOINT_ASSIGNMENT_NOT_FOUND_DETAIL,
            )

        return checkpoint_assignment

    @staticmethod
    def get_checkpoint_assignments(
        db: Session,
        skip: int = DBConstants.DEFAULT_PAGE_SKIP,
        limit: int = DBConstants.DEFAULT_PAGE_LIMIT,
        work_date: date | None = None,
        schedule_item_id: int | None = None,
        parent_assignment_id: int | None = None,
        assignment_status: AssignmentStatus | None = None,
        is_active: bool | None = None,
        include_deleted: bool = False,
    ) -> list[CheckpointAssignment]:
        stmt = select(CheckpointAssignment)

        if not include_deleted:
            stmt = stmt.where(CheckpointAssignment.mark_flag.is_(False))

        if work_date is not None:
            stmt = stmt.where(CheckpointAssignment.work_date == work_date)

        if schedule_item_id is not None:
            stmt = stmt.where(
                CheckpointAssignment.schedule_item_id == schedule_item_id
            )

        if parent_assignment_id is not None:
            if parent_assignment_id == _PARENT_ASSIGNMENT_ROOT_KEY:
                stmt = stmt.where(CheckpointAssignment.parent_assignment_id.is_(None))
            else:
                stmt = stmt.where(
                    CheckpointAssignment.parent_assignment_id == parent_assignment_id
                )

        if assignment_status is not None:
            stmt = stmt.where(
                CheckpointAssignment.assignment_status == assignment_status
            )

        if is_active is not None:
            stmt = stmt.where(CheckpointAssignment.is_active.is_(is_active))

        stmt = (
            stmt.order_by(
                CheckpointAssignment.work_date.desc(),
                CheckpointAssignment.assignment_id.desc(),
            )
            .offset(skip)
            .limit(limit)
        )

        return list(db.scalars(stmt).all())

    @staticmethod
    def get_daily_checkpoint_assignments(
        db: Session,
        work_date: date,
        shift_type: ShiftType | None = None,
        employee_code: str | None = None,
        division_id: int | None = None,
        route_id: int | None = None,
        is_active: bool | None = True,
        include_deleted: bool = False,
    ) -> list[CheckpointAssignmentDailyResponse]:
        now = CheckpointAssignmentService._now_bangkok_naive()

        # Alias สำหรับดึงข้อมูลพนักงานที่กำลังถือ Assignment อยู่
        # (กรณี assignment_status = "in_progress")
        InProgressEmployee = aliased(Employees)

        # Alias สำหรับดึงข้อมูลพนักงานที่จอง Assignment ไว้
        ReservedEmployee = aliased(Employees)

        has_call_expr = (
            exists()
            .where(
                CheckpointAssignmentCall.assignment_id
                == CheckpointAssignment.assignment_id,
                func.date(CheckpointAssignmentCall.created_at)
                == CheckpointAssignment.work_date,
                CheckpointAssignmentCall.is_active.is_(True),
                CheckpointAssignmentCall.mark_flag.is_(False),
            )
            .label("has_call")
        )

        stmt = (
            select(
                CheckpointAssignment.assignment_id.label("assignment_id"),
                CheckpointAssignment.work_date.label("work_date"),
                CheckpointAssignment.schedule_item_id.label("schedule_item_id"),
                CheckpointScheduleItem.shift_id.label("shift_id"),
                CheckpointAssignment.time_record_id.label("time_record_id"),
                CheckpointAssignment.assignment_status.label("assignment_status"),
                CheckpointAssignment.due_datetime.label("due_datetime"),
                CheckpointAssignment.started_at.label("started_at"),
                CheckpointAssignment.started_by.label("started_by"),
                InProgressEmployee.employee_code.label(
                    "in_progress_employee_code"
                ),
                InProgressEmployee.first_name.label(
                    "in_progress_employee_first_name"
                ),
                InProgressEmployee.last_name.label(
                    "in_progress_employee_last_name"
                ),
                CheckpointAssignment.reserved_by.label("reserved_by"),
                CheckpointAssignment.reserved_at.label("reserved_at"),
                ReservedEmployee.first_name.label(
                    "reserved_employee_first_name"
                ),
                ReservedEmployee.last_name.label(
                    "reserved_employee_last_name"
                ),
                CheckpointAssignment.completed_at.label("completed_at"),
                CheckpointAssignment.completed_by.label("completed_by"),
                CheckpointAssignment.is_active.label("is_active"),
                CheckpointScheduleItem.plan_day.label("plan_day"),
                CheckpointScheduleItem.require_call.label("require_call"),
                CheckpointScheduleItem.sequence_no.label("sequence_no"),
                RouteSiteLocation.route_site_location_id.label(
                    "route_site_location_id"
                ),
                SiteLocation.contract_code.label("contract_code"),
                SiteLocation.location_name.label("location_name"),
                has_call_expr,
            )
            .join(
                CheckpointScheduleItem,
                CheckpointAssignment.schedule_item_id
                == CheckpointScheduleItem.schedule_item_id,
            )
            .join(
                RouteSiteLocation,
                CheckpointScheduleItem.route_site_location_id
                == RouteSiteLocation.route_site_location_id,
            )
            .join(
                SiteLocation,
                RouteSiteLocation.location_id == SiteLocation.location_id,
            )
            .outerjoin(
                InProgressEmployee,
                and_(
                    InProgressEmployee.employee_code
                    == CheckpointAssignment.started_by,
                    CheckpointAssignment.assignment_status == "in_progress",
                ),
            )
            .outerjoin(
                ReservedEmployee,
                ReservedEmployee.employee_code
                == CheckpointAssignment.reserved_by,
            )
            .where(
                or_(
                    CheckpointAssignment.work_date == work_date,
                    and_(
                        CheckpointAssignment.work_date < work_date,
                        CheckpointAssignment.assignment_status.in_(
                            tuple(_OVERDUE_STATUSES)
                        ),
                        CheckpointAssignment.due_datetime.is_not(None),
                        CheckpointAssignment.due_datetime >= now,
                    ),
                )
            )
        )

        stmt = stmt.where(
            or_(
                RouteSiteLocation.effective_from.is_(None),
                RouteSiteLocation.effective_from <= CheckpointAssignment.work_date,
            ),
            or_(
                RouteSiteLocation.effective_to.is_(None),
                RouteSiteLocation.effective_to >= CheckpointAssignment.work_date,
            ),
        )

        if not include_deleted:
            stmt = stmt.where(
                CheckpointAssignment.mark_flag.is_(False),
                CheckpointScheduleItem.mark_flag.is_(False),
                RouteSiteLocation.mark_flag.is_(False),
                SiteLocation.mark_flag.is_(False),
            )

        if is_active is not None:
            stmt = stmt.where(
                CheckpointAssignment.is_active.is_(is_active),
                CheckpointScheduleItem.is_active.is_(is_active),
                RouteSiteLocation.is_active.is_(is_active),
                SiteLocation.is_active.is_(is_active),
            )

        selected_scope = division_id is not None or route_id is not None

        if selected_scope and (division_id is None or route_id is None):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=INVALID_REFERENCE_DETAIL,
            )

        employee: Employees | None = None

        if employee_code is not None:
            clean_employee_code = employee_code.strip()

            if clean_employee_code:
                employee = (
                    CheckpointAssignmentService
                    ._get_active_employee_for_daily_filter(
                        db=db,
                        employee_code=clean_employee_code,
                    )
                )

                if employee is None:
                    return []

        route_division_column = getattr(RouteSiteLocation, "division_id", None)
        route_routes_column = getattr(RouteSiteLocation, "routes_id", None)

        if selected_scope:
            if route_division_column is None or route_routes_column is None:
                return []

            employee_field_id = (
                getattr(employee, "field_id", None)
                if employee is not None
                else None
            )
            employee_department_id = (
                getattr(employee, "department_id", None)
                if employee is not None
                else None
            )

            CheckpointAssignmentService._ensure_daily_scope_exists(
                db=db,
                division_id=division_id,
                route_id=route_id,
                field_id=employee_field_id,
                department_id=employee_department_id,
                work_date=work_date,
            )

            stmt = stmt.where(
                route_division_column == division_id,
                route_routes_column == route_id,
            )

        elif employee is not None:
            employee_division_id = getattr(employee, "division_id", None)
            employee_routes_id = getattr(employee, "routes_id", None)

            # พฤติกรรมเดิม:
            # ถ้าไม่ได้เลือกเขต/เส้นทางอื่น ให้ใช้เขตและเส้นทางประจำของพนักงาน
            if (
                route_division_column is not None
                and employee_division_id is not None
            ):
                stmt = stmt.where(
                    route_division_column == employee_division_id
                )

            if (
                route_routes_column is not None
                and employee_routes_id is not None
            ):
                stmt = stmt.where(
                    route_routes_column == employee_routes_id
                )

            if employee_division_id is None and employee_routes_id is None:
                return []

        if shift_type is not None:
            target_shift_id = 1 if shift_type == "day" else 2

            stmt = stmt.where(
                CheckpointScheduleItem.shift_id == target_shift_id
            )

        stmt = stmt.order_by(
            CheckpointAssignment.work_date.asc(),
            CheckpointScheduleItem.sequence_no.asc(),
            CheckpointAssignment.assignment_id.asc(),
        )

        rows = db.execute(stmt).mappings().all()

        result: list[CheckpointAssignmentDailyResponse] = []

        for row in rows:
            data = dict(row)

            assignment_status_raw = data.get("assignment_status")
            assignment_status = (
                str(assignment_status_raw)
                if assignment_status_raw is not None
                else None
            )

            due_datetime_raw = data.get("due_datetime")
            due_datetime = (
                due_datetime_raw
                if isinstance(due_datetime_raw, datetime)
                else None
            )

            shift_id_raw = data.get("shift_id")
            shift_id = int(shift_id_raw) if shift_id_raw is not None else None

            is_overdue = CheckpointAssignmentService._is_overdue(
                assignment_status=assignment_status,
                due_datetime=due_datetime,
                now=now,
            )

            action_state = CheckpointAssignmentService._build_action_state_for_shift(
                db=db,
                work_date=data["work_date"],
                shift_id=shift_id,
                assignment_status=assignment_status,
                is_active=bool(data.get("is_active")),
                now=now,
            )

            data["unit_name"] = CheckpointAssignmentService._build_unit_name(
                contract_code=data.get("contract_code"),
                location_name=data.get("location_name"),
            )
            data["require_call"] = bool(data["require_call"])
            data["has_call"] = bool(data["has_call"])
            data["is_overdue"] = is_overdue
            data["overdue_text"] = CheckpointAssignmentService._build_overdue_text(
                assignment_status=assignment_status,
                is_overdue=is_overdue,
            )

            # ส่งข้อมูลคนที่กำลังเข้าตรวจให้ Frontend ใช้เปิด
            # CheckpointInProgressModal เมื่อพนักงานคนอื่นกดจุดเดียวกัน
            if assignment_status == "in_progress":
                holder_employee_code = (
                    str(data.get("in_progress_employee_code") or "").strip()
                    or str(data.get("started_by") or "").strip()
                    or None
                )

                holder_employee_name = " ".join(
                    part
                    for part in [
                        str(
                            data.get("in_progress_employee_first_name") or ""
                        ).strip(),
                        str(
                            data.get("in_progress_employee_last_name") or ""
                        ).strip(),
                    ]
                    if part
                ).strip() or None

                data["in_progress_employee_code"] = holder_employee_code
                data["in_progress_employee_name"] = holder_employee_name
            else:
                data["in_progress_employee_code"] = None
                data["in_progress_employee_name"] = None

            reserved_by = str(data.get("reserved_by") or "").strip() or None
            reserved_by_name = " ".join(
                part
                for part in [
                    str(data.get("reserved_employee_first_name") or "").strip(),
                    str(data.get("reserved_employee_last_name") or "").strip(),
                ]
                if part
            ).strip() or None

            data["reserved_by"] = reserved_by
            data["reserved_by_name"] = reserved_by_name

            # เป็น field ชั่วคราวที่ใช้ประกอบชื่อเท่านั้น
            # ต้องเอาออกก่อน model_validate เพราะ schema กำหนด extra="forbid"
            data.pop("in_progress_employee_first_name", None)
            data.pop("in_progress_employee_last_name", None)
            data.pop("reserved_employee_first_name", None)
            data.pop("reserved_employee_last_name", None)

            data.update(action_state)

            result.append(
                CheckpointAssignmentDailyResponse.model_validate(data)
            )

        return result

    @staticmethod
    def verify_checkpoint_location(
        db: Session,
        payload: VerifyCheckpointLocationRequest,
    ) -> VerifyCheckpointLocationResponse:
        stmt = (
            select(
                CheckpointAssignment.assignment_id.label("assignment_id"),
                CheckpointAssignment.is_active.label("assignment_is_active"),
                SiteLocation.latitude.label("site_latitude"),
                SiteLocation.longitude.label("site_longitude"),
                SiteLocation.radius_meter.label("radius_meter"),
                SiteLocation.grace_meter.label("grace_meter"),
                SiteLocation.location_detail.label("location_detail"),
                SiteLocation.contract_code.label("contract_code"),
                SiteLocation.location_name.label("location_name"),
            )
            .join(
                CheckpointScheduleItem,
                CheckpointAssignment.schedule_item_id
                == CheckpointScheduleItem.schedule_item_id,
            )
            .join(
                RouteSiteLocation,
                CheckpointScheduleItem.route_site_location_id
                == RouteSiteLocation.route_site_location_id,
            )
            .join(
                SiteLocation,
                RouteSiteLocation.location_id == SiteLocation.location_id,
            )
            .where(
                CheckpointAssignment.assignment_id == payload.assignment_id,
                CheckpointAssignment.mark_flag.is_(False),
                CheckpointScheduleItem.mark_flag.is_(False),
                RouteSiteLocation.mark_flag.is_(False),
                SiteLocation.mark_flag.is_(False),
            )
            .limit(1)
        )

        row = db.execute(stmt).mappings().first()

        if row is None:
            return VerifyCheckpointLocationResponse(
                allowed=False,
                message="ไม่พบข้อมูลจุดตรวจจาก assignment_id นี้",
                distance_meter=None,
                radius_meter=None,
                accuracy=payload.accuracy,
                assignment_id=payload.assignment_id,
                unit_name=payload.unit_name,
            )

        unit_name = CheckpointAssignmentService._build_unit_name(
            contract_code=row["contract_code"],
            location_name=row["location_name"],
        )

        if not bool(row["assignment_is_active"]):
            return VerifyCheckpointLocationResponse(
                allowed=False,
                message="ตารางงานสายตรวจนี้ถูกปิดใช้งานแล้ว",
                distance_meter=None,
                radius_meter=None,
                accuracy=payload.accuracy,
                assignment_id=payload.assignment_id,
                unit_name=unit_name,
            )

        site_latitude_raw = row["site_latitude"]
        site_longitude_raw = row["site_longitude"]

        if site_latitude_raw is None or site_longitude_raw is None:
            return VerifyCheckpointLocationResponse(
                allowed=False,
                message="จุดตรวจนี้ยังไม่ได้กำหนดพิกัดในระบบ",
                distance_meter=None,
                radius_meter=None,
                accuracy=payload.accuracy,
                assignment_id=payload.assignment_id,
                unit_name=unit_name,
            )

        site_latitude = float(site_latitude_raw)
        site_longitude = float(site_longitude_raw)
        radius_meter = float(row["radius_meter"] or 0)
        grace_meter = float(row["grace_meter"] or 0)

        allowed_radius = radius_meter + grace_meter

        if allowed_radius <= 0:
            return VerifyCheckpointLocationResponse(
                allowed=False,
                message="จุดตรวจนี้ยังไม่ได้กำหนดรัศมีพื้นที่ตรวจ",
                distance_meter=None,
                radius_meter=0,
                accuracy=payload.accuracy,
                assignment_id=payload.assignment_id,
                unit_name=unit_name,
            )

        distance_meter = CheckpointAssignmentService._calculate_distance_meter(
            lat1=payload.latitude,
            lng1=payload.longitude,
            lat2=site_latitude,
            lng2=site_longitude,
        )

        allowed = distance_meter <= allowed_radius

        if allowed:
            message = "อยู่ในพื้นที่ที่กำหนด"
        else:
            display_unit_name = unit_name or payload.unit_name or "จุดตรวจที่เลือก"
            message = f"คุณอยู่นอกพื้นที่ที่กำหนดของ {display_unit_name}"

        return VerifyCheckpointLocationResponse(
            allowed=allowed,
            message=message,
            distance_meter=round(distance_meter, 2),
            radius_meter=round(allowed_radius, 2),
            accuracy=payload.accuracy,
            assignment_id=payload.assignment_id,
            unit_name=unit_name,
        )

    @staticmethod
    def create_checkpoint_assignment(
        db: Session,
        payload: CheckpointAssignmentCreate,
    ) -> CheckpointAssignment:
        CheckpointAssignmentService._ensure_employee_exists(
            db=db,
            employee_code=payload.created_by,
        )

        CheckpointAssignmentService._ensure_schedule_item_exists(
            db=db,
            schedule_item_id=payload.schedule_item_id,
        )

        CheckpointAssignmentService._ensure_not_duplicate(
            db=db,
            work_date=payload.work_date,
            schedule_item_id=payload.schedule_item_id,
            parent_assignment_id=None,
        )

        create_data = payload.model_dump()
        create_data.update(
            {
                "parent_assignment_id": None,
                "parent_assignment_key": _PARENT_ASSIGNMENT_ROOT_KEY,
                "active_unique_key": _ACTIVE_UNIQUE_KEY,
                "recheck_depth": 0,
                "assignment_status": "pending",
            }
        )

        checkpoint_assignment = CheckpointAssignment(**create_data)

        db.add(checkpoint_assignment)

        return CheckpointAssignmentService._commit_and_refresh(
            db=db,
            checkpoint_assignment=checkpoint_assignment,
            duplicate_detail=DUPLICATE_CHECKPOINT_ASSIGNMENT_DETAIL,
        )

    @staticmethod
    def update_checkpoint_assignment(
        db: Session,
        assignment_id: int,
        payload: CheckpointAssignmentUpdate,
    ) -> CheckpointAssignment:
        update_data = payload.model_dump(exclude_unset=True)

        CheckpointAssignmentService._ensure_employee_exists(
            db=db,
            employee_code=payload.updated_by,
        )

        if update_data.get("schedule_item_id") is not None:
            CheckpointAssignmentService._ensure_schedule_item_exists(
                db=db,
                schedule_item_id=update_data["schedule_item_id"],
            )

        checkpoint_assignment = CheckpointAssignmentService.get_checkpoint_assignment(
            db=db,
            assignment_id=assignment_id,
        )

        CheckpointAssignmentService._ensure_editable(
            checkpoint_assignment=checkpoint_assignment,
        )

        if "work_date" in update_data or "schedule_item_id" in update_data:
            target_work_date = update_data.get(
                "work_date",
                checkpoint_assignment.work_date,
            )
            target_schedule_item_id = update_data.get(
                "schedule_item_id",
                checkpoint_assignment.schedule_item_id,
            )

            CheckpointAssignmentService._ensure_not_duplicate(
                db=db,
                work_date=target_work_date,
                schedule_item_id=target_schedule_item_id,
                parent_assignment_id=checkpoint_assignment.parent_assignment_id,
                exclude_assignment_id=assignment_id,
            )

        for field, value in update_data.items():
            setattr(checkpoint_assignment, field, value)

        return CheckpointAssignmentService._commit_and_refresh(
            db=db,
            checkpoint_assignment=checkpoint_assignment,
            duplicate_detail=DUPLICATE_CHECKPOINT_ASSIGNMENT_DETAIL,
        )

    @staticmethod
    def reserve_checkpoint_assignment(
        db: Session,
        assignment_id: int,
        payload: CheckpointAssignmentReservationAction,
    ) -> CheckpointAssignment:
        employee_code = payload.employee_code.strip()

        CheckpointAssignmentService._ensure_employee_exists(
            db=db,
            employee_code=employee_code,
        )

        checkpoint_assignment = (
            CheckpointAssignmentService._get_checkpoint_assignment_for_update(
                db=db,
                assignment_id=assignment_id,
            )
        )

        CheckpointAssignmentService._ensure_active_for_start(
            checkpoint_assignment=checkpoint_assignment,
        )

        if checkpoint_assignment.assignment_status != "pending":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="รายการนี้ไม่อยู่ในสถานะที่สามารถจองได้",
            )

        # พนักงานคนเดิมกดจองซ้ำ ให้ถือว่ายังจองสำเร็จอยู่
        if checkpoint_assignment.reserved_by == employee_code:
            return checkpoint_assignment

        if checkpoint_assignment.reserved_by is not None:
            reserved_employee = db.scalar(
                select(Employees).where(
                    Employees.employee_code
                    == checkpoint_assignment.reserved_by
                )
            )

            reserved_employee_name = None
            if reserved_employee is not None:
                reserved_employee_name = " ".join(
                    part
                    for part in [
                        str(
                            getattr(reserved_employee, "first_name", "") or ""
                        ).strip(),
                        str(
                            getattr(reserved_employee, "last_name", "") or ""
                        ).strip(),
                    ]
                    if part
                ).strip() or None

            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "code": "CHECKPOINT_ASSIGNMENT_RESERVED_BY_OTHER",
                    "message": "หน่วยงานนี้มีผู้จองแล้ว",
                    "employee_code": checkpoint_assignment.reserved_by,
                    "employee_name": reserved_employee_name,
                },
            )

        checkpoint_assignment.reserved_by = employee_code
        checkpoint_assignment.reserved_at = (
            CheckpointAssignmentService._now_bangkok_naive()
        )
        checkpoint_assignment.updated_by = employee_code

        return CheckpointAssignmentService._commit_and_refresh(
            db=db,
            checkpoint_assignment=checkpoint_assignment,
        )

    @staticmethod
    def cancel_checkpoint_assignment_reservation(
        db: Session,
        assignment_id: int,
        payload: CheckpointAssignmentReservationAction,
    ) -> CheckpointAssignment:
        employee_code = payload.employee_code.strip()

        CheckpointAssignmentService._ensure_employee_exists(
            db=db,
            employee_code=employee_code,
        )

        checkpoint_assignment = (
            CheckpointAssignmentService._get_checkpoint_assignment_for_update(
                db=db,
                assignment_id=assignment_id,
            )
        )

        if checkpoint_assignment.assignment_status != "pending":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="รายการนี้ไม่อยู่ในสถานะที่สามารถยกเลิกการจองได้",
            )

        if checkpoint_assignment.reserved_by is None:
            return checkpoint_assignment

        if checkpoint_assignment.reserved_by != employee_code:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="ไม่สามารถยกเลิกการจองของพนักงานคนอื่นได้",
            )

        checkpoint_assignment.reserved_by = None
        checkpoint_assignment.reserved_at = None
        checkpoint_assignment.updated_by = employee_code

        return CheckpointAssignmentService._commit_and_refresh(
            db=db,
            checkpoint_assignment=checkpoint_assignment,
        )

    @staticmethod
    def start_checkpoint_assignment(
        db: Session,
        assignment_id: int,
        updated_by: str,
    ) -> CheckpointAssignment:
        CheckpointAssignmentService._ensure_employee_exists(
            db=db,
            employee_code=updated_by,
        )

        checkpoint_assignment = (
            CheckpointAssignmentService._get_checkpoint_assignment_for_update(
                db=db,
                assignment_id=assignment_id,
            )
        )

        CheckpointAssignmentService._ensure_active_for_start(
            checkpoint_assignment=checkpoint_assignment,
        )

        CheckpointAssignmentService._ensure_start_in_shift_window(
            db=db,
            checkpoint_assignment=checkpoint_assignment,
        )

        if (
            checkpoint_assignment.reserved_by is not None
            and checkpoint_assignment.reserved_by != updated_by
        ):
            reserved_employee = db.scalar(
                select(Employees).where(
                    Employees.employee_code
                    == checkpoint_assignment.reserved_by
                )
            )

            reserved_employee_name = None
            if reserved_employee is not None:
                reserved_employee_name = " ".join(
                    part
                    for part in [
                        str(
                            getattr(reserved_employee, "first_name", "") or ""
                        ).strip(),
                        str(
                            getattr(reserved_employee, "last_name", "") or ""
                        ).strip(),
                    ]
                    if part
                ).strip() or None

            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "code": "CHECKPOINT_ASSIGNMENT_RESERVED_BY_OTHER",
                    "message": "หน่วยงานนี้ถูกจองโดยพนักงานคนอื่น",
                    "employee_code": checkpoint_assignment.reserved_by,
                    "employee_name": reserved_employee_name,
                },
            )

        CheckpointAssignmentService._transition_status(
            checkpoint_assignment=checkpoint_assignment,
            next_status="in_progress",
            updated_by=updated_by,
        )

        CheckpointAssignmentService._set_action_metadata(
            checkpoint_assignment=checkpoint_assignment,
            employee_code=updated_by,
            at_field="started_at",
            by_field="started_by",
        )

        # เมื่อเริ่มเข้าตรวจจริง ให้สิ้นสุดการจอง
        checkpoint_assignment.reserved_by = None
        checkpoint_assignment.reserved_at = None

        return CheckpointAssignmentService._commit_and_refresh(
            db=db,
            checkpoint_assignment=checkpoint_assignment,
        )

    @staticmethod
    def complete_checkpoint_assignment(
        db: Session,
        assignment_id: int,
        updated_by: str,
    ) -> CheckpointAssignment:
        CheckpointAssignmentService._ensure_employee_exists(
            db=db,
            employee_code=updated_by,
        )

        checkpoint_assignment = CheckpointAssignmentService.get_checkpoint_assignment(
            db=db,
            assignment_id=assignment_id,
        )

        CheckpointAssignmentService._transition_status(
            checkpoint_assignment=checkpoint_assignment,
            next_status="completed",
            updated_by=updated_by,
        )

        CheckpointAssignmentService._set_action_metadata(
            checkpoint_assignment=checkpoint_assignment,
            employee_code=updated_by,
            at_field="completed_at",
            by_field="completed_by",
        )

        return CheckpointAssignmentService._commit_and_refresh(
            db=db,
            checkpoint_assignment=checkpoint_assignment,
        )

    @staticmethod
    def recheck_checkpoint_assignment(
        db: Session,
        assignment_id: int,
        payload: CheckpointAssignmentRecheck,
    ) -> CheckpointAssignment:
        CheckpointAssignmentService._ensure_employee_exists(
            db=db,
            employee_code=payload.updated_by,
        )

        parent_assignment = CheckpointAssignmentService.get_checkpoint_assignment(
            db=db,
            assignment_id=assignment_id,
        )

        CheckpointAssignmentService._ensure_not_duplicate(
            db=db,
            work_date=payload.work_date,
            schedule_item_id=parent_assignment.schedule_item_id,
            parent_assignment_id=parent_assignment.assignment_id,
            duplicate_detail=CHECKPOINT_ASSIGNMENT_RECHECK_ALREADY_EXISTS_DETAIL,
        )

        CheckpointAssignmentService._transition_status(
            checkpoint_assignment=parent_assignment,
            next_status="repaired",
            updated_by=payload.updated_by,
        )

        recheck_assignment = CheckpointAssignment(
            work_date=payload.work_date,
            schedule_item_id=parent_assignment.schedule_item_id,
            parent_assignment_id=parent_assignment.assignment_id,
            parent_assignment_key=parent_assignment.assignment_id,
            active_unique_key=_ACTIVE_UNIQUE_KEY,
            recheck_depth=parent_assignment.recheck_depth + 1,
            due_datetime=payload.due_datetime,
            assignment_status="pending",
            recheck_reason=payload.recheck_reason,
            is_active=True,
            created_by=payload.updated_by,
            updated_by=payload.updated_by,
        )

        db.add(recheck_assignment)

        return CheckpointAssignmentService._commit_and_refresh(
            db=db,
            checkpoint_assignment=recheck_assignment,
            duplicate_detail=CHECKPOINT_ASSIGNMENT_RECHECK_ALREADY_EXISTS_DETAIL,
        )

    @staticmethod
    def delete_checkpoint_assignment(
        db: Session,
        assignment_id: int,
        updated_by: str,
    ) -> None:
        CheckpointAssignmentService._ensure_employee_exists(
            db=db,
            employee_code=updated_by,
        )

        checkpoint_assignment = CheckpointAssignmentService.get_checkpoint_assignment(
            db=db,
            assignment_id=assignment_id,
        )

        CheckpointAssignmentService._ensure_deletable(
            checkpoint_assignment=checkpoint_assignment,
        )

        checkpoint_assignment.updated_by = updated_by
        checkpoint_assignment.mark_flag = True
        checkpoint_assignment.active_unique_key = checkpoint_assignment.assignment_id

        CheckpointAssignmentService._commit(db=db)