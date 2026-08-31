from __future__ import annotations

from datetime import date, datetime, time, timedelta
from math import atan2, cos, radians, sin, sqrt
from typing import Any, ClassVar, Final, Literal
from zoneinfo import ZoneInfo

from fastapi import HTTPException, status
from sqlalchemy import and_, bindparam, exists, func, or_, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, aliased

from app.core.constants import DBConstants
from app.core.error_messages import (
    CHECKPOINT_ASSIGNMENT_ALREADY_IN_PROGRESS_TEMPLATE,
    CHECKPOINT_ASSIGNMENT_NOT_AVAILABLE_DETAIL,
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
    TakeoverCheckpointAssignmentResponse,
)
from app.schemas.checkpoint_location import (
    VerifyCheckpointLocationRequest,
    VerifyCheckpointLocationResponse,
)


_PARENT_ASSIGNMENT_ROOT_KEY: Final[int] = 0
_ACTIVE_UNIQUE_KEY: Final[int] = 0
_BANGKOK_TIMEZONE: Final[str] = "Asia/Bangkok"

_NO_CROSS_DAY_INSPECTION_MODES: Final[frozenset[str]] = frozenset(
    {
        "WEEKLY",
        "SPLIT_MONTH",
    }
)

_EXACT_INSPECTION_DAYS: Final[dict[str, int]] = {
    "EXACT_7": 7,
    "EXACT_15": 15,
}

_EXACT_INSPECTION_MODES: Final[frozenset[str]] = frozenset(
    {
        *_EXACT_INSPECTION_DAYS,
        "EXACT_MONTHLY",
    }
)

_WINDOW_INSPECTION_MODES: Final[frozenset[str]] = frozenset(
    {
        "FLEXIBLE_7",
        "FLEXIBLE_15",
        "FLEXIBLE_MONTHLY",
    }
)

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
    # Assignment ตรวจแทนที่ค้าง pending จากวันก่อนต้องยกเลิกได้
    # เมื่อสร้าง Assignment ลูกของวันปัจจุบันขึ้นมารับช่วงต่อ
    "pending": {"in_progress", "cancelled"},
    "in_progress": {"completed", "cancelled"},
    "completed": {"repaired"},
    "cancelled": set(),
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
    def _is_takeover_assignment(
        checkpoint_assignment: CheckpointAssignment,
    ) -> bool:
        return (
            checkpoint_assignment.parent_assignment_id is not None
            and not str(
                checkpoint_assignment.recheck_reason or ""
            ).strip()
            and checkpoint_assignment.schedule_rule_run_id is not None
        )

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
    def _as_date(value: Any) -> date | None:
        if isinstance(value, datetime):
            return value.date()

        if isinstance(value, date):
            return value

        if value is None:
            return None

        try:
            return date.fromisoformat(str(value).strip().split(" ", 1)[0])
        except ValueError:
            return None

    @staticmethod
    def _get_root_assignment_work_dates(
        db: Session,
        assignment_ids: set[int],
    ) -> dict[int, date]:
        clean_assignment_ids = {
            int(assignment_id)
            for assignment_id in assignment_ids
        }

        if not clean_assignment_ids:
            return {}

        root_work_dates: dict[int, date] = {}
        fallback_work_dates: dict[int, date] = {}
        current_ids_by_assignment = {
            assignment_id: assignment_id
            for assignment_id in clean_assignment_ids
        }
        visited_ids_by_assignment = {
            assignment_id: set()
            for assignment_id in clean_assignment_ids
        }

        while current_ids_by_assignment:
            current_ids = set(current_ids_by_assignment.values())
            rows = db.execute(
                select(
                    CheckpointAssignment.assignment_id.label(
                        "assignment_id"
                    ),
                    CheckpointAssignment.parent_assignment_id.label(
                        "parent_assignment_id"
                    ),
                    CheckpointAssignment.work_date.label("work_date"),
                ).where(
                    CheckpointAssignment.assignment_id.in_(current_ids)
                )
            ).mappings().all()
            rows_by_id = {
                int(row["assignment_id"]): row
                for row in rows
            }

            next_ids_by_assignment: dict[int, int] = {}

            for assignment_id, current_id in (
                current_ids_by_assignment.items()
            ):
                visited_ids = visited_ids_by_assignment[assignment_id]

                if current_id in visited_ids:
                    continue

                visited_ids.add(current_id)
                row = rows_by_id.get(current_id)

                if row is None:
                    continue

                row_work_date = (
                    CheckpointAssignmentService._as_date(row["work_date"])
                )
                if row_work_date is not None:
                    fallback_work_dates.setdefault(
                        assignment_id,
                        row_work_date,
                    )

                parent_assignment_id_raw = row["parent_assignment_id"]
                if parent_assignment_id_raw is None:
                    if row_work_date is not None:
                        root_work_dates[assignment_id] = row_work_date
                    continue

                next_ids_by_assignment[assignment_id] = int(
                    parent_assignment_id_raw
                )

            current_ids_by_assignment = next_ids_by_assignment

        for assignment_id, fallback_work_date in (
            fallback_work_dates.items()
        ):
            root_work_dates.setdefault(
                assignment_id,
                fallback_work_date,
            )

        return root_work_dates

    @staticmethod
    def _last_day_of_month(value: date) -> date:
        next_month = (value.replace(day=28) + timedelta(days=4)).replace(day=1)
        return next_month - timedelta(days=1)

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
    def _get_active_shift_window_infos(
        db: Session,
    ) -> list[dict[str, Any]]:
        stmt = text(
            """
            SELECT
                shift_id,
                shift_name_th,
                start_time,
                end_time,
                crosses_midnight
            FROM shifts
            WHERE COALESCE(mark_flag, 0) = 0
              AND COALESCE(is_active, 1) = 1
            ORDER BY shift_id ASC
            """
        )

        rows = db.execute(stmt).mappings().all()
        shift_infos: list[dict[str, Any]] = []

        for row in rows:
            start_time = CheckpointAssignmentService._normalize_time(
                row["start_time"]
            )
            end_time = CheckpointAssignmentService._normalize_time(
                row["end_time"]
            )

            if start_time is None or end_time is None:
                continue

            shift_infos.append(
                {
                    "shift_id": int(row["shift_id"]),
                    "shift_name_th": row["shift_name_th"],
                    "start_time": start_time,
                    "end_time": end_time,
                    "crosses_midnight": (
                        CheckpointAssignmentService._as_bool(
                            row["crosses_midnight"]
                        )
                    ),
                }
            )

        return shift_infos

    @staticmethod
    def _get_shift_window_info_by_type(
        db: Session,
        shift_type: ShiftType,
    ) -> dict[str, Any] | None:
        shift_infos = (
            CheckpointAssignmentService._get_active_shift_window_infos(
                db=db,
            )
        )

        for shift_info in shift_infos:
            crosses_midnight = bool(shift_info["crosses_midnight"])
            start_time = shift_info["start_time"]
            end_time = shift_info["end_time"]
            is_night_shift = crosses_midnight or end_time <= start_time

            if shift_type == "night" and is_night_shift:
                return shift_info

            if shift_type == "day" and not is_night_shift:
                return shift_info

        return None

    @staticmethod
    def _get_current_shift_window_info(
        db: Session,
        now: datetime,
    ) -> dict[str, Any] | None:
        shift_infos = (
            CheckpointAssignmentService._get_active_shift_window_infos(
                db=db,
            )
        )
        matching_shifts: list[tuple[datetime, dict[str, Any]]] = []

        for shift_info in shift_infos:
            for candidate_work_date in (
                now.date(),
                now.date() - timedelta(days=1),
            ):
                start_datetime, end_datetime = (
                    CheckpointAssignmentService
                    ._build_shift_datetime_window(
                        work_date=candidate_work_date,
                        start_time=shift_info["start_time"],
                        end_time=shift_info["end_time"],
                        crosses_midnight=bool(
                            shift_info["crosses_midnight"]
                        ),
                    )
                )

                if start_datetime <= now <= end_datetime:
                    matching_shifts.append(
                        (start_datetime, shift_info)
                    )

        if not matching_shifts:
            return None

        # หากช่วงเวลาของผลัดซ้อนกัน ให้ผลัดที่เริ่มล่าสุดเป็นผลัดปัจจุบัน
        matching_shifts.sort(key=lambda item: item[0], reverse=True)
        return matching_shifts[0][1]

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

        # EXACT_* เป็นงานตามรอบตรวจ ไม่ได้จำกัดว่าต้องดำเนินการเฉพาะ
        # ผลัดเดิมของ schedule_item เท่านั้น จึงอนุญาตให้เริ่มตรวจใน
        # ผลัดปัจจุบันได้ทั้งกลางวันและกลางคืน โดยยังคงใช้ Assignment เดิม
        # และให้กติกา Rule Run เป็นผู้ตรวจสอบว่ารอบยังเปิดอยู่หรือไม่
        schedule_rule_run_id = checkpoint_assignment.schedule_rule_run_id

        if schedule_rule_run_id is not None:
            rule_run_context = (
                CheckpointAssignmentService
                ._get_rule_run_contexts_by_ids(
                    db=db,
                    rule_run_ids={int(schedule_rule_run_id)},
                )
                .get(int(schedule_rule_run_id))
            )
            inspection_mode = str(
                (rule_run_context or {}).get("inspection_mode") or ""
            ).strip().upper()

            if inspection_mode in _EXACT_INSPECTION_MODES:
                current_shift_info = (
                    CheckpointAssignmentService
                    ._get_current_shift_window_info(
                        db=db,
                        now=now,
                    )
                )

                if current_shift_info is not None:
                    return

                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=(
                        "ไม่พบผลัดที่เปิดให้ดำเนินการ"
                        "ในเวลาปัจจุบัน"
                    ),
                )

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
    def _get_rule_run_contexts_by_ids(
        db: Session,
        rule_run_ids: set[int],
    ) -> dict[int, dict[str, Any]]:
        if not rule_run_ids:
            return {}

        stmt = text(
            """
            SELECT
                rule_run.rule_run_id,
                rule_run.assignment_start_date,
                rule_run.assignment_end_date,
                rule_set.inspection_mode
            FROM checkpoint_schedule_rule_run AS rule_run
            LEFT JOIN checkpoint_schedule_rule_set AS rule_set
              ON rule_set.rule_set_id = rule_run.rule_set_id
            WHERE rule_run.rule_run_id IN :rule_run_ids
            """
        ).bindparams(
            bindparam(
                "rule_run_ids",
                expanding=True,
            )
        )

        rows = db.execute(
            stmt,
            {
                "rule_run_ids": sorted(rule_run_ids),
            },
        ).mappings().all()

        contexts: dict[int, dict[str, Any]] = {}

        for row in rows:
            contexts[int(row["rule_run_id"])] = {
                "inspection_mode": str(
                    row["inspection_mode"] or ""
                ).strip().upper(),
                "assignment_start_date": (
                    CheckpointAssignmentService._as_date(
                        row["assignment_start_date"]
                    )
                ),
                "assignment_end_date": (
                    CheckpointAssignmentService._as_date(
                        row["assignment_end_date"]
                    )
                ),
            }

        return contexts

    @staticmethod
    def _get_cross_day_inspection_period(
        assignment_work_date: date,
        rule_run_context: dict[str, Any] | None,
    ) -> tuple[date, date] | None:
        if rule_run_context is None:
            return None

        inspection_mode = str(
            rule_run_context.get("inspection_mode") or ""
        ).strip().upper()

        if inspection_mode in _NO_CROSS_DAY_INSPECTION_MODES:
            return None

        exact_days = _EXACT_INSPECTION_DAYS.get(inspection_mode)
        if exact_days is not None:
            period_start = assignment_work_date
            period_end = min(
                period_start + timedelta(days=exact_days - 1),
                CheckpointAssignmentService._last_day_of_month(period_start),
            )
            return period_start, period_end

        if inspection_mode == "EXACT_MONTHLY":
            period_start = assignment_work_date
            period_end = CheckpointAssignmentService._last_day_of_month(
                period_start
            )
            return period_start, period_end

        if inspection_mode in _WINDOW_INSPECTION_MODES:
            period_start = rule_run_context.get("assignment_start_date")
            period_end = rule_run_context.get("assignment_end_date")

            if not isinstance(period_start, date):
                period_start = assignment_work_date

            if not isinstance(period_end, date):
                return None

            return period_start, period_end

        # inspection_mode อื่นที่อนุญาตให้ข้ามวัน ใช้ช่วงจาก Rule Run
        # โดยไม่อ้าง rule_type
        period_start = rule_run_context.get("assignment_start_date")
        period_end = rule_run_context.get("assignment_end_date")

        if not isinstance(period_start, date):
            period_start = assignment_work_date

        if not isinstance(period_end, date):
            return None

        return period_start, period_end

    @staticmethod
    def _get_assignment_period_key(
        schedule_rule_run_id: int,
        assignment_work_date: date,
        rule_run_context: dict[str, Any] | None,
    ) -> tuple[int, date, date]:
        inspection_period = (
            CheckpointAssignmentService._get_cross_day_inspection_period(
                assignment_work_date=assignment_work_date,
                rule_run_context=rule_run_context,
            )
        )

        if inspection_period is None:
            period_start = assignment_work_date
            period_end = assignment_work_date
        else:
            period_start, period_end = inspection_period

        return schedule_rule_run_id, period_start, period_end

    @staticmethod
    def _is_cross_day_open_within_period(
        period_anchor_work_date: date,
        source_work_date: date,
        requested_work_date: date,
        assignment_status: str | None,
        started_at: datetime | None,
        completed_at: datetime | None,
        is_takeover_assignment: bool,
        rule_run_context: dict[str, Any] | None,
    ) -> bool:
        """
        ตรวจว่างานล่าสุดในสายตรวจแทนยังค้างอยู่ในรอบหรือไม่

        รองรับทั้ง:
        - in_progress: เช็กอินแล้วแต่ยังไม่เช็กเอาต์
        - pending: งานลูกตรวจแทนจากวันก่อนที่ยังไม่เช็กอิน

        period_anchor_work_date คือวันที่ของ Assignment ราก เช่น 20
        source_work_date คือวันที่ของรายการล่าสุด เช่น 24
        """

        if completed_at is not None:
            return False

        if assignment_status == "in_progress":
            if started_at is None:
                return False
        elif assignment_status == "pending":
            if not is_takeover_assignment or started_at is not None:
                return False
        else:
            return False

        # ตรวจแทนซ้ำได้ตั้งแต่วันถัดไปของรายการล่าสุดเท่านั้น
        if source_work_date >= requested_work_date:
            return False

        inspection_period = (
            CheckpointAssignmentService._get_cross_day_inspection_period(
                assignment_work_date=period_anchor_work_date,
                rule_run_context=rule_run_context,
            )
        )

        if inspection_period is None:
            return False

        period_start, period_end = inspection_period
        return period_start <= requested_work_date <= period_end

    @staticmethod
    def _is_cross_day_takeover_allowed(
        period_anchor_work_date: date,
        source_work_date: date,
        requested_work_date: date,
        assignment_status: str | None,
        started_at: datetime | None,
        completed_at: datetime | None,
        started_by: str | None,
        employee_code: str | None,
        is_takeover_assignment: bool,
        rule_run_context: dict[str, Any] | None,
    ) -> bool:
        clean_employee_code = (employee_code or "").strip()

        if not clean_employee_code:
            return False

        is_open_within_period = (
            CheckpointAssignmentService
            ._is_cross_day_open_within_period(
                period_anchor_work_date=period_anchor_work_date,
                source_work_date=source_work_date,
                requested_work_date=requested_work_date,
                assignment_status=assignment_status,
                started_at=started_at,
                completed_at=completed_at,
                is_takeover_assignment=is_takeover_assignment,
                rule_run_context=rule_run_context,
            )
        )

        if not is_open_within_period:
            return False

        # pending ตรวจแทนยังไม่มีผู้เช็กอิน จึงให้พนักงานคนเดิมหรือคนอื่น
        # กดรับช่วงในวันถัดไปได้ โดยไม่ถือเป็นการจอง
        if assignment_status == "pending":
            return is_takeover_assignment

        clean_started_by = (started_by or "").strip()

        if not clean_started_by:
            return False

        # ผู้ที่กำลังถือ in_progress อยู่สามารถเช็กเอาต์รายการเดิมได้
        # ไม่จำเป็นต้องสร้างงานตรวจแทนของตนเอง
        return clean_started_by != clean_employee_code

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
    def _raise_assignment_in_progress_conflict(
        db: Session,
        employee_code: str | None,
    ) -> None:
        clean_employee_code = (employee_code or "").strip()

        employee_name = "-"
        if clean_employee_code:
            employee = db.scalar(
                select(Employees).where(
                    Employees.employee_code == clean_employee_code
                )
            )

            if employee is not None:
                employee_name = " ".join(
                    part
                    for part in [
                        str(getattr(employee, "first_name", "") or "").strip(),
                        str(getattr(employee, "last_name", "") or "").strip(),
                    ]
                    if part
                ).strip() or "-"

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=CHECKPOINT_ASSIGNMENT_ALREADY_IN_PROGRESS_TEMPLATE.format(
                employee_code=clean_employee_code or "-",
                employee_name=employee_name,
            ),
        )

    @staticmethod
    def _ensure_rule_run_pending_action_available(
        db: Session,
        checkpoint_assignment: CheckpointAssignment,
        ignored_assignment_ids: set[int] | None = None,
        period_anchor_work_date: date | None = None,
    ) -> None:
        schedule_rule_run_id = checkpoint_assignment.schedule_rule_run_id

        # Legacy Assignment ไม่มี Rule Run: คงพฤติกรรมเดิม
        if schedule_rule_run_id is None:
            return

        rule_run_context = (
            CheckpointAssignmentService
            ._get_rule_run_contexts_by_ids(
                db=db,
                rule_run_ids={int(schedule_rule_run_id)},
            )
            .get(int(schedule_rule_run_id))
        )
        resolved_period_anchor_work_date = period_anchor_work_date

        if (
            resolved_period_anchor_work_date is None
            and checkpoint_assignment.assignment_id is not None
            and CheckpointAssignmentService._is_takeover_assignment(
                checkpoint_assignment
            )
        ):
            root_work_dates = (
                CheckpointAssignmentService
                ._get_root_assignment_work_dates(
                    db=db,
                    assignment_ids={
                        int(checkpoint_assignment.assignment_id)
                    },
                )
            )
            resolved_period_anchor_work_date = root_work_dates.get(
                int(checkpoint_assignment.assignment_id)
            )

        if resolved_period_anchor_work_date is None:
            resolved_period_anchor_work_date = (
                checkpoint_assignment.work_date
            )

        inspection_period = (
            CheckpointAssignmentService._get_cross_day_inspection_period(
                assignment_work_date=resolved_period_anchor_work_date,
                rule_run_context=rule_run_context,
            )
        )

        # WEEKLY/SPLIT_MONTH หรือข้อมูลรอบไม่สมบูรณ์ ให้ล็อกเฉพาะวันงาน
        if inspection_period is None:
            period_start = resolved_period_anchor_work_date
            period_end = resolved_period_anchor_work_date
        else:
            period_start, period_end = inspection_period

        excluded_assignment_ids = {
            int(assignment_id)
            for assignment_id in (ignored_assignment_ids or set())
        }

        if checkpoint_assignment.assignment_id is not None:
            excluded_assignment_ids.add(
                int(checkpoint_assignment.assignment_id)
            )

        period_conditions = [
            CheckpointAssignment.schedule_rule_run_id
            == schedule_rule_run_id,
            CheckpointAssignment.work_date.between(
                period_start,
                period_end,
            ),
            CheckpointAssignment.mark_flag.is_(False),
        ]

        if excluded_assignment_ids:
            period_conditions.append(
                CheckpointAssignment.assignment_id.notin_(
                    excluded_assignment_ids
                )
            )

        in_progress_stmt = (
            select(
                CheckpointAssignment.assignment_id,
                CheckpointAssignment.started_by,
            )
            .where(
                *period_conditions,
                CheckpointAssignment.started_at.is_not(None),
                CheckpointAssignment.completed_at.is_(None),
                CheckpointAssignment.assignment_status == "in_progress",
            )
            .order_by(
                CheckpointAssignment.started_at.asc(),
                CheckpointAssignment.assignment_id.asc(),
            )
            .limit(1)
        )

        in_progress_row = db.execute(in_progress_stmt).mappings().first()

        if in_progress_row is not None:
            CheckpointAssignmentService._raise_assignment_in_progress_conflict(
                db=db,
                employee_code=in_progress_row["started_by"],
            )

        closed_stmt = select(
            exists().where(
                *period_conditions,
                or_(
                    CheckpointAssignment.completed_at.is_not(None),
                    CheckpointAssignment.assignment_status.in_(
                        ("completed", "repaired")
                    ),
                ),
            )
        )

        if db.scalar(closed_stmt):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=CHECKPOINT_ASSIGNMENT_NOT_AVAILABLE_DETAIL,
            )

    @staticmethod
    def _ensure_assignment_checkout_owner(
        db: Session,
        checkpoint_assignment: CheckpointAssignment,
        employee_code: str,
    ) -> None:
        if checkpoint_assignment.assignment_status != "in_progress":
            return

        started_by = (checkpoint_assignment.started_by or "").strip()
        clean_employee_code = employee_code.strip()

        if started_by and started_by != clean_employee_code:
            CheckpointAssignmentService._raise_assignment_in_progress_conflict(
                db=db,
                employee_code=started_by,
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
            .execution_options(populate_existing=True)
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
        target_shift_info = (
            CheckpointAssignmentService._get_shift_window_info_by_type(
                db=db,
                shift_type=shift_type,
            )
            if shift_type is not None
            else None
        )

        if shift_type is not None and target_shift_info is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="ไม่พบข้อมูลผลัดที่เลือกหรือผลัดถูกปิดใช้งาน",
            )

        target_shift_id = (
            int(target_shift_info["shift_id"])
            if target_shift_info is not None
            else None
        )

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
                CheckpointAssignment.schedule_rule_run_id.label(
                    "schedule_rule_run_id"
                ),
                CheckpointAssignment.parent_assignment_id.label(
                    "parent_assignment_id"
                ),
                CheckpointAssignment.recheck_reason.label(
                    "recheck_reason"
                ),
                CheckpointAssignment.updated_by.label("takeover_by"),
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
                        CheckpointAssignment.schedule_rule_run_id.is_not(None),
                        CheckpointAssignment.assignment_status == "in_progress",
                        CheckpointAssignment.started_at.is_not(None),
                        CheckpointAssignment.completed_at.is_(None),
                    ),
                    # Assignment ลูกตรวจแทนที่ยังไม่เช็กอินต้องแสดงข้ามวัน
                    # จนกว่าจะ completed หรือพ้นรอบตรวจ
                    and_(
                        CheckpointAssignment.work_date < work_date,
                        CheckpointAssignment.schedule_rule_run_id.is_not(None),
                        CheckpointAssignment.parent_assignment_id.is_not(None),
                        or_(
                            CheckpointAssignment.recheck_reason.is_(None),
                            func.trim(
                                CheckpointAssignment.recheck_reason
                            ) == "",
                        ),
                        CheckpointAssignment.assignment_status == "pending",
                        CheckpointAssignment.started_at.is_(None),
                        CheckpointAssignment.completed_at.is_(None),
                    ),
                    and_(
                        CheckpointAssignment.work_date < work_date,
                        CheckpointAssignment.assignment_status == "pending",
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

        if target_shift_id is not None:
            # ดึงงาน Rule Engine ที่ยังเปิดอยู่จากทั้งสองผลัดมาก่อน
            # เพื่อให้สามารถจำแนก EXACT_* และเปิดให้แสดงข้ามผลัดได้
            # จากนั้นจึงกรอง inspection_mode ที่ไม่เกี่ยวข้องด้านล่าง
            stmt = stmt.where(
                or_(
                    CheckpointScheduleItem.shift_id == target_shift_id,
                    and_(
                        CheckpointAssignment.schedule_rule_run_id.is_not(None),
                        CheckpointAssignment.assignment_status.in_(
                            ("pending", "in_progress")
                        ),
                        CheckpointAssignment.completed_at.is_(None),
                    ),
                )
            )

        stmt = stmt.order_by(
            CheckpointAssignment.work_date.asc(),
            CheckpointScheduleItem.sequence_no.asc(),
            CheckpointAssignment.assignment_id.asc(),
        )

        rows = db.execute(stmt).mappings().all()

        # Context ที่โหลดไว้สามารถนำกลับไปใช้กับการกรองข้ามวันและ
        # Schedule Rule Run state ด้านล่างได้ เพื่อลดการอ่านฐานข้อมูลซ้ำ
        rule_run_contexts: dict[int, dict[str, Any]] = {}

        if target_shift_id is not None:
            cross_shift_rule_run_ids = {
                int(row["schedule_rule_run_id"])
                for row in rows
                if row.get("schedule_rule_run_id") is not None
                and row.get("shift_id") != target_shift_id
            }

            if cross_shift_rule_run_ids:
                rule_run_contexts.update(
                    CheckpointAssignmentService
                    ._get_rule_run_contexts_by_ids(
                        db=db,
                        rule_run_ids=cross_shift_rule_run_ids,
                    )
                )

            shift_filtered_rows = []

            for row in rows:
                row_shift_id_raw = row.get("shift_id")
                row_shift_id = (
                    int(row_shift_id_raw)
                    if row_shift_id_raw is not None
                    else None
                )

                if row_shift_id == target_shift_id:
                    shift_filtered_rows.append(row)
                    continue

                # คงพฤติกรรมเดิมสำหรับงาน Rule Engine ที่เริ่มตรวจแล้ว
                # เพื่อให้ผู้ถือ Assignment สามารถเช็กเอาต์ต่อได้
                is_open_in_progress = (
                    row.get("schedule_rule_run_id") is not None
                    and row.get("assignment_status") == "in_progress"
                    and row.get("started_at") is not None
                    and row.get("completed_at") is None
                )

                if is_open_in_progress:
                    shift_filtered_rows.append(row)
                    continue

                rule_run_id_raw = row.get("schedule_rule_run_id")

                if rule_run_id_raw is None:
                    continue

                rule_run_context = rule_run_contexts.get(
                    int(rule_run_id_raw)
                )
                inspection_mode = str(
                    (rule_run_context or {}).get("inspection_mode") or ""
                ).strip().upper()
                is_exact_pending = (
                    inspection_mode in _EXACT_INSPECTION_MODES
                    and row.get("assignment_status") == "pending"
                    and row.get("started_at") is None
                    and row.get("completed_at") is None
                )

                if is_exact_pending:
                    shift_filtered_rows.append(row)

            rows = shift_filtered_rows

        period_anchor_work_dates_by_assignment = (
            CheckpointAssignmentService._get_root_assignment_work_dates(
                db=db,
                assignment_ids={
                    int(row["assignment_id"])
                    for row in rows
                    if row["assignment_id"] is not None
                    and row.get("parent_assignment_id") is not None
                    and row.get("schedule_rule_run_id") is not None
                    and not str(
                        row.get("recheck_reason") or ""
                    ).strip()
                },
            )
        )

        # กรอง Assignment ที่ค้างจากวันก่อน:
        # - WEEKLY/SPLIT_MONTH ไม่แสดงข้ามวัน
        # - EXACT_* ใช้รอบจาก work_date ตามจำนวนวันของ inspection_mode
        # - FLEXIBLE_* ใช้ assignment_start_date/assignment_end_date ของ run
        # - รองรับทั้ง in_progress และลูกตรวจแทน pending
        # - เมื่อพ้นรอบแล้วไม่แสดงงานค้างจากรอบเดิม
        rule_run_ids_for_cross_day = {
            int(row["schedule_rule_run_id"])
            for row in rows
            if row.get("schedule_rule_run_id") is not None
            and row["work_date"] < work_date
            and (
                row["assignment_status"] == "in_progress"
                or (
                    row["assignment_status"] == "pending"
                    and row.get("parent_assignment_id") is not None
                    and not str(
                        row.get("recheck_reason") or ""
                    ).strip()
                )
            )
        }

        missing_cross_day_rule_run_ids = (
            rule_run_ids_for_cross_day - set(rule_run_contexts)
        )
        if missing_cross_day_rule_run_ids:
            rule_run_contexts.update(
                CheckpointAssignmentService
                ._get_rule_run_contexts_by_ids(
                    db=db,
                    rule_run_ids=missing_cross_day_rule_run_ids,
                )
            )

        filtered_rows = []

        for row in rows:
            row_assignment_id = int(row["assignment_id"])
            is_takeover_assignment_row = (
                row.get("parent_assignment_id") is not None
                and row.get("schedule_rule_run_id") is not None
                and not str(
                    row.get("recheck_reason") or ""
                ).strip()
            )
            is_cross_day_open_candidate = (
                row["work_date"] < work_date
                and row.get("schedule_rule_run_id") is not None
                and (
                    row["assignment_status"] == "in_progress"
                    or (
                        row["assignment_status"] == "pending"
                        and is_takeover_assignment_row
                    )
                )
            )

            if not is_cross_day_open_candidate:
                filtered_rows.append(row)
                continue

            rule_run_id_raw = row.get("schedule_rule_run_id")

            # Legacy Assignment หรือข้อมูล run หาไม่พบ: คงพฤติกรรมเดิมไว้
            # เพื่อไม่ให้รายการที่เคยใช้งานหายจากหน้าจอโดยไม่ตั้งใจ
            if rule_run_id_raw is None:
                filtered_rows.append(row)
                continue

            rule_run_context = rule_run_contexts.get(int(rule_run_id_raw))

            if rule_run_context is None:
                filtered_rows.append(row)
                continue

            if (
                CheckpointAssignmentService
                ._is_cross_day_open_within_period(
                    period_anchor_work_date=(
                        period_anchor_work_dates_by_assignment.get(
                            row_assignment_id,
                            row["work_date"],
                        )
                    ),
                    source_work_date=row["work_date"],
                    requested_work_date=work_date,
                    assignment_status=row["assignment_status"],
                    started_at=row.get("started_at"),
                    completed_at=row.get("completed_at"),
                    is_takeover_assignment=(
                        is_takeover_assignment_row
                    ),
                    rule_run_context=rule_run_context,
                )
            ):
                filtered_rows.append(row)

        rows = filtered_rows

        # Assignment pending ของวันปัจจุบันอาจถูกซ่อนจากรายการ เพราะมีงานเก่า
        # ค้างอยู่ จึงค้นหาจากฐานข้อมูลโดยตรงเพื่อใช้ตรวจแทน
        clean_employee_code = (employee_code or "").strip()
        takeover_target_location_shift_keys: set[
            tuple[int, int | None]
        ] = set()

        if clean_employee_code:
            takeover_target_stmt = select(
                CheckpointScheduleItem.route_site_location_id.label(
                    "route_site_location_id"
                ),
                CheckpointScheduleItem.shift_id.label("shift_id"),
            ).join(
                CheckpointAssignment,
                CheckpointAssignment.schedule_item_id
                == CheckpointScheduleItem.schedule_item_id,
            ).where(
                CheckpointAssignment.work_date == work_date,
                CheckpointAssignment.assignment_status == "pending",
                CheckpointAssignment.started_at.is_(None),
                CheckpointAssignment.completed_at.is_(None),
                CheckpointAssignment.parent_assignment_id.is_(None),
                CheckpointAssignment.is_active.is_(True),
                CheckpointAssignment.mark_flag.is_(False),
                or_(
                    CheckpointAssignment.reserved_by.is_(None),
                    CheckpointAssignment.reserved_by == clean_employee_code,
                ),
            )

            takeover_target_location_shift_keys = {
                (
                    int(target_row["route_site_location_id"]),
                    (
                        int(target_row["shift_id"])
                        if target_row["shift_id"] is not None
                        else None
                    ),
                )
                for target_row in db.execute(
                    takeover_target_stmt
                ).mappings().all()
                if target_row["route_site_location_id"] is not None
            }

        # ============================================================
        # Schedule Rule Run state
        # ============================================================
        # Hybrid visibility:
        # - ยังไม่เริ่ม  -> แสดง pending ของวันที่เปิดดูตามปกติ
        # - งานค้าง     -> แสดง Assignment ล่าสุดและซ่อน pending ในรอบเดียวกัน
        # - completed   -> ปิดเฉพาะรอบนั้น ซ่อน pending และแสดงประวัติ completed
        #
        # Legacy Assignment ที่ schedule_rule_run_id เป็น NULL
        # จะไม่เข้า logic นี้และยังคงพฤติกรรมเดิม
        rule_run_ids = {
            int(row["schedule_rule_run_id"])
            for row in rows
            if row.get("schedule_rule_run_id") is not None
        }

        missing_context_rule_run_ids = (
            rule_run_ids - set(rule_run_contexts)
        )
        if missing_context_rule_run_ids:
            rule_run_contexts.update(
                CheckpointAssignmentService
                ._get_rule_run_contexts_by_ids(
                    db=db,
                    rule_run_ids=missing_context_rule_run_ids,
                )
            )

        open_assignment_ids_by_period: dict[
            tuple[int, date, date],
            set[int],
        ] = {}
        completed_period_keys: set[tuple[int, date, date]] = set()

        if rule_run_ids:
            rule_state_stmt = (
                select(
                    CheckpointAssignment.schedule_rule_run_id.label(
                        "schedule_rule_run_id"
                    ),
                    CheckpointAssignment.assignment_id.label(
                        "assignment_id"
                    ),
                    CheckpointAssignment.work_date.label("work_date"),
                    CheckpointAssignment.parent_assignment_id.label(
                        "parent_assignment_id"
                    ),
                    CheckpointAssignment.recheck_reason.label(
                        "recheck_reason"
                    ),
                    CheckpointAssignment.assignment_status.label(
                        "assignment_status"
                    ),
                    CheckpointAssignment.started_at.label("started_at"),
                    CheckpointAssignment.completed_at.label("completed_at"),
                )
                .where(
                    CheckpointAssignment.schedule_rule_run_id.in_(rule_run_ids),
                    CheckpointAssignment.mark_flag.is_(False),
                    or_(
                        CheckpointAssignment.started_at.is_not(None),
                        CheckpointAssignment.completed_at.is_not(None),
                        CheckpointAssignment.assignment_status.in_(
                            ("in_progress", "completed", "repaired")
                        ),
                        and_(
                            CheckpointAssignment.assignment_status
                            == "pending",
                            CheckpointAssignment.parent_assignment_id.is_not(
                                None
                            ),
                            or_(
                                CheckpointAssignment.recheck_reason.is_(None),
                                func.trim(
                                    CheckpointAssignment.recheck_reason
                                ) == "",
                            ),
                        ),
                    ),
                )
            )

            rule_state_rows = db.execute(rule_state_stmt).mappings().all()

            state_assignment_ids = {
                int(state_row["assignment_id"])
                for state_row in rule_state_rows
                if state_row["assignment_id"] is not None
                and state_row.get("parent_assignment_id") is not None
                and not str(
                    state_row.get("recheck_reason") or ""
                ).strip()
            }
            missing_period_anchor_assignment_ids = (
                state_assignment_ids
                - set(period_anchor_work_dates_by_assignment)
            )
            if missing_period_anchor_assignment_ids:
                period_anchor_work_dates_by_assignment.update(
                    CheckpointAssignmentService
                    ._get_root_assignment_work_dates(
                        db=db,
                        assignment_ids=(
                            missing_period_anchor_assignment_ids
                        ),
                    )
                )

            for state_row in rule_state_rows:
                run_id_raw = state_row["schedule_rule_run_id"]
                assignment_id_raw = state_row["assignment_id"]

                if run_id_raw is None or assignment_id_raw is None:
                    continue

                run_id = int(run_id_raw)
                state_assignment_id = int(assignment_id_raw)
                state_status = str(state_row["assignment_status"] or "")
                state_period_key = (
                    CheckpointAssignmentService
                    ._get_assignment_period_key(
                        schedule_rule_run_id=run_id,
                        assignment_work_date=(
                            period_anchor_work_dates_by_assignment.get(
                                state_assignment_id,
                                state_row["work_date"],
                            )
                        ),
                        rule_run_context=rule_run_contexts.get(run_id),
                    )
                )

                is_takeover_state = (
                    state_row.get("parent_assignment_id") is not None
                    and not str(
                        state_row.get("recheck_reason") or ""
                    ).strip()
                )
                is_open = (
                    state_row["completed_at"] is None
                    and (
                        (
                            state_status == "in_progress"
                            and state_row["started_at"] is not None
                        )
                        or (
                            state_status == "pending"
                            and state_row["started_at"] is None
                            and is_takeover_state
                        )
                    )
                )

                if is_open:
                    open_assignment_ids_by_period.setdefault(
                        state_period_key,
                        set(),
                    ).add(state_assignment_id)

                if (
                    state_row["completed_at"] is not None
                    or state_status in {"completed", "repaired"}
                ):
                    completed_period_keys.add(state_period_key)

        takeover_pending_parent_assignment_ids = {
            int(row["parent_assignment_id"])
            for row in rows
            if row.get("parent_assignment_id") is not None
            and row.get("schedule_rule_run_id") is not None
            and row["assignment_status"] == "pending"
            and not str(row.get("recheck_reason") or "").strip()
            and row["work_date"] == work_date
        }

        result: list[CheckpointAssignmentDailyResponse] = []

        for row in rows:
            data = dict(row)
            is_takeover_assignment_row = (
                data.get("parent_assignment_id") is not None
                and data.get("schedule_rule_run_id") is not None
                and not str(data.get("recheck_reason") or "").strip()
            )
            is_takeover_pending_row = (
                is_takeover_assignment_row
                and data.get("assignment_status") == "pending"
            )

            # ========================================================
            # Schedule Rule Run visibility
            # ========================================================
            schedule_rule_run_id_raw = data.get("schedule_rule_run_id")
            schedule_rule_run_id = (
                int(schedule_rule_run_id_raw)
                if schedule_rule_run_id_raw is not None
                else None
            )

            if schedule_rule_run_id is not None:
                assignment_id = int(data["assignment_id"])
                row_status = str(data.get("assignment_status") or "")
                row_period_key = (
                    CheckpointAssignmentService
                    ._get_assignment_period_key(
                        schedule_rule_run_id=schedule_rule_run_id,
                        assignment_work_date=(
                            period_anchor_work_dates_by_assignment.get(
                                assignment_id,
                                data["work_date"],
                            )
                        ),
                        rule_run_context=rule_run_contexts.get(
                            schedule_rule_run_id
                        ),
                    )
                )
                open_assignment_ids = (
                    open_assignment_ids_by_period.get(
                        row_period_key,
                        set(),
                    )
                )

                # แสดง Assignment ลูก pending แทนรายการก่อนหน้า
                # ที่ถูกยกเลิกตอนยืนยันตรวจแทน
                if (
                    assignment_id
                    in takeover_pending_parent_assignment_ids
                ):
                    continue

                # completed ของวันที่เปิดดูต้องคงไว้เป็นประวัติ "ตรวจแล้ว"
                # แม้ในรอบเดียวกันจะมี Assignment ที่กำลังตรวจอยู่
                if row_status == "completed":
                    pass

                # ถ้ามีงานค้าง ให้แสดงเฉพาะรายการล่าสุดที่เป็น
                # in_progress หรือลูกตรวจแทน pending
                elif open_assignment_ids:
                    if (
                        assignment_id not in open_assignment_ids
                        and not is_takeover_pending_row
                    ):
                        continue

                # ถ้าไม่มีงานค้างและ run ถูกปิดแล้ว ให้ซ่อน pending ที่เหลือ
                elif row_period_key in completed_period_keys:
                    continue

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
            schedule_shift_id = (
                int(shift_id_raw)
                if shift_id_raw is not None
                else None
            )

            rule_run_context = (
                rule_run_contexts.get(schedule_rule_run_id)
                if schedule_rule_run_id is not None
                else None
            )
            inspection_mode = str(
                (rule_run_context or {}).get("inspection_mode") or ""
            ).strip().upper()

            # เมื่อเปิด EXACT_* จากอีกผลัด ให้ใช้ผลัดที่ผู้ใช้กำลังเลือก
            # เป็นผลัดปฏิบัติงานสำหรับ can_action และ shift_id ที่ส่งไป
            # บันทึก time_record โดยไม่แก้ shift_id ของ schedule_item ใน DB
            is_exact_cross_shift = (
                target_shift_id is not None
                and inspection_mode in _EXACT_INSPECTION_MODES
                and schedule_shift_id != target_shift_id
                and assignment_status in {"pending", "in_progress"}
                and data.get("completed_at") is None
            )
            action_shift_id = (
                target_shift_id
                if is_exact_cross_shift
                else schedule_shift_id
            )

            if is_exact_cross_shift:
                data["shift_id"] = action_shift_id

            is_overdue = CheckpointAssignmentService._is_overdue(
                assignment_status=assignment_status,
                due_datetime=due_datetime,
                now=now,
            )

            action_state = CheckpointAssignmentService._build_action_state_for_shift(
                db=db,
                work_date=data["work_date"],
                shift_id=action_shift_id,
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

            takeover_location_shift_key = (
                int(data["route_site_location_id"]),
                action_shift_id,
            )

            has_existing_takeover_target = (
                takeover_location_shift_key
                in takeover_target_location_shift_keys
            )
            can_create_exact_takeover_target = (
                inspection_mode in _EXACT_INSPECTION_MODES
            )

            can_takeover = (
                schedule_rule_run_id is not None
                and (
                    has_existing_takeover_target
                    or can_create_exact_takeover_target
                )
                and CheckpointAssignmentService
                ._is_cross_day_takeover_allowed(
                    period_anchor_work_date=(
                        period_anchor_work_dates_by_assignment.get(
                            int(data["assignment_id"]),
                            data["work_date"],
                        )
                    ),
                    source_work_date=data["work_date"],
                    requested_work_date=work_date,
                    assignment_status=assignment_status,
                    started_at=data.get("started_at"),
                    completed_at=data.get("completed_at"),
                    started_by=data.get("started_by"),
                    employee_code=clean_employee_code,
                    is_takeover_assignment=(
                        is_takeover_assignment_row
                    ),
                    rule_run_context=rule_run_context,
                )
            )

            if can_takeover:
                takeover_action_state = (
                    CheckpointAssignmentService
                    ._build_action_state_for_shift(
                        db=db,
                        work_date=work_date,
                        shift_id=action_shift_id,
                        assignment_status="pending",
                        is_active=True,
                        now=now,
                    )
                )
                can_takeover = bool(takeover_action_state["can_action"])

                # pending ตรวจแทนจากวันก่อนต้องเปิดปุ่มของวันปัจจุบัน
                # เพื่อให้ Frontend เรียกตรวจแทนซ้ำและสร้างลูกของวันนี้
                if (
                    can_takeover
                    and is_takeover_pending_row
                    and data["work_date"] < work_date
                ):
                    action_state = takeover_action_state

            data["can_takeover"] = can_takeover
            data["is_takeover_pending"] = is_takeover_pending_row
            data["takeover_by"] = (
                str(data.get("takeover_by") or "").strip() or None
                if is_takeover_pending_row
                else None
            )

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

            # ใช้เฉพาะภายใน Backend สำหรับจำแนก Assignment ตรวจแทน
            data.pop("parent_assignment_id", None)
            data.pop("recheck_reason", None)

            # ใช้เฉพาะภายใน Backend สำหรับกรองรอบตรวจ
            # ไม่ส่งออกไปยัง Frontend
            data.pop("schedule_rule_run_id", None)

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

        CheckpointAssignmentService._ensure_rule_run_pending_action_available(
            db=db,
            checkpoint_assignment=checkpoint_assignment,
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

        # อ่านก่อนโดยยังไม่ล็อก เพื่อให้ Assignment ตรวจแทนล็อก Parent
        # ก่อน Child เสมอ ลดโอกาสเกิด deadlock กับ Takeover endpoint
        checkpoint_assignment_preview = (
            CheckpointAssignmentService.get_checkpoint_assignment(
                db=db,
                assignment_id=assignment_id,
            )
        )

        takeover_parent_assignment: CheckpointAssignment | None = None
        if CheckpointAssignmentService._is_takeover_assignment(
            checkpoint_assignment_preview
        ):
            takeover_parent_assignment = (
                CheckpointAssignmentService
                ._get_checkpoint_assignment_for_update(
                    db=db,
                    assignment_id=int(
                        checkpoint_assignment_preview.parent_assignment_id
                    ),
                )
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

        ignored_assignment_ids: set[int] | None = None

        if takeover_parent_assignment is not None:
            is_same_takeover_parent = (
                CheckpointAssignmentService._is_takeover_assignment(
                    checkpoint_assignment
                )
                and checkpoint_assignment.parent_assignment_id
                == takeover_parent_assignment.assignment_id
            )

            if (
                not is_same_takeover_parent
                or not takeover_parent_assignment.is_active
                or takeover_parent_assignment.assignment_status
                != "cancelled"
                or takeover_parent_assignment.completed_at is not None
            ):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail={
                        "code": "CHECKPOINT_TAKEOVER_NOT_AVAILABLE",
                        "message": (
                            "รายการต้นทางไม่ได้ถูกยกเลิก"
                            "จากการยืนยันตรวจแทน"
                        ),
                    },
                )

            if (
                checkpoint_assignment.schedule_rule_run_id
                != takeover_parent_assignment.schedule_rule_run_id
            ):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=INVALID_REFERENCE_DETAIL,
                )

            ignored_assignment_ids = {
                int(takeover_parent_assignment.assignment_id)
            }

        CheckpointAssignmentService._ensure_rule_run_pending_action_available(
            db=db,
            checkpoint_assignment=checkpoint_assignment,
            ignored_assignment_ids=ignored_assignment_ids,
        )

        CheckpointAssignmentService._ensure_start_in_shift_window(
            db=db,
            checkpoint_assignment=checkpoint_assignment,
        )

        if (
            takeover_parent_assignment is None
            and checkpoint_assignment.reserved_by is not None
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

        # Parent ของงานตรวจแทนถูกยกเลิกตั้งแต่กดยืนยันตรวจแทนแล้ว
        # ตอนเริ่มตรวจจึงเปลี่ยนเฉพาะ Child pending -> in_progress

        return CheckpointAssignmentService._commit_and_refresh(
            db=db,
            checkpoint_assignment=checkpoint_assignment,
        )

    @staticmethod
    def takeover_checkpoint_assignment(
        db: Session,
        assignment_id: int,
        updated_by: str,
    ) -> TakeoverCheckpointAssignmentResponse:
        clean_updated_by = updated_by.strip()

        CheckpointAssignmentService._ensure_employee_exists(
            db=db,
            employee_code=clean_updated_by,
        )

        previous_assignment = (
            CheckpointAssignmentService._get_checkpoint_assignment_for_update(
                db=db,
                assignment_id=assignment_id,
            )
        )

        CheckpointAssignmentService._ensure_active_for_start(
            checkpoint_assignment=previous_assignment,
        )

        is_open_in_progress = (
            previous_assignment.assignment_status == "in_progress"
            and previous_assignment.started_at is not None
            and previous_assignment.completed_at is None
        )
        is_open_takeover_pending = (
            CheckpointAssignmentService._is_takeover_assignment(
                previous_assignment
            )
            and previous_assignment.assignment_status == "pending"
            and previous_assignment.started_at is None
            and previous_assignment.completed_at is None
        )

        if not (is_open_in_progress or is_open_takeover_pending):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "code": "CHECKPOINT_TAKEOVER_NOT_AVAILABLE",
                    "message": (
                        "รายการนี้ไม่มีงานค้างในรอบตรวจ"
                        "ที่สามารถรับช่วงได้"
                    ),
                },
            )

        if is_open_in_progress:
            previous_started_by = (
                previous_assignment.started_by or ""
            ).strip()

            if not previous_started_by:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail={
                        "code": "CHECKPOINT_TAKEOVER_NOT_AVAILABLE",
                        "message": "ไม่พบพนักงานผู้เริ่มเข้าตรวจรายการเดิม",
                    },
                )

            if previous_started_by == clean_updated_by:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail={
                        "code": "CHECKPOINT_TAKEOVER_NOT_REQUIRED",
                        "message": (
                            "พนักงานผู้เริ่มตรวจเดิมสามารถกดออกตรวจได้"
                            "โดยไม่ต้องรับช่วง"
                        ),
                    },
                )

        schedule_rule_run_id = previous_assignment.schedule_rule_run_id

        if schedule_rule_run_id is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "code": "CHECKPOINT_TAKEOVER_NOT_AVAILABLE",
                    "message": "รายการนี้ไม่มีข้อมูลรอบตรวจสำหรับเข้าตรวจแทน",
                },
            )

        now = CheckpointAssignmentService._now_bangkok_naive()
        current_work_date = now.date()
        rule_run_context = (
            CheckpointAssignmentService
            ._get_rule_run_contexts_by_ids(
                db=db,
                rule_run_ids={int(schedule_rule_run_id)},
            )
            .get(int(schedule_rule_run_id))
        )

        previous_period_anchor_work_date = (
            CheckpointAssignmentService
            ._get_root_assignment_work_dates(
                db=db,
                assignment_ids={int(previous_assignment.assignment_id)},
            )
            .get(
                int(previous_assignment.assignment_id),
                previous_assignment.work_date,
            )
        )

        if not CheckpointAssignmentService._is_cross_day_takeover_allowed(
            period_anchor_work_date=previous_period_anchor_work_date,
            source_work_date=previous_assignment.work_date,
            requested_work_date=current_work_date,
            assignment_status=previous_assignment.assignment_status,
            started_at=previous_assignment.started_at,
            completed_at=previous_assignment.completed_at,
            started_by=previous_assignment.started_by,
            employee_code=clean_updated_by,
            is_takeover_assignment=(
                CheckpointAssignmentService._is_takeover_assignment(
                    previous_assignment
                )
            ),
            rule_run_context=rule_run_context,
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "code": "CHECKPOINT_TAKEOVER_NOT_ALLOWED",
                    "message": (
                        "อนุญาตให้เข้าตรวจแทนเฉพาะงานค้างข้ามวันที่ยังอยู่ในรอบตรวจ"
                    ),
                },
            )

        previous_schedule_item_row = db.execute(
            select(
                CheckpointScheduleItem.route_site_location_id.label(
                    "route_site_location_id"
                ),
                CheckpointScheduleItem.shift_id.label("shift_id"),
            ).where(
                CheckpointScheduleItem.schedule_item_id
                == previous_assignment.schedule_item_id
            )
        ).mappings().one_or_none()

        if previous_schedule_item_row is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=INVALID_REFERENCE_DETAIL,
            )

        previous_route_site_location_id = int(
            previous_schedule_item_row["route_site_location_id"]
        )
        previous_shift_id_raw = previous_schedule_item_row["shift_id"]

        # ค้นหาเฉพาะ Assignment ที่ผูกไว้สำหรับตรวจแทนต้นทางนี้
        # Assignment pending ปกติของวันปัจจุบันต้องคงสถานะเดิมไว้
        current_assignment_stmt = (
            select(CheckpointAssignment)
            .join(
                CheckpointScheduleItem,
                CheckpointAssignment.schedule_item_id
                == CheckpointScheduleItem.schedule_item_id,
            )
            .where(
                CheckpointScheduleItem.route_site_location_id
                == previous_route_site_location_id,
                CheckpointAssignment.work_date == current_work_date,
                CheckpointAssignment.schedule_rule_run_id
                == schedule_rule_run_id,
                CheckpointAssignment.parent_assignment_id
                == previous_assignment.assignment_id,
                CheckpointAssignment.recheck_reason.is_(None),
                CheckpointAssignment.assignment_status == "pending",
                CheckpointAssignment.started_at.is_(None),
                CheckpointAssignment.completed_at.is_(None),
                CheckpointAssignment.is_active.is_(True),
                CheckpointAssignment.mark_flag.is_(False),
            )
            .order_by(
                (
                    CheckpointAssignment.schedule_item_id
                    == previous_assignment.schedule_item_id
                ).desc(),
                CheckpointAssignment.assignment_id.asc(),
            )
            .limit(1)
            .with_for_update()
        )

        if previous_shift_id_raw is None:
            current_assignment_stmt = current_assignment_stmt.where(
                CheckpointScheduleItem.shift_id.is_(None)
            )
        else:
            current_assignment_stmt = current_assignment_stmt.where(
                CheckpointScheduleItem.shift_id == int(previous_shift_id_raw)
            )

        current_assignment = db.scalar(current_assignment_stmt)

        created_takeover_assignment = False

        if current_assignment is None:
            inspection_mode = str(
                (rule_run_context or {}).get("inspection_mode") or ""
            ).strip().upper()

            assignment_template = previous_assignment
            current_schedule_item_id = (
                previous_assignment.schedule_item_id
            )
            current_due_datetime = None

            if inspection_mode in _EXACT_INSPECTION_MODES:
                if previous_assignment.due_datetime is not None:
                    current_due_datetime = datetime.combine(
                        current_work_date,
                        previous_assignment.due_datetime.time(),
                    )
            elif inspection_mode in _WINDOW_INSPECTION_MODES:
                # FLEXIBLE มี Assignment pending ของวันปัจจุบันอยู่แล้ว
                # จึงใช้รายการเดิมและผูกกับงานต้นทาง ห้ามสร้างรายการใหม่
                pending_template_stmt = (
                    select(CheckpointAssignment)
                    .join(
                        CheckpointScheduleItem,
                        CheckpointAssignment.schedule_item_id
                        == CheckpointScheduleItem.schedule_item_id,
                    )
                    .where(
                        CheckpointScheduleItem.route_site_location_id
                        == previous_route_site_location_id,
                        CheckpointAssignment.work_date
                        == current_work_date,
                        CheckpointAssignment.schedule_rule_run_id
                        == schedule_rule_run_id,
                        CheckpointAssignment.parent_assignment_id.is_(None),
                        CheckpointAssignment.assignment_status == "pending",
                        CheckpointAssignment.started_at.is_(None),
                        CheckpointAssignment.completed_at.is_(None),
                        CheckpointAssignment.is_active.is_(True),
                        CheckpointAssignment.mark_flag.is_(False),
                        or_(
                            CheckpointAssignment.reserved_by.is_(None),
                            CheckpointAssignment.reserved_by
                            == clean_updated_by,
                        ),
                    )
                    .order_by(
                        (
                            CheckpointAssignment.schedule_item_id
                            == previous_assignment.schedule_item_id
                        ).desc(),
                        CheckpointAssignment.assignment_id.asc(),
                    )
                    .limit(1)
                    .with_for_update()
                )

                if previous_shift_id_raw is None:
                    pending_template_stmt = (
                        pending_template_stmt.where(
                            CheckpointScheduleItem.shift_id.is_(None)
                        )
                    )
                else:
                    pending_template_stmt = (
                        pending_template_stmt.where(
                            CheckpointScheduleItem.shift_id
                            == int(previous_shift_id_raw)
                        )
                    )

                pending_template = db.scalar(pending_template_stmt)

                if pending_template is None:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail={
                            "code": "CHECKPOINT_TAKEOVER_TARGET_NOT_FOUND",
                            "message": (
                                "ไม่พบรายการรอดำเนินการที่ระบบสร้างไว้"
                                "สำหรับวันปัจจุบัน"
                            ),
                        },
                    )

                current_assignment = pending_template
                current_assignment.parent_assignment_id = (
                    previous_assignment.assignment_id
                )
                current_assignment.parent_assignment_key = (
                    previous_assignment.assignment_id
                )
                current_assignment.recheck_depth = (
                    previous_assignment.recheck_depth + 1
                )
                current_assignment.recheck_reason = None
                current_assignment.reserved_by = None
                current_assignment.reserved_at = None
                current_assignment.updated_by = clean_updated_by

            else:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail={
                        "code": "CHECKPOINT_TAKEOVER_NOT_ALLOWED",
                        "message": (
                            "รูปแบบรอบตรวจนี้ไม่รองรับ"
                            "การตรวจแทนข้ามวัน"
                        ),
                    },
                )

            if inspection_mode in _EXACT_INSPECTION_MODES:
                CheckpointAssignmentService._ensure_not_duplicate(
                    db=db,
                    work_date=current_work_date,
                    schedule_item_id=current_schedule_item_id,
                    parent_assignment_id=(
                        previous_assignment.assignment_id
                    ),
                    duplicate_detail=(
                        DUPLICATE_CHECKPOINT_ASSIGNMENT_DETAIL
                    ),
                )

                # EXACT ไม่มี Assignment ของวันปัจจุบัน จึงสร้าง
                # Assignment ลูกสำหรับผู้ตรวจแทน
                current_assignment = CheckpointAssignment(
                    work_date=current_work_date,
                    schedule_item_id=current_schedule_item_id,
                    parent_assignment_id=(
                        previous_assignment.assignment_id
                    ),
                    parent_assignment_key=(
                        previous_assignment.assignment_id
                    ),
                    active_unique_key=_ACTIVE_UNIQUE_KEY,
                    recheck_depth=(
                        previous_assignment.recheck_depth + 1
                    ),
                    due_datetime=current_due_datetime,
                    assignment_status="pending",
                    is_active=True,
                    mark_flag=False,
                    created_by=clean_updated_by,
                    updated_by=clean_updated_by,
                    schedule_rule_set_id=(
                        assignment_template.schedule_rule_set_id
                    ),
                    schedule_rule_id=(
                        assignment_template.schedule_rule_id
                    ),
                    schedule_rule_run_id=schedule_rule_run_id,
                    schedule_rule_closed_run_id=(
                        assignment_template.schedule_rule_closed_run_id
                    ),
                    schedule_rule_source=(
                        assignment_template.schedule_rule_source
                    ),
                )
                created_takeover_assignment = True

        CheckpointAssignmentService._ensure_active_for_start(
            checkpoint_assignment=current_assignment,
        )
        CheckpointAssignmentService._ensure_start_in_shift_window(
            db=db,
            checkpoint_assignment=current_assignment,
        )
        CheckpointAssignmentService._ensure_rule_run_pending_action_available(
            db=db,
            checkpoint_assignment=current_assignment,
            ignored_assignment_ids={previous_assignment.assignment_id},
            period_anchor_work_date=(
                previous_period_anchor_work_date
            ),
        )

        # Assignment ตรวจแทนเป็น pending สำหรับเข้า Flow GPS/Face Verify
        # ไม่ใช่การจองและไม่ล็อกผู้ตรวจคนอื่น
        current_assignment.reserved_by = None
        current_assignment.reserved_at = None
        current_assignment.updated_by = clean_updated_by

        if created_takeover_assignment:
            db.add(current_assignment)

        # ยืนยันตรวจแทนถือเป็นการส่งมอบงานทันที รายการล่าสุดในสาย
        # (in_progress หรือ pending จากวันก่อน) จึงถูกยกเลิกใน Transaction
        # เดียวกับการจัดเตรียม Assignment pending ของวันปัจจุบัน
        CheckpointAssignmentService._transition_status(
            checkpoint_assignment=previous_assignment,
            next_status="cancelled",
            updated_by=clean_updated_by,
        )
        previous_assignment.reserved_by = None
        previous_assignment.reserved_at = None

        CheckpointAssignmentService._commit(
            db=db,
            duplicate_detail=DUPLICATE_CHECKPOINT_ASSIGNMENT_DETAIL,
        )
        db.refresh(previous_assignment)
        db.refresh(current_assignment)

        return TakeoverCheckpointAssignmentResponse.model_validate(
            {
                "previous_assignment": previous_assignment,
                "current_assignment": current_assignment,
            }
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

        checkpoint_assignment = (
            CheckpointAssignmentService._get_checkpoint_assignment_for_update(
                db=db,
                assignment_id=assignment_id,
            )
        )

        CheckpointAssignmentService._ensure_assignment_checkout_owner(
            db=db,
            checkpoint_assignment=checkpoint_assignment,
            employee_code=updated_by,
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
