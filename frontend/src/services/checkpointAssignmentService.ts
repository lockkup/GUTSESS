// src/services/checkpointAssignmentService.ts

import api from "@/lib/api";
import type {
  CheckpointDailyRow,
  CheckpointMapLocationResponse,
  CheckpointReservationActionRequest,
  CheckpointReservationActionResponse,
  GetCheckpointMapLocationParams,
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

type CheckpointReservationParams = {
  assignmentId: number;
  employeeCode: string;
};

type RawCheckpointMapLocationResponse = CheckpointMapLocationResponse & {
  locationDetail?: string | null;
};

export function getDailyCheckpointAssignments({
  workDate,
  shiftType,
  employeeCode,
}: GetDailyCheckpointAssignmentsParams): Promise<CheckpointDailyRow[]> {
  const normalizedEmployeeCode = employeeCode.trim();

  // กันกรณีไม่มีรหัสพนักงาน แล้ว backend อาจคืนข้อมูลทั้งหมด
  if (!normalizedEmployeeCode) {
    return Promise.resolve([] as CheckpointDailyRow[]);
  }

  return api.get<CheckpointDailyRow[]>("/checkpoint-assignments/daily", {
    work_date: workDate,
    shift_type: shiftType ?? undefined,
    employee_code: normalizedEmployeeCode,
    is_active: true,
    include_deleted: false,
  });
}

/**
 * จองหน่วยงานก่อนเดินทางเข้าตรวจ
 *
 * POST /api/checkpoint-assignments/{assignmentId}/reserve
 */
export function reserveCheckpointAssignment({
  assignmentId,
  employeeCode,
}: CheckpointReservationParams): Promise<CheckpointReservationActionResponse> {
  const normalizedEmployeeCode = employeeCode.trim();

  if (!Number.isInteger(assignmentId) || assignmentId <= 0) {
    return Promise.reject(new Error("assignmentId ไม่ถูกต้อง"));
  }

  if (!normalizedEmployeeCode) {
    return Promise.reject(new Error("ไม่พบรหัสพนักงานสำหรับจองหน่วยงาน"));
  }

  const payload: CheckpointReservationActionRequest = {
    employee_code: normalizedEmployeeCode,
  };

  return api.post<CheckpointReservationActionResponse>(
    `/checkpoint-assignments/${assignmentId}/reserve`,
    payload,
  );
}

/**
 * ยกเลิกการจองหน่วยงาน
 *
 * POST /api/checkpoint-assignments/{assignmentId}/cancel-reservation
 */
export function cancelCheckpointAssignmentReservation({
  assignmentId,
  employeeCode,
}: CheckpointReservationParams): Promise<CheckpointReservationActionResponse> {
  const normalizedEmployeeCode = employeeCode.trim();

  if (!Number.isInteger(assignmentId) || assignmentId <= 0) {
    return Promise.reject(new Error("assignmentId ไม่ถูกต้อง"));
  }

  if (!normalizedEmployeeCode) {
    return Promise.reject(
      new Error("ไม่พบรหัสพนักงานสำหรับยกเลิกการจอง"),
    );
  }

  const payload: CheckpointReservationActionRequest = {
    employee_code: normalizedEmployeeCode,
  };

  return api.post<CheckpointReservationActionResponse>(
    `/checkpoint-assignments/${assignmentId}/cancel-reservation`,
    payload,
  );
}

export async function getCheckpointMapLocation({
  contractCode,
  locationName,
}: GetCheckpointMapLocationParams): Promise<CheckpointMapLocationResponse> {
  const normalizedContractCode = contractCode.trim();
  const normalizedLocationName = locationName.trim();

  if (!normalizedContractCode || !normalizedLocationName) {
    return Promise.reject(new Error("กรุณาระบุรหัสสัญญาและชื่อหน่วยงาน"));
  }

  const result = await api.get<RawCheckpointMapLocationResponse>(
    "/checkpoint-assignments/map-location",
    {
      contract_code: normalizedContractCode,
      location_name: normalizedLocationName,
    },
  );

  console.log("[checkpointAssignmentService] MAP LOCATION RESPONSE", result);

  return {
    ...result,
    location_detail: result.location_detail ?? result.locationDetail ?? null,
  };
}