// src/types/timeRecord.ts

export type TimeRecord = {
  time_record_id: number;
  employee_code: string;
  shift_id: number;
  work_date: string;

  checkin_location_id?: number | null;
  checkout_location_id?: number | null;

  checkin?: string | null;
  checkin_lat?: number | null;
  checkin_lng?: number | null;
  checkin_remark?: string | null;
  images_checkin_1?: string | null;
  images_checkin_2?: string | null;

  checkout?: string | null;
  checkout_lat?: number | null;
  checkout_lng?: number | null;
  checkout_remark?: string | null;
  images_checkout_1?: string | null;
  images_checkout_2?: string | null;

  created_at?: string;
  updated_at?: string;
  created_by: string;
  updated_by?: string | null;
};

export type TimeRecordCheckIn = {
  employee_code: string;
  shift_id: number;
  work_date: string;

  /**
   * ใช้เฉพาะกรณีมาจาก "ตารางงานสายตรวจ"
   * - attendance ปกติ: ไม่ต้องส่ง
   * - checkpoint: ส่ง assignment_id เพื่อให้ backend ตรวจ GPS และผูก time_record_id กับ checkpoint_assignment
   */
  assignment_id?: number | null;

  current_latitude: number;
  current_longitude: number;
  gps_accuracy?: number | null;

  /**
   * Backend จะใช้ current_latitude/current_longitude ตรวจพื้นที่
   * และกำหนด checkin_location_id เอง
   */
  checkin: string;
  checkin_lat?: number | null;
  checkin_lng?: number | null;
  checkin_remark?: string | null;
  images_checkin_1?: string | null;
  images_checkin_2?: string | null;

  created_by: string;
};

export type TimeRecordCheckOut = {
  /**
   * ใช้เฉพาะกรณีออกงานจาก "ตารางงานสายตรวจ"
   * - attendance ปกติ: ไม่ต้องส่ง
   * - checkpoint: ส่ง assignment_id เพื่อให้ backend ตรวจ GPS และหา checkpoint_assignment.time_record_id
   */
  assignment_id?: number | null;

  current_latitude: number;
  current_longitude: number;
  gps_accuracy?: number | null;

  /**
   * Backend จะใช้ current_latitude/current_longitude ตรวจพื้นที่
   * และกำหนด checkout_location_id เอง
   */
  checkout: string;
  checkout_lat?: number | null;
  checkout_lng?: number | null;
  checkout_remark?: string | null;
  images_checkout_1?: string | null;
  images_checkout_2?: string | null;

  updated_by: string;
};

export type TimeRecordResponse = TimeRecord;

export type TimeRecordListItemResponse = TimeRecord;

export type GetTimeRecordsParams = {
  skip?: number;
  limit?: number;
  employee_code?: string;
  shift_id?: number;
  work_date?: string;
  start_date?: string;
  end_date?: string;
};