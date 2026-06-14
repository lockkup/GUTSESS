// src/services/checkpointLocationService.ts

import api from "@/lib/api";

export type VerifyCheckpointLocationPayload = {
  assignment_id: number;

  /**
   * ใช้ประกอบการแสดงผล / debug
   * backend ควรใช้ assignment_id เป็นหลักในการหา location
   */
  unit_name?: string | null;

  latitude: number;
  longitude: number;

  /**
   * ค่าความคลาดเคลื่อน GPS จาก browser หน่วยเป็นเมตร
   */
  accuracy?: number | null;
};

export type VerifyCheckpointLocationResponse = {
  allowed: boolean;
  message: string;

  /**
   * ระยะห่างจริงระหว่าง GPS ปัจจุบันกับจุดตรวจในฐานข้อมูล
   */
  distance_meter?: number | null;

  /**
   * รัศมีที่ backend ใช้ตัดสิน เช่น radius_meter + grace_meter
   */
  radius_meter?: number | null;

  /**
   * accuracy ที่ frontend ส่งไป
   */
  accuracy?: number | null;

  /**
   * ส่งกลับมาเพื่อ debug / ตรวจสอบว่า backend ตรวจ assignment ไหน
   */
  assignment_id?: number | null;
  unit_name?: string | null;
};

function logDev(message: string, payload?: unknown) {
  console.log(message, payload);
}

function logDevError(message: string, error: unknown) {
  console.error(message, error);
}

export async function verifyCheckpointLocation(
  payload: VerifyCheckpointLocationPayload,
): Promise<VerifyCheckpointLocationResponse> {
  logDev("[CheckpointLocationService] VERIFY LOCATION REQUEST", {
    endpoint: "/checkpoint-assignments/verify-location",
    payload,
  });

  try {
    const result = await api.post<VerifyCheckpointLocationResponse>(
      "/checkpoint-assignments/verify-location",
      payload,
    );

    logDev("[CheckpointLocationService] VERIFY LOCATION RESPONSE", {
      payload,
      result,
    });

    return result;
  } catch (error) {
    logDevError("[CheckpointLocationService] VERIFY LOCATION ERROR", {
      payload,
      error,
    });

    throw error;
  }
}