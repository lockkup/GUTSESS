from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.core.constants import DBConstants


AssignmentStatus = Literal[
    "pending",
    "in_progress",
    "completed",
    "cancelled",
    "repaired",
]


class CheckpointAssignmentBase(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    work_date: date

    schedule_item_id: int = Field(..., gt=0)

    due_datetime: datetime | None = None

    # True = เปิดใช้งาน, False = ปิดใช้งาน
    # ไม่ใช่ soft delete
    is_active: bool = Field(default=True)


class CheckpointAssignmentCreate(CheckpointAssignmentBase):
    created_by: str = Field(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )


class CheckpointAssignmentUpdate(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    work_date: date | None = None

    schedule_item_id: int | None = Field(
        default=None,
        gt=0,
    )

    due_datetime: datetime | None = None

    is_active: bool | None = None

    updated_by: str = Field(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )

    @model_validator(mode="after")
    def validate_not_null_fields(self) -> "CheckpointAssignmentUpdate":
        for field_name in ("work_date", "schedule_item_id", "is_active"):
            if (
                field_name in self.model_fields_set
                and getattr(self, field_name) is None
            ):
                raise ValueError(f"{field_name} cannot be null")

        return self


class CheckpointAssignmentAction(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    updated_by: str = Field(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )


class TakeoverCheckpointAssignmentRequest(CheckpointAssignmentAction):
    """
    คำขอเข้าตรวจแทน Assignment ที่ค้างจากวันก่อน

    assignment_id ของงานเดิมรับจาก Path Parameter ส่วน Backend เป็นผู้กำหนด
    Assignment ปลายทางเอง:

    - FLEXIBLE_* ใช้ Assignment pending ของวันปัจจุบันที่มีอยู่แล้ว
    - EXACT_* สร้าง Assignment pending ของวันปัจจุบันเมื่อยังไม่มี

    Frontend ไม่สามารถระบุ Assignment ปลายทางเองได้
    """


class CheckpointAssignmentReservationAction(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    employee_code: str = Field(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )


class CheckpointAssignmentRecheck(CheckpointAssignmentAction):
    # ต้องระบุวันตรวจซ้ำใหม่
    # ไม่ควรดึง work_date จากงานเดิมอัตโนมัติ เพราะ recheck อาจคนละวัน
    work_date: date

    due_datetime: datetime | None = None

    recheck_reason: str = Field(
        ...,
        min_length=1,
        max_length=DBConstants.REMARK_LENGTH,
    )


class CheckpointAssignmentResponse(CheckpointAssignmentBase):
    model_config = ConfigDict(from_attributes=True)

    assignment_id: int

    # ใช้ผูกกับ time_record ที่เกิดจากการเช็คอินสายตรวจ
    # create/update assignment ปกติไม่ต้องส่งค่านี้
    time_record_id: int | None = None

    parent_assignment_id: int | None = None

    # ใช้กันปัญหา MySQL UNIQUE + NULL
    # งานหลัก = 0
    # งาน recheck = parent_assignment_id
    parent_assignment_key: int

    # งานหลัก = 0
    # recheck ครั้งแรก = 1
    # recheck ซ้อน = 2, 3, ...
    recheck_depth: int

    assignment_status: AssignmentStatus

    started_at: datetime | None = None
    started_by: str | None = None

    completed_at: datetime | None = None
    completed_by: str | None = None

    recheck_reason: str | None = None

    # ผู้ที่จองหน่วยงานไว้ขณะอยู่นอกพื้นที่
    reserved_by: str | None = Field(
        default=None,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )

    # วันและเวลาที่จอง
    reserved_at: datetime | None = None

    mark_flag: bool

    created_at: datetime

    updated_at: datetime

    created_by: str

    updated_by: str | None = None


class TakeoverCheckpointAssignmentResponse(BaseModel):
    """
    ผลการยืนยันเข้าตรวจแทน

    previous_assignment คือ Assignment ต้นทางที่เปลี่ยนเป็น cancelled
    ทันทีเมื่อยืนยันตรวจแทน

    current_assignment คือ Assignment pending สำหรับผู้ตรวจแทน:
    - FLEXIBLE_* ใช้ Assignment รายวันเดิมและผูก parent_assignment_id
    - EXACT_* สร้าง Assignment ใหม่สำหรับวันปัจจุบัน

    Assignment ตรวจแทนไม่ได้จองหรือล็อกด้วย reserved_by
    """

    model_config = ConfigDict(
        from_attributes=True,
        extra="forbid",
        str_strip_whitespace=True,
    )

    previous_assignment: CheckpointAssignmentResponse
    current_assignment: CheckpointAssignmentResponse


class CheckpointAssignmentDailyResponse(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
        extra="forbid",
        str_strip_whitespace=True,
    )

    assignment_id: int

    work_date: date

    schedule_item_id: int

    # ผลัดตามแผนที่ผูกอยู่กับ checkpoint_schedule_item
    # ค่านี้ต้องคงเดิมแม้เปิดรายการ EXACT_* จากอีกผลัด
    schedule_shift_id: int | None = Field(default=None, gt=0)

    # ผลัดที่ใช้เข้าตรวจจริงในคำขอ daily ปัจจุบัน
    # สำหรับ EXACT_* อาจต่างจาก schedule_shift_id ได้
    action_shift_id: int | None = Field(default=None, gt=0)

    # รองรับ Frontend รุ่นปัจจุบันระหว่างเปลี่ยนไปใช้ action_shift_id
    # Backend ต้องส่งค่าเดียวกับ action_shift_id ใน field นี้
    shift_id: int | None = Field(default=None, gt=0)

    # ใช้ให้ frontend รู้ว่างานนี้มี time_record ผูกอยู่หรือยัง
    time_record_id: int | None = None

    unit_name: str

    plan_day: int

    require_call: bool

    assignment_status: AssignmentStatus

    has_call: bool = False

    due_datetime: datetime | None = None

    # ใช้แจ้งเตือนว่าเลยกำหนดตรวจหรือยัง
    is_overdue: bool = False
    overdue_text: str | None = None

    started_at: datetime | None = None
    started_by: str | None = None

    # ผู้ที่กำลังถือจุดตรวจอยู่
    # ใช้เฉพาะกรณี assignment_status = "in_progress"
    # ส่งให้ Frontend แสดง CheckpointInProgressModal
    in_progress_employee_code: str | None = None
    in_progress_employee_name: str | None = None

    # Backend เท่านั้นที่ตัดสินสิทธิ์จากผู้ใช้งาน วันตรวจ inspection_mode
    # และขอบเขตของ schedule rule run; Frontend ใช้สำหรับแสดงปุ่มเท่านั้น
    can_takeover: bool = False

    # True เมื่อเป็น Assignment ที่ผูกกับงานต้นทางสำหรับตรวจแทน
    # สถานะยังเป็น pending และยังไม่ได้เช็กอินเข้าตรวจ
    is_takeover_pending: bool = False

    # รหัสพนักงานที่กดยืนยันตรวจแทน
    # อ่านจาก checkpoint_assignment.updated_by
    # ไม่ใช้ reserved_by เพราะไม่ได้เป็นการจองหรือล็อกงาน
    takeover_by: str | None = Field(
        default=None,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )

    completed_at: datetime | None = None
    completed_by: str | None = None

    # ผู้ที่จองจุดตรวจไว้ขณะอยู่นอกพื้นที่
    reserved_by: str | None = Field(
        default=None,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )

    # ชื่อ-นามสกุลผู้จอง
    # ดึงจากตาราง employees ไม่ต้องบันทึกชื่อซ้ำใน checkpoint_assignment
    reserved_by_name: str | None = None

    # วันและเวลาที่จอง
    reserved_at: datetime | None = None

    is_active: bool

    sequence_no: int

    route_site_location_id: int

    contract_code: str | None = None

    location_name: str | None = None

    # ใช้ให้ frontend ปิด/เปิดปุ่มดำเนินการตามช่วงเวลาของกะ
    # true = กดปุ่มเข้าตรวจ/ออกตรวจได้
    # false = ห้ามกด และให้แสดง action_disabled_reason
    can_action: bool = False

    # เหตุผลที่ปุ่มถูกปิด เช่น
    # "ยังไม่ถึงช่วงเวลาของผลัดกลางคืน"
    # "หมดช่วงเวลาของผลัดกลางวันแล้ว"
    # "ไม่พบข้อมูลผลัดของตารางงานสายตรวจ"
    action_disabled_reason: str | None = None

    # true = เวลาปัจจุบันอยู่ในช่วง start_time - end_time ของกะนี้
    is_shift_time_allowed: bool = False

    # เวลาเริ่มกะจากตาราง shifts เช่น "08:01:00"
    shift_start_time: str | None = None

    # เวลาสิ้นสุดกะจากตาราง shifts เช่น "20:00:00"
    shift_end_time: str | None = None

    # true = กะข้ามวัน เช่น 20:01 - 08:00
    crosses_midnight: bool | None = None


class CheckpointAreaOptionResponse(BaseModel):
    """
    เขตและเส้นทางที่พนักงานเลือกเปิดดูงานได้
    """

    model_config = ConfigDict(
        from_attributes=True,
        extra="forbid",
        str_strip_whitespace=True,
    )

    division_id: int

    route_id: int

    division_name: str

    route_name: str

    # True = เขต/เส้นทางประจำของพนักงาน
    is_home: bool = False


class CheckpointMapLocationUpdateRequest(BaseModel):
    """
    คำขอแก้ไขพิกัดหน่วยงานจากตำแหน่ง GPS ปัจจุบันของผู้ใช้งาน

    assignment_id รับจาก Path Parameter

    Backend ต้องตรวจ Assignment และ route_location_update_setting ซ้ำก่อนบันทึก
    โดยการแก้พิกัดนี้ไม่ใช้ verify-location เทียบกับพิกัดเดิมใน site_location
    เพราะใช้สำหรับกรณีพิกัดเดิมไม่ถูกต้อง

    radius_meter เป็น optional:
    - None = ไม่ขอเปลี่ยนระยะรัศมี
    - มีค่า = Service ต้องตรวจว่าค่าต่างจากเดิมหรือไม่
      และหากต่าง ต้องตรวจ allow_radius_update ก่อนบันทึก
    """

    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
        allow_inf_nan=False,
    )

    employee_code: str = Field(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )

    # ใช้สำหรับตรวจความสอดคล้องกับหน่วยงานที่ได้จาก Assignment
    # Backend ต้องไม่ใช้สอง field นี้แทนการหา site_location จาก Assignment
    contract_code: str = Field(
        ...,
        min_length=1,
        max_length=DBConstants.CONTRACT_CODE_LENGTH,
    )

    location_name: str = Field(
        ...,
        min_length=1,
        max_length=DBConstants.LOCATION_NAME_LENGTH,
    )

    location_id: int = Field(..., gt=0)

    department_id: int = Field(..., gt=0)

    division_id: int = Field(..., gt=0)

    route_id: int = Field(..., gt=0)

    latitude: float = Field(
        ...,
        ge=-90,
        le=90,
    )

    longitude: float = Field(
        ...,
        ge=-180,
        le=180,
    )

    # ความคลาดเคลื่อนที่ Browser Geolocation คืนมา ณ ตอนกดบันทึก
    accuracy_meter: float = Field(
        ...,
        ge=0,
    )

    # ไม่ส่งค่า = แก้เฉพาะ latitude / longitude
    radius_meter: int | None = Field(
        default=None,
        gt=0,
    )


class CheckpointMapLocationResponse(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
        extra="forbid",
        str_strip_whitespace=True,
    )

    # บริบทของหน่วยงานในแถว Assignment ที่ผู้ใช้คลิก
    # Service ต้องตรวจสิทธิ์และหาค่าเหล่านี้จากข้อมูลจริงก่อนส่งกลับ
    # รองรับ None สำหรับการเปิดแผนที่แบบเดิมที่ไม่ได้ส่งบริบท Assignment
    assignment_id: int | None = Field(default=None, gt=0)

    location_id: int | None = Field(default=None, gt=0)

    department_id: int | None = Field(default=None, gt=0)

    division_id: int | None = Field(default=None, gt=0)

    route_id: int | None = Field(default=None, gt=0)

    contract_code: str

    location_name: str

    latitude: float | None = None

    longitude: float | None = None

    radius_meter: int | None = None

    grace_meter: int | None = None

    # หมายเหตุ / รายละเอียดเพิ่มเติมจาก site_location.location_detail
    location_detail: str | None = None