// src/services/appSetting.service.ts

import { api } from "../lib/api";

const BASE_PATH = "/api/app-settings";

export type AttendanceLocationSetting = {
  enable_face_verify: boolean;
  geo: {
    desiredAccuracyM: number;
    maxAccuracyM: number;
    watchWindowMs: number;
    hardTimeoutMs: number;
  };
};

type ApiAttendanceLocationSetting = {
  enable_face_verify?: boolean;
  geo?: {
    desiredAccuracyM?: number;
    maxAccuracyM?: number;
    watchWindowMs?: number;
    hardTimeoutMs?: number;
  };
};

function toNumber(value: unknown, fieldName: string): number {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    throw new Error(`Invalid attendance location setting: ${fieldName}`);
  }

  return numberValue;
}

function normalizeAttendanceLocationSetting(
  data: ApiAttendanceLocationSetting,
): AttendanceLocationSetting {
  if (!data || typeof data !== "object") {
    throw new Error("Invalid attendance location setting response");
  }

  if (!data.geo || typeof data.geo !== "object") {
    throw new Error("Missing geo setting");
  }

  return {
    enable_face_verify: data.enable_face_verify === true,
    geo: {
      desiredAccuracyM: toNumber(
        data.geo.desiredAccuracyM,
        "geo.desiredAccuracyM",
      ),
      maxAccuracyM: toNumber(data.geo.maxAccuracyM, "geo.maxAccuracyM"),
      watchWindowMs: toNumber(data.geo.watchWindowMs, "geo.watchWindowMs"),
      hardTimeoutMs: toNumber(data.geo.hardTimeoutMs, "geo.hardTimeoutMs"),
    },
  };
}

export const appSettingService = {
  /**
   * ดึงค่าตั้งค่าการตรวจ GPS สำหรับเมนูลงเวลาเข้า-ออกงาน
   *
   * Endpoint:
   * GET /api/app-settings/attendance-location
   */
  async getAttendanceLocationSetting(): Promise<AttendanceLocationSetting> {
    const data = await api.get<ApiAttendanceLocationSetting>(
      `${BASE_PATH}/attendance-location`,
    );

    return normalizeAttendanceLocationSetting(data);
  },
};

/**
 * export ฟังก์ชันเดี่ยวไว้ให้ AttendanceFaceVerify.tsx ใช้ต่อได้
 */
export function getAttendanceLocationSetting(): Promise<AttendanceLocationSetting> {
  return appSettingService.getAttendanceLocationSetting();
}