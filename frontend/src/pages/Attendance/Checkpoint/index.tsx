// src/pages/Attendance/Checkpoint/index.tsx

import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardList, Info, RefreshCcw, Search } from "lucide-react";

import Header from "@/layout/Header";
import BackButton from "@/components/BackButton";
import LoadingModal from "@/components/LoadingModal";
import SuccessModal from "@/components/SuccessModal";
import OutOfAreaModal from "@/components/OutOfAreaModal";
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
  getDailyCheckpointAssignments,
  getCheckpointMapLocation,
} from "@/services/checkpointAssignmentService";
import { createCheckpointAssignmentCall } from "@/services/checkpointAssignmentCallService";
import { verifyCheckpointLocation } from "@/services/checkpointLocationService";

import type {
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
   * ใช้เฉพาะงานสายตรวจ / Checkpoint
   * ส่งต่อไป App.tsx เพื่อบันทึกลง time_record.shift_id
   *
   * ไม่ fix ที่ frontend แล้ว
   * ต้องใช้ shift_id จาก API /checkpoint-assignments/daily
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
  shiftId: number | null;
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
};

type CheckpointDailyRowWithExtra = CheckpointDailyRow & {
  shift_id?: number | string | null;
  latest_call_status?: number | string | null;
  call_status?: number | string | null;

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
    if (!navigator.geolocation) {
      reject(new Error("unavailable"));
      return;
    }

    try {
      const perm = await (navigator as any).permissions?.query?.({
        name: "geolocation",
      });

      if (perm?.state === "denied") {
        reject({ code: 1 });
        return;
      }
    } catch {
      // ignore
    }

    let best: GeolocationPosition | null = null;
    let done = false;

    let watchId: number | null = null;
    let tWindow: ReturnType<typeof setTimeout> | null = null;
    let tHard: ReturnType<typeof setTimeout> | null = null;

    const finish = (ok: boolean, payload?: unknown) => {
      if (done) return;
      done = true;

      if (watchId != null) navigator.geolocation.clearWatch(watchId);
      if (tWindow) clearTimeout(tWindow);
      if (tHard) clearTimeout(tHard);

      if (ok) {
        resolve(payload as GeolocationPosition);
      } else {
        reject(payload);
      }
    };

    tHard = setTimeout(() => {
      if (best) finish(true, best);
      else finish(false, new Error("timeout"));
    }, hardTimeoutMs);

    tWindow = setTimeout(() => {
      if (best) finish(true, best);
      else finish(false, new Error("timeout"));
    }, watchWindowMs);

    const onPos = (pos: GeolocationPosition) => {
      const accuracy = Number.isFinite(pos.coords.accuracy)
        ? pos.coords.accuracy
        : Number.POSITIVE_INFINITY;

      const bestAccuracy =
        best && Number.isFinite(best.coords.accuracy)
          ? best.coords.accuracy
          : Number.POSITIVE_INFINITY;

      if (!best || accuracy < bestAccuracy) {
        best = pos;
      }

      if (accuracy <= desiredAccuracyM) {
        finish(true, pos);
      }
    };

    const onErr = (err: GeolocationPositionError) => {
      if (best) finish(true, best);
      else finish(false, err);
    };

    watchId = navigator.geolocation.watchPosition(onPos, onErr, {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: hardTimeoutMs,
    });
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

const getCurrentShiftTypeByTime = (date: Date): ShiftType => {
  const totalMinutes = date.getHours() * 60 + date.getMinutes();

  // ผลัดกลางวัน 08:01:00 - 20:00:00
  const dayStartMinutes = 8 * 60 + 1;
  const dayEndMinutes = 20 * 60;

  if (totalMinutes >= dayStartMinutes && totalMinutes <= dayEndMinutes) {
    return "day";
  }

  // ผลัดกลางคืน 20:01:00 - 08:00:00 ข้ามวัน
  return "night";
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

const isClosedRowStatus = (status: RowStatus): boolean => {
  return (
    status === "done" ||
    status === "doneCall" ||
    status === "abnormalCall" ||
    status === "cancelled"
  );
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

const getRowShiftId = (item: CheckpointDailyRow): number | null => {
  const row = item as CheckpointDailyRowWithExtra;

  return normalizeShiftId(row.shift_id);
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
      shiftId: getRowShiftId(item),
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
    };
  });
};

function getRequestErrorStatus(error: any): number | null {
  return error?.response?.status ?? error?.status ?? null;
}

function getRequestErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "";
}

function splitUnitName(unitName: string) {
  const parts = unitName.split("-");
  const contractCode = parts.shift()?.trim() || unitName.trim();
  const locationName = parts.join("-").trim();

  return {
    contractCode,
    locationName: locationName || contractCode,
  };
}

export default function Checkpoint({
  empCode,
  displayName,
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
  const [selectedShift, setSelectedShift] = useState<ShiftType>("day");
  const [currentDate, setCurrentDate] = useState(() => new Date());

  const [isSavingCall, setIsSavingCall] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);

  const [isCheckingLocation, setIsCheckingLocation] = useState(false);
  const [outOfAreaOpen, setOutOfAreaOpen] = useState(false);
  const [outOfAreaHint, setOutOfAreaHint] = useState("");

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

  const shiftText = getShiftText(selectedShift);
  const currentShiftText = getShiftText(currentShift);
  const isSelectedCurrentShift = selectedShift === currentShift;

  const selectedShiftMismatchMessage = !isSelectedCurrentShift
    ? `ไม่ใช่ผลัดปัจจุบัน ทำรายการไม่ได้ ขณะนี้เป็น${currentShiftText}`
    : "";

  const orderedCheckRows = useMemo(() => {
    return [...checkRows].sort(
      (a, b) => statusOrder[a.status] - statusOrder[b.status],
    );
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

      const workDate = formatApiDate(new Date());

      const data = await getDailyCheckpointAssignments({
        workDate,
        shiftType: selectedShift,
        employeeCode: normalizedEmpCode,
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
  }, [empCode, selectedShift]);

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
    }, 60_000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    void fetchCheckpointAssignments();
  }, [fetchCheckpointAssignments]);

  useEffect(() => {
    const refreshWhenPageActive = () => {
      if (document.visibilityState === "visible") {
        void fetchCheckpointAssignments();
      }
    };

    window.addEventListener("focus", refreshWhenPageActive);
    document.addEventListener("visibilitychange", refreshWhenPageActive);

    return () => {
      window.removeEventListener("focus", refreshWhenPageActive);
      document.removeEventListener("visibilitychange", refreshWhenPageActive);
    };
  }, [fetchCheckpointAssignments]);

  const resetCallForm = () => {
    setContactDetail("");
    setCallNote("");
    setCallStatus(1);
  };

  const openOutOfAreaModal = (message: string) => {
    setOutOfAreaHint(message);
    setOutOfAreaOpen(true);
  };

  const openCallModal = (row: CheckRow) => {
    if (!isSelectedCurrentShift) {
      openOutOfAreaModal(selectedShiftMismatchMessage);
      return;
    }

    if (!row.canAction) {
      openOutOfAreaModal(
        row.actionDisabledReason || "ยังไม่ถึงช่วงเวลาที่อนุญาตให้ดำเนินการ",
      );
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
  };

  const openCheckpointMapModal = async (row: CheckRow) => {
    const { contractCode, locationName } = splitUnitName(row.unitName);

    setIsMapModalOpen(true);
    setMapLoading(true);
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

      setMapLocation({
        contractCode: data.contract_code,
        locationName: data.location_name,
        latitude: data.latitude,
        longitude: data.longitude,
        radiusMeter: data.radius_meter,
        graceMeter: data.grace_meter,
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
      return null;
    }

    if (!setting) {
      logDevError("[Checkpoint] LOCATION SETTING NOT FOUND", {
        assignmentId: row.assignmentId,
        unitName: row.unitName,
        shiftId: row.shiftId,
        row,
      });

      openOutOfAreaModal("ยังไม่พบค่าตั้งค่าการตรวจสอบตำแหน่ง");
      return null;
    }

    try {
      setIsCheckingLocation(true);
      setOutOfAreaHint("");
      setOutOfAreaOpen(false);

      const pos = await getBestPositionAsync({
        desiredAccuracyM: setting.geo.desiredAccuracyM,
        watchWindowMs: setting.geo.watchWindowMs,
        hardTimeoutMs: setting.geo.hardTimeoutMs,
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

      if (currentAccuracy > setting.geo.maxAccuracyM) {
        const message = `สัญญาณ GPS ยังไม่ดี ค่าความคลาดเคลื่อนประมาณ ${roundedAccuracy} เมตร กรุณาไปที่โล่งหรือเปิด Wi-Fi แล้วตรวจสอบตำแหน่งอีกครั้ง`;

        logDevError("[Checkpoint] GPS ACCURACY TOO HIGH", {
          message,
          assignmentId: row.assignmentId,
          unitName: row.unitName,
          shiftId: row.shiftId,
          currentLocation,
          currentAccuracy,
          roundedAccuracy,
          geoSetting: setting.geo,
          maxAccuracyM: setting.geo.maxAccuracyM,
        });

        openOutOfAreaModal(message);
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
          shiftId: row.shiftId,
          currentLocation,
          geoSetting: setting.geo,
          distanceMeter,
          distanceText:
            distanceMeter !== null ? formatDistanceMeter(distanceMeter) : null,
          verifyPayload,
          verifyResult,
        });

        openOutOfAreaModal(message);

        return null;
      }

      return {
        latitude: currentLatitude,
        longitude: currentLongitude,
        accuracy: roundedAccuracy,
      };
    } catch (error: any) {
      const status = getRequestErrorStatus(error);
      const message = getRequestErrorMessage(error);

      logDevError("[Checkpoint] VERIFY LOCATION ERROR", {
        assignmentId: row.assignmentId,
        unitName: row.unitName,
        shiftId: row.shiftId,
        status,
        message,
        error,
      });

      if (status === 405 || message.includes("405")) {
        openOutOfAreaModal(
          "Backend ยังไม่มี POST /api/checkpoint-assignments/verify-location กรุณาเพิ่ม endpoint ตรวจสอบตำแหน่งในฝั่ง backend ก่อน",
        );
        return null;
      }

      if (error?.code === 1) {
        openOutOfAreaModal(
          "ไม่อนุญาตให้เข้าถึงตำแหน่ง กรุณาเปิด Location และอนุญาตสิทธิ์ตำแหน่ง",
        );
        return null;
      }

      if (String(error?.message).includes("unavailable")) {
        openOutOfAreaModal("อุปกรณ์หรือเบราว์เซอร์ไม่รองรับการอ่านตำแหน่ง");
        return null;
      }

      openOutOfAreaModal(
        error instanceof Error
          ? error.message
          : "ตรวจสอบพื้นที่กับระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
      );

      return null;
    } finally {
      setIsCheckingLocation(false);
    }
  };

  const handleGoCheckInOut = async (row: CheckRow) => {
    const mode =
      row.status === "pending"
        ? "checkin"
        : row.status === "progress"
          ? "checkout"
          : null;

    if (!mode) {
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
        shiftId: row.shiftId,
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

    if (!row.shiftId) {
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

    if (!passedLocation) {
      return;
    }

    onGoCheckInOut({
      assignmentId: row.assignmentId,
      unitName: row.unitName,
      shiftId: row.shiftId,
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

    if (!selectedRow.canAction) {
      openOutOfAreaModal(
        selectedRow.actionDisabledReason ||
          "ยังไม่ถึงช่วงเวลาที่อนุญาตให้บันทึกการโทร",
      );
      return;
    }

    const assignmentId = selectedRow.assignmentId;

    try {
      setIsSavingCall(true);

      await createCheckpointAssignmentCall({
        assignment_id: assignmentId,
        contact_detail: payload.contactDetail,
        call_status: payload.callStatus,
        call_note: payload.callNote,
        created_by: empCode,
      });

      updateRowAfterSaveCall(assignmentId, payload.callStatus);
      closeCallModal();
      setIsSuccessModalOpen(true);
    } catch (error) {
      logDevError("[Checkpoint] SAVE CALL ERROR", error);

      alert(
        error instanceof Error
          ? error.message
          : "เกิดข้อผิดพลาดในการบันทึกการโทร",
      );
    } finally {
      setIsSavingCall(false);
    }
  };

  return (
    <>
      <main className="guts-bg">
        <div className="guts-home">
          <section className="guts-home-card" aria-label="Checkpoint">
            <Header empCode={empCode} displayName={displayName} />

            <h2 className={styles.attTitle}>หน้าจอ-ตารางงานสายตรวจประจำวัน</h2>

            <div className={styles.roundInfo}>
              {formatThaiDateTime(currentDate)}
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
                    isSavingCall
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
                      ไม่พบตารางงานสายตรวจของวันนี้
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
                    const canGoCheckInOutByStatus = isPending || isProgress;
                    const canGoCheckInOut =
                      canGoCheckInOutByStatus &&
                      row.canAction &&
                      isSelectedCurrentShift;

                    const showCallButton =
                      row.requireCall && !isClosedRowStatus(row.status);

                    const statusClass =
                      row.status === "done" || row.status === "cancelled"
                        ? styles.statusDone
                        : row.status === "doneCall" ||
                            row.status === "abnormalCall"
                          ? styles.statusDoneCall
                          : row.status === "progress"
                            ? styles.statusProgress
                            : styles.statusPending;

                    const disabledReason = selectedShiftMismatchMessage
                      ? selectedShiftMismatchMessage
                      : !row.canAction && row.actionDisabledReason
                        ? row.actionDisabledReason
                        : undefined;

                    const isActionDisabled =
                      !canGoCheckInOutByStatus ||
                      !isSelectedCurrentShift ||
                      !row.canAction ||
                      settingLoading ||
                      !setting ||
                      isCheckingLocation ||
                      isSavingCall;

                    const isCallDisabled =
                      !isSelectedCurrentShift ||
                      !row.canAction ||
                      isSavingCall ||
                      isCheckingLocation ||
                      settingLoading;

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
                                onClick={() => openCallModal(row)}
                                disabled={isCallDisabled}
                                title={disabledReason}
                                aria-label={
                                  disabledReason
                                    ? `${disabledReason} หน่วยงาน ${row.unitName}`
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
                            title={disabledReason}
                            aria-label={
                              disabledReason
                                ? `${disabledReason} หน่วยงาน ${row.unitName}`
                                : canGoCheckInOut
                                  ? `ไปหน้าลงเวลาเข้าออกงาน หน่วยงาน ${row.unitName}`
                                  : `${statusText[row.status]} หน่วยงาน ${row.unitName}`
                            }
                          >
                            {statusText[row.status]}
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
                disabled={isCheckingLocation || isSavingCall || settingLoading}
                className="guts-fv-backBtn"
              />
            </div>
          </section>
        </div>
      </main>

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
        isOpen={isSavingCall || isCheckingLocation || settingLoading}
        message={
          settingLoading
            ? "กำลังโหลดค่าตรวจสอบตำแหน่ง..."
            : isCheckingLocation
              ? "กำลังตรวจสอบตำแหน่ง..."
              : "กำลังบันทึกข้อมูล..."
        }
      />

      <OutOfAreaModal
        open={outOfAreaOpen}
        locHint={outOfAreaHint}
        onClose={() => setOutOfAreaOpen(false)}
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