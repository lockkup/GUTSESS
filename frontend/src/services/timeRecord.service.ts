// src/services/timeRecord.service.ts

import { api } from "../lib/api";
import type {
  GetTimeRecordsParams,
  TimeRecordCheckIn,
  TimeRecordCheckOut,
  TimeRecordListItemResponse,
  TimeRecordResponse,
} from "../types/timeRecord";

const BASE_PATH = "/api/time-records";

export type OpenAttendanceTimeRecordParams = {
  work_date: string; // YYYY-MM-DD
};

function isNotFoundError(error: unknown) {
  return (
    error instanceof Error &&
    (error.message.includes("HTTP 404") ||
      error.message.includes("404") ||
      error.message.includes("Not Found") ||
      error.message.includes("Open time record not found") ||
      error.message.includes("Time record not found") ||
      error.message.includes("ไม่พบข้อมูล"))
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
  createTimeRecord(payload: TimeRecordCheckIn) {
    return api.post<TimeRecordResponse>(`${BASE_PATH}/`, payload);
  },

  checkIn(payload: TimeRecordCheckIn) {
    return api.post<TimeRecordResponse>(`${BASE_PATH}/`, payload);
  },

  /**
   * ใช้กับเมนู "ลงเวลา เข้า-ออกงาน"
   *
   * ใช้ employee_code + work_date
   * ไม่ใช้ shift_id แล้ว
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
   * Backend จะหา time_record ผ่าน checkpoint_assignment.time_record_id
   * โดยใช้ assignment_id ที่เลือกจากตารางงานสายตรวจ
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
   * ให้ชี้ไปที่ attendance
   * ใช้ employee_code + work_date
   * ไม่ใช้ shift_id แล้ว
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
   * Endpoint: GET /api/time-records/
   */
  getTimeRecords(params?: GetTimeRecordsParams) {
    return api.get<TimeRecordResponse[]>(`${BASE_PATH}/`, params);
  },

  /**
   * ดึงข้อมูลสำหรับหน้า list/history แบบย่อ
   * Endpoint: GET /api/time-records/list-items
   */
  getTimeRecordListItems(params?: GetTimeRecordsParams) {
    return api.get<TimeRecordListItemResponse[]>(
      `${BASE_PATH}/list-items`,
      params,
    );
  },

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