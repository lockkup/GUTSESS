// src/pages/Attendance/Checkpoint/index.tsx

import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardList, Info, RefreshCcw, Search } from "lucide-react";

import Header from "@/layout/Header";
import BackButton from "@/components/BackButton";
import LoadingModal from "@/components/LoadingModal";
import SuccessModal from "@/components/SuccessModal";
import OutOfAreaModal from "@/components/OutOfAreaModal";
import CheckpointCallModal, {
  type CallStatus,
  type CheckpointCallModalSavePayload,
} from "@/components/CheckpointCallModal";

import {
  getAttendanceLocationSetting,
  type AttendanceLocationSetting,
} from "@/services/appSetting.service";

import { getDailyCheckpointAssignments } from "@/services/checkpointAssignmentService";
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
  onBack: () => void;
  onGoCheckInOut: (payload: GoCheckInOutPayload) => void;
};

type RowStatus =
  | "progress"
  | "pending"
  | "done"
  | "doneCall"
  | "abnormalCall";

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
};

type CheckpointDailyRowWithExtra = CheckpointDailyRow & {
  /**
   * Backend ควรส่ง field นี้กลับมา
   * เพื่อไม่ต้อง hardcode day=1 / night=2 ใน frontend
   */
  shift_id?: number | string | null;

  /**
   * Backend ควรส่ง field นี้กลับมาด้วย
   * เพื่อให้ frontend แยกได้ว่า call_status ล่าสุดเป็น 1, 2 หรือ 3
   */
  latest_call_status?: number | string | null;

  /**
   * fallback เผื่อ backend ใช้ชื่อ call_status แทน latest_call_status
   */
  call_status?: number | string | null;
};

const statusText: Record<RowStatus, string> = {
  progress: "อยู่ระหว่างการเข้าตรวจ",
  pending: "รอดำเนินการเข้าตรวจ",
  done: "ตรวจแล้ว",
  doneCall: "ตรวจแล้ว(โทร)",
  abnormalCall: "ผิดปกติ(โทร)",
};

const statusOrder: Record<RowStatus, number> = {
  progress: 1,
  pending: 2,
  done: 3,
  doneCall: 4,
  abnormalCall: 4,
};

/**
 * เปิด log ตลอด เพื่อให้เห็นใน Production Build / Caddy / Cloudflare Tunnel
 * ถ้าไม่ต้องการ log ตอนใช้งานจริง ค่อยเปลี่ยนกลับไปครอบ import.meta.env.DEV ได้
 */
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

const mapAssignmentStatusOnly = (
  status: CheckpointAssignmentStatus,
): RowStatus => {
  if (status === "in_progress") {
    return "progress";
  }

  if (status === "completed") {
    return "done";
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

const getLatestCallStatus = (
  item: CheckpointDailyRowWithExtra,
): CallStatus | null => {
  return normalizeCallStatus(item.latest_call_status ?? item.call_status);
};

const isClosedRowStatus = (status: RowStatus): boolean => {
  return status === "done" || status === "doneCall" || status === "abnormalCall";
};

const mapAssignmentStatusToRowStatus = (
  status: CheckpointAssignmentStatus,
  hasCall?: boolean,
  latestCallStatus?: CallStatus | null,
): RowStatus => {
  /**
   * กติกา call_status:
   *
   * 1 = ปกติ ไม่ต้องเข้าหน้างาน
   *     => ปิดงานทันที แสดง ตรวจแล้ว(โทร)
   *
   * 2 = ผิดปกติ ไม่ต้องเข้าหน้างาน
   *     => ปิดงานทันที แสดง ผิดปกติ(โทร)
   *
   * 3 = ผิดปกติ ต้องเข้าหน้างาน
   *     => ยังไม่ปิดงานทันที ต้องเข้าตรวจต่อ
   *
   * Flow ข้อ 3:
   * - pending     => รอดำเนินการเข้าตรวจ
   * - in_progress => อยู่ระหว่างการเข้าตรวจ
   * - completed   => ตรวจแล้ว(โทร)
   */

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

  /**
   * fallback กรณี backend ยังไม่ส่ง latest_call_status กลับมา
   *
   * - ถ้า completed แล้ว และมี call log ให้แสดง ตรวจแล้ว(โทร)
   * - ถ้ายัง pending / in_progress ให้ยึด assignment_status เป็นหลัก
   */
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

  const shiftText = selectedShift === "day" ? "ผลัดกลางวัน" : "ผลัดกลางคืน";

  const orderedCheckRows = useMemo(() => {
    return [...checkRows].sort(
      (a, b) => statusOrder[a.status] - statusOrder[b.status],
    );
  }, [checkRows]);

  const fetchCheckpointAssignments = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMessage("");

      const workDate = formatApiDate(new Date());

      const data = await getDailyCheckpointAssignments({
        workDate,
        shiftType: selectedShift,
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
  }, [selectedShift]);

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

  const openCallModal = (row: CheckRow) => {
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

  const openOutOfAreaModal = (message: string) => {
    setOutOfAreaHint(message);
    setOutOfAreaOpen(true);
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

        /**
         * ข้อ 3 = ผิดปกติ ต้องเข้าหน้างาน
         *
         * ให้บันทึก call log ได้ แต่ไม่ปิดงานทันที
         * เพื่อให้ยังสามารถกดเข้าตรวจ / ออกตรวจต่อได้
         *
         * Flow:
         * - ถ้ายัง pending     => รอดำเนินการเข้าตรวจ
         * - ถ้า in_progress    => อยู่ระหว่างการเข้าตรวจ
         * - ถ้า completed แล้ว => ตรวจแล้ว(โทร)
         */
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

        /**
         * ข้อ 1, 2 = ไม่ต้องเข้าหน้างาน
         * ต้องปิดงานทันที และไม่ให้กดเข้าตรวจต่อ
         */
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

    /**
     * ไม่ fetch ทันที เพื่อไม่ให้กรณี call_status = 3
     * ถูก API ที่ยังไม่ส่ง latest_call_status กลับมาแปลงผิด
     *
     * ระยะยาว:
     * - Backend daily API ควรส่ง latest_call_status กลับมา
     * - Backend ควรอัปเดต assignment_status = completed เมื่อ call_status เป็น 1 หรือ 2
     * - เมื่อ backend พร้อมแล้ว สามารถเปิด fetchCheckpointAssignments() ได้
     */
    // void fetchCheckpointAssignments();
  };

  const handleSaveCallDetail = async (
    payload: CheckpointCallModalSavePayload,
  ) => {
    if (!selectedRow?.assignmentId || isSavingCall) {
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
                    const canGoCheckInOut = isPending || isProgress;

                    /**
                     * ปิดปุ่มบันทึกการโทร เมื่อแถวปิดงานแล้ว
                     * เช่น ตรวจแล้ว, ตรวจแล้ว(โทร), ผิดปกติ(โทร)
                     */
                    const showCallButton =
                      row.requireCall && !isClosedRowStatus(row.status);

                    const statusClass =
                      row.status === "done"
                        ? styles.statusDone
                        : row.status === "doneCall" ||
                            row.status === "abnormalCall"
                          ? styles.statusDoneCall
                          : row.status === "progress"
                            ? styles.statusProgress
                            : styles.statusPending;

                    const isActionDisabled =
                      !canGoCheckInOut ||
                      settingLoading ||
                      !setting ||
                      isCheckingLocation ||
                      isSavingCall;

                    return (
                      <div className={styles.dataRow} key={row.assignmentId}>
                        <div className={`${styles.cell} ${styles.unitCell}`}>
                          {row.unitName}
                        </div>

                        <div className={`${styles.cell} ${styles.planCell}`}>
                          <div className={styles.planInline}>
                            {showCallButton && (
                              <button
                                type="button"
                                className={styles.callBtn}
                                onClick={() => openCallModal(row)}
                                disabled={
                                  isSavingCall ||
                                  isCheckingLocation ||
                                  settingLoading
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
                            aria-label={
                              canGoCheckInOut
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
    </>
  );
}