# app/services/time_record.py

from __future__ import annotations

from datetime import date, datetime, timedelta
from math import asin, cos, isfinite, radians, sin, sqrt
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, aliased

from app.core.constants import DBConstants
from app.core.error_messages import (
    ATTENDANCE_OUT_OF_AREA_TEMPLATE,
    CHECKIN_LOCATION_NOT_FOUND_DETAIL,
    CHECKOUT_BEFORE_CHECKIN_DETAIL,
    CHECKOUT_LOCATION_NOT_FOUND_DETAIL,
    CHECKPOINT_ASSIGNMENT_ALREADY_IN_PROGRESS_TEMPLATE,
    CHECKPOINT_ASSIGNMENT_NOT_AVAILABLE_DETAIL,
    CHECKPOINT_ASSIGNMENT_SHIFT_NOT_FOUND_DETAIL,
    CHECKPOINT_OUT_OF_AREA_TEMPLATE,
    CREATED_BY_EMPLOYEE_NOT_FOUND_DETAIL,
    EMPLOYEE_NOT_FOUND_DETAIL,
    INVALID_CHECK_TIME_FORMAT_DETAIL,
    INVALID_COORDINATES_DETAIL,
    INVALID_TIME_RECORD_REFERENCE_DETAIL,
    INVALID_TIME_RECORD_UPDATE_DETAIL,
    OPEN_TIME_RECORD_ALREADY_EXISTS_DETAIL,
    OPEN_TIME_RECORD_NOT_FOUND_DETAIL,
    SITE_LOCATION_COORDINATES_NOT_FOUND_DETAIL,
    TIME_RECORD_ALREADY_CHECKED_OUT_DETAIL,
    TIME_RECORD_CHECKOUT_FORBIDDEN_DETAIL,
    TIME_RECORD_NOT_FOUND_DETAIL,
    UPDATED_BY_EMPLOYEE_NOT_FOUND_DETAIL,
)
from app.models.checkpoint_assignment import CheckpointAssignment
from app.models.checkpoint_schedule_item import CheckpointScheduleItem
from app.models.employees import Employees
from app.models.route_site_location import RouteSiteLocation
from app.models.site_location import SiteLocation
from app.models.time_record import TimeRecord
from app.models.time_record_image import TimeRecordImage
from app.schemas.time_record import (
    TimeRecordCheckIn,
    TimeRecordCheckOut,
    TimeRecordListItemResponse,
)
from app.services.image_storage import (
    ImageStorageError,
    ImageStorageService,
)


class TimeRecordService:
    @staticmethod
    def _is_deleted_or_inactive(record: Any) -> bool:
        if bool(getattr(record, "mark_flag", False)):
            return True

        if getattr(record, "is_active", True) is False:
            return True

        return False

    @staticmethod
    def _raise_not_found(detail: str) -> None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=detail,
        )

    @staticmethod
    def _get_employee(
        db: Session,
        employee_code: str,
        for_update: bool = False,
    ) -> Employees | None:
        stmt = select(Employees).where(Employees.employee_code == employee_code)

        if for_update:
            stmt = stmt.with_for_update()

        return db.scalar(stmt)

    @staticmethod
    def _get_site_location(
        db: Session,
        location_id: int,
    ) -> SiteLocation | None:
        stmt = select(SiteLocation).where(SiteLocation.location_id == location_id)
        return db.scalar(stmt)

    @staticmethod
    def _ensure_employee_exists(
        db: Session,
        employee_code: str,
        detail: str,
        for_update: bool = False,
    ) -> Employees:
        employee = TimeRecordService._get_employee(
            db=db,
            employee_code=employee_code,
            for_update=for_update,
        )

        if employee is None or TimeRecordService._is_deleted_or_inactive(employee):
            TimeRecordService._raise_not_found(detail)

        return employee

    @staticmethod
    def _ensure_site_location_exists(
        db: Session,
        location_id: int,
        detail: str,
    ) -> SiteLocation:
        site_location = TimeRecordService._get_site_location(
            db=db,
            location_id=location_id,
        )

        if site_location is None or TimeRecordService._is_deleted_or_inactive(
            site_location
        ):
            TimeRecordService._raise_not_found(detail)

        return site_location

    @staticmethod
    def _get_time_record_by_id_raw(
        db: Session,
        time_record_id: int,
        for_update: bool = False,
    ) -> TimeRecord | None:
        stmt = select(TimeRecord).where(TimeRecord.time_record_id == time_record_id)

        if for_update:
            stmt = stmt.with_for_update()

        return db.scalar(stmt)

    @staticmethod
    def _is_time_record_linked_to_checkpoint(
        db: Session,
        time_record_id: int,
    ) -> bool:
        """
        ตรวจว่า time_record_id นี้ถูกผูกกับ checkpoint_assignment หรือไม่

        ใช้ตอนออกงาน Attendance ปกติ:
        - ถ้า time_record นี้ถูกผูกกับ Checkpoint ห้ามออกงานผ่าน Attendance
        - ถ้าไม่ถูกผูกกับ Checkpoint ให้ออกงาน Attendance ได้ตามปกติ
        """

        stmt = (
            select(CheckpointAssignment.assignment_id)
            .where(CheckpointAssignment.time_record_id == time_record_id)
            .limit(1)
        )

        return db.scalar(stmt) is not None

    @staticmethod
    def _get_open_attendance_time_record_by_employee_raw(
        db: Session,
        employee_code: str,
        work_date: date | None = None,
    ) -> TimeRecord | None:
        """
        ดึงรายการลงเวลาเข้างานที่ยังไม่ออกงานของพนักงาน

        ใช้ employee_code + work_date
        ไม่ใช้ shift_id
        ไม่รวม time_record ที่ผูกกับ checkpoint_assignment
        """

        checkpoint_time_record_exists = (
            select(CheckpointAssignment.assignment_id)
            .where(CheckpointAssignment.time_record_id == TimeRecord.time_record_id)
            .exists()
        )

        stmt = (
            select(TimeRecord)
            .where(TimeRecord.employee_code == employee_code)
            .where(TimeRecord.checkout.is_(None))
            .where(~checkpoint_time_record_exists)
        )

        if work_date is not None:
            stmt = stmt.where(TimeRecord.work_date == work_date)

        stmt = stmt.order_by(
            TimeRecord.created_at.desc(),
            TimeRecord.time_record_id.desc(),
        )

        return db.scalar(stmt)

    @staticmethod
    def _get_open_checkpoint_time_record_by_employee_raw(
        db: Session,
        employee_code: str,
        assignment_id: int,
    ) -> TimeRecord | None:
        stmt = (
            select(TimeRecord)
            .join(
                CheckpointAssignment,
                CheckpointAssignment.time_record_id == TimeRecord.time_record_id,
            )
            .where(CheckpointAssignment.assignment_id == assignment_id)
            .where(TimeRecord.employee_code == employee_code)
            .where(TimeRecord.checkout.is_(None))
            .order_by(
                TimeRecord.created_at.desc(),
                TimeRecord.time_record_id.desc(),
            )
        )

        return db.scalar(stmt)

    @staticmethod
    def _get_open_time_record_by_employee_raw(
        db: Session,
        employee_code: str,
        work_date: date | None = None,
    ) -> TimeRecord | None:
        return TimeRecordService._get_open_attendance_time_record_by_employee_raw(
            db=db,
            employee_code=employee_code,
            work_date=work_date,
        )

    @staticmethod
    def _is_datetime_value(value: str) -> bool:
        cleaned_value = value.strip()
        return (
            len(cleaned_value) >= 10
            and cleaned_value[4] == "-"
            and cleaned_value[7] == "-"
        )

    @staticmethod
    def _parse_check_time(
        value: str,
        work_date: date,
    ) -> datetime:
        cleaned_value = value.strip()

        for time_format in DBConstants.CHECK_TIME_INPUT_FORMATS:
            try:
                parsed_value = datetime.strptime(cleaned_value, time_format)
            except ValueError:
                continue

            if "%Y" in time_format:
                return parsed_value

            return datetime.combine(work_date, parsed_value.time())

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=INVALID_CHECK_TIME_FORMAT_DETAIL,
        )

    @staticmethod
    def _validate_checkout_after_checkin(
        time_record: TimeRecord,
        checkout: str,
    ) -> None:
        if time_record.checkin is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=INVALID_TIME_RECORD_UPDATE_DETAIL,
            )

        checkin_at = TimeRecordService._parse_check_time(
            value=time_record.checkin,
            work_date=time_record.work_date,
        )
        checkout_at = TimeRecordService._parse_check_time(
            value=checkout,
            work_date=time_record.work_date,
        )

        """
        ไม่ใช้ shift ในการคำนวณเวลาออก:
        - ถ้า checkout ส่งมาเป็น datetime เต็ม ระบบจะเทียบตามวันที่จริง
        - ถ้า checkout ส่งมาเป็นเวลาอย่างเดียว และน้อยกว่า checkin ให้ถือว่าออกวันถัดไป
        """
        if checkout_at < checkin_at and not TimeRecordService._is_datetime_value(
            checkout
        ):
            checkout_at += timedelta(days=1)

        if checkout_at < checkin_at:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=CHECKOUT_BEFORE_CHECKIN_DETAIL,
            )

    @staticmethod
    def _distance_meters(
        lat1: float,
        lng1: float,
        lat2: float,
        lng2: float,
    ) -> float:
        earth_radius_meter = 6_371_000

        d_lat = radians(lat2 - lat1)
        d_lng = radians(lng2 - lng1)

        a = (
            sin(d_lat / 2) ** 2
            + cos(radians(lat1))
            * cos(radians(lat2))
            * sin(d_lng / 2) ** 2
        )

        return 2 * earth_radius_meter * asin(sqrt(a))

    @staticmethod
    def _coerce_current_coordinates(
        current_latitude: Any,
        current_longitude: Any,
    ) -> tuple[float, float]:
        try:
            current_lat = float(current_latitude)
            current_lng = float(current_longitude)
        except (TypeError, ValueError) as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=INVALID_COORDINATES_DETAIL,
            ) from exc

        if not all(isfinite(value) for value in [current_lat, current_lng]):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=INVALID_COORDINATES_DETAIL,
            )

        return current_lat, current_lng

    @staticmethod
    def _coerce_checkpoint_shift_id(value: Any) -> int:
        try:
            shift_id = int(value)
        except (TypeError, ValueError) as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=CHECKPOINT_ASSIGNMENT_SHIFT_NOT_FOUND_DETAIL,
            ) from exc

        if shift_id <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=CHECKPOINT_ASSIGNMENT_SHIFT_NOT_FOUND_DETAIL,
            )

        return shift_id

    @staticmethod
    def _get_assignment_and_site_location(
        db: Session,
        assignment_id: int,
        detail: str,
    ) -> tuple[CheckpointAssignment, SiteLocation]:
        """
        ดึงข้อมูล Assignment + SiteLocation

        กติกาปัจจุบัน:
        - Frontend ส่ง shift_id มาเฉพาะกรณี Checkpoint
        - Backend ใช้ assignment_id เพื่อตรวจจุดงานและพิกัด
        - Backend ไม่ join checkpoint_schedule แล้ว
        - เพราะ CheckpointScheduleItem ไม่มี schedule_id
        """

        stmt = (
            select(
                CheckpointAssignment,
                CheckpointScheduleItem,
                RouteSiteLocation,
                SiteLocation,
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
            .where(CheckpointAssignment.assignment_id == assignment_id)
        )

        row = db.execute(stmt).first()

        if row is None:
            TimeRecordService._raise_not_found(detail)

        assignment, schedule_item, route_site_location, site_location = row

        if (
            TimeRecordService._is_deleted_or_inactive(assignment)
            or TimeRecordService._is_deleted_or_inactive(schedule_item)
            or TimeRecordService._is_deleted_or_inactive(route_site_location)
            or TimeRecordService._is_deleted_or_inactive(site_location)
        ):
            TimeRecordService._raise_not_found(detail)

        return assignment, site_location

    @staticmethod
    def _get_checkpoint_assignment_holder_employee(
        db: Session,
        assignment: CheckpointAssignment,
    ) -> Employees | None:
        """
        คืนข้อมูลพนักงานที่กำลังถือ Assignment นี้อยู่

        ใช้ TimeRecord.employee_code เป็นข้อมูลหลัก
        เพราะเป็นผู้ที่ Check-in เข้าตรวจจริง
        และใช้ assignment.started_by เป็นข้อมูลสำรอง
        """

        holder_employee_code = assignment.started_by

        if assignment.time_record_id is not None:
            holder_employee_code = db.scalar(
                select(TimeRecord.employee_code).where(
                    TimeRecord.time_record_id == assignment.time_record_id
                )
            ) or assignment.started_by

        if not holder_employee_code:
            return None

        return db.scalar(
            select(Employees).where(
                Employees.employee_code == holder_employee_code
            )
        )

    @staticmethod
    def _lock_and_validate_assignment_for_checkin(
        db: Session,
        assignment_id: int,
        detail: str,
    ) -> CheckpointAssignment:
        """
        ล็อก Assignment ด้วย SELECT ... FOR UPDATE ก่อนสร้าง TimeRecord

        หลักการ:
        - คนที่กดเข้าตรวจคนแรกจะได้ Lock ก่อน
        - คนที่กดตามมาต้องรอ Transaction ของคนแรก
        - เมื่อคนแรก Commit แล้ว คนถัดไปจะเห็น assignment_status ล่าสุด
        - อนุญาตเฉพาะสถานะ pending เท่านั้น
        """

        stmt = (
            select(CheckpointAssignment)
            .where(CheckpointAssignment.assignment_id == assignment_id)
            .with_for_update()
        )

        assignment = db.scalar(stmt)

        if assignment is None or TimeRecordService._is_deleted_or_inactive(
            assignment
        ):
            TimeRecordService._raise_not_found(detail)

        if assignment.assignment_status == "in_progress":
            holder_employee = (
                TimeRecordService._get_checkpoint_assignment_holder_employee(
                    db=db,
                    assignment=assignment,
                )
            )

            holder_employee_code = (
                holder_employee.employee_code
                if holder_employee is not None
                else assignment.started_by or "-"
            )
            holder_employee_name = (
                " ".join(
                    part
                    for part in [
                        holder_employee.first_name,
                        holder_employee.last_name,
                    ]
                    if part
                ).strip()
                if holder_employee is not None
                else "-"
            ) or "-"

            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=CHECKPOINT_ASSIGNMENT_ALREADY_IN_PROGRESS_TEMPLATE.format(
                    employee_code=holder_employee_code,
                    employee_name=holder_employee_name,
                ),
            )

        if (
            assignment.assignment_status != "pending"
            or assignment.time_record_id is not None
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=CHECKPOINT_ASSIGNMENT_NOT_AVAILABLE_DETAIL,
            )

        return assignment

    @staticmethod
    def _lock_assignment_for_checkout(
        db: Session,
        assignment_id: int,
        detail: str,
    ) -> CheckpointAssignment:
        """
        ล็อก Assignment ระหว่าง Check-out

        ช่วยกันการส่งคำขอ Check-out ซ้ำพร้อมกัน
        และทำให้ตรวจสอบ Assignment กับ TimeRecord ชุดเดียวกันได้แน่นอน
        """

        stmt = (
            select(CheckpointAssignment)
            .where(CheckpointAssignment.assignment_id == assignment_id)
            .with_for_update()
        )

        assignment = db.scalar(stmt)

        if assignment is None or TimeRecordService._is_deleted_or_inactive(
            assignment
        ):
            TimeRecordService._raise_not_found(detail)

        return assignment

    @staticmethod
    def _validate_assignment_location_gate(
        db: Session,
        assignment_id: int,
        current_latitude: Any,
        current_longitude: Any,
        detail: str,
    ) -> tuple[CheckpointAssignment, SiteLocation]:
        assignment, site_location = TimeRecordService._get_assignment_and_site_location(
            db=db,
            assignment_id=assignment_id,
            detail=detail,
        )

        if site_location.latitude is None or site_location.longitude is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=SITE_LOCATION_COORDINATES_NOT_FOUND_DETAIL,
            )

        current_lat, current_lng = TimeRecordService._coerce_current_coordinates(
            current_latitude=current_latitude,
            current_longitude=current_longitude,
        )

        site_lat = float(site_location.latitude)
        site_lng = float(site_location.longitude)

        radius_meter = float(site_location.radius_meter or 0)
        grace_meter = float(getattr(site_location, "grace_meter", 0) or 0)
        allowed_radius = radius_meter + grace_meter

        if not all(
            isfinite(value)
            for value in [
                site_lat,
                site_lng,
                allowed_radius,
            ]
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=INVALID_COORDINATES_DETAIL,
            )

        distance_meter = TimeRecordService._distance_meters(
            lat1=current_lat,
            lng1=current_lng,
            lat2=site_lat,
            lng2=site_lng,
        )

        if distance_meter > allowed_radius:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=CHECKPOINT_OUT_OF_AREA_TEMPLATE.format(
                    location_name=site_location.location_name,
                    distance_meter=round(distance_meter),
                ),
            )

        return assignment, site_location

    @staticmethod
    def _validate_nearest_attendance_location_gate(
        db: Session,
        current_latitude: Any,
        current_longitude: Any,
        detail: str,
    ) -> SiteLocation:
        current_lat, current_lng = TimeRecordService._coerce_current_coordinates(
            current_latitude=current_latitude,
            current_longitude=current_longitude,
        )

        stmt = (
            select(SiteLocation)
            .where(SiteLocation.latitude.is_not(None))
            .where(SiteLocation.longitude.is_not(None))
        )

        site_locations = list(db.scalars(stmt).all())

        best_site_location: SiteLocation | None = None
        best_distance_meter: float | None = None
        best_allowed_radius: float = 0

        for site_location in site_locations:
            if TimeRecordService._is_deleted_or_inactive(site_location):
                continue

            site_lat = float(site_location.latitude)
            site_lng = float(site_location.longitude)

            radius_meter = float(site_location.radius_meter or 0)
            grace_meter = float(getattr(site_location, "grace_meter", 0) or 0)
            allowed_radius = radius_meter + grace_meter

            if not all(
                isfinite(value)
                for value in [
                    site_lat,
                    site_lng,
                    allowed_radius,
                ]
            ):
                continue

            distance_meter = TimeRecordService._distance_meters(
                lat1=current_lat,
                lng1=current_lng,
                lat2=site_lat,
                lng2=site_lng,
            )

            if best_distance_meter is None or distance_meter < best_distance_meter:
                best_site_location = site_location
                best_distance_meter = distance_meter
                best_allowed_radius = allowed_radius

        if best_site_location is None or best_distance_meter is None:
            TimeRecordService._raise_not_found(detail)

        if best_distance_meter > best_allowed_radius:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=ATTENDANCE_OUT_OF_AREA_TEMPLATE.format(
                    location_name=best_site_location.location_name,
                    distance_meter=round(best_distance_meter),
                ),
            )

        return best_site_location

    @staticmethod
    def _get_status_code(time_record: TimeRecord) -> str:
        if time_record.checkin is None and time_record.checkout is None:
            return "pending"

        if time_record.checkin is not None and time_record.checkout is None:
            return "in_progress"

        return "completed"

    @staticmethod
    def _get_status_text(status_code: str) -> str:
        status_map = {
            "pending": "รอดำเนินการลงเวลา",
            "in_progress": "ลงเวลาเข้าแล้ว",
            "completed": "ลงเวลาออกแล้ว",
        }
        return status_map.get(status_code, "ไม่ทราบสถานะ")

    @staticmethod
    def _apply_filters(
        stmt: Any,
        employee_code: str | None = None,
        work_date: date | None = None,
    ) -> Any:
        if employee_code:
            stmt = stmt.where(TimeRecord.employee_code == employee_code)

        if work_date is not None:
            stmt = stmt.where(TimeRecord.work_date == work_date)

        return stmt

    @staticmethod
    def _apply_ordering_and_pagination(
        stmt: Any,
        skip: int,
        limit: int,
    ) -> Any:
        return (
            stmt.order_by(
                TimeRecord.created_at.desc(),
                TimeRecord.time_record_id.desc(),
            )
            .offset(skip)
            .limit(limit)
        )

    @staticmethod
    def _cleanup_saved_images(
        image_paths: list[str],
    ) -> None:
        """
        ลบไฟล์รูปที่บันทึกไปแล้วแบบ best effort

        ใช้กรณี DB transaction ล้มเหลวหลังจากสร้างไฟล์บน disk แล้ว
        เพื่อไม่ให้เกิด orphan files
        """
        if not image_paths:
            return

        try:
            ImageStorageService.delete_images(image_paths)
        except ImageStorageError:
            # ไม่ให้ cleanup error กลบ error หลักของ transaction
            pass

    @staticmethod
    def _save_time_record_images(
        db: Session,
        time_record: TimeRecord,
        image_type: str,
        image_values: list[str | None],
        error_detail: str,
    ) -> list[str]:
        """
        รับ Base64 จาก payload
        -> บันทึกเป็นไฟล์ผ่าน ImageStorageService
        -> เพิ่มข้อมูล path ลง time_record_image

        ไม่เก็บ Base64 ลง time_record สำหรับข้อมูลใหม่
        """
        saved_image_paths: list[str] = []

        try:
            for sequence_no, image_base64 in enumerate(
                image_values,
                start=1,
            ):
                if not image_base64:
                    continue

                image_path = ImageStorageService.save_time_record_image(
                    image_base64=image_base64,
                    work_date=time_record.work_date,
                    employee_code=time_record.employee_code,
                    time_record_id=time_record.time_record_id,
                    image_type=image_type,
                    sequence_no=sequence_no,
                )

                saved_image_paths.append(image_path)

                db.add(
                    TimeRecordImage(
                        time_record_id=time_record.time_record_id,
                        image_type=image_type,
                        sequence_no=sequence_no,
                        image_path=image_path,
                        created_by=time_record.employee_code,
                    )
                )

            if saved_image_paths:
                db.flush()

        except ImageStorageError as exc:
            db.rollback()
            TimeRecordService._cleanup_saved_images(saved_image_paths)

            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(exc),
            ) from exc

        except IntegrityError as exc:
            db.rollback()
            TimeRecordService._cleanup_saved_images(saved_image_paths)

            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error_detail,
            ) from exc

        return saved_image_paths

    @staticmethod
    def _commit(
        db: Session,
        time_record: TimeRecord,
        error_detail: str,
        saved_image_paths: list[str] | None = None,
    ) -> None:
        try:
            db.commit()
            db.refresh(time_record)
        except IntegrityError as exc:
            db.rollback()
            TimeRecordService._cleanup_saved_images(
                saved_image_paths or []
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error_detail,
            ) from exc

    @staticmethod
    def create_time_record(
        db: Session,
        payload: TimeRecordCheckIn,
    ) -> TimeRecord:
        TimeRecordService._ensure_employee_exists(
            db=db,
            employee_code=payload.employee_code,
            detail=EMPLOYEE_NOT_FOUND_DETAIL,
            for_update=True,
        )

        TimeRecordService._ensure_employee_exists(
            db=db,
            employee_code=payload.created_by,
            detail=CREATED_BY_EMPLOYEE_NOT_FOUND_DETAIL,
        )

        checkin_at = TimeRecordService._parse_check_time(
            value=payload.checkin,
            work_date=payload.work_date,
        )

        assignment_id = getattr(payload, "assignment_id", None)

        assignment: CheckpointAssignment | None = None
        assignment_shift_id: int | None = None

        if assignment_id is not None:
            assignment_shift_id = TimeRecordService._coerce_checkpoint_shift_id(
                getattr(payload, "shift_id", None)
            )

            # สำคัญ: Lock Assignment ก่อนตรวจสถานะและก่อนสร้าง TimeRecord
            assignment = TimeRecordService._lock_and_validate_assignment_for_checkin(
                db=db,
                assignment_id=assignment_id,
                detail=CHECKIN_LOCATION_NOT_FOUND_DETAIL,
            )

            # Lock ยังถูกถืออยู่จนกว่าจะ Commit / Rollback
            # จึงปลอดภัยจากการที่คนอื่นกดเข้าจุดเดียวกันพร้อมกัน
            _, site_location = TimeRecordService._validate_assignment_location_gate(
                db=db,
                assignment_id=assignment_id,
                current_latitude=payload.current_latitude,
                current_longitude=payload.current_longitude,
                detail=CHECKIN_LOCATION_NOT_FOUND_DETAIL,
            )

            # สิทธิ์ของ Checkpoint ถูกตัดสินด้วย Assignment ที่ล็อกไว้แล้ว
            open_time_record = None
        else:
            site_location = TimeRecordService._validate_nearest_attendance_location_gate(
                db=db,
                current_latitude=payload.current_latitude,
                current_longitude=payload.current_longitude,
                detail=CHECKIN_LOCATION_NOT_FOUND_DETAIL,
            )

            open_time_record = (
                TimeRecordService._get_open_attendance_time_record_by_employee_raw(
                    db=db,
                    employee_code=payload.employee_code,
                    work_date=payload.work_date,
                )
            )

        # Attendance ปกติ: กันพนักงานคนเดิมเปิดรายการซ้ำ
        # Checkpoint: ใช้ Assignment Lock เป็นตัวควบคุม 1 คนต่อ 1 จุด
        if assignment_id is None and open_time_record is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=OPEN_TIME_RECORD_ALREADY_EXISTS_DETAIL,
            )

        checkin_images = [
            payload.images_checkin_1,
            payload.images_checkin_2,
        ]

        create_data = payload.model_dump(
            exclude={
                "shift_id",
                "assignment_id",
                "current_latitude",
                "current_longitude",
                "gps_accuracy",
                # Base64 ใช้สำหรับสร้างไฟล์เท่านั้น
                # ไม่เก็บลง time_record สำหรับข้อมูลใหม่
                "images_checkin_1",
                "images_checkin_2",
            }
        )

        # กติกา:
        # - มาจาก Checkpoint: ใช้ shift_id ที่ Frontend ส่งมา
        # - มาจาก Attendance ปกติ: ไม่เก็บ shift_id ให้เป็น None
        create_data["shift_id"] = (
            assignment_shift_id if assignment_id is not None else None
        )

        create_data["checkin_location_id"] = site_location.location_id
        create_data["checkin_lat"] = payload.current_latitude
        create_data["checkin_lng"] = payload.current_longitude

        time_record = TimeRecord(**create_data)

        try:
            db.add(time_record)

            # ต้อง flush ก่อน เพื่อให้ได้ time_record_id
            # สำหรับสร้าง path ของรูปภาพ
            db.flush()
        except IntegrityError as exc:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=INVALID_TIME_RECORD_REFERENCE_DETAIL,
            ) from exc

        # Base64 -> file -> time_record_image
        saved_image_paths = TimeRecordService._save_time_record_images(
            db=db,
            time_record=time_record,
            image_type="checkin",
            image_values=checkin_images,
            error_detail=INVALID_TIME_RECORD_REFERENCE_DETAIL,
        )

        if assignment is not None:
            assignment.time_record_id = time_record.time_record_id
            assignment.assignment_status = "in_progress"
            assignment.started_at = checkin_at

            # ต้องใช้ผู้ตรวจจริง ไม่ใช่ created_by
            assignment.started_by = payload.employee_code
            assignment.updated_by = payload.employee_code

        TimeRecordService._commit(
            db=db,
            time_record=time_record,
            error_detail=INVALID_TIME_RECORD_REFERENCE_DETAIL,
            saved_image_paths=saved_image_paths,
        )

        return time_record

    @staticmethod
    def get_time_record_by_id(
        db: Session,
        time_record_id: int,
    ) -> TimeRecord:
        time_record = TimeRecordService._get_time_record_by_id_raw(
            db=db,
            time_record_id=time_record_id,
        )

        if time_record is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=TIME_RECORD_NOT_FOUND_DETAIL,
            )

        return time_record

    @staticmethod
    def get_open_attendance_time_record_by_employee(
        db: Session,
        employee_code: str,
        work_date: date | None = None,
    ) -> TimeRecord:
        TimeRecordService._ensure_employee_exists(
            db=db,
            employee_code=employee_code,
            detail=EMPLOYEE_NOT_FOUND_DETAIL,
        )

        time_record = (
            TimeRecordService._get_open_attendance_time_record_by_employee_raw(
                db=db,
                employee_code=employee_code,
                work_date=work_date,
            )
        )

        if time_record is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=OPEN_TIME_RECORD_NOT_FOUND_DETAIL,
            )

        return time_record

    @staticmethod
    def get_open_checkpoint_time_record_by_employee(
        db: Session,
        employee_code: str,
        assignment_id: int,
    ) -> TimeRecord:
        TimeRecordService._ensure_employee_exists(
            db=db,
            employee_code=employee_code,
            detail=EMPLOYEE_NOT_FOUND_DETAIL,
        )

        time_record = (
            TimeRecordService._get_open_checkpoint_time_record_by_employee_raw(
                db=db,
                employee_code=employee_code,
                assignment_id=assignment_id,
            )
        )

        if time_record is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=OPEN_TIME_RECORD_NOT_FOUND_DETAIL,
            )

        return time_record

    @staticmethod
    def get_open_time_record_by_employee(
        db: Session,
        employee_code: str,
        work_date: date | None = None,
    ) -> TimeRecord:
        return TimeRecordService.get_open_attendance_time_record_by_employee(
            db=db,
            employee_code=employee_code,
            work_date=work_date,
        )

    @staticmethod
    def get_time_records(
        db: Session,
        skip: int = DBConstants.DEFAULT_PAGE_SKIP,
        limit: int = DBConstants.DEFAULT_PAGE_LIMIT,
        employee_code: str | None = None,
        work_date: date | None = None,
    ) -> list[TimeRecord]:
        stmt = select(TimeRecord)

        stmt = TimeRecordService._apply_filters(
            stmt=stmt,
            employee_code=employee_code,
            work_date=work_date,
        )
        stmt = TimeRecordService._apply_ordering_and_pagination(
            stmt=stmt,
            skip=skip,
            limit=limit,
        )

        return list(db.scalars(stmt).all())

    @staticmethod
    def get_time_record_list_items(
        db: Session,
        skip: int = DBConstants.DEFAULT_PAGE_SKIP,
        limit: int = DBConstants.DEFAULT_PAGE_LIMIT,
        employee_code: str | None = None,
        work_date: date | None = None,
    ) -> list[TimeRecordListItemResponse]:
        CheckinLocation = aliased(SiteLocation)
        CheckoutLocation = aliased(SiteLocation)

        stmt = (
            select(TimeRecord, CheckinLocation, CheckoutLocation)
            .outerjoin(
                CheckinLocation,
                TimeRecord.checkin_location_id == CheckinLocation.location_id,
            )
            .outerjoin(
                CheckoutLocation,
                TimeRecord.checkout_location_id == CheckoutLocation.location_id,
            )
        )

        stmt = TimeRecordService._apply_filters(
            stmt=stmt,
            employee_code=employee_code,
            work_date=work_date,
        )
        stmt = TimeRecordService._apply_ordering_and_pagination(
            stmt=stmt,
            skip=skip,
            limit=limit,
        )

        rows = db.execute(stmt).all()

        results: list[TimeRecordListItemResponse] = []
        for time_record, checkin_location, checkout_location in rows:
            status_code = TimeRecordService._get_status_code(time_record)
            display_location = checkin_location or checkout_location

            results.append(
                TimeRecordListItemResponse(
                    time_record_id=time_record.time_record_id,
                    work_date=time_record.work_date,
                    shift_id=time_record.shift_id,
                    location_id=(
                        display_location.location_id if display_location else None
                    ),
                    location_name=(
                        display_location.location_name if display_location else "-"
                    ),
                    status_code=status_code,
                    status_text=TimeRecordService._get_status_text(status_code),
                    checkin=time_record.checkin,
                    checkout=time_record.checkout,
                )
            )

        return results

    @staticmethod
    def update_time_record(
        db: Session,
        time_record_id: int,
        payload: TimeRecordCheckOut,
    ) -> TimeRecord:
        # Lock TimeRecord เพื่อกันกดออกซ้ำพร้อมกัน
        time_record = TimeRecordService._get_time_record_by_id_raw(
            db=db,
            time_record_id=time_record_id,
            for_update=True,
        )

        if time_record is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=TIME_RECORD_NOT_FOUND_DETAIL,
            )

        if time_record.checkout is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=TIME_RECORD_ALREADY_CHECKED_OUT_DETAIL,
            )

        TimeRecordService._ensure_employee_exists(
            db=db,
            employee_code=payload.updated_by,
            detail=UPDATED_BY_EMPLOYEE_NOT_FOUND_DETAIL,
        )

        # ห้ามใช้ time_record_id ของพนักงานคนอื่นเพื่อออกงานแทน
        if time_record.employee_code != payload.updated_by:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=TIME_RECORD_CHECKOUT_FORBIDDEN_DETAIL,
            )

        TimeRecordService._validate_checkout_after_checkin(
            time_record=time_record,
            checkout=payload.checkout,
        )

        assignment_id = getattr(payload, "assignment_id", None)

        assignment: CheckpointAssignment | None = None
        assignment_shift_id: int | None = None

        if assignment_id is not None:
            assignment_shift_id = TimeRecordService._coerce_checkpoint_shift_id(
                getattr(payload, "shift_id", None)
            )

            # Lock Assignment ระหว่าง Check-out ด้วย
            assignment = TimeRecordService._lock_assignment_for_checkout(
                db=db,
                assignment_id=assignment_id,
                detail=CHECKOUT_LOCATION_NOT_FOUND_DETAIL,
            )

            _, site_location = TimeRecordService._validate_assignment_location_gate(
                db=db,
                assignment_id=assignment_id,
                current_latitude=payload.current_latitude,
                current_longitude=payload.current_longitude,
                detail=CHECKOUT_LOCATION_NOT_FOUND_DETAIL,
            )

            if (
                assignment.time_record_id != time_record.time_record_id
                or assignment.assignment_status != "in_progress"
            ):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=INVALID_TIME_RECORD_UPDATE_DETAIL,
                )
        else:
            if TimeRecordService._is_time_record_linked_to_checkpoint(
                db=db,
                time_record_id=time_record.time_record_id,
            ):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=INVALID_TIME_RECORD_UPDATE_DETAIL,
                )

            site_location = TimeRecordService._validate_nearest_attendance_location_gate(
                db=db,
                current_latitude=payload.current_latitude,
                current_longitude=payload.current_longitude,
                detail=CHECKOUT_LOCATION_NOT_FOUND_DETAIL,
            )

        checkout_images = [
            payload.images_checkout_1,
            payload.images_checkout_2,
        ]

        update_data = payload.model_dump(
            exclude_unset=True,
            exclude={
                "shift_id",
                "assignment_id",
                "current_latitude",
                "current_longitude",
                "gps_accuracy",
                # Base64 ใช้สำหรับสร้างไฟล์เท่านั้น
                # ไม่เก็บลง time_record สำหรับข้อมูลใหม่
                "images_checkout_1",
                "images_checkout_2",
            },
        )

        # กติกา:
        # - ออกงานจาก Checkpoint: ใช้ shift_id ที่ Frontend ส่งมา
        # - ออกงาน Attendance ปกติ: ไม่แตะ shift_id
        if assignment_id is not None:
            update_data["shift_id"] = assignment_shift_id

        update_data["checkout_location_id"] = site_location.location_id
        update_data["checkout_lat"] = payload.current_latitude
        update_data["checkout_lng"] = payload.current_longitude

        for field, value in update_data.items():
            setattr(time_record, field, value)

        # Base64 -> file -> time_record_image
        saved_image_paths = TimeRecordService._save_time_record_images(
            db=db,
            time_record=time_record,
            image_type="checkout",
            image_values=checkout_images,
            error_detail=INVALID_TIME_RECORD_UPDATE_DETAIL,
        )

        if assignment is not None:
            checkout_at = TimeRecordService._parse_check_time(
                value=payload.checkout,
                work_date=time_record.work_date,
            )

            assignment.assignment_status = "completed"
            assignment.completed_at = checkout_at
            assignment.completed_by = payload.updated_by
            assignment.updated_by = payload.updated_by

        TimeRecordService._commit(
            db=db,
            time_record=time_record,
            error_detail=INVALID_TIME_RECORD_UPDATE_DETAIL,
            saved_image_paths=saved_image_paths,
        )

        return time_record