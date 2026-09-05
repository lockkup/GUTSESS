# app/services/patrol_area.py

from __future__ import annotations

from collections import defaultdict
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import case, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.constants import DBConstants
from app.core.error_messages import (
    EMPLOYEE_NOT_FOUND_DETAIL,
    INVALID_REFERENCE_DETAIL,
)
from app.models.checkpoint_assignment import CheckpointAssignment
from app.models.checkpoint_schedule_item import CheckpointScheduleItem
from app.models.departments import Department
from app.models.divisions import Divisions
from app.models.employees import Employees
from app.models.route import Route
from app.models.route_site_location import RouteSiteLocation
from app.models.site_location import SiteLocation
from app.schemas.patrol_area import (
    PatrolAreaLocationUpdateRequest,
    PatrolAreaLocationUpdateResponse,
    PatrolAreaSearchResponse,
)
from app.services.route_location_update_setting_service import (
    RouteLocationUpdateSettingService,
)


# Python date.weekday()
# 0 = จันทร์
# 1 = อังคาร
# 2 = พุธ
# 3 = พฤหัสบดี
# 4 = ศุกร์
# 5 = เสาร์
# 6 = อาทิตย์
THAI_WEEKDAY_NAMES: dict[int, str] = {
    0: "จันทร์",
    1: "อังคาร",
    2: "พุธ",
    3: "พฤหัสบดี",
    4: "ศุกร์",
    5: "เสาร์",
    6: "อาทิตย์",
}


SHIFT_ORDER: dict[str, int] = {
    "ผลัดกลางวัน": 1,
    "ผลัดกลางคืน": 2,
}


ALLOWED_LOCATION_RADIUS_METERS: frozenset[int] = frozenset({50, 70, 100})


def _get_shift_name(shift_id: int | None) -> str:
    """
    แปลง shift_id เป็นชื่อผลัดที่ใช้แสดงบนการ์ด
    """

    if shift_id == 1:
        return "ผลัดกลางวัน"

    if shift_id == 2:
        return "ผลัดกลางคืน"

    return ""


def _build_patrol_round_text(
    weekday_numbers: set[int],
    shift_name: str,
) -> str:
    """
    สร้างข้อความรอบตรวจตามวันและผลัด

    ตัวอย่าง:

    {0} + ผลัดกลางวัน
    -> ผลัดกลางวัน: วันจันทร์

    {0, 2} + ผลัดกลางวัน
    -> ผลัดกลางวัน: วันจันทร์/พุธ

    {4, 6} + ผลัดกลางคืน
    -> ผลัดกลางคืน: วันศุกร์/อาทิตย์
    """

    valid_weekdays = sorted(
        weekday_number
        for weekday_number in weekday_numbers
        if weekday_number in THAI_WEEKDAY_NAMES
    )

    if not valid_weekdays:
        return shift_name

    weekday_text = "/".join(
        THAI_WEEKDAY_NAMES[weekday_number]
        for weekday_number in valid_weekdays
    )

    return f"{shift_name}: วัน{weekday_text}"


class PatrolAreaService:
    @staticmethod
    def get_contract_codes(
        db: Session,
    ) -> list[str]:
        """
        ดึงรหัสสัญญาของหน่วยงานที่ยังเปิดใช้งาน
        """

        contract_code_expr = func.trim(
            SiteLocation.contract_code
        )

        stmt = (
            select(contract_code_expr)
            .where(
                SiteLocation.mark_flag.is_(False),
                SiteLocation.is_active.is_(True),
                SiteLocation.contract_code.is_not(None),
                contract_code_expr != "",
            )
            .distinct()
            .order_by(
                contract_code_expr.asc()
            )
        )

        contract_codes = db.scalars(stmt).all()

        return [
            str(contract_code).strip()
            for contract_code in contract_codes
            if contract_code is not None
            and str(contract_code).strip()
        ]

    @staticmethod
    def search_patrol_areas(
        db: Session,
        keyword: str | None = None,
        contract_code: str | None = None,
        skip: int = DBConstants.DEFAULT_PAGE_SKIP,
        limit: int = DBConstants.PATROL_AREA_SEARCH_DEFAULT_LIMIT,
    ) -> list[PatrolAreaSearchResponse]:
        # =====================================================
        # 1. ค้นหาข้อมูลหน่วยงานจาก route_site_location
        #
        # route_site_location.location_id
        #     -> site_location.location_id
        #
        # route_site_location.routes_id
        #     -> routes.route_id
        #
        # route_site_location.division_id
        #     -> divisions.division_id
        #
        # divisions.department_id
        #     -> departments.department_id
        # =====================================================

        stmt = (
            select(
                # ---------------------------------------------
                # route_site_location
                # ---------------------------------------------
                RouteSiteLocation.route_site_location_id.label(
                    "route_site_location_id"
                ),

                # ---------------------------------------------
                # ภาค จาก departments
                # ---------------------------------------------
                Department.department_id.label(
                    "department_id"
                ),
                Department.department_name.label(
                    "department_name"
                ),

                # ---------------------------------------------
                # เขต จาก divisions
                # ---------------------------------------------
                Divisions.division_id.label(
                    "division_id"
                ),
                Divisions.division_name.label(
                    "division_name"
                ),

                # ---------------------------------------------
                # เส้นทาง จาก routes
                # ---------------------------------------------
                RouteSiteLocation.routes_id.label(
                    "routes_id"
                ),
                Route.route_name.label(
                    "route_name"
                ),

                # ---------------------------------------------
                # ข้อมูลจุดรักษาการณ์ จาก site_location
                # ---------------------------------------------
                SiteLocation.location_id.label(
                    "location_id"
                ),
                SiteLocation.contract_code.label(
                    "contract_code"
                ),
                SiteLocation.location_name.label(
                    "location_name"
                ),
                SiteLocation.location_detail.label(
                    "location_detail"
                ),
                SiteLocation.latitude.label(
                    "latitude"
                ),
                SiteLocation.longitude.label(
                    "longitude"
                ),
                SiteLocation.radius_meter.label(
                    "radius_meter"
                ),
                SiteLocation.grace_meter.label(
                    "grace_meter"
                ),
                SiteLocation.updated_at.label(
                    "updated_at"
                ),
            )
            .select_from(RouteSiteLocation)
            .join(
                SiteLocation,
                RouteSiteLocation.location_id
                == SiteLocation.location_id,
            )
            .join(
                Route,
                RouteSiteLocation.routes_id
                == Route.route_id,
            )
            .join(
                Divisions,
                RouteSiteLocation.division_id
                == Divisions.division_id,
            )
            .join(
                Department,
                Divisions.department_id
                == Department.department_id,
            )
            .where(
                # route_site_location ต้องยังใช้งาน
                RouteSiteLocation.mark_flag.is_(False),
                RouteSiteLocation.is_active.is_(True),

                # แสดงเฉพาะความสัมพันธ์ที่มีผลในวันที่ปัจจุบัน
                RouteSiteLocation.effective_from
                <= func.current_date(),

                or_(
                    RouteSiteLocation.effective_to.is_(None),
                    RouteSiteLocation.effective_to
                    >= func.current_date(),
                ),

                # จุดรักษาการณ์ต้องยังใช้งาน
                SiteLocation.mark_flag.is_(False),
                SiteLocation.is_active.is_(True),

                # เส้นทางต้องยังเปิดใช้งาน
                Route.is_active.is_(True),

                # เขตต้องยังเปิดใช้งาน
                Divisions.is_active.is_(True),

                # ภาคต้องยังเปิดใช้งาน
                Department.is_active.is_(True),
            )
        )

        clean_keyword = (
            keyword.strip()
            if keyword is not None
            else ""
        )

        contract_code_expr = func.trim(
            SiteLocation.contract_code
        )

        if clean_keyword:
            stmt = stmt.where(
                or_(
                    contract_code_expr.contains(
                        clean_keyword
                    ),
                    SiteLocation.location_name.contains(
                        clean_keyword
                    ),
                    SiteLocation.location_detail.contains(
                        clean_keyword
                    ),
                )
            )

        clean_contract_code = (
            contract_code.strip()
            if contract_code is not None
            else ""
        )

        if clean_contract_code:
            stmt = stmt.where(
                contract_code_expr
                == clean_contract_code,
            )

        order_by_expressions = []

        if clean_keyword:
            search_priority = case(
                (
                    contract_code_expr
                    == clean_keyword,
                    0,
                ),
                (
                    contract_code_expr.startswith(
                        clean_keyword,
                        autoescape=True,
                    ),
                    1,
                ),
                (
                    contract_code_expr.contains(
                        clean_keyword,
                        autoescape=True,
                    ),
                    2,
                ),
                else_=3,
            )

            order_by_expressions.extend(
                [
                    search_priority.asc(),
                    func.char_length(
                        contract_code_expr
                    ).asc(),
                    contract_code_expr.asc(),
                ]
            )

        order_by_expressions.extend(
            [
                Department.department_name.asc(),
                Divisions.division_name.asc(),
                Route.route_name.asc(),
                SiteLocation.location_name.asc(),
                SiteLocation.contract_code.asc(),
                RouteSiteLocation.route_site_location_id.asc(),
            ]
        )

        stmt = (
            stmt.order_by(
                *order_by_expressions
            )
            .offset(skip)
            .limit(limit)
        )

        location_rows = (
            db.execute(stmt)
            .mappings()
            .all()
        )

        if not location_rows:
            return []

        route_site_location_ids = [
            int(
                location_row[
                    "route_site_location_id"
                ]
            )
            for location_row in location_rows
        ]

        # =====================================================
        # 2. ดึงวันตรวจและผลัดของแต่ละ route_site_location
        #
        # checkpoint_assignment.schedule_item_id
        #     -> checkpoint_schedule_item.schedule_item_id
        #
        # checkpoint_schedule_item.route_site_location_id
        #     -> route_site_location.route_site_location_id
        #
        # ผลัดใช้ checkpoint_schedule_item.shift_id โดยตรง
        # =====================================================

        patrol_round_stmt = (
            select(
                RouteSiteLocation.route_site_location_id.label(
                    "route_site_location_id"
                ),
                CheckpointAssignment.work_date.label(
                    "work_date"
                ),
                CheckpointScheduleItem.shift_id.label(
                    "shift_id"
                ),
            )
            .select_from(CheckpointAssignment)
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
            .where(
                RouteSiteLocation.route_site_location_id.in_(
                    route_site_location_ids
                ),

                # Assignment ที่ยังใช้งาน
                CheckpointAssignment.mark_flag.is_(False),
                CheckpointAssignment.is_active.is_(True),

                # ไม่นำงานตรวจซ้ำมาเพิ่มวันซ้ำ
                CheckpointAssignment.parent_assignment_id.is_(None),

                # Schedule item ที่ยังใช้งาน
                CheckpointScheduleItem.mark_flag.is_(False),
                CheckpointScheduleItem.is_active.is_(True),

                # จุดตรวจในเส้นทางที่ยังใช้งาน
                RouteSiteLocation.mark_flag.is_(False),
                RouteSiteLocation.is_active.is_(True),

                # ตรวจช่วงวันที่ที่จุดตรวจผูกกับเส้นทาง
                RouteSiteLocation.effective_from
                <= CheckpointAssignment.work_date,

                or_(
                    RouteSiteLocation.effective_to.is_(None),
                    RouteSiteLocation.effective_to
                    >= CheckpointAssignment.work_date,
                ),
            )
            .distinct()
        )

        patrol_round_rows = (
            db.execute(patrol_round_stmt)
            .mappings()
            .all()
        )

        # =====================================================
        # 3. รวมวันตามผลัด
        #
        # โครงสร้าง:
        #
        # route_site_location_id
        #     -> shift_name
        #         -> {weekday numbers}
        #
        # ใช้ route_site_location_id แทน location_id
        # เพื่อไม่ให้รอบตรวจของจุดเดียวกันแต่คนละเส้นทางปะปนกัน
        # =====================================================

        grouped_rounds: dict[
            int,
            dict[str, set[int]],
        ] = defaultdict(
            lambda: defaultdict(set)
        )

        for patrol_round_row in patrol_round_rows:
            route_site_location_id = int(
                patrol_round_row[
                    "route_site_location_id"
                ]
            )

            work_date = patrol_round_row[
                "work_date"
            ]

            shift_id_raw = patrol_round_row[
                "shift_id"
            ]

            shift_id = (
                int(shift_id_raw)
                if shift_id_raw is not None
                else None
            )

            shift_name = _get_shift_name(
                shift_id
            )

            if work_date is None or not shift_name:
                continue

            grouped_rounds[
                route_site_location_id
            ][shift_name].add(
                work_date.weekday()
            )

        # =====================================================
        # 4. สร้างข้อความ patrol_rounds
        # =====================================================

        patrol_rounds_by_route_site_location: dict[
            int,
            list[str],
        ] = {}

        for (
            route_site_location_id,
            shift_groups,
        ) in grouped_rounds.items():
            sorted_shift_groups = sorted(
                shift_groups.items(),
                key=lambda item: (
                    SHIFT_ORDER.get(
                        item[0],
                        99,
                    ),
                    item[0],
                ),
            )

            patrol_rounds_by_route_site_location[
                route_site_location_id
            ] = [
                _build_patrol_round_text(
                    weekday_numbers=weekday_numbers,
                    shift_name=shift_name,
                )
                for shift_name, weekday_numbers
                in sorted_shift_groups
            ]

        # =====================================================
        # 5. รวมข้อมูลหน่วยงานกับกลุ่มตรวจ
        # =====================================================

        results: list[
            PatrolAreaSearchResponse
        ] = []

        for location_row in location_rows:
            response_data = dict(
                location_row
            )

            route_site_location_id = int(
                response_data[
                    "route_site_location_id"
                ]
            )

            response_data["patrol_rounds"] = (
                patrol_rounds_by_route_site_location.get(
                    route_site_location_id,
                    [],
                )
            )

            results.append(
                PatrolAreaSearchResponse.model_validate(
                    response_data
                )
            )

        return results

    @staticmethod
    def update_patrol_area_location(
        db: Session,
        payload: PatrolAreaLocationUpdateRequest,
    ) -> PatrolAreaLocationUpdateResponse:
        """
        แก้ไขพิกัดและรัศมีของหน่วยงานจากหน้าข้อมูลหน่วยงาน.

        Flow นี้ไม่ได้อ้างอิง checkpoint_assignment เพราะผู้ใช้เข้ามาจาก
        การค้นหาหน่วยงานโดยตรง จึงตรวจ scope จาก route_site_location แทน.

        ไม่เรียก verify_checkpoint_location() และไม่เทียบ GPS ปัจจุบันกับ
        พิกัดเดิม เนื่องจากจุดประสงค์ของรายการนี้คือแก้พิกัดเดิมที่อาจผิด.
        """

        clean_employee_code = payload.employee_code.strip()

        # =====================================================
        # 1. ตรวจพนักงาน
        # =====================================================
        employee_exists = db.scalar(
            select(Employees.employee_code)
            .where(
                Employees.employee_code == clean_employee_code,
            )
            .limit(1)
        )

        if employee_exists is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=EMPLOYEE_NOT_FOUND_DETAIL,
            )

        # =====================================================
        # 2. ตรวจ context ของหน่วยงานจาก route_site_location จริง
        #
        # location_id + department_id + division_id + route_id
        # ต้องเป็นความสัมพันธ์เดียวกับที่ Backend ใช้ในหน้าค้นหา
        # =====================================================
        route_site_location_id = db.scalar(
            select(
                RouteSiteLocation.route_site_location_id
            )
            .select_from(RouteSiteLocation)
            .join(
                Divisions,
                RouteSiteLocation.division_id
                == Divisions.division_id,
            )
            .join(
                Department,
                Divisions.department_id
                == Department.department_id,
            )
            .join(
                Route,
                RouteSiteLocation.routes_id
                == Route.route_id,
            )
            .where(
                RouteSiteLocation.location_id
                == payload.location_id,
                RouteSiteLocation.division_id
                == payload.division_id,
                RouteSiteLocation.routes_id
                == payload.route_id,
                Divisions.department_id
                == payload.department_id,

                RouteSiteLocation.mark_flag.is_(False),
                RouteSiteLocation.is_active.is_(True),
                RouteSiteLocation.effective_from
                <= func.current_date(),
                or_(
                    RouteSiteLocation.effective_to.is_(None),
                    RouteSiteLocation.effective_to
                    >= func.current_date(),
                ),

                Route.is_active.is_(True),
                Divisions.is_active.is_(True),
                Department.is_active.is_(True),
            )
            .limit(1)
        )

        if route_site_location_id is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "ข้อมูลหน่วยงานหรือเส้นทางเปลี่ยนแปลงแล้ว "
                    "กรุณาปิดและเปิดข้อมูลหน่วยงานใหม่"
                ),
            )

        # =====================================================
        # 3. ตรวจ Setting ซ้ำที่ Backend ก่อนเขียนข้อมูลจริง
        #
        # Setting รุ่นปัจจุบันใช้ allow_location_update ค่าเดียว
        # สำหรับทั้งพิกัดและ radius_meter
        # =====================================================
        setting = (
            RouteLocationUpdateSettingService
            .get_allowed_route_location_update_setting(
                db=db,
                department_id=payload.department_id,
                division_id=payload.division_id,
                route_id=payload.route_id,
            )
        )

        if setting is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "เส้นทางนี้ไม่ได้รับอนุญาตให้แก้ไขพิกัด "
                    "หรืออยู่นอกช่วงวันที่อนุญาต"
                ),
            )

        if payload.radius_meter not in ALLOWED_LOCATION_RADIUS_METERS:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="ระยะรัศมีต้องเป็น 50, 70 หรือ 100 เมตร",
            )

        # =====================================================
        # 4. Lock site_location เป้าหมายและ UPDATE
        # =====================================================
        site_location = db.scalar(
            select(SiteLocation)
            .where(
                SiteLocation.location_id
                == payload.location_id,
                SiteLocation.mark_flag.is_(False),
                SiteLocation.is_active.is_(True),
            )
            .execution_options(populate_existing=True)
            .with_for_update()
        )

        if site_location is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="ไม่พบข้อมูลหน่วยงานที่ต้องการแก้ไขพิกัด",
            )

        # ให้รูปแบบการบันทึกพิกัดตรงกับ flow Checkpoint ที่ใช้งานอยู่
        site_location.latitude = Decimal(
            str(payload.latitude)
        ).quantize(
            Decimal("0.000001")
        )

        site_location.longitude = Decimal(
            str(payload.longitude)
        ).quantize(
            Decimal("0.000001")
        )

        site_location.radius_meter = payload.radius_meter
        site_location.updated_by = clean_employee_code

        try:
            db.commit()
        except IntegrityError as exc:
            db.rollback()

            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=INVALID_REFERENCE_DETAIL,
            ) from exc

        db.refresh(site_location)

        # =====================================================
        # 5. คืนค่าที่อ่านจากฐานข้อมูลหลังบันทึก
        # =====================================================
        return PatrolAreaLocationUpdateResponse(
            location_id=int(site_location.location_id),
            department_id=payload.department_id,
            division_id=payload.division_id,
            route_id=payload.route_id,
            contract_code=str(
                site_location.contract_code or ""
            ).strip(),
            location_name=str(
                site_location.location_name or ""
            ).strip(),
            location_detail=(
                str(site_location.location_detail).strip()
                if site_location.location_detail is not None
                else None
            ),
            latitude=site_location.latitude,
            longitude=site_location.longitude,
            radius_meter=int(site_location.radius_meter),
            grace_meter=int(site_location.grace_meter),
            updated_at=site_location.updated_at,
        )