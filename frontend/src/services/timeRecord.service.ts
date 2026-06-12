// src/services/timeRecord.service.ts

import { api } from "../lib/api";
import type {
  GetTimeRecordsParams,
  TimeRecordCheckIn,
  TimeRecordCheckOut,
  TimeRecordListItemResponse,
  TimeRecordResponse,
} from "../types/timeRecord";

const BASE_PATH = "/time-records";

export type OpenAttendanceTimeRecordParams = {
  work_date: string; // YYYY-MM-DD
};

type ApiErrorLike = {
  status?: number;
  statusCode?: number;
  message?: string;
  response?: {
    status?: number;
    data?: {
      detail?: string;
    };
  };
  data?: {
    detail?: string;
  };
};

function isNotFoundError(error: unknown) {
  if (!error) {
    return false;
  }

  if (typeof error === "string") {
    return (
      error.includes("HTTP 404") ||
      error.includes("404") ||
      error.includes("Not Found") ||
      error.includes("Open time record not found") ||
      error.includes("Time record not found") ||
      error.includes("ไม่พบข้อมูล") ||
      error.includes("ไม่พบรายการ")
    );
  }

  if (typeof error !== "object") {
    return false;
  }

  const maybeError = error as ApiErrorLike;

  if (
    maybeError.status === 404 ||
    maybeError.statusCode === 404 ||
    maybeError.response?.status === 404
  ) {
    return true;
  }

  const detail =
    maybeError.response?.data?.detail ??
    maybeError.data?.detail ??
    maybeError.message ??
    "";

  return (
    detail.includes("HTTP 404") ||
    detail.includes("404") ||
    detail.includes("Not Found") ||
    detail.includes("Open time record not found") ||
    detail.includes("Time record not found") ||
    detail.includes("ไม่พบข้อมูล") ||
    detail.includes("ไม่พบรายการ")
  );
}

function validateOpenRecordParams(
  params?: OpenAttendanceTimeRecordParams | null,
): OpenAttendanceTimeRecordParams {
  if (!params) {
    throw new Error("ไม่พบข้อมูล work_date สำหรับค้นหาข้อมูลลงเวลา");
  }

  if (!params.work_date) {
    throw new Error("ไม่พบข้อมูล work_date สำหรับค้นหาข้อมูลลงเวลา");
  }

  return params;
}

function buildOpenRecordQuery(params?: OpenAttendanceTimeRecordParams | null) {
  const validParams = validateOpenRecordParams(params);

  const query = new URLSearchParams();

  query.set("work_date", validParams.work_date);

  return query.toString();
}

export const timeRecordService = {
  /**
   * สร้าง time_record
   *
   * attendance ปกติ:
   * - ไม่ส่ง shift_id
   * - ไม่ส่ง assignment_id
   *
   * checkpoint:
   * - ส่ง shift_id
   * - ส่ง assignment_id
   */
  createTimeRecord(payload: TimeRecordCheckIn) {
    return api.post<TimeRecordResponse>(`${BASE_PATH}/`, payload);
  },

  checkIn(payload: TimeRecordCheckIn) {
    return api.post<TimeRecordResponse>(`${BASE_PATH}/`, payload);
  },

  /**
   * ใช้กับเมนู "ลงเวลา เข้า-ออกงาน" จากหน้า Home
   *
   * ใช้ employee_code + work_date
   * ไม่ใช้ shift_id
   *
   * Endpoint จริงหลังผ่าน api.ts:
   * GET /api/time-records/open/attendance/{employee_code}?work_date=YYYY-MM-DD
   */
  async getOpenAttendanceTimeRecordByEmployeeCode(
    employeeCode: string,
    params?: OpenAttendanceTimeRecordParams | null,
  ): Promise<TimeRecordResponse | null> {
    try {
      const query = buildOpenRecordQuery(params);

      return await api.get<TimeRecordResponse>(
        `${BASE_PATH}/open/attendance/${encodeURIComponent(
          employeeCode,
        )}?${query}`,
      );
    } catch (error) {
      if (isNotFoundError(error)) {
        return null;
      }

      throw error;
    }
  },

  /**
   * ใช้กับเมนู "ตารางงานสายตรวจ"
   *
   * Backend จะหา time_record ผ่าน checkpoint_assignment.time_record_id
   * โดยใช้ assignment_id ที่เลือกจากตารางงานสายตรวจ
   *
   * Endpoint จริงหลังผ่าน api.ts:
   * GET /api/time-records/open/checkpoint/{employee_code}/{assignment_id}
   */
  async getOpenCheckpointTimeRecordByEmployeeCode(
    employeeCode: string,
    assignmentId: number,
  ): Promise<TimeRecordResponse | null> {
    try {
      return await api.get<TimeRecordResponse>(
        `${BASE_PATH}/open/checkpoint/${encodeURIComponent(
          employeeCode,
        )}/${assignmentId}`,
      );
    } catch (error) {
      if (isNotFoundError(error)) {
        return null;
      }

      throw error;
    }
  },

  /**
   * ฟังก์ชันเดิม
   *
   * ให้ชี้ไปที่ attendance
   * ใช้ employee_code + work_date
   * ไม่ใช้ shift_id
   */
  async getOpenTimeRecordByEmployeeCode(
    employeeCode: string,
    params?: OpenAttendanceTimeRecordParams | null,
  ): Promise<TimeRecordResponse | null> {
    return this.getOpenAttendanceTimeRecordByEmployeeCode(employeeCode, params);
  },

  getTimeRecordById(timeRecordId: number) {
    return api.get<TimeRecordResponse>(`${BASE_PATH}/${timeRecordId}`);
  },

  /**
   * ดึงข้อมูล time_record แบบเต็ม
   *
   * Endpoint จริงหลังผ่าน api.ts:
   * GET /api/time-records/
   */
  getTimeRecords(params?: GetTimeRecordsParams) {
    return api.get<TimeRecordResponse[]>(`${BASE_PATH}/`, params);
  },

  /**
   * ดึงข้อมูลสำหรับหน้า list/history แบบย่อ
   *
   * Endpoint จริงหลังผ่าน api.ts:
   * GET /api/time-records/list-items
   */
  getTimeRecordListItems(params?: GetTimeRecordsParams) {
    return api.get<TimeRecordListItemResponse[]>(
      `${BASE_PATH}/list-items`,
      params,
    );
  },

  /**
   * update time_record
   *
   * attendance ปกติ:
   * - ไม่ส่ง shift_id
   * - ไม่ส่ง assignment_id
   *
   * checkpoint:
   * - ส่ง shift_id
   * - ส่ง assignment_id
   */
  updateTimeRecord(timeRecordId: number, payload: TimeRecordCheckOut) {
    return api.patch<TimeRecordResponse>(
      `${BASE_PATH}/${timeRecordId}`,
      payload,
    );
  },

  checkOut(timeRecordId: number, payload: TimeRecordCheckOut) {
    return api.patch<TimeRecordResponse>(
      `${BASE_PATH}/${timeRecordId}`,
      payload,
    );
  },
};