export type CheckpointAssignmentStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "repaired";

export type ShiftType = "day" | "night";

export type CheckpointDailyRow = {
  assignment_id: number;
  work_date: string;
  schedule_item_id: number;

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
};