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
  mode: CheckInOutMode;
  passedLocation: PassedLocation;
};

type Props = {
  empCode: string;
  displayName?: string;
  onBack: () => void;
  onGoCheckInOut: (payload: GoCheckInOutPayload) => void;
};

type RowStatus = "progress" | "pending" | "done" | "doneCall";

type CheckRow = {
  assignmentId: number;
  unitName: string;
  plan: string;
  status: RowStatus;
  requireCall: boolean;
  hasCall: boolean;
};

const statusText: Record<RowStatus, string> = {
  progress: "อยู่ระหว่างการเข้าตรวจ",
  pending: "รอดำเนินการเข้าตรวจ",
  done: "ตรวจแล้ว",
  doneCall: "ตรวจแล้ว(โทร)",
};

const statusOrder: Record<RowStatus, number> = {
  progress: 1,
  pending: 2,
  done: 3,
  doneCall: 4,
};

/**
 * สำหรับทดสอบ:
 * desiredAccuracyM: 30 = พยายามรอ GPS ให้แม่นประมาณ 30 เมตร
 * maxAccuracyM: 100 = ถ้า accuracy เกิน 100 เมตร จะไม่ให้ไปต่อ
 *
 * ถ้าใช้งานจริงรัศมี 10 เมตร อาจปรับเป็น:
 * desiredAccuracyM: 10,
 * maxAccuracyM: 30,
 */
const GEO = {
  desiredAccuracyM: 50,
  maxAccuracyM: 100,
  watchWindowMs: 6000,
  hardTimeoutMs: 15000,
};

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
      const accuracy = pos.coords.accuracy ?? 999999;

      if (!best || accuracy < (best.coords.accuracy ?? 999999)) {
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
      timeout: Math.min(12000, hardTimeoutMs),
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

const mapAssignmentStatusToRowStatus = (
  status: CheckpointAssignmentStatus,
  hasCall?: boolean,
): RowStatus => {
  if (hasCall) {
    return "doneCall";
  }

  if (status === "in_progress") {
    return "progress";
  }

  if (status === "completed") {
    return "done";
  }

  return "pending";
};

const mapDailyRowsToCheckRows = (rows: CheckpointDailyRow[]): CheckRow[] => {
  return rows.map((item) => {
    const hasCall = Boolean(item.has_call);

    return {
      assignmentId: item.assignment_id,
      unitName: item.unit_name,
      plan: `${item.plan_day} วัน`,
      requireCall: Boolean(item.require_call),
      hasCall,
      status: mapAssignmentStatusToRowStatus(item.assignment_status, hasCall),
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

    try {
      setIsCheckingLocation(true);
      setOutOfAreaHint("");
      setOutOfAreaOpen(false);

      const pos = await getBestPositionAsync({
        desiredAccuracyM: GEO.desiredAccuracyM,
        watchWindowMs: GEO.watchWindowMs,
        hardTimeoutMs: GEO.hardTimeoutMs,
      });

      const currentLatitude = pos.coords.latitude;
      const currentLongitude = pos.coords.longitude;
      const accuracy = pos.coords.accuracy ?? 999999;
      const roundedAccuracy = Math.round(accuracy);

      if (accuracy > GEO.maxAccuracyM) {
        openOutOfAreaModal(
          `สัญญาณ GPS ยังไม่ดี ค่าความคลาดเคลื่อนประมาณ ${roundedAccuracy} เมตร กรุณาไปที่โล่งหรือเปิด Wi-Fi แล้วตรวจสอบตำแหน่งอีกครั้ง`,
        );
        return null;
      }

      const verifyPayload = {
        assignment_id: row.assignmentId,
        unit_name: row.unitName,
        latitude: currentLatitude,
        longitude: currentLongitude,
        accuracy: roundedAccuracy,
      };

      if (import.meta.env.DEV) {
        console.log("VERIFY CHECKPOINT LOCATION PAYLOAD", verifyPayload);
      }

      const verifyResult = await verifyCheckpointLocation(verifyPayload);

      if (import.meta.env.DEV) {
        console.log("VERIFY CHECKPOINT LOCATION RESULT", verifyResult);
      }

      if (!verifyResult.allowed) {
        const distanceText =
          typeof verifyResult.distance_meter === "number"
            ? ` ระยะห่างประมาณ ${formatDistanceMeter(
                verifyResult.distance_meter,
              )} จากจุดตรวจที่เลือก`
            : "";

        openOutOfAreaModal(
          verifyResult.message ||
            `คุณอยู่นอกพื้นที่ที่กำหนด${distanceText}`,
        );

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

    const passedLocation = await checkLocationBeforeGoCheckInOut(row);

    if (!passedLocation) {
      return;
    }

    onGoCheckInOut({
      assignmentId: row.assignmentId,
      unitName: row.unitName,
      mode,
      passedLocation,
    });
  };

  const markRowAsDoneCall = (assignmentId: number) => {
    setCheckRows((currentRows) =>
      currentRows.map((row) =>
        row.assignmentId === assignmentId
          ? {
              ...row,
              hasCall: true,
              status: "doneCall",
            }
          : row,
      ),
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

      markRowAsDoneCall(assignmentId);
      closeCallModal();
      setIsSuccessModalOpen(true);
    } catch (error) {
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
                  disabled={isLoading}
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
                  <div className={`${styles.cell} ${styles.headCell}`}>แผน</div>
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
                    const showCallButton = row.requireCall;

                    const statusClass =
                      row.status === "done"
                        ? styles.statusDone
                        : row.status === "doneCall"
                          ? styles.statusDoneCall
                          : row.status === "progress"
                            ? styles.statusProgress
                            : styles.statusPending;

                    return (
                      <div className={styles.dataRow} key={row.assignmentId}>
                        <div className={`${styles.cell} ${styles.unitCell}`}>
                          {row.unitName}
                        </div>

                        <div className={`${styles.cell} ${styles.planCell}`}>
                          <div className={styles.planInline}>
                            <span className={styles.planText}>{row.plan}</span>

                            {showCallButton && (
                              <button
                                type="button"
                                className={styles.callBtn}
                                onClick={() => openCallModal(row)}
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
                            disabled={!canGoCheckInOut || isCheckingLocation}
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
              <BackButton onClick={onBack} className="guts-fv-backBtn" />
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
        isOpen={isSavingCall || isCheckingLocation}
        message={
          isCheckingLocation
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