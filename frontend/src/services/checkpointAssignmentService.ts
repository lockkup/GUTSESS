// src/services/checkpointAssignmentService.ts

import api from "@/lib/api";
import type {
  CheckpointAreaOptionResponse,
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
   * รหัสพนักงานที่ล็อกอิน
   *
   * ถ้าไม่ได้เลือกพื้นที่อื่น Backend จะใช้ employee_code
   * เพื่อกรองเขต / เส้นทางประจำเหมือนระบบเดิม
   */
  employeeCode: string;

  /**
   * เขตที่ผู้ใช้เลือกจาก Dropdown
   *
   * ไม่ส่ง = ใช้เขต / เส้นทางประจำของพนักงาน
   */
  divisionId?: number | null;

  /**
   * เส้นทางที่ผู้ใช้เลือกจาก Dropdown
   *
   * ต้องส่งพร้อม divisionId
   */
  routeId?: number | null;
};

type GetCheckpointAreaOptionsParams = {
  employeeCode: string;
};

type CheckpointReservationParams = {
  assignmentId: number;
  employeeCode: string;
};

export type TakeoverCheckpointAssignmentParams = {
  /** Assignment เดิมที่มีสถานะ in_progress ค้างข้ามวัน */
  assignmentId: number;

  /** รหัสพนักงานคนใหม่ที่ยืนยันเข้าตรวจแทน */
  updatedBy: string;
};

type TakeoverCheckpointAssignmentRequest = {
  updated_by: string;
};

export type TakeoverCheckpointAssignmentResponse = {
  /** Assignment เดิมที่ Backend ปิดเป็น cancelled */
  previous_assignment: CheckpointReservationActionResponse;

  /** Assignment ของวันปัจจุบันที่จองให้พนักงานคนใหม่ */
  current_assignment: CheckpointReservationActionResponse;
};

type RawCheckpointMapLocationResponse = CheckpointMapLocationResponse & {
  locationDetail?: string | null;
};

export function getDailyCheckpointAssignments({
  workDate,
  shiftType,
  employeeCode,
  divisionId,
  routeId,
}: GetDailyCheckpointAssignmentsParams): Promise<CheckpointDailyRow[]> {
  const normalizedEmployeeCode = employeeCode.trim();

  // กันกรณีไม่มีรหัสพนักงาน แล้ว backend อาจคืนข้อมูลทั้งหมด
  if (!normalizedEmployeeCode) {
    return Promise.resolve([] as CheckpointDailyRow[]);
  }

  const hasDivisionId = divisionId !== null && divisionId !== undefined;
  const hasRouteId = routeId !== null && routeId !== undefined;

  // หากเลือกพื้นที่อื่น ต้องมีทั้งเขตและเส้นทาง
  if (hasDivisionId !== hasRouteId) {
    return Promise.reject(
      new Error("กรุณาระบุเขตและเส้นทางให้ครบ"),
    );
  }

  if (
    hasDivisionId &&
    (!Number.isInteger(divisionId) || Number(divisionId) <= 0)
  ) {
    return Promise.reject(new Error("divisionId ไม่ถูกต้อง"));
  }

  if (
    hasRouteId &&
    (!Number.isInteger(routeId) || Number(routeId) <= 0)
  ) {
    return Promise.reject(new Error("routeId ไม่ถูกต้อง"));
  }

  return api.get<CheckpointDailyRow[]>("/checkpoint-assignments/daily", {
    work_date: workDate,
    shift_type: shiftType ?? undefined,
    employee_code: normalizedEmployeeCode,
    division_id: hasDivisionId ? divisionId : undefined,
    route_id: hasRouteId ? routeId : undefined,
    is_active: true,
    include_deleted: false,
  });
}

/**
 * โหลดรายการเขต / เส้นทางที่พนักงานสามารถเลือกเปิดดูได้
 *
 * GET /api/checkpoint-assignments/area-options
 */
export function getCheckpointAreaOptions({
  employeeCode,
}: GetCheckpointAreaOptionsParams): Promise<CheckpointAreaOptionResponse[]> {
  const normalizedEmployeeCode = employeeCode.trim();

  if (!normalizedEmployeeCode) {
    return Promise.resolve([] as CheckpointAreaOptionResponse[]);
  }

  return api.get<CheckpointAreaOptionResponse[]>(
    "/checkpoint-assignments/area-options",
    {
      employee_code: normalizedEmployeeCode,
    },
  );
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

/**
 * ยืนยันเข้าตรวจแทน Assignment ที่ค้างข้ามวัน
 *
 * Backend จะปิด Assignment เดิมและคืน Assignment ของวันปัจจุบัน
 * เพื่อให้หน้า Checkpoint ทำ GPS / Face Verify และเช็กอินตามขั้นตอนปกติ
 *
 * POST /api/checkpoint-assignments/{assignmentId}/takeover
 */
export function takeoverCheckpointAssignment({
  assignmentId,
  updatedBy,
}: TakeoverCheckpointAssignmentParams): Promise<TakeoverCheckpointAssignmentResponse> {
  const normalizedUpdatedBy = updatedBy.trim();

  if (!Number.isInteger(assignmentId) || assignmentId <= 0) {
    return Promise.reject(new Error("assignmentId ไม่ถูกต้อง"));
  }

  if (!normalizedUpdatedBy) {
    return Promise.reject(
      new Error("ไม่พบรหัสพนักงานสำหรับเข้าตรวจแทน"),
    );
  }

  const payload: TakeoverCheckpointAssignmentRequest = {
    updated_by: normalizedUpdatedBy,
  };

  return api.post<TakeoverCheckpointAssignmentResponse>(
    `/checkpoint-assignments/${assignmentId}/takeover`,
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