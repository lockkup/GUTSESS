import { api } from "../lib/api";
import type {
  GetTimeRecordsParams,
  TimeRecordCheckIn,
  TimeRecordCheckOut,
  TimeRecordListItemResponse,
  TimeRecordResponse,
} from "../types/timeRecord";

const BASE_PATH = "/api/time-records";

function isNotFoundError(error: unknown) {
  return (
    error instanceof Error &&
    (error.message.includes("HTTP 404") ||
      error.message.includes("404") ||
      error.message.includes("Not Found") ||
      error.message.includes("Open time record not found") ||
      error.message.includes("Time record not found"))
  );
}

export const timeRecordService = {
  createTimeRecord(payload: TimeRecordCheckIn) {
    return api.post<TimeRecordResponse>(`${BASE_PATH}/`, payload);
  },

  checkIn(payload: TimeRecordCheckIn) {
    return api.post<TimeRecordResponse>(`${BASE_PATH}/`, payload);
  },

  async getOpenTimeRecordByEmployeeCode(
    employeeCode: string,
  ): Promise<TimeRecordResponse | null> {
    try {
      return await api.get<TimeRecordResponse>(
        `${BASE_PATH}/open/${encodeURIComponent(employeeCode)}`,
      );
    } catch (error) {
      if (isNotFoundError(error)) {
        return null;
      }

      throw error;
    }
  },

  getTimeRecordById(timeRecordId: number) {
    return api.get<TimeRecordResponse>(`${BASE_PATH}/${timeRecordId}`);
  },

  getTimeRecords(params?: GetTimeRecordsParams) {
    return api.get<TimeRecordListItemResponse[]>(`${BASE_PATH}/`, params);
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