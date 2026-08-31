// src/types/checkpointAssignment.ts

export type CheckpointAssignmentStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "repaired";

export type ShiftType = "day" | "night";

/**
 * รายการเขต / เส้นทางสำหรับ Dropdown หน้า Checkpoint
 *
 * Response จาก:
 * GET /api/checkpoint-assignments/area-options
 */
export type CheckpointAreaOptionResponse = {
  division_id: number;
  route_id: number;

  division_name: string;
  route_name: string;

  /**
   * true = เขต / เส้นทางประจำของพนักงาน
   * false = เขต / เส้นทางอื่นที่สามารถเลือกเปิดดูได้
   */
  is_home: boolean;
};

export type CheckpointDailyRow = {
  assignment_id: number;
  work_date: string;
  schedule_item_id: number;

  /**
   * ผลัดตามแผนที่ผูกอยู่กับ checkpoint_schedule_item
   * ค่านี้ต้องคงเดิมแม้เปิดรายการ EXACT_* จากอีกผลัด
   */
  schedule_shift_id: number | null;

  /**
   * ผลัดที่ใช้เข้าตรวจจริงในคำขอ daily ปัจจุบัน
   * สำหรับ EXACT_* อาจต่างจาก schedule_shift_id ได้
   */
  action_shift_id: number | null;

  /**
   * รองรับ Frontend รุ่นปัจจุบันระหว่างเปลี่ยนไปใช้ action_shift_id
   * Backend ต้องส่งค่าเดียวกับ action_shift_id ใน field นี้
   */
  shift_id: number | null;

  /**
   * ใช้เชื่อมกับ time_record
   * - null = ยังไม่ได้เช็คอินสายตรวจ
   * - มีค่า = assignment นี้มี time_record แล้ว
   */
  time_record_id: number | null;

  unit_name: string;

  plan_day: number;
  require_call: boolean;

  assignment_status: CheckpointAssignmentStatus;
  has_call: boolean;

  /**
   * เผื่อ backend ส่งสถานะการโทรล่าสุดกลับมา
   * 1 = ตรวจแล้ว(โทร)
   * 2 = ผิดปกติ(โทร)
   * 3 = บันทึกโทร แต่ยังต้องเข้าตรวจต่อ
   */
  latest_call_status?: number | string | null;
  call_status?: number | string | null;

  due_datetime: string | null;

  started_at: string | null;
  started_by: string | null;

  /**
   * ผู้ที่กำลังเข้าตรวจหน่วยงานนี้
   * ใช้เฉพาะกรณี assignment_status = "in_progress"
   */
  in_progress_employee_code: string | null;
  in_progress_employee_name: string | null;

  completed_at: string | null;
  completed_by: string | null;

  /**
   * รหัสพนักงานผู้จองหน่วยงาน
   * null = ยังไม่มีผู้จอง
   */
  reserved_by: string | null;

  /**
   * ชื่อ-นามสกุลพนักงานผู้จอง
   */
  reserved_by_name: string | null;

  /**
   * วันและเวลาที่กดยืนยันการจอง
   */
  reserved_at: string | null;

  is_active: boolean;

  sequence_no: number;
  route_site_location_id: number;

  contract_code: string | null;
  location_name: string | null;

  /**
   * ใช้ให้ frontend ปิด/เปิดปุ่มดำเนินการตามช่วงเวลาของกะ
   * true = กดปุ่มเข้าตรวจ/ออกตรวจได้
   * false = ห้ามกด และให้แสดง action_disabled_reason
   */
  can_action: boolean;

  /**
   * เหตุผลที่ปุ่มถูกปิด เช่น
   * "ยังไม่ถึงช่วงเวลาของผลัดกลางคืน"
   * "หมดช่วงเวลาของผลัดกลางวันแล้ว"
   * "ไม่พบข้อมูลผลัดของตารางงานสายตรวจ"
   */
  action_disabled_reason: string | null;

  /**
   * true = เวลาปัจจุบันอยู่ในช่วง start_time - end_time ของกะนี้
   */
  is_shift_time_allowed: boolean;

  /**
   * เวลาเริ่มกะจากตาราง shifts เช่น "08:01:00"
   */
  shift_start_time: string | null;

  /**
   * เวลาสิ้นสุดกะจากตาราง shifts เช่น "20:00:00"
   */
  shift_end_time: string | null;

  /**
   * true = กะข้ามวัน เช่น 20:01 - 08:00
   */
  crosses_midnight: boolean | null;
};

/**
 * Request body สำหรับ:
 * POST /api/checkpoint-assignments/{assignmentId}/reserve
 * POST /api/checkpoint-assignments/{assignmentId}/cancel-reservation
 */
export type CheckpointReservationActionRequest = {
  employee_code: string;
};

/**
 * Response จาก API จอง/ยกเลิกการจอง
 * ใช้เฉพาะฟิลด์ที่ frontend อาจต้องอ่านหลังดำเนินการ
 */
export type CheckpointReservationActionResponse = {
  assignment_id: number;
  assignment_status: CheckpointAssignmentStatus;

  reserved_by: string | null;
  reserved_at: string | null;

  updated_by: string | null;
  updated_at: string;
};

/**
 * รูปแบบ detail กรณีรายการถูกพนักงานคนอื่นจองไว้
 */
export type CheckpointReservationConflictDetail = {
  code: "CHECKPOINT_ASSIGNMENT_RESERVED_BY_OTHER";
  message: string;
  employee_code: string | null;
  employee_name: string | null;
};

/**
 * รูปแบบ error ที่ FastAPI อาจตอบกลับ
 */
export type CheckpointReservationApiError = {
  detail: string | CheckpointReservationConflictDetail;
};

/**
 * ใช้เรียก API:
 * GET /api/checkpoint-assignments/map-location
 *
 * Frontend ส่ง:
 * contractCode = รหัสสัญญา
 * locationName = ชื่อจุดหน่วยงาน
 */
export type GetCheckpointMapLocationParams = {
  contractCode: string;
  locationName: string;
};

/**
 * Response จาก Backend แบบ snake_case
 */
export type CheckpointMapLocationResponse = {
  contract_code: string;
  location_name: string;
  latitude: number | string | null;
  longitude: number | string | null;
  radius_meter: number | string | null;
  grace_meter: number | string | null;

  /**
   * หมายเหตุ / รายละเอียดเพิ่มเติมจาก site_location.location_detail
   */
  location_detail?: string | null;
};