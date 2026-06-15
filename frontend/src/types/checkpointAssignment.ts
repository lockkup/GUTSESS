// src/types/checkpointAssignment.ts

export type CheckpointAssignmentStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "repaired";

export type ShiftType = "day" | "night";

export type CheckpointDailyRow = {
  assignment_id: number;
  work_date: string;
  schedule_item_id: number;

  /**
   * ใช้ให้ frontend รู้ว่างานนี้เป็นผลัดไหน
   * ดึงจาก checkpoint_schedule_item.shift_id
   * เพื่อไม่ต้อง hardcode day=1 / night=2 ที่ frontend
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

  completed_at: string | null;
  completed_by: string | null;

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
