from __future__ import annotations

from datetime import date, datetime
from math import atan2, cos, radians, sin, sqrt
from typing import Any, ClassVar, Final, Literal
from zoneinfo import ZoneInfo

from fastapi import HTTPException, status
from sqlalchemy import and_, exists, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

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
from app.models.employees import Employees
from app.models.route_site_location import RouteSiteLocation
from app.models.site_location import SiteLocation
from app.schemas.checkpoint_assignment import (
    AssignmentStatus,
    CheckpointAssignmentCreate,
    CheckpointAssignmentDailyResponse,
    CheckpointAssignmentRecheck,
    CheckpointAssignmentUpdate,
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
        is_active: bool | None = True,
        include_deleted: bool = False,
    ) -> list[CheckpointAssignmentDailyResponse]:
        now = CheckpointAssignmentService._now_bangkok_naive()

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
                CheckpointAssignment.time_record_id.label("time_record_id"),
                CheckpointAssignment.assignment_status.label("assignment_status"),
                CheckpointAssignment.due_datetime.label("due_datetime"),
                CheckpointAssignment.started_at.label("started_at"),
                CheckpointAssignment.started_by.label("started_by"),
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
            .where(
                or_(
                    # งานของวันที่หน้าเว็บเลือก
                    CheckpointAssignment.work_date == work_date,
                    # งานเก่าที่ยังค้าง และยังไม่พ้น due_datetime
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

            is_overdue = CheckpointAssignmentService._is_overdue(
                assignment_status=assignment_status,
                due_datetime=due_datetime,
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
            )

        if not bool(row["assignment_is_active"]):
            return VerifyCheckpointLocationResponse(
                allowed=False,
                message="ตารางงานสายตรวจนี้ถูกปิดใช้งานแล้ว",
                distance_meter=None,
                radius_meter=None,
                accuracy=payload.accuracy,
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
            )

        distance_meter = CheckpointAssignmentService._calculate_distance_meter(
            lat1=payload.latitude,
            lng1=payload.longitude,
            lat2=site_latitude,
            lng2=site_longitude,
        )

        allowed = distance_meter <= allowed_radius

        unit_name = CheckpointAssignmentService._build_unit_name(
            contract_code=row["contract_code"],
            location_name=row["location_name"],
        )

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
    def start_checkpoint_assignment(
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

        CheckpointAssignmentService._ensure_active_for_start(
            checkpoint_assignment=checkpoint_assignment,
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