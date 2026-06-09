// src/services/checkpointAssignmentService.ts

import api from "@/lib/api";
import type {
  CheckpointDailyRow,
  ShiftType,
} from "@/types/checkpointAssignment";

type GetDailyCheckpointAssignmentsParams = {
  workDate: string;

  /**
   * day = ผลัดกลางวัน
   * night = ผลัดกลางคืน
   * ถ้าไม่ส่ง จะดึงทุกผลัดตามที่ backend รองรับ
   */
  shiftType?: ShiftType | null;

  /**
   * ใช้ให้ Backend กรองตารางงานสายตรวจตามผู้ที่ล็อกอิน
   * Backend เอา employee_code ไปหา division_id / routes_id เอง
   * ไม่ควรเชื่อ division_id / route_id จาก frontend ตรง ๆ
   */
  employeeCode: string;
};

export function getDailyCheckpointAssignments({
  workDate,
  shiftType,
  employeeCode,
}: GetDailyCheckpointAssignmentsParams) {
  const normalizedEmployeeCode = employeeCode.trim();

  // กันกรณีไม่มีรหัสพนักงาน แล้ว backend อาจคืนข้อมูลทั้งหมด
  if (!normalizedEmployeeCode) {
    return Promise.resolve([] as CheckpointDailyRow[]);
  }

  return api.get<CheckpointDailyRow[]>("/api/checkpoint-assignments/daily", {
    work_date: workDate,
    shift_type: shiftType ?? undefined,
    employee_code: normalizedEmployeeCode,
    is_active: true,
    include_deleted: false,
  });
}