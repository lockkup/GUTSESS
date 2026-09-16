// src/types/timeRecord.ts

export type TimeRecord = {
  time_record_id: number;
  employee_code: string;
  work_date: string;

  /**
   * ใช้เฉพาะกรณี time_record ที่มาจาก "ตารางงานสายตรวจ"
   * - attendance ปกติ: อาจเป็น null
   * - checkpoint: ควรมีค่า 1 = กลางวัน, 2 = กลางคืน
   */
  shift_id?: number | null;

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

/**
 * Payload สำหรับค้นหาหน่วยงานที่อยู่ในพื้นที่ GPS ปัจจุบัน
 * employee_code ใช้ตรวจสอบสถานะรายการค้างของแต่ละหน่วยงาน
 */
export type AttendanceLocationSearchRequest = {
  employee_code: string;
  work_date: string;
  current_latitude: number;
  current_longitude: number;
  gps_accuracy?: number | null;
};

/**
 * หน่วยงานที่อยู่ในพื้นที่ GPS พร้อมสถานะลงเวลาของพนักงาน
 */
export type AttendanceLocationOptionResponse = {
  location_id: number;
  contract_code: string;
  location_name: string;
  has_open_record: boolean;
  open_time_record_id: number | null;
};

export type TimeRecordCheckIn = {
  employee_code: string;
  work_date: string;

  /**
   * ใช้เฉพาะกรณีมาจาก "ตารางงานสายตรวจ"
   * - attendance ปกติ: ไม่ต้องส่ง
   * - checkpoint: ส่ง shift_id เพื่อใช้ตอนทำรายงาน
   *
   * ค่า:
   * 1 = ผลัดกลางวัน
   * 2 = ผลัดกลางคืน
   */
  shift_id?: number | null;

  /**
   * ใช้เฉพาะกรณีมาจาก "ตารางงานสายตรวจ"
   * - attendance ปกติ: ไม่ต้องส่ง
   * - checkpoint: ส่ง assignment_id เพื่อให้ backend ตรวจ GPS และผูก time_record_id กับ checkpoint_assignment
   */
  assignment_id?: number | null;

  /**
   * ใช้เฉพาะ attendance ปกติ เมื่อเลือกหน่วยงานจากพื้นที่ทับซ้อน
   * กรณี checkpoint ไม่ต้องส่ง เพราะ Backend หา location จาก assignment_id
   */
  checkin_location_id?: number | null;

  current_latitude: number;
  current_longitude: number;
  gps_accuracy?: number | null;

  /**
   * Backend จะตรวจ current_latitude/current_longitude กับหน่วยงานที่เลือก
   * และบันทึกพิกัดที่ใช้ลงเวลา
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
   * - checkpoint: ส่ง shift_id เพื่อใช้ตอนทำรายงาน
   *
   * ค่า:
   * 1 = ผลัดกลางวัน
   * 2 = ผลัดกลางคืน
   */
  shift_id?: number | null;

  /**
   * ใช้เฉพาะกรณีออกงานจาก "ตารางงานสายตรวจ"
   * - attendance ปกติ: ไม่ต้องส่ง
   * - checkpoint: ส่ง assignment_id เพื่อให้ backend ตรวจ GPS และหา checkpoint_assignment.time_record_id
   */
  assignment_id?: number | null;

  /**
   * ใช้เฉพาะ attendance ปกติ เพื่อยืนยันหน่วยงานของรายการที่ออกงาน
   * กรณี checkpoint ไม่ต้องส่ง เพราะ Backend หา location จาก assignment_id
   */
  checkout_location_id?: number | null;

  current_latitude: number;
  current_longitude: number;
  gps_accuracy?: number | null;

  /**
   * Backend จะตรวจ current_latitude/current_longitude กับหน่วยงานที่เลือก
   * และบันทึกพิกัดที่ใช้ลงเวลา
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
  work_date?: string;
  start_date?: string;
  end_date?: string;

  /**
   * เผื่อใช้ filter รายงาน / debug ตามผลัด
   */
  shift_id?: number;
};
