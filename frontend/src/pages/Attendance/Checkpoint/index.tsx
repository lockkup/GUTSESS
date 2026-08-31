// src/pages/Attendance/Checkpoint/index.tsx

import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { ClipboardList, Info, RefreshCcw, Search } from "lucide-react";

import Header from "@/layout/Header";
import BackButton from "@/components/BackButton";
import LoadingModal from "@/components/LoadingModal";
import SuccessModal from "@/components/SuccessModal";
import OutOfAreaModal from "@/components/OutOfAreaModal";
import CheckpointInProgressModal from "@/components/CheckpointInProgressModal/CheckpointInProgressModal";
import CheckpointTakeoverConfirmModal from "@/components/CheckpointTakeoverConfirmModal/CheckpointTakeoverConfirmModal";
import CheckpointAreaConfirmModal from "@/components/CheckpointAreaConfirmModal";
import CheckpointMapModal, {
  type CheckpointMapLocation,
} from "@/components/CheckpointMapModal";
import CheckpointCallModal, {
  type CallStatus,
  type CheckpointCallModalSavePayload,
} from "@/components/CheckpointCallModal";

import {
  getAttendanceLocationSetting,
  type AttendanceLocationSetting,
} from "@/services/appSetting.service";

import {
  cancelCheckpointAssignmentReservation,
  getCheckpointAreaOptions,
  getDailyCheckpointAssignments,
  getCheckpointMapLocation,
  reserveCheckpointAssignment,
  takeoverCheckpointAssignment,
} from "@/services/checkpointAssignmentService";
import { createCheckpointAssignmentCall } from "@/services/checkpointAssignmentCallService";
import { verifyCheckpointLocation } from "@/services/checkpointLocationService";

import type {
  CheckpointAreaOptionResponse,
  CheckpointAssignmentStatus,
  CheckpointDailyRow,
  ShiftType,
} from "@/types/checkpointAssignment";

import styles from "./Checkpoint.module.css";

export type CheckInOutMode = "checkin" | "checkout";

export type PassedLocation = {
  latitude: number;
  longitude: number;
  accuracy: number;
};

export type GoCheckInOutPayload = {
  assignmentId: number;
  unitName: string;

  /**
   * ข้อความที่กำลังแสดงบนหน้า Checkpoint เช่น
   * ["ภาค 2", "เขต 2.1", "เส้นทางที่ 1"]
   *
   * ส่งต่อผ่าน App.tsx ไปหน้า CheckInOut
   * โดยไม่มีหัวข้อ fix เช่น ภาค: เขต: หรือ เส้นทาง:
   */
  patrolAreaValues: string[];

  /**
   * ใช้เฉพาะงานสายตรวจ / Checkpoint
   * ส่งต่อไป App.tsx เพื่อบันทึกลง time_record.shift_id
   *
   * ไม่ fix ที่ frontend แล้ว
   * ต้องใช้ action_shift_id จาก API /checkpoint-assignments/daily
   */
  shiftId: number;

  mode: CheckInOutMode;
  passedLocation: PassedLocation;
};

type Props = {
  empCode: string;
  displayName?: string;

  /**
   * ยังรับ props ชุดนี้ไว้ เพื่อไม่ให้ App.tsx ที่ส่ง props เดิมเข้ามา error
   * แต่หน้า Checkpoint ไม่ใช้ข้อมูลชุดนี้บล็อกการโหลดแล้ว
   * ตอนนี้ให้ Backend กรองจาก employeeCode เป็นหลัก
   */
  divisionId?: number | string | null;
  routeId?: number | string | null;
  routesId?: number | string | null;
  zoneId?: number | string | null;

  /**
   * ข้อความสรุปแนวสายตรวจที่รับมาจากข้อมูลผู้ใช้ / API
   * ส่งข้อความที่มีคำนำหน้าพร้อมแสดงได้เลย เช่น
   * regionLabel="ภาค 1"
   * districtLabel="เขต 1.1"
   * routeLabel="เส้นทาง 1"
   *
   * ไม่ใช้ divisionId / routeId มาแสดงตรง ๆ เพื่อป้องกันการแสดงรหัส ID
   * แทนชื่อจริงของภาค เขต หรือเส้นทาง
   */
  regionLabel?: string | null;
  districtLabel?: string | null;
  routeLabel?: string | null;

  /**
   * เขต / เส้นทางล่าสุดที่ App.tsx จำไว้
   * ใช้ restore หลังกลับมาจาก CheckInOut / FaceVerify
   */
  restoreDivisionId?: number | null;
  restoreRouteId?: number | null;

  /**
   * แจ้ง App.tsx เมื่อผู้ใช้ยืนยันเปลี่ยนเขต / เส้นทางจาก Dropdown
   */
  onPatrolAreaChange?: (
    divisionId: number,
    routeId: number,
  ) => void;

  onBack: () => void;
  onGoCheckInOut: (payload: GoCheckInOutPayload) => void;
};

type RowStatus =
  | "progress"
  | "pending"
  | "done"
  | "doneCall"
  | "abnormalCall"
  | "cancelled";

type CheckRow = {
  assignmentId: number;
  unitName: string;

  // ผลัดตามแผน ใช้สำหรับอ้างอิงเท่านั้น
  scheduleShiftId: number | null;

  // ผลัดที่ใช้บันทึกการเข้าตรวจจริง
  actionShiftId: number | null;

  plan: string;
  assignmentStatus: CheckpointAssignmentStatus;
  status: RowStatus;
  requireCall: boolean;
  hasCall: boolean;
  latestCallStatus: CallStatus | null;

  /**
   * Backend ส่งมาจาก /api/checkpoint-assignments/daily
   * ใช้ปิดปุ่มเมื่อยังไม่ถึงช่วงเวลากะ / หมดช่วงเวลากะ
   */
  canAction: boolean;
  actionDisabledReason: string | null;
  isShiftTimeAllowed: boolean;
  shiftStartTime: string | null;
  shiftEndTime: string | null;
  crossesMidnight: boolean | null;

  /**
   * ผู้ที่กำลังถือจุดตรวจอยู่ กรณี assignment_status = in_progress
   * ต้องได้จาก API /checkpoint-assignments/daily
   */
  inProgressEmployeeCode: string | null;
  inProgressEmployeeName: string | null;

  /**
   * Backend อนุญาตให้พนักงานคนอื่นรับช่วงงานค้างข้ามวันได้
   */
  canTakeover: boolean;

  /**
   * Assignment ที่ผูกกับงานต้นทางสำหรับตรวจแทน
   * สถานะยังเป็น pending และยังไม่ได้เช็กอิน
   */
  isTakeoverPending: boolean;

  /**
   * รหัสพนักงานที่กดยืนยันตรวจแทน อ่านจาก updated_by
   */
  takeoverBy: string | null;

  /**
   * ข้อมูลการจองของ Assignment
   * การจองไม่เปลี่ยน assignment_status
   */
  reservedBy: string | null;
  reservedByName: string | null;
  reservedAt: string | null;
};

type CheckpointDailyRowWithExtra = CheckpointDailyRow & {
  latest_call_status?: number | string | null;
  call_status?: number | string | null;

  /**
   * รองรับชื่อ field ใหม่ที่ Backend ควรส่งมา
   * และ fallback started_by / started_by_name เผื่อ Backend ใช้ชื่อเดิม
   */
  in_progress_employee_code?: string | null;
  in_progress_employee_name?: string | null;
  started_by?: string | null;
  started_by_name?: string | null;
  can_takeover?: boolean | number | string | null;

  is_takeover_pending?: boolean | number | string | null;
  takeover_by?: string | null;

  reserved_by?: string | null;
  reserved_by_name?: string | null;
  reserved_at?: string | null;

  can_action?: boolean | number | string | null;
  action_disabled_reason?: string | null;
  is_shift_time_allowed?: boolean | number | string | null;
  shift_start_time?: string | null;
  shift_end_time?: string | null;
  crosses_midnight?: boolean | number | string | null;
};

const statusText: Record<RowStatus, string> = {
  progress: "อยู่ระหว่างการเข้าตรวจ",
  pending: "รอดำเนินการเข้าตรวจ",
  done: "ตรวจแล้ว",
  doneCall: "ตรวจแล้ว(โทร)",
  abnormalCall: "ผิดปกติ(โทร)",
  cancelled: "ยกเลิก",
};

const statusOrder: Record<RowStatus, number> = {
  progress: 1,
  pending: 2,
  done: 3,
  doneCall: 4,
  abnormalCall: 4,
  cancelled: 5,
};

const DAY_SHIFT_START_SECONDS = 8 * 60 * 60 + 1; // 08:00:01
const DAY_SHIFT_END_SECONDS = 20 * 60 * 60; // 20:00:00
const NIGHT_SHIFT_END_SECONDS = 8 * 60 * 60; // 08:00:00

function logDev(message: string, payload?: unknown) {
  console.log(message, payload);
}

function logDevError(message: string, error: unknown) {
  console.error(message, error);
}

function formatDistanceMeter(distance: number) {
  if (distance >= 1000) {
    return `${(distance / 1000).toFixed(2)} กม.`;
  }

  return `${Math.round(distance)} เมตร`;
}

function getBestPositionAsync(opts: {
  desiredAccuracyM: number;
  watchWindowMs: number;
  hardTimeoutMs: number;
}) {
  const { desiredAccuracyM, watchWindowMs, hardTimeoutMs } = opts;

  return new Promise<GeolocationPosition>(async (resolve, reject) => {
    logDev("[Checkpoint] GPS START", {
      desiredAccuracyM,
      watchWindowMs,
      hardTimeoutMs,
      hasGeolocation: Boolean(navigator.geolocation),
    });

    if (!navigator.geolocation) {
      logDevError("[Checkpoint] GPS NOT SUPPORTED", {
        hasGeolocation: false,
      });

      reject(new Error("unavailable"));
      return;
    }

    try {
      const perm = await (navigator as any).permissions?.query?.({
        name: "geolocation",
      });

      logDev("[Checkpoint] GPS PERMISSION STATE", {
        state: perm?.state,
      });

      if (perm?.state === "denied") {
        logDevError("[Checkpoint] GPS PERMISSION DENIED", {
          state: perm?.state,
        });

        reject({
          code: 1,
          message: "permission denied",
        });
        return;
      }
    } catch (error) {
      logDevError("[Checkpoint] GPS PERMISSION CHECK ERROR", error);
    }

    let best: GeolocationPosition | null = null;
    let done = false;

    let watchId: number | null = null;
    let tWindow: ReturnType<typeof setTimeout> | null = null;
    let tHard: ReturnType<typeof setTimeout> | null = null;

    const finish = (ok: boolean, payload?: unknown) => {
      if (done) return;
      done = true;

      if (watchId != null) {
        navigator.geolocation.clearWatch(watchId);
      }

      if (tWindow) {
        clearTimeout(tWindow);
      }

      if (tHard) {
        clearTimeout(tHard);
      }

      logDev("[Checkpoint] GPS FINISH", {
        ok,
        hasPayload: Boolean(payload),
        bestAccuracy: best?.coords?.accuracy ?? null,
      });

      if (ok) {
        resolve(payload as GeolocationPosition);
      } else {
        reject(payload);
      }
    };

    tHard = setTimeout(() => {
      logDevError("[Checkpoint] GPS HARD TIMEOUT", {
        hardTimeoutMs,
        hasBest: Boolean(best),
        bestAccuracy: best?.coords?.accuracy ?? null,
      });

      if (best) {
        finish(true, best);
      } else {
        finish(false, new Error("GPS timeout"));
      }
    }, hardTimeoutMs);

    tWindow = setTimeout(() => {
      logDev("[Checkpoint] GPS WATCH WINDOW TIMEOUT", {
        watchWindowMs,
        hasBest: Boolean(best),
        bestAccuracy: best?.coords?.accuracy ?? null,
      });

      if (best) {
        finish(true, best);
      }
    }, watchWindowMs);

    const onPos = (pos: GeolocationPosition) => {
      const accuracy = Number.isFinite(pos.coords.accuracy)
        ? pos.coords.accuracy
        : Number.POSITIVE_INFINITY;

      const bestAccuracy =
        best && Number.isFinite(best.coords.accuracy)
          ? best.coords.accuracy
          : Number.POSITIVE_INFINITY;

      logDev("[Checkpoint] GPS POSITION RECEIVED", {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy,
        bestAccuracy,
        desiredAccuracyM,
      });

      if (!best || accuracy < bestAccuracy) {
        best = pos;

        logDev("[Checkpoint] GPS BEST POSITION UPDATED", {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy,
        });
      }

      if (accuracy <= desiredAccuracyM) {
        logDev("[Checkpoint] GPS DESIRED ACCURACY PASSED", {
          accuracy,
          desiredAccuracyM,
        });

        finish(true, pos);
      }
    };

    const onErr = (err: GeolocationPositionError) => {
      logDevError("[Checkpoint] GPS POSITION ERROR", {
        code: err.code,
        message: err.message,
        hasBest: Boolean(best),
        bestAccuracy: best?.coords?.accuracy ?? null,
      });

      if (best) {
        finish(true, best);
      } else {
        finish(false, err);
      }
    };

    try {
      watchId = navigator.geolocation.watchPosition(onPos, onErr, {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: hardTimeoutMs,
      });

      logDev("[Checkpoint] GPS WATCH STARTED", {
        watchId,
      });
    } catch (error) {
      logDevError("[Checkpoint] GPS WATCH START ERROR", error);
      finish(false, error);
    }
  });
}

const formatThaiDateTime = (date: Date) => {
  const dayNames = [
    "อาทิตย์",
    "จันทร์",
    "อังคาร",
    "พุธ",
    "พฤหัสบดี",
    "ศุกร์",
    "เสาร์",
  ];

  const monthNames = [
    "ม.ค.",
    "ก.พ.",
    "มี.ค.",
    "เม.ย.",
    "พ.ค.",
    "มิ.ย.",
    "ก.ค.",
    "ส.ค.",
    "ก.ย.",
    "ต.ค.",
    "พ.ย.",
    "ธ.ค.",
  ];

  const dayName = dayNames[date.getDay()];
  const day = date.getDate();
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear() + 543;
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");

  return `รอบ วัน ${dayName} ที่ ${day} ${month} ${year} เวลาขณะนี้ ${hour}:${minute} น.`;
};

const formatApiDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const getTotalSeconds = (date: Date) => {
  return date.getHours() * 60 * 60 + date.getMinutes() * 60 + date.getSeconds();
};

const getCurrentShiftTypeByTime = (date: Date): ShiftType => {
  const totalSeconds = getTotalSeconds(date);

  // ผลัดกลางวัน 08:00:01 - 20:00:00
  if (
    totalSeconds >= DAY_SHIFT_START_SECONDS &&
    totalSeconds <= DAY_SHIFT_END_SECONDS
  ) {
    return "day";
  }

  // ผลัดกลางคืน 20:00:01 - 08:00:00
  return "night";
};

const getCheckpointWorkDate = (date: Date, shift: ShiftType) => {
  const workDate = new Date(date);
  const totalSeconds = getTotalSeconds(date);

  /**
   * ผลัดกลางวันเปิดรอบใหม่เวลา 08:00:01
   * ก่อนเวลา 08:00:01 หากผู้ใช้เลือกดูผลัดกลางวัน
   * ต้องแสดง work_date ของเมื่อวาน และปิดปุ่มทำรายการไว้ตาม currentShift
   *
   * ตัวอย่าง:
   * 18 มิ.ย. 07:31 + เลือกผลัดกลางวัน
   * ต้องส่ง API เป็น workDate = 17 มิ.ย.
   */
  if (shift === "day" && totalSeconds < DAY_SHIFT_START_SECONDS) {
    workDate.setDate(workDate.getDate() - 1);
    return workDate;
  }

  /**
   * ผลัดกลางคืนข้ามวัน:
   * 00:00:00 - 08:00:00 ต้องนับเป็น work_date ของวันก่อนหน้า
   *
   * ตัวอย่าง:
   * 12 มิ.ย. 00:03 + ผลัดกลางคืน
   * ต้องส่ง API เป็น workDate = 11 มิ.ย.
   */
  if (shift === "night" && totalSeconds <= NIGHT_SHIFT_END_SECONDS) {
    workDate.setDate(workDate.getDate() - 1);
  }

  return workDate;
};

const getShiftText = (shift: ShiftType): string => {
  return shift === "day" ? "ผลัดกลางวัน" : "ผลัดกลางคืน";
};

const mapAssignmentStatusOnly = (
  status: CheckpointAssignmentStatus,
): RowStatus => {
  if (status === "in_progress") {
    return "progress";
  }

  if (status === "completed") {
    return "done";
  }

  if (status === "cancelled") {
    return "cancelled";
  }

  return "pending";
};

const normalizeCallStatus = (value: unknown): CallStatus | null => {
  const numericValue =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : null;

  if (numericValue === 1 || numericValue === 2 || numericValue === 3) {
    return numericValue;
  }

  return null;
};

const normalizeShiftId = (value: unknown): number | null => {
  const numericValue =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : null;

  if (typeof numericValue === "number" && Number.isFinite(numericValue)) {
    return numericValue;
  }

  return null;
};

const normalizePositiveId = (value: unknown): number | null => {
  const numericValue = Number(value);

  return Number.isInteger(numericValue) && numericValue > 0
    ? numericValue
    : null;
};

const normalizeBoolean = (value: unknown, fallback: boolean): boolean => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value === 1;
  }

  if (typeof value === "string") {
    const cleanValue = value.trim().toLowerCase();

    if (["1", "true", "t", "yes", "y"].includes(cleanValue)) {
      return true;
    }

    if (["0", "false", "f", "no", "n"].includes(cleanValue)) {
      return false;
    }
  }

  return fallback;
};

const normalizeNullableText = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const cleanValue = value.trim();

  return cleanValue ? cleanValue : null;
};

const getLatestCallStatus = (
  item: CheckpointDailyRowWithExtra,
): CallStatus | null => {
  return normalizeCallStatus(item.latest_call_status ?? item.call_status);
};

const getInProgressEmployeeCode = (
  item: CheckpointDailyRowWithExtra,
): string | null => {
  return normalizeNullableText(
    item.in_progress_employee_code ?? item.started_by,
  );
};

const getInProgressEmployeeName = (
  item: CheckpointDailyRowWithExtra,
): string | null => {
  return normalizeNullableText(
    item.in_progress_employee_name ?? item.started_by_name,
  );
};

const getReservedBy = (
  item: CheckpointDailyRowWithExtra,
): string | null => {
  return normalizeNullableText(item.reserved_by);
};

const getReservedByName = (
  item: CheckpointDailyRowWithExtra,
): string | null => {
  return normalizeNullableText(item.reserved_by_name);
};

const getReservedAt = (
  item: CheckpointDailyRowWithExtra,
): string | null => {
  return normalizeNullableText(item.reserved_at);
};

const mapAssignmentStatusToRowStatus = (
  status: CheckpointAssignmentStatus,
  hasCall?: boolean,
  latestCallStatus?: CallStatus | null,
): RowStatus => {
  if (status === "cancelled") {
    return "cancelled";
  }

  if (!hasCall) {
    return mapAssignmentStatusOnly(status);
  }

  if (latestCallStatus === 1) {
    return "doneCall";
  }

  if (latestCallStatus === 2) {
    return "abnormalCall";
  }

  if (latestCallStatus === 3) {
    if (status === "completed") {
      return "doneCall";
    }

    return mapAssignmentStatusOnly(status);
  }

  if (status === "completed") {
    return "doneCall";
  }

  return mapAssignmentStatusOnly(status);
};

const getRowScheduleShiftId = (
  item: CheckpointDailyRow,
): number | null => {
  const row = item as CheckpointDailyRowWithExtra;

  return normalizeShiftId(row.schedule_shift_id ?? row.shift_id);
};

const getRowActionShiftId = (
  item: CheckpointDailyRow,
): number | null => {
  const row = item as CheckpointDailyRowWithExtra;

  return normalizeShiftId(
    row.action_shift_id ?? row.shift_id ?? row.schedule_shift_id,
  );
};

const mapDailyRowsToCheckRows = (rows: CheckpointDailyRow[]): CheckRow[] => {
  return rows.map((item) => {
    const row = item as CheckpointDailyRowWithExtra;
    const hasCall = Boolean(item.has_call);
    const latestCallStatus = getLatestCallStatus(row);
    const canAction = normalizeBoolean(row.can_action, true);

    return {
      assignmentId: item.assignment_id,
      unitName: item.unit_name,
      scheduleShiftId: getRowScheduleShiftId(item),
      actionShiftId: getRowActionShiftId(item),
      plan: `${item.plan_day} วัน`,
      assignmentStatus: item.assignment_status,
      requireCall: Boolean(item.require_call),
      hasCall,
      latestCallStatus,
      status: mapAssignmentStatusToRowStatus(
        item.assignment_status,
        hasCall,
        latestCallStatus,
      ),

      canAction,
      actionDisabledReason: normalizeNullableText(row.action_disabled_reason),
      isShiftTimeAllowed: normalizeBoolean(row.is_shift_time_allowed, canAction),
      shiftStartTime: normalizeNullableText(row.shift_start_time),
      shiftEndTime: normalizeNullableText(row.shift_end_time),
      crossesMidnight:
        row.crosses_midnight === null || row.crosses_midnight === undefined
          ? null
          : normalizeBoolean(row.crosses_midnight, false),

      inProgressEmployeeCode: getInProgressEmployeeCode(row),
      inProgressEmployeeName: getInProgressEmployeeName(row),
      canTakeover: normalizeBoolean(row.can_takeover, false),

      isTakeoverPending: normalizeBoolean(
        row.is_takeover_pending,
        false,
      ),
      takeoverBy: normalizeNullableText(row.takeover_by),

      reservedBy: getReservedBy(row),
      reservedByName: getReservedByName(row),
      reservedAt: getReservedAt(row),
    };
  });
};

function getRequestErrorStatus(error: any): number | null {
  return error?.response?.status ?? error?.status ?? null;
}

function getRequestErrorDetail(error: any): {
  message: string;
  employeeCode: string | null;
  employeeName: string | null;
} {
  const detail =
    error?.response?.data?.detail ??
    error?.data?.detail ??
    error?.message ??
    "";

  if (typeof detail === "string") {
    return {
      message: detail,
      employeeCode: null,
      employeeName: null,
    };
  }

  if (detail && typeof detail === "object") {
    return {
      message:
        typeof detail.message === "string"
          ? detail.message
          : "เกิดข้อผิดพลาดในการดำเนินการ",
      employeeCode: normalizeNullableText(detail.employee_code),
      employeeName: normalizeNullableText(detail.employee_name),
    };
  }

  return {
    message: "เกิดข้อผิดพลาดในการดำเนินการ",
    employeeCode: null,
    employeeName: null,
  };
}

function isCheckpointInProgressConflict(
  status: number | null,
  message: string,
): boolean {
  return (
    message.includes("ท่านไม่สามารถบันทึกลงเวลางานได้ เนื่องจาก") ||
    message.includes("กำลังเข้าตรวจหน่วยงานนี้") ||
    message.includes("จุดนี้อยู่ระหว่างการเข้าตรวจโดยรหัสพนักงาน") ||
    (status === 409 && message.includes("เข้าตรวจ"))
  );
}

function splitUnitName(unitName: string) {
  const cleanUnitName = unitName.trim();

  const parts = cleanUnitName
    .split("-")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length <= 1) {
    return {
      contractCode: cleanUnitName,
      locationName: cleanUnitName,
    };
  }

  const firstPart = parts[0] ?? cleanUnitName;
  const secondPart = parts[1] ?? "";

  /**
   * รองรับกรณี contract_code มีขีด เช่น:
   * ท046-2-ทีโอเอ (22)
   *
   * ต้องได้:
   * contractCode = ท046-2
   * locationName = ทีโอเอ (22)
   */
  const secondPartIsCodeSuffix = parts.length >= 3 && /^\d+$/.test(secondPart);

  const contractCode = secondPartIsCodeSuffix
    ? `${firstPart}-${secondPart}`
    : firstPart;

  const locationName = secondPartIsCodeSuffix
    ? parts.slice(2).join("-").trim()
    : parts.slice(1).join("-").trim();

  return {
    contractCode,
    locationName: locationName || contractCode,
  };
}

export default function Checkpoint({
  empCode,
  displayName,
  regionLabel,
  districtLabel,
  routeLabel,
  restoreDivisionId,
  restoreRouteId,
  onPatrolAreaChange,
  onBack,
  onGoCheckInOut,
}: Props) {
  const [checkRows, setCheckRows] = useState<CheckRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [setting, setSetting] = useState<AttendanceLocationSetting | null>(
    null,
  );
  const [settingLoading, setSettingLoading] = useState(true);

  const [isCallModalOpen, setIsCallModalOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<CheckRow | null>(null);
  const [contactDetail, setContactDetail] = useState("");
  const [callNote, setCallNote] = useState("");
  const [callStatus, setCallStatus] = useState<CallStatus>(1);

  const [selectedShift, setSelectedShift] = useState<ShiftType>(() =>
    getCurrentShiftTypeByTime(new Date()),
  );
  const [currentDate, setCurrentDate] = useState(() => new Date());

  const [isSavingCall, setIsSavingCall] = useState(false);
  const [isSavingReservation, setIsSavingReservation] = useState(false);
  const [isCancellingReservation, setIsCancellingReservation] =
    useState(false);
  const [takeoverRow, setTakeoverRow] = useState<CheckRow | null>(null);
  const [isTakingOver, setIsTakingOver] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);

  const [patrolAreaOptions, setPatrolAreaOptions] = useState<
    CheckpointAreaOptionResponse[]
  >([]);
  const [isAreaOptionsLoading, setIsAreaOptionsLoading] = useState(false);
  const [selectedPatrolArea, setSelectedPatrolArea] =
    useState<CheckpointAreaOptionResponse | null>(null);
  const [draftDivisionId, setDraftDivisionId] = useState<number | null>(null);
  const [draftRouteId, setDraftRouteId] = useState<number | null>(null);
  const [pendingPatrolArea, setPendingPatrolArea] =
    useState<CheckpointAreaOptionResponse | null>(null);
  const [isAreaConfirmModalOpen, setIsAreaConfirmModalOpen] = useState(false);

  const isReservationActionLoading =
    isSavingReservation || isCancellingReservation || isTakingOver;

  const [isCheckingLocation, setIsCheckingLocation] = useState(false);
  const [outOfAreaOpen, setOutOfAreaOpen] = useState(false);
  const [outOfAreaHint, setOutOfAreaHint] = useState("");

  /**
   * เก็บเฉพาะแถวที่ผู้ใช้กดและ Backend ยืนยันว่าอยู่นอกพื้นที่
   * จึงไม่มีการจองทุกแถวพร้อมกัน
   */
  const [reservationRow, setReservationRow] = useState<CheckRow | null>(null);

  const [checkpointInProgressMessage, setCheckpointInProgressMessage] =
    useState("");

  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const [mapLocation, setMapLocation] = useState<CheckpointMapLocation | null>(
    null,
  );
  const [mapLoading, setMapLoading] = useState(false);
  const [mapErrorMessage, setMapErrorMessage] = useState<string | null>(null);

  const currentShift = useMemo(
    () => getCurrentShiftTypeByTime(currentDate),
    [currentDate],
  );

  useEffect(() => {
    const normalizedEmployeeCode = empCode.trim();

    if (!normalizedEmployeeCode) {
      setPatrolAreaOptions([]);
      setSelectedPatrolArea(null);
      setDraftDivisionId(null);
      setDraftRouteId(null);
      setIsAreaOptionsLoading(false);
      return;
    }

    let cancelled = false;

    async function loadAreaOptions() {
      try {
        setIsAreaOptionsLoading(true);

        const areaOptions = await getCheckpointAreaOptions({
          employeeCode: normalizedEmployeeCode,
        });

        if (cancelled) {
          return;
        }

        setPatrolAreaOptions(areaOptions);

        const homeArea = areaOptions.find((option) => option.is_home) ?? null;

        /**
         * ถ้า App.tsx จำเขต / เส้นทางล่าสุดไว้
         * ให้ restore พื้นที่นั้นก่อน
         *
         * ถ้าไม่มีค่าที่จำไว้
         * จึงใช้พื้นที่ประจำ is_home ตามเดิม
         */
        const restoredArea =
          restoreDivisionId != null && restoreRouteId != null
            ? areaOptions.find(
                (option) =>
                  option.division_id === restoreDivisionId &&
                  option.route_id === restoreRouteId,
              ) ?? null
            : null;

        const initialArea = restoredArea ?? homeArea;

        setSelectedPatrolArea(initialArea);
        setDraftDivisionId(initialArea?.division_id ?? null);
        setDraftRouteId(initialArea?.route_id ?? null);
      } catch (error) {
        logDevError("[Checkpoint] LOAD AREA OPTIONS ERROR", error);

        if (!cancelled) {
          // ถ้าโหลดตัวเลือกพื้นที่ไม่ได้ ให้ระบบงานประจำเดิมยังทำงานต่อได้
          setPatrolAreaOptions([]);
          setSelectedPatrolArea(null);
          setDraftDivisionId(null);
          setDraftRouteId(null);
        }
      } finally {
        if (!cancelled) {
          setIsAreaOptionsLoading(false);
        }
      }
    }

    void loadAreaOptions();

    return () => {
      cancelled = true;
    };
  }, [empCode, restoreDivisionId, restoreRouteId]);

  const divisionOptions = useMemo(() => {
    const divisionMap = new Map<number, string>();

    patrolAreaOptions.forEach((option) => {
      if (!divisionMap.has(option.division_id)) {
        divisionMap.set(option.division_id, option.division_name);
      }
    });

    return [...divisionMap.entries()].map(([divisionId, divisionName]) => ({
      divisionId,
      divisionName,
    }));
  }, [patrolAreaOptions]);

  const routeOptions = useMemo(
    () =>
      draftDivisionId === null
        ? []
        : patrolAreaOptions.filter(
            (option) => option.division_id === draftDivisionId,
          ),
    [draftDivisionId, patrolAreaOptions],
  );

  /**
   * พื้นที่ประจำยังใช้ข้อความเดิมจาก Home/App ตามเดิม
   * เมื่อยืนยันพื้นที่อื่นแล้วจึงเปลี่ยนเฉพาะข้อความเขต/เส้นทางบนหน้า Checkpoint
   */
  const patrolAreaValues = useMemo(() => {
    const areaValues =
      selectedPatrolArea && !selectedPatrolArea.is_home
        ? [
            regionLabel,
            selectedPatrolArea.division_name,
            selectedPatrolArea.route_name,
          ]
        : [regionLabel, districtLabel, routeLabel];

    return areaValues
      .map((value) => value?.trim() || "")
      .filter(Boolean);
  }, [districtLabel, regionLabel, routeLabel, selectedPatrolArea]);

  const selectedWorkDate = useMemo(
    () => getCheckpointWorkDate(currentDate, selectedShift),
    [currentDate, selectedShift],
  );

  const selectedWorkDateText = useMemo(
    () => formatApiDate(selectedWorkDate),
    [selectedWorkDate],
  );

  const currentDateText = useMemo(
    () => formatApiDate(currentDate),
    [currentDate],
  );

  const shiftText = getShiftText(selectedShift);
  const currentShiftText = getShiftText(currentShift);
  const isSelectedCurrentShift = selectedShift === currentShift;
  const isShowingPreviousDayShift =
    selectedShift === "day" && selectedWorkDateText !== currentDateText;

  const selectedShiftMismatchMessage = !isSelectedCurrentShift
    ? isShowingPreviousDayShift
      ? "ขณะนี้ยังไม่ถึงเวลาเปิดรอบผลัดกลางวันใหม่ ระบบแสดงรายการผลัดกลางวันของเมื่อวาน และไม่สามารถทำรายการได้"
      : `ไม่ใช่ผลัดปัจจุบัน ทำรายการไม่ได้ ขณะนี้เป็น${currentShiftText}`
    : "";

  const orderedCheckRows = useMemo(() => {
    return [...checkRows].sort((a, b) => {
      const statusDifference =
        statusOrder[a.status] - statusOrder[b.status];

      if (statusDifference !== 0) {
        return statusDifference;
      }

      // รายการตรวจแทนให้อยู่ก่อน pending ปกติ
      if (a.status === "pending" && b.status === "pending") {
        return (
          Number(b.isTakeoverPending) -
          Number(a.isTakeoverPending)
        );
      }

      return 0;
    });
  }, [checkRows]);

  const fetchCheckpointAssignments = useCallback(async () => {
    const normalizedEmpCode = empCode.trim();

    if (!normalizedEmpCode) {
      setCheckRows([]);
      setErrorMessage("ไม่พบรหัสพนักงาน กรุณาเข้าสู่ระบบใหม่");
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage("");

      const workDate = selectedWorkDateText;

      const selectedAreaOverride =
        selectedPatrolArea && !selectedPatrolArea.is_home
          ? selectedPatrolArea
          : null;

      logDev("[Checkpoint] FETCH ASSIGNMENTS", {
        workDate,
        selectedShift,
        currentShift,
        divisionId: selectedAreaOverride?.division_id ?? null,
        routeId: selectedAreaOverride?.route_id ?? null,
      });

      const data = await getDailyCheckpointAssignments({
        workDate,
        shiftType: selectedShift,
        employeeCode: normalizedEmpCode,
        divisionId: selectedAreaOverride?.division_id,
        routeId: selectedAreaOverride?.route_id,
      });

      setCheckRows(mapDailyRowsToCheckRows(data));
    } catch (error) {
      setCheckRows([]);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "เกิดข้อผิดพลาดในการโหลดตารางงานสายตรวจ",
      );
    } finally {
      setIsLoading(false);
    }
  }, [
    currentShift,
    empCode,
    selectedPatrolArea,
    selectedShift,
    selectedWorkDateText,
  ]);

  const fetchLatestLocationSetting =
    useCallback(async (): Promise<AttendanceLocationSetting | null> => {
      try {
        const data = await getAttendanceLocationSetting();

        setSetting(data);

        logDev("[Checkpoint] LATEST LOCATION SETTING", {
          geoSetting: data.geo,
        });

        return data;
      } catch (error) {
        logDevError("[Checkpoint] LOAD LATEST LOCATION SETTING ERROR", error);

        return null;
      }
    }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadSetting() {
      setSettingLoading(true);

      try {
        const data = await getAttendanceLocationSetting();

        if (!cancelled) {
          setSetting(data);
        }
      } catch (error) {
        logDevError("load checkpoint location setting error:", error);

        if (!cancelled) {
          setSetting(null);
          setErrorMessage("โหลดค่าตรวจสอบตำแหน่งไม่สำเร็จ");
        }
      } finally {
        if (!cancelled) {
          setSettingLoading(false);
        }
      }
    }

    void loadSetting();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentDate(new Date());
    }, 1_000);

    return () => window.clearInterval(timer);
  }, []);

  /**
   * เลือกปุ่ม Radio ผลัดตามเวลาปัจจุบันอัตโนมัติ
   *
   * 08:00:01 - 20:00:00 = ผลัดกลางวัน
   * 20:00:01 - 08:00:00 = ผลัดกลางคืน
   */
  useEffect(() => {
    setSelectedShift(currentShift);
  }, [currentShift]);

  useEffect(() => {
    void fetchCheckpointAssignments();
  }, [fetchCheckpointAssignments]);
  useEffect(() => {
    const refreshWhenPageActive = () => {
      if (document.visibilityState === "visible") {
        void fetchCheckpointAssignments();
        void fetchLatestLocationSetting();
      }
    };

    window.addEventListener("focus", refreshWhenPageActive);
    document.addEventListener("visibilitychange", refreshWhenPageActive);

    return () => {
      window.removeEventListener("focus", refreshWhenPageActive);
      document.removeEventListener("visibilitychange", refreshWhenPageActive);
    };
  }, [fetchCheckpointAssignments, fetchLatestLocationSetting]);

  const resetCallForm = () => {
    setContactDetail("");
    setCallNote("");
    setCallStatus(1);
  };

  const openOutOfAreaModal = (message: string) => {
    setOutOfAreaHint(message);
    setOutOfAreaOpen(true);
  };

  const closeOutOfAreaModal = () => {
    if (isReservationActionLoading) {
      return;
    }

    setOutOfAreaOpen(false);
    setOutOfAreaHint("");
    setReservationRow(null);
  };

  const openCheckpointInProgressModal = (message: string) => {
    setOutOfAreaOpen(false);
    setOutOfAreaHint("");
    setReservationRow(null);
    setCheckpointInProgressMessage(message);
  };

  const openReservationConflictModal = ({
    employeeCode,
    employeeName,
    message,
  }: {
    employeeCode: string | null;
    employeeName: string | null;
    message?: string;
  }) => {
    const reservationMessage =
      message ||
      [
        "ท่านไม่สามารถเข้าตรวจหน่วยงานนี้ได้ เนื่องจาก",
        `${employeeCode ?? "-"} ${employeeName ?? "-"}`.trim(),
        "ได้จองเข้าตรวจหน่วยงานนี้แล้ว",
        "",
        "กรุณาเลือกหน่วยงานอื่น",
      ].join("\n");

    openCheckpointInProgressModal(reservationMessage);
  };

  const closeCheckpointInProgressModal = () => {
    setCheckpointInProgressMessage("");
    void fetchCheckpointAssignments();
  };

  const showLocationFailModal = (message: string) => {
    /**
     * ปิด LoadingModal ก่อน แล้วค่อยเปิด OutOfAreaModal
     * กันเคส modal ถูก LoadingModal ทับ หรือ state ชนกัน
     */
    setIsCheckingLocation(false);

    window.setTimeout(() => {
      openOutOfAreaModal(message);
    }, 0);
  };

  const openCallModal = (row: CheckRow) => {
    if (!isSelectedCurrentShift) {
      openOutOfAreaModal(selectedShiftMismatchMessage);
      return;
    }

    setSelectedRow(row);
    resetCallForm();
    setIsCallModalOpen(true);
  };

  const closeCallModal = () => {
    setIsCallModalOpen(false);
    setSelectedRow(null);
    resetCallForm();
  };

  const handleRefresh = () => {
    void fetchCheckpointAssignments();
    void fetchLatestLocationSetting();
  };

  const handleDivisionChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextDivisionId = normalizePositiveId(event.target.value);

    setDraftDivisionId(nextDivisionId);
    setDraftRouteId(null);
    setPendingPatrolArea(null);
    setIsAreaConfirmModalOpen(false);
  };

  const handleRouteChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextRouteId = normalizePositiveId(event.target.value);

    setDraftRouteId(nextRouteId);

    if (draftDivisionId === null || nextRouteId === null) {
      setPendingPatrolArea(null);
      setIsAreaConfirmModalOpen(false);
      return;
    }

    const nextArea = patrolAreaOptions.find(
      (option) =>
        option.division_id === draftDivisionId &&
        option.route_id === nextRouteId,
    );

    if (!nextArea) {
      setErrorMessage("ไม่พบข้อมูลเขตและเส้นทางที่เลือก");
      return;
    }

    const isCurrentArea =
      selectedPatrolArea?.division_id === nextArea.division_id &&
      selectedPatrolArea?.route_id === nextArea.route_id;

    if (isCurrentArea) {
      return;
    }

    setPendingPatrolArea(nextArea);
    setIsAreaConfirmModalOpen(true);
  };

  const closeAreaConfirmModal = () => {
    setIsAreaConfirmModalOpen(false);
    setPendingPatrolArea(null);
    setDraftDivisionId(selectedPatrolArea?.division_id ?? null);
    setDraftRouteId(selectedPatrolArea?.route_id ?? null);
  };

  const confirmPatrolArea = () => {
    if (!pendingPatrolArea) {
      return;
    }

    const nextArea = pendingPatrolArea;

    setSelectedPatrolArea(nextArea);
    setDraftDivisionId(nextArea.division_id);
    setDraftRouteId(nextArea.route_id);

    /**
     * ให้ App.tsx จำพื้นที่ล่าสุดที่ผู้ใช้ยืนยันเลือก
     * เพื่อให้หลัง Check-in / Check-out แล้วกลับมา
     * ยังคงอยู่เขต / เส้นทางเดิม
     */
    onPatrolAreaChange?.(
      nextArea.division_id,
      nextArea.route_id,
    );

    setCheckRows([]);
    setErrorMessage("");
    setPendingPatrolArea(null);
    setIsAreaConfirmModalOpen(false);
  };

  const openCheckpointMapModal = async (row: CheckRow) => {
    const { contractCode, locationName } = splitUnitName(row.unitName);

    logDev("[Checkpoint] MAP LOCATION REQUEST", {
      assignmentId: row.assignmentId,
      unitName: row.unitName,
      contractCode,
      locationName,
    });

    setIsMapModalOpen(true);
    setMapLoading(true);
    setMapLocation(null);
    setMapErrorMessage(null);

    try {
      const data = await getCheckpointMapLocation({
        contractCode,
        locationName,
      });

      logDev("[Checkpoint] MAP LOCATION RESULT", {
        row,
        contractCode,
        locationName,
        data,
      });

      const mapData = data as typeof data & {
        location_detail?: string | null;
      };

      setMapLocation({
        contractCode: mapData.contract_code,
        locationName: mapData.location_name,
        latitude: mapData.latitude,
        longitude: mapData.longitude,
        radiusMeter: mapData.radius_meter,
        graceMeter: mapData.grace_meter,
        locationDetail: mapData.location_detail ?? null,
      });
    } catch (error) {
      logDevError("[Checkpoint] LOAD MAP LOCATION ERROR", error);

      setMapLocation({
        contractCode,
        locationName,
        latitude: null,
        longitude: null,
        radiusMeter: null,
        graceMeter: null,
        locationDetail: null,
      });

      setMapErrorMessage(
        error instanceof Error
          ? error.message
          : "โหลดพิกัดหน่วยงานไม่สำเร็จ",
      );
    } finally {
      setMapLoading(false);
    }
  };

  const closeCheckpointMapModal = () => {
    setIsMapModalOpen(false);
    setMapLocation(null);
    setMapErrorMessage(null);
    setMapLoading(false);
  };

  const checkLocationBeforeGoCheckInOut = async (
    row: CheckRow,
  ): Promise<PassedLocation | null> => {
    if (isCheckingLocation) {
      showLocationFailModal("ระบบกำลังตรวจสอบตำแหน่งอยู่ กรุณารอสักครู่");
      return null;
    }

    try {
      setIsCheckingLocation(true);
      setOutOfAreaHint("");
      setOutOfAreaOpen(false);
      setReservationRow(null);

      const latestSetting = await fetchLatestLocationSetting();
      const activeSetting = latestSetting ?? setting;

      if (!activeSetting) {
        logDevError("[Checkpoint] LOCATION SETTING NOT FOUND", {
          assignmentId: row.assignmentId,
          unitName: row.unitName,
          shiftId: row.actionShiftId,
          row,
        });

        showLocationFailModal(
          "ยังไม่พบค่าตั้งค่าการตรวจสอบตำแหน่ง กรุณาลองใหม่อีกครั้ง",
        );
        return null;
      }

      const pos = await getBestPositionAsync({
        desiredAccuracyM: activeSetting.geo.desiredAccuracyM,
        watchWindowMs: activeSetting.geo.watchWindowMs,
        hardTimeoutMs: activeSetting.geo.hardTimeoutMs,
      });

      const currentLatitude = pos.coords.latitude;
      const currentLongitude = pos.coords.longitude;

      const currentAccuracy = Number.isFinite(pos.coords.accuracy)
        ? pos.coords.accuracy
        : Number.POSITIVE_INFINITY;

      const roundedAccuracy = Number.isFinite(currentAccuracy)
        ? Math.round(currentAccuracy)
        : 999999;

      const currentLocation = {
        latitude: currentLatitude,
        longitude: currentLongitude,
        accuracy: roundedAccuracy,
      };

      if (currentAccuracy > activeSetting.geo.maxAccuracyM) {
        const message = `สัญญาณ GPS ยังไม่ดี ค่าความคลาดเคลื่อนประมาณ ${roundedAccuracy} เมตร กรุณาไปที่โล่งหรือเปิด Wi-Fi แล้วตรวจสอบตำแหน่งอีกครั้ง`;

        logDevError("[Checkpoint] GPS ACCURACY TOO HIGH", {
          message,
          assignmentId: row.assignmentId,
          unitName: row.unitName,
          shiftId: row.actionShiftId,
          currentLocation,
          currentAccuracy,
          roundedAccuracy,
          geoSetting: activeSetting.geo,
          maxAccuracyM: activeSetting.geo.maxAccuracyM,
        });

        showLocationFailModal(message);
        return null;
      }

      const verifyPayload = {
        assignment_id: row.assignmentId,
        unit_name: row.unitName,
        latitude: currentLatitude,
        longitude: currentLongitude,
        accuracy: roundedAccuracy,
      };

      logDev("VERIFY CHECKPOINT LOCATION PAYLOAD", verifyPayload);

      const verifyResult = await verifyCheckpointLocation(verifyPayload);

      logDev("VERIFY CHECKPOINT LOCATION RESULT", verifyResult);

      if (!verifyResult || typeof verifyResult.allowed !== "boolean") {
        logDevError("[Checkpoint] VERIFY LOCATION INVALID RESPONSE", {
          assignmentId: row.assignmentId,
          unitName: row.unitName,
          shiftId: row.actionShiftId,
          verifyPayload,
          verifyResult,
        });

        showLocationFailModal(
          "ตรวจสอบพื้นที่กับระบบไม่สำเร็จ ผลลัพธ์จาก backend ไม่ถูกต้อง",
        );
        return null;
      }

      if (!verifyResult.allowed) {
        const distanceMeter =
          typeof verifyResult.distance_meter === "number"
            ? verifyResult.distance_meter
            : null;

        const distanceText =
          distanceMeter !== null
            ? ` ระยะห่างประมาณ ${formatDistanceMeter(
                distanceMeter,
              )} จากจุดตรวจที่เลือก`
            : "";

        const baseMessage =
          verifyResult.message || "คุณอยู่นอกพื้นที่ที่กำหนด";

        const message =
          distanceText && !baseMessage.includes("ระยะห่าง")
            ? `${baseMessage}${distanceText}`
            : baseMessage;

        logDevError("[Checkpoint] OUT OF AREA", {
          message,
          assignmentId: row.assignmentId,
          unitName: row.unitName,
          shiftId: row.actionShiftId,
          currentLocation,
          geoSetting: activeSetting.geo,
          distanceMeter,
          distanceText:
            distanceMeter !== null ? formatDistanceMeter(distanceMeter) : null,
          verifyPayload,
          verifyResult,
        });

        /**
         * เมื่อ Backend ยืนยันว่าอยู่นอกพื้นที่จริง:
         * - ยังไม่มีผู้จอง: แสดงปุ่มสีเหลือง "ยืนยันการเข้าตรวจ"
         * - ผู้ใช้ปัจจุบันเป็นผู้จอง: แสดงปุ่มสีแดง "ยกเลิกการเข้าตรวจ"
         * - ผู้ใช้อื่นเป็นผู้จอง: ไม่แสดงปุ่มจองหรือปุ่มยกเลิก
         */
        const normalizedCurrentEmployeeCode = empCode.trim();
        const normalizedReservedBy = row.reservedBy?.trim() || null;

        const isNotReserved = normalizedReservedBy === null;
        const isReservedByCurrentEmployee =
          normalizedReservedBy === normalizedCurrentEmployeeCode;

        if (
          row.assignmentStatus === "pending" &&
          !row.isTakeoverPending &&
          (isNotReserved || isReservedByCurrentEmployee)
        ) {
          setReservationRow(row);
        } else {
          setReservationRow(null);
        }

        showLocationFailModal(message);
        return null;
      }

      return {
        latitude: currentLatitude,
        longitude: currentLongitude,
        accuracy: roundedAccuracy,
      };
    } catch (error: any) {
      const status = getRequestErrorStatus(error);

      const apiDetail =
        error?.response?.data?.detail ??
        error?.data?.detail ??
        error?.message ??
        "";

      const message = typeof apiDetail === "string" ? apiDetail : "";

      logDevError("[Checkpoint] VERIFY LOCATION ERROR", {
        assignmentId: row.assignmentId,
        unitName: row.unitName,
        shiftId: row.actionShiftId,
        status,
        message,
        error,
      });

      if (isCheckpointInProgressConflict(status, message)) {
        openCheckpointInProgressModal(
          message ||
            [
              "ท่านไม่สามารถบันทึกลงเวลางานได้ เนื่องจาก",
              "- -",
              "กำลังเข้าตรวจหน่วยงานนี้",
              "",
              'หากมีความจำเป็น ให้ไปใช้เมนูเข้าพื้นที่ "ติดตาม / มอบหมาย"',
            ].join("\n"),
        );
        return null;
      }

      if (status === 405 || message.includes("405")) {
        showLocationFailModal(
          "Backend ยังไม่มี POST /api/checkpoint-assignments/verify-location กรุณาเพิ่ม endpoint ตรวจสอบตำแหน่งในฝั่ง backend ก่อน",
        );
        return null;
      }

      if (status === 400 || status === 404 || status === 422) {
        showLocationFailModal(
          message ||
            "ตรวจสอบพื้นที่ไม่ผ่าน กรุณาตรวจสอบพิกัดหรือข้อมูลหน่วยงานของรายการนี้",
        );
        return null;
      }

      if (error?.code === 1) {
        showLocationFailModal(
          "ไม่อนุญาตให้เข้าถึงตำแหน่ง กรุณาเปิด Location และอนุญาตสิทธิ์ตำแหน่ง",
        );
        return null;
      }

      if (
        String(error?.message).includes("unavailable") ||
        String(message).includes("unavailable")
      ) {
        showLocationFailModal("อุปกรณ์หรือเบราว์เซอร์ไม่รองรับการอ่านตำแหน่ง");
        return null;
      }

      if (
        String(error?.message).toLowerCase().includes("timeout") ||
        String(message).toLowerCase().includes("timeout")
      ) {
        showLocationFailModal(
          "อ่านตำแหน่ง GPS ไม่สำเร็จภายในเวลาที่กำหนด กรุณาลองใหม่อีกครั้ง",
        );
        return null;
      }

      showLocationFailModal(
        message ||
          "ตรวจสอบตำแหน่งไม่ผ่าน กรุณาลองใหม่อีกครั้ง หรือแจ้งผู้ดูแลระบบตรวจพิกัดของหน่วยงานนี้",
      );

      return null;
    } finally {
      setIsCheckingLocation(false);
    }
  };

  const handleReserveFromOutOfAreaModal = async () => {
    if (!reservationRow || isReservationActionLoading) {
      return;
    }

    const normalizedEmpCode = empCode.trim();

    if (!normalizedEmpCode) {
      setOutOfAreaHint("ไม่พบรหัสพนักงาน กรุณาเข้าสู่ระบบใหม่");
      return;
    }

    /**
     * เก็บ assignmentId ของแถวที่กดไว้ก่อน await
     * เพื่อยืนยันว่าจองเพียงหน่วยงานเดียว
     */
    const targetAssignmentId = reservationRow.assignmentId;
    const targetUnitName = reservationRow.unitName;

    try {
      setIsSavingReservation(true);

      logDev("[Checkpoint] RESERVE FROM OUT OF AREA MODAL", {
        assignmentId: targetAssignmentId,
        unitName: targetUnitName,
        employeeCode: normalizedEmpCode,
      });

      await reserveCheckpointAssignment({
        assignmentId: targetAssignmentId,
        employeeCode: normalizedEmpCode,
      });

      setOutOfAreaOpen(false);
      setOutOfAreaHint("");
      setReservationRow(null);

      await fetchCheckpointAssignments();
    } catch (error: any) {
      logDevError("[Checkpoint] RESERVE FROM OUT OF AREA MODAL ERROR", {
        assignmentId: targetAssignmentId,
        unitName: targetUnitName,
        employeeCode: normalizedEmpCode,
        error,
      });

      const status = getRequestErrorStatus(error);
      const detail = getRequestErrorDetail(error);

      if (status === 409) {
        setOutOfAreaOpen(false);
        setOutOfAreaHint("");
        setReservationRow(null);

        openReservationConflictModal({
          employeeCode: detail.employeeCode,
          employeeName: detail.employeeName,
          message: detail.message,
        });

        await fetchCheckpointAssignments();
        return;
      }

      setOutOfAreaHint(
        detail.message ||
          `ไม่สามารถจองหน่วยงาน ${targetUnitName} ได้ กรุณาลองใหม่อีกครั้ง`,
      );
    } finally {
      setIsSavingReservation(false);
    }
  };

  const handleCancelReservationFromOutOfAreaModal = async () => {
    if (!reservationRow || isReservationActionLoading) {
      return;
    }

    const normalizedEmpCode = empCode.trim();
    const normalizedReservedBy = reservationRow.reservedBy?.trim() || null;

    if (!normalizedEmpCode) {
      setOutOfAreaHint("ไม่พบรหัสพนักงาน กรุณาเข้าสู่ระบบใหม่");
      return;
    }

    if (normalizedReservedBy !== normalizedEmpCode) {
      setOutOfAreaOpen(false);
      setOutOfAreaHint("");
      setReservationRow(null);

      openCheckpointInProgressModal(
        "ไม่สามารถยกเลิกการเข้าตรวจได้ เนื่องจากท่านไม่ได้เป็นผู้จองรายการนี้",
      );

      await fetchCheckpointAssignments();
      return;
    }

    const targetAssignmentId = reservationRow.assignmentId;
    const targetUnitName = reservationRow.unitName;

    try {
      setIsCancellingReservation(true);

      logDev("[Checkpoint] CANCEL RESERVATION FROM OUT OF AREA MODAL", {
        assignmentId: targetAssignmentId,
        unitName: targetUnitName,
        employeeCode: normalizedEmpCode,
      });

      await cancelCheckpointAssignmentReservation({
        assignmentId: targetAssignmentId,
        employeeCode: normalizedEmpCode,
      });

      /**
       * อัปเดตสีปุ่มในตารางทันทีให้กลับเป็นสีขาว
       * โดยคงข้อความ "รอดำเนินการเข้าตรวจ" ตามเดิม
       */
      setCheckRows((currentRows) =>
        currentRows.map((row) =>
          row.assignmentId === targetAssignmentId
            ? {
                ...row,
                reservedBy: null,
                reservedByName: null,
                reservedAt: null,
              }
            : row,
        ),
      );

      setOutOfAreaOpen(false);
      setOutOfAreaHint("");
      setReservationRow(null);

      await fetchCheckpointAssignments();
    } catch (error: any) {
      logDevError(
        "[Checkpoint] CANCEL RESERVATION FROM OUT OF AREA MODAL ERROR",
        {
          assignmentId: targetAssignmentId,
          unitName: targetUnitName,
          employeeCode: normalizedEmpCode,
          error,
        },
      );

      const detail = getRequestErrorDetail(error);

      setOutOfAreaOpen(false);
      setOutOfAreaHint("");
      setReservationRow(null);

      openCheckpointInProgressModal(
        detail.message ||
          `ไม่สามารถยกเลิกการเข้าตรวจหน่วยงาน ${targetUnitName} ได้ กรุณาลองใหม่อีกครั้ง`,
      );

      await fetchCheckpointAssignments();
    } finally {
      setIsCancellingReservation(false);
    }
  };

  const closeTakeoverConfirmModal = () => {
    if (isTakingOver) {
      return;
    }

    setTakeoverRow(null);
  };

  const handleConfirmTakeover = async () => {
    if (!takeoverRow || isTakingOver) {
      return;
    }

    const sourceRow = takeoverRow;
    const normalizedEmpCode = empCode.trim();

    if (!normalizedEmpCode) {
      setTakeoverRow(null);
      openCheckpointInProgressModal(
        "ไม่พบรหัสพนักงาน กรุณาเข้าสู่ระบบใหม่",
      );
      return;
    }

    if (!sourceRow.actionShiftId) {
      setTakeoverRow(null);
      openCheckpointInProgressModal(
        "ไม่พบข้อมูลผลัดของตารางงานสายตรวจ กรุณาติดต่อผู้ดูแลระบบ",
      );
      return;
    }

    try {
      setIsTakingOver(true);

      logDev("[Checkpoint] TAKEOVER REQUEST", {
        previousAssignmentId: sourceRow.assignmentId,
        employeeCode: normalizedEmpCode,
        unitName: sourceRow.unitName,
      });

      const result = await takeoverCheckpointAssignment({
        assignmentId: sourceRow.assignmentId,
        updatedBy: normalizedEmpCode,
      });

      const currentAssignmentId = normalizePositiveId(
        result.current_assignment.assignment_id,
      );

      if (!currentAssignmentId) {
        throw new Error(
          "Backend ไม่ได้ส่งรหัส Assignment ของวันปัจจุบันกลับมา",
        );
      }

      const currentRow: CheckRow = {
        ...sourceRow,
        assignmentId: currentAssignmentId,
        assignmentStatus: "pending",
        status: "pending",
        inProgressEmployeeCode: null,
        inProgressEmployeeName: null,
        canTakeover: false,

        isTakeoverPending: true,
        takeoverBy: normalizedEmpCode,

        reservedBy: null,
        reservedByName: null,
        reservedAt: null,
      };

      setTakeoverRow(null);

      const passedLocation = await checkLocationBeforeGoCheckInOut(currentRow);

      if (!passedLocation) {
        logDevError(
          "[Checkpoint] TAKEOVER LOCATION NOT PASSED",
          {
            previousAssignmentId: sourceRow.assignmentId,
            currentAssignmentId,
            employeeCode: normalizedEmpCode,
          },
        );
        await fetchCheckpointAssignments();
        return;
      }

      logDev("[Checkpoint] TAKEOVER GO CHECKINOUT PAGE", {
        previousAssignmentId: sourceRow.assignmentId,
        currentAssignmentId,
        employeeCode: normalizedEmpCode,
        unitName: sourceRow.unitName,
      });

      onGoCheckInOut({
        assignmentId: currentAssignmentId,
        unitName: sourceRow.unitName,
        patrolAreaValues,
        shiftId: sourceRow.actionShiftId,
        mode: "checkin",
        passedLocation,
      });
    } catch (error: any) {
      logDevError("[Checkpoint] TAKEOVER ERROR", {
        previousAssignmentId: sourceRow.assignmentId,
        employeeCode: normalizedEmpCode,
        unitName: sourceRow.unitName,
        error,
      });

      const detail = getRequestErrorDetail(error);

      setTakeoverRow(null);
      openCheckpointInProgressModal(
        detail.message ||
          `ไม่สามารถเข้าตรวจแทนหน่วยงาน ${sourceRow.unitName} ได้ กรุณาลองใหม่อีกครั้ง`,
      );

      await fetchCheckpointAssignments();
    } finally {
      setIsTakingOver(false);
    }
  };

  const handleGoCheckInOut = async (row: CheckRow) => {
    const normalizedEmpCode = empCode.trim();

    /**
     * สถานะ in_progress ไม่ได้แปลว่าผู้ใช้ปัจจุบันเป็นคนที่กดเข้าเสมอไป
     * ต้องเทียบรหัสผู้ถือ Assignment กับผู้ใช้ที่ล็อกอินอยู่ก่อน
     */
    const isInProgressByOtherEmployee =
      row.assignmentStatus === "in_progress" &&
      row.inProgressEmployeeCode !== normalizedEmpCode;

    if (isInProgressByOtherEmployee) {
      if (row.canTakeover) {
        logDev("[Checkpoint] OPEN TAKEOVER CONFIRM MODAL", {
          assignmentId: row.assignmentId,
          unitName: row.unitName,
          currentEmployeeCode: normalizedEmpCode,
          holderEmployeeCode: row.inProgressEmployeeCode,
          holderEmployeeName: row.inProgressEmployeeName,
        });

        setTakeoverRow(row);
        return;
      }

      const holderEmployeeCode = row.inProgressEmployeeCode ?? "-";
      const holderEmployeeName = row.inProgressEmployeeName ?? "-";

      const message = [
        "ท่านไม่สามารถบันทึกลงเวลางานได้ เนื่องจาก",
        `${holderEmployeeCode} ${holderEmployeeName}`,
        "กำลังเข้าตรวจหน่วยงานนี้",
        "",
        'หากมีความจำเป็น ให้ไปใช้เมนูเข้าพื้นที่ "ติดตาม / มอบหมาย"',
      ].join("\n");

      logDev("[Checkpoint] STOP: ASSIGNMENT IS HELD BY OTHER EMPLOYEE", {
        assignmentId: row.assignmentId,
        unitName: row.unitName,
        currentEmployeeCode: normalizedEmpCode,
        holderEmployeeCode,
        holderEmployeeName,
        row,
      });

      openCheckpointInProgressModal(message);
      return;
    }

    const isReservedByOtherEmployee =
      row.assignmentStatus === "pending" &&
      !row.isTakeoverPending &&
      Boolean(row.reservedBy) &&
      row.reservedBy !== normalizedEmpCode;

    if (isReservedByOtherEmployee) {
      openReservationConflictModal({
        employeeCode: row.reservedBy,
        employeeName: row.reservedByName,
      });
      return;
    }

    const mode =
      row.status === "pending"
        ? "checkin"
        : row.status === "progress"
          ? "checkout"
          : null;

    logDev("[Checkpoint] ACTION BUTTON CLICK", {
      assignmentId: row.assignmentId,
      unitName: row.unitName,
      shiftId: row.actionShiftId,
      rowStatus: row.status,
      assignmentStatus: row.assignmentStatus,
      canAction: row.canAction,
      isSelectedCurrentShift,
      selectedShift,
      currentShift,
      mode,
      row,
    });

    if (!mode) {
      logDevError("[Checkpoint] STOP BECAUSE MODE NOT ALLOWED", {
        assignmentId: row.assignmentId,
        unitName: row.unitName,
        rowStatus: row.status,
        assignmentStatus: row.assignmentStatus,
        row,
      });

      return;
    }

    if (!isSelectedCurrentShift) {
      logDevError("[Checkpoint] SELECTED SHIFT IS NOT CURRENT SHIFT", {
        selectedShift,
        currentShift,
        selectedShiftText: shiftText,
        currentShiftText,
        row,
      });

      openOutOfAreaModal(selectedShiftMismatchMessage);
      return;
    }

    if (!row.canAction) {
      logDevError("[Checkpoint] ACTION DISABLED BY SHIFT WINDOW", {
        assignmentId: row.assignmentId,
        unitName: row.unitName,
        shiftId: row.actionShiftId,
        reason: row.actionDisabledReason,
        shiftStartTime: row.shiftStartTime,
        shiftEndTime: row.shiftEndTime,
        crossesMidnight: row.crossesMidnight,
        row,
      });

      openOutOfAreaModal(
        row.actionDisabledReason || "ยังไม่ถึงช่วงเวลาที่อนุญาตให้เข้าตรวจ",
      );
      return;
    }

    if (!row.actionShiftId) {
      logDevError("[Checkpoint] SHIFT ID NOT FOUND", {
        assignmentId: row.assignmentId,
        unitName: row.unitName,
        row,
      });

      openOutOfAreaModal(
        "ไม่พบข้อมูลผลัดของตารางงานสายตรวจ กรุณาติดต่อผู้ดูแลระบบ",
      );
      return;
    }

    const passedLocation = await checkLocationBeforeGoCheckInOut(row);

    logDev("[Checkpoint] PASSED LOCATION RESULT", {
      assignmentId: row.assignmentId,
      unitName: row.unitName,
      shiftId: row.actionShiftId,
      mode,
      passedLocation,
    });

    if (!passedLocation) {
      logDevError("[Checkpoint] STOP GO CHECKINOUT BECAUSE LOCATION NOT PASSED", {
        assignmentId: row.assignmentId,
        unitName: row.unitName,
        shiftId: row.actionShiftId,
        mode,
      });

      return;
    }

    logDev("[Checkpoint] GO CHECKINOUT PAGE", {
      assignmentId: row.assignmentId,
      unitName: row.unitName,
      shiftId: row.actionShiftId,
      mode,
      passedLocation,
    });

    onGoCheckInOut({
      assignmentId: row.assignmentId,
      unitName: row.unitName,
      patrolAreaValues,
      shiftId: row.actionShiftId,
      mode,
      passedLocation,
    });
  };

  const updateRowAfterSaveCall = (
    assignmentId: number,
    savedCallStatus: CallStatus,
  ) => {
    setCheckRows((currentRows) =>
      currentRows.map((row) => {
        if (row.assignmentId !== assignmentId) {
          return row;
        }

        if (savedCallStatus === 3) {
          return {
            ...row,
            hasCall: true,
            latestCallStatus: 3,
            status:
              row.assignmentStatus === "completed"
                ? "doneCall"
                : mapAssignmentStatusOnly(row.assignmentStatus),
          };
        }

        return {
          ...row,
          assignmentStatus: "completed",
          hasCall: true,
          latestCallStatus: savedCallStatus,
          status: savedCallStatus === 2 ? "abnormalCall" : "doneCall",
        };
      }),
    );
  };

  const handleSuccessOk = () => {
    setIsSuccessModalOpen(false);
  };

  const handleSaveCallDetail = async (
    payload: CheckpointCallModalSavePayload,
  ) => {
    if (!selectedRow?.assignmentId || isSavingCall) {
      return;
    }

    if (!isSelectedCurrentShift) {
      openOutOfAreaModal(selectedShiftMismatchMessage);
      return;
    }

    const contactDetailText = payload.contactDetail.trim();
    const callNoteText = payload.callNote.trim();

    if (!contactDetailText && !callNoteText) {
      alert("โปรดระบุข้อมูลผู้มาติดต่อ หรือรายละเอียดการโทร");
      return;
    }

    const assignmentId = selectedRow.assignmentId;

    try {
      setIsSavingCall(true);

      await createCheckpointAssignmentCall({
        assignment_id: assignmentId,
        contact_detail: contactDetailText || callNoteText,
        call_status: payload.callStatus,
        call_note: callNoteText,
        created_by: empCode,
      });

      updateRowAfterSaveCall(assignmentId, payload.callStatus);
      closeCallModal();
      setIsSuccessModalOpen(true);
    } catch (error) {
      logDevError("[Checkpoint] SAVE CALL ERROR", error);

      const errorMessage =
        error instanceof Error
          ? error.message
          : "เกิดข้อผิดพลาดในการบันทึกการโทร";

      if (
        errorMessage.includes("contact_detail") ||
        errorMessage.includes("String should have at least 1 character")
      ) {
        alert("โปรดระบุข้อมูลผู้มาติดต่อ หรือรายละเอียดการโทร");
        return;
      }

      alert(errorMessage);
    } finally {
      setIsSavingCall(false);
    }
  };

  const isReservationOwnedByCurrentEmployee =
    Boolean(reservationRow?.reservedBy) &&
    reservationRow?.reservedBy?.trim() === empCode.trim();

  const canReserveFromOutOfArea =
    Boolean(reservationRow) && !reservationRow?.reservedBy;

  const canCancelReservationFromOutOfArea =
    Boolean(reservationRow) && isReservationOwnedByCurrentEmployee;

  const isAreaSelectionDisabled =
    isLoading ||
    isAreaOptionsLoading ||
    settingLoading ||
    isCheckingLocation ||
    isSavingCall ||
    isReservationActionLoading;

  return (
    <>
      <main className="guts-bg">
        <div className="guts-home">
          <section className="guts-home-card" aria-label="Checkpoint">
            <Header empCode={empCode} displayName={displayName} />

            <h2 className={styles.attTitle}>หน้าจอ-ตารางงานสายตรวจประจำวัน</h2>
            <div className={styles.attSubtitle}>
              เลือกหน่วยงาน ที่ได้รับมอบหมายให้ช่วยตรวจ
            </div>

            <fieldset
              className={styles.areaSelector}
              aria-label="เลือกเขตและเส้นทางที่ต้องการเปิดดู"
            >
              <legend className={styles.visuallyHidden}>
                เลือกเขตและเส้นทาง
              </legend>

              <div className={styles.areaSelectorGrid}>
                <label className={styles.areaSelectorField}>
                  <span>เขต</span>
                  <select
                    value={draftDivisionId ?? ""}
                    onChange={handleDivisionChange}
                    disabled={
                      isAreaSelectionDisabled || divisionOptions.length === 0
                    }
                    aria-label="เลือกเขตที่ต้องการเปิดดู"
                    className={styles.areaSelect}
                  >
                    <option value="">
                      {isAreaOptionsLoading
                        ? "กำลังโหลดข้อมูล..."
                        : "เลือกเขต"}
                    </option>
                    {divisionOptions.map((option) => (
                      <option
                        key={option.divisionId}
                        value={option.divisionId}
                      >
                        {option.divisionName}
                      </option>
                    ))}
                  </select>
                </label>

                <label className={styles.areaSelectorField}>
                  <span>เส้นทาง</span>
                  <select
                    value={draftRouteId ?? ""}
                    onChange={handleRouteChange}
                    disabled={
                      isAreaSelectionDisabled || draftDivisionId === null
                    }
                    aria-label="เลือกเส้นทางที่ต้องการเปิดดู"
                    className={styles.areaSelect}
                  >
                    <option value="">เลือกเส้นทาง</option>
                    {routeOptions.map((option) => (
                      <option key={option.route_id} value={option.route_id}>
                        {option.route_name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </fieldset>

            {patrolAreaValues.length > 0 && (
              <div
                className={styles.patrolAreaInfo}
                aria-label="ข้อมูลแนวสายตรวจ"
              >
                {patrolAreaValues.map((value, index) => (
                  <div
                    className={styles.patrolAreaItem}
                    key={`${value}-${index}`}
                  >
                    <span className={styles.patrolAreaValue}>{value}</span>
                  </div>
                ))}
              </div>
            )}

            <div className={styles.roundInfo}>
              {formatThaiDateTime(selectedWorkDate)}
            </div>

            <fieldset className={styles.shiftSelector}>
              <legend className={styles.visuallyHidden}>เลือกผลัด</legend>

              <div className={styles.shiftOptions}>
                <label className={styles.radioItem}>
                  <input
                    type="radio"
                    name="checkpoint-shift"
                    value="day"
                    checked={selectedShift === "day"}
                    onChange={() => setSelectedShift("day")}
                  />
                  <span>ผลัดกลางวัน</span>
                </label>

                <label className={styles.radioItem}>
                  <input
                    type="radio"
                    name="checkpoint-shift"
                    value="night"
                    checked={selectedShift === "night"}
                    onChange={() => setSelectedShift("night")}
                  />
                  <span>ผลัดกลางคืน</span>
                </label>
              </div>

              <div className={styles.refreshBox}>
                <button
                  type="button"
                  className={styles.refreshBtn}
                  onClick={handleRefresh}
                  disabled={
                    isLoading ||
                    settingLoading ||
                    isCheckingLocation ||
                    isSavingCall ||
                    isReservationActionLoading
                  }
                  aria-label="รีเฟรชหน้าจอ"
                  title="รีเฟรชหน้าจอ"
                >
                  <RefreshCcw
                    className={styles.refreshIcon}
                    size={15}
                    strokeWidth={2.6}
                    aria-hidden="true"
                  />
                </button>
              </div>
            </fieldset>

            {errorMessage && (
              <div className={styles.errorBox}>{errorMessage}</div>
            )}

            {selectedShiftMismatchMessage && (
              <div className={styles.errorBox} role="alert">
                {selectedShiftMismatchMessage}
              </div>
            )}

            <div className={styles.tableCard}>
              <div className={styles.tableWrap}>
                <div className={styles.headRow}>
                  <div className={`${styles.cell} ${styles.headCell}`}>
                    หน่วยงาน
                  </div>

                  <div className={`${styles.cell} ${styles.headCell}`}>
                    <span className={styles.callHeadText}>
                      <span>บันทึก</span>
                      <span>การโทร</span>
                    </span>
                  </div>

                  <div className={`${styles.cell} ${styles.headCell}`}>
                    ปุ่มดำเนินการ
                  </div>
                </div>

                {isLoading && (
                  <div className={styles.emptyRow}>
                    กำลังโหลดตารางงานสายตรวจ...
                  </div>
                )}

                {!isLoading && orderedCheckRows.length === 0 && !errorMessage && (
                  <div className={styles.emptyState}>
                    <div className={styles.emptyIconWrap} aria-hidden="true">
                      <div className={styles.emptyIconCircle}>
                        <ClipboardList
                          className={styles.emptyClipboardIcon}
                          size={62}
                          strokeWidth={1.8}
                        />

                        <span className={styles.emptySearchBadge}>
                          <Search size={28} strokeWidth={2.6} />
                        </span>

                        <span className={styles.emptyCloseBadge}>×</span>
                      </div>
                    </div>

                    <h3 className={styles.emptyTitle}>
                      ไม่พบตารางงานสายตรวจของรอบนี้
                    </h3>

                    <div className={styles.emptyDivider} />

                    <div className={styles.emptyHint}>
                      <Info
                        className={styles.emptyHintIcon}
                        size={24}
                        strokeWidth={2.5}
                        aria-hidden="true"
                      />
                      <span>กรุณาติดต่อผู้ดูแลระบบ</span>
                    </div>
                  </div>
                )}

                {!isLoading &&
                  orderedCheckRows.map((row) => {
                    const isPending = row.status === "pending";
                    const isProgress = row.status === "progress";
                    const normalizedEmpCode = empCode.trim();

                    const isTakeoverPending =
                      isPending && row.isTakeoverPending;

                    const isReserved =
                      isPending &&
                      !isTakeoverPending &&
                      Boolean(row.reservedBy);

                    const isReservedByCurrentEmployee =
                      isReserved && row.reservedBy === normalizedEmpCode;

                    const isReservedByOtherEmployee =
                      isReserved && row.reservedBy !== normalizedEmpCode;

                    const canGoCheckInOutByStatus = isPending || isProgress;
                    const canGoCheckInOut =
                      canGoCheckInOutByStatus &&
                      row.canAction &&
                      isSelectedCurrentShift;

                    const showCallButton =
                      row.requireCall && row.status !== "cancelled";

                    const statusClass =
                      row.status === "done" || row.status === "cancelled"
                        ? styles.statusDone
                        : row.status === "doneCall" ||
                            row.status === "abnormalCall"
                          ? styles.statusDoneCall
                          : row.status === "progress"
                            ? styles.statusProgress
                            : isTakeoverPending || isReserved
                              ? styles.statusReserved
                              : styles.statusPending;

                    const disabledReason = selectedShiftMismatchMessage
                      ? selectedShiftMismatchMessage
                      : !row.canAction && row.actionDisabledReason
                        ? row.actionDisabledReason
                        : undefined;

                    const callDisabledReason = selectedShiftMismatchMessage
                      ? selectedShiftMismatchMessage
                      : undefined;

                    const isActionDisabled =
                      !canGoCheckInOutByStatus ||
                      !isSelectedCurrentShift ||
                      !row.canAction ||
                      settingLoading ||
                      isCheckingLocation ||
                      isSavingCall ||
                      isReservationActionLoading;

                    /**
                     * ปุ่มบันทึกการโทรต้องกดซ้ำได้ แม้เคยบันทึกแล้ว
                     * จึงไม่ใช้ row.canAction และไม่ใช้ settingLoading
                     * เพราะ row.canAction ใช้ควบคุมเฉพาะปุ่มเข้า/ออกตรวจ
                     */
                    const isCallDisabled =
                      !isSelectedCurrentShift ||
                      isSavingCall ||
                      isCheckingLocation;

                    return (
                      <div className={styles.dataRow} key={row.assignmentId}>
                        <div className={`${styles.cell} ${styles.unitCell}`}>
                          <button
                            type="button"
                            className={styles.unitMapButton}
                            onClick={() => void openCheckpointMapModal(row)}
                            aria-label={`ดูพิกัดหน่วยงาน ${row.unitName}`}
                            title="ดูพิกัดหน่วยงาน"
                          >
                            <span>{row.unitName}</span>
                          </button>
                        </div>

                        <div className={`${styles.cell} ${styles.planCell}`}>
                          <div className={styles.planInline}>
                            {showCallButton && (
                              <button
                                type="button"
                                className={styles.callBtn}
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  openCallModal(row);
                                }}
                                onPointerDown={(event) => {
                                  event.stopPropagation();
                                }}
                                onTouchStart={(event) => {
                                  event.stopPropagation();
                                }}
                                disabled={isCallDisabled}
                                title={callDisabledReason}
                                aria-label={
                                  callDisabledReason
                                    ? `${callDisabledReason} หน่วยงาน ${row.unitName}`
                                    : `บันทึกการโทร หน่วยงาน ${row.unitName}`
                                }
                              >
                                <span className={styles.callBtnText}>
                                  <span>บันทึก</span>
                                  <span>การโทร</span>
                                </span>
                              </button>
                            )}
                          </div>
                        </div>

                        <div className={`${styles.cell} ${styles.statusCell}`}>
                          <button
                            type="button"
                            className={`${styles.statusButton} ${statusClass}`}
                            onClick={
                              canGoCheckInOut
                                ? () => void handleGoCheckInOut(row)
                                : undefined
                            }
                            disabled={isActionDisabled}
                            title={
                              isTakeoverPending
                                ? `ผู้ตรวจแทน ${row.takeoverBy ?? "-"}`
                                : isReservedByCurrentEmployee
                                  ? "ท่านจองหน่วยงานนี้แล้ว"
                                  : isReservedByOtherEmployee
                                    ? `จองโดย ${row.reservedBy ?? "-"} ${row.reservedByName ?? ""}`.trim()
                                    : disabledReason
                            }
                            aria-label={
                              isTakeoverPending
                                ? `${statusText[row.status]} โดยผู้ตรวจ ${row.takeoverBy ?? "-"} หน่วยงาน ${row.unitName}`
                                : isReservedByCurrentEmployee
                                  ? `ท่านจองแล้ว ${statusText[row.status]} หน่วยงาน ${row.unitName}`
                                  : isReservedByOtherEmployee
                                    ? `มีผู้จองแล้ว ${statusText[row.status]} หน่วยงาน ${row.unitName}`
                                    : disabledReason
                                      ? `${disabledReason} หน่วยงาน ${row.unitName}`
                                      : canGoCheckInOut
                                        ? `ไปหน้าลงเวลาเข้าออกงาน หน่วยงาน ${row.unitName}`
                                        : `${statusText[row.status]} หน่วยงาน ${row.unitName}`
                            }
                          >
                            <span className={styles.statusContent}>
                              <span className={styles.statusMainText}>
                                {statusText[row.status]}
                              </span>

                              {isTakeoverPending && (
                                <span className={styles.reservedByText}>
                                  โดยผู้ตรวจ: {row.takeoverBy ?? "-"}
                                </span>
                              )}

                              {!isTakeoverPending &&
                                isReserved &&
                                row.reservedBy && (
                                  <span className={styles.reservedByText}>
                                    โดยผู้จอง: {row.reservedBy}
                                  </span>
                                )}
                            </span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            <div className="guts-fv-bottom">
              <BackButton
                onClick={onBack}
                disabled={
                  isCheckingLocation ||
                  isSavingCall ||
                  isReservationActionLoading ||
                  settingLoading
                }
                className="guts-fv-backBtn"
              />
            </div>
          </section>
        </div>
      </main>

      <CheckpointAreaConfirmModal
        open={isAreaConfirmModalOpen}
        regionLabel={regionLabel?.trim() || "-"}
        districtLabel={pendingPatrolArea?.division_name ?? "-"}
        routeLabel={pendingPatrolArea?.route_name ?? "-"}
        onCancel={closeAreaConfirmModal}
        onConfirm={confirmPatrolArea}
        closeOnBackdrop={false}
        closeOnEsc={false}
      />

      <CheckpointCallModal
        isOpen={isCallModalOpen}
        unitName={selectedRow?.unitName ?? ""}
        plan={selectedRow?.plan ?? ""}
        shiftText={shiftText}
        contactDetail={contactDetail}
        callNote={callNote}
        callStatus={callStatus}
        onChangeContactDetail={setContactDetail}
        onChangeCallNote={setCallNote}
        onChangeCallStatus={setCallStatus}
        onClose={closeCallModal}
        onSave={handleSaveCallDetail}
      />

      <LoadingModal
        isOpen={
          isSavingCall ||
          isReservationActionLoading ||
          isCheckingLocation ||
          settingLoading
        }
        message={
          settingLoading
            ? "กำลังโหลดค่าตรวจสอบตำแหน่ง..."
            : isCheckingLocation
              ? "กำลังตรวจสอบตำแหน่ง..."
              : isTakingOver
                ? "กำลังเตรียมเข้าตรวจแทน..."
              : isSavingReservation
                ? "กำลังจองเข้าตรวจ..."
                : isCancellingReservation
                  ? "กำลังยกเลิกการเข้าตรวจ..."
                  : "กำลังบันทึกข้อมูล..."
        }
      />

      <OutOfAreaModal
        open={outOfAreaOpen}
        locHint={outOfAreaHint}
        showReserveButton={canReserveFromOutOfArea}
        reserveUnitName={reservationRow?.unitName ?? ""}
        reserveLoading={isSavingReservation}
        onReserve={() => void handleReserveFromOutOfAreaModal()}
        showCancelButton={canCancelReservationFromOutOfArea}
        cancelLoading={isCancellingReservation}
        onCancel={() =>
          void handleCancelReservationFromOutOfAreaModal()
        }
        onClose={closeOutOfAreaModal}
        closeOnBackdrop={!isReservationActionLoading}
        closeOnEsc={!isReservationActionLoading}
      />

      <CheckpointInProgressModal
        open={Boolean(checkpointInProgressMessage)}
        message={checkpointInProgressMessage}
        onClose={closeCheckpointInProgressModal}
        closeOnBackdrop={false}
      />

      <CheckpointTakeoverConfirmModal
        open={Boolean(takeoverRow)}
        unitName={takeoverRow?.unitName ?? ""}
        holderEmployeeCode={takeoverRow?.inProgressEmployeeCode ?? null}
        holderEmployeeName={takeoverRow?.inProgressEmployeeName ?? null}
        loading={isTakingOver}
        onCancel={closeTakeoverConfirmModal}
        onConfirm={() => void handleConfirmTakeover()}
      />

      <SuccessModal
        open={isSuccessModalOpen}
        title="บันทึกสำเร็จ"
        message="บันทึกข้อมูลเรียบร้อยแล้ว"
        okText="ตกลง"
        onOk={handleSuccessOk}
        closeOnBackdrop={false}
        closeOnEsc={false}
      />

      <CheckpointMapModal
        open={isMapModalOpen}
        location={mapLocation}
        loading={mapLoading}
        errorMessage={mapErrorMessage}
        onClose={closeCheckpointMapModal}
      />
    </>
  );
}