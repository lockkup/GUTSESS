// src/pages/Attendance/CheckInOut/CheckInOut.tsx

import { useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPersonWalking,
  faRightToBracket,
  faRightFromBracket,
} from "@fortawesome/free-solid-svg-icons";

import Header from "@/layout/Header";
import BackButton from "@/components/BackButton";
import CheckInOutModal from "@/components/CheckInOutModal";
import { timeRecordService } from "@/services/timeRecord.service";

import styles from "./CheckInOut.module.css";

export type CheckInOutMode = "attendance" | "checkpoint";

export type PassedLocation = {
  latitude: number;
  longitude: number;
  accuracy: number;
};

export type CheckInOutPayload = {
  mode: CheckInOutMode;
  assignmentId?: number | null;
  unitName?: string | null;
  passedLocation?: PassedLocation | null;
};

type Props = {
  empCode: string;
  displayName?: string;

  /**
   * attendance = ลงเวลาเข้า-ออกงานปกติ
   * checkpoint = ลงเวลาจากตารางงานสายตรวจ
   */
  mode?: CheckInOutMode;

  assignmentId?: number | null;
  unitName?: string | null;
  passedLocation?: PassedLocation | null;

  lastInAt?: string | null;
  lastOutAt?: string | null;

  onBack: () => void;
  onCheckIn: (payload: CheckInOutPayload) => void;
  onCheckOut: (payload: CheckInOutPayload) => void;
};

function fmtThaiDate(d: Date) {
  return new Intl.DateTimeFormat("th-TH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

function fmtTimeHHMM(d: Date) {
  return new Intl.DateTimeFormat("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

function safeDate(iso?: string | null) {
  if (!iso) return null;

  const d = new Date(iso);

  return Number.isNaN(d.getTime()) ? null : d;
}

export default function CheckInOut({
  empCode,
  displayName,
  mode = "attendance",
  assignmentId = null,
  unitName = null,
  passedLocation = null,
  lastInAt,
  lastOutAt,
  onBack,
  onCheckIn,
  onCheckOut,
}: Props) {
  const [now, setNow] = useState(() => new Date());
  const [busy, setBusy] = useState(false);
  const [checkInOutModalOpen, setCheckInOutModalOpen] = useState(false);

  const isCheckpointMode = mode === "checkpoint";

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);

    return () => clearInterval(t);
  }, []);

  const lastIn = useMemo(() => safeDate(lastInAt), [lastInAt]);
  const lastOut = useMemo(() => safeDate(lastOutAt), [lastOutAt]);

  const hasCheckedIn = Boolean(lastIn);
  const hasCheckedOut = Boolean(lastOut);

  const canCheckIn = !busy && !hasCheckedIn;
  const canCheckOut = !busy && hasCheckedIn && !hasCheckedOut;

  const checkInOutPayload = useMemo<CheckInOutPayload>(
    () => ({
      mode,
      assignmentId,
      unitName,
      passedLocation,
    }),
    [mode, assignmentId, unitName, passedLocation],
  );

  const nowDate = fmtThaiDate(now);
  const nowTime = fmtTimeHHMM(now);

  async function handleCheckInClick() {
    if (busy) return;

    if (!canCheckIn) {
      setCheckInOutModalOpen(true);
      return;
    }

    if (isCheckpointMode && !assignmentId) {
      alert("ไม่พบข้อมูลจุดงานสายตรวจ กรุณากลับไปเลือกจุดจากตารางงานสายตรวจก่อน");
      return;
    }

    if (isCheckpointMode && !passedLocation) {
      alert("ไม่พบข้อมูลพิกัดที่ผ่านการตรวจสอบ กรุณากลับไปเลือกจุดจากตารางงานสายตรวจก่อน");
      return;
    }

    setBusy(true);

    try {
      if (isCheckpointMode) {
        onCheckIn(checkInOutPayload);
        return;
      }

      /*
       * โหมด attendance:
       * ตรวจเฉพาะ open time_record ของการลงเวลาเข้า-ออกงานปกติ
       * backend จะแยกออกจากสายตรวจด้วย checkpoint_assignment.time_record_id
       */
      const openRecord =
        await timeRecordService.getOpenAttendanceTimeRecordByEmployeeCode(
          empCode,
        );

      if (openRecord) {
        setCheckInOutModalOpen(true);
        return;
      }

      onCheckIn(checkInOutPayload);
    } catch (error) {
      console.error("handleCheckInClick error:", error);
      alert(
        error instanceof Error
          ? error.message
          : "ตรวจสอบข้อมูลการเข้างานไม่สำเร็จ กรุณาลองใหม่",
      );
    } finally {
      setBusy(false);
    }
  }

  function handleCheckOutClick() {
    if (busy) return;

    if (isCheckpointMode && !assignmentId) {
      alert("ไม่พบข้อมูลจุดงานสายตรวจ กรุณากลับไปเลือกจุดจากตารางงานสายตรวจก่อน");
      return;
    }

    if (isCheckpointMode && !passedLocation) {
      alert("ไม่พบข้อมูลพิกัดที่ผ่านการตรวจสอบ กรุณากลับไปเลือกจุดจากตารางงานสายตรวจก่อน");
      return;
    }

    if (!hasCheckedIn) {
      alert("ไม่พบข้อมูลเข้างาน กรุณาเข้างานก่อนออกงาน");
      return;
    }

    if (hasCheckedOut) {
      alert("รายการนี้ออกงานแล้ว");
      return;
    }

    onCheckOut(checkInOutPayload);
  }

  return (
    <main className="guts-bg">
      <div className="guts-home">
        <section className="guts-home-card" aria-label="CheckInOut">
          <Header empCode={empCode} displayName={displayName} />

          <h2 className={styles.attTitle}>หน้าจอ - ลงเวลาเข้า-ออกงาน</h2>

          {isCheckpointMode && unitName ? (
            <div className={styles.unitNameText}>หน่วยงาน: {unitName}</div>
          ) : null}

          <div
            className={styles.summaryCard}
            role="status"
            aria-label="สรุปเวลาเข้า-ออกงาน"
          >
            <div className={styles.col}>
              <div className={styles.colHead}>
                <FontAwesomeIcon
                  icon={faPersonWalking}
                  className={styles.walk}
                />
                <span>เข้างาน</span>
              </div>

              <div className={`${styles.time} ${styles.timeIn}`}>
                {lastIn ? fmtTimeHHMM(lastIn) : "--:--"}
              </div>

              <div className={styles.date}>
                {lastIn ? fmtThaiDate(lastIn) : "—"}
              </div>
            </div>

            <div className={styles.divider} aria-hidden="true" />

            <div className={styles.col}>
              <div className={styles.colHead}>
                <FontAwesomeIcon
                  icon={faPersonWalking}
                  className={styles.walk}
                />
                <span>ออกงาน</span>
              </div>

              <div className={`${styles.time} ${styles.timeOut}`}>
                {lastOut ? fmtTimeHHMM(lastOut) : "--:--"}
              </div>

              <div className={styles.date}>
                {lastOut ? fmtThaiDate(lastOut) : "—"}
              </div>
            </div>
          </div>

          <div className={styles.actionCard} aria-label="ลงเวลา">
            <button
              type="button"
              className={`${styles.btn} ${styles.btnIn}`}
              onClick={() => void handleCheckInClick()}
              disabled={!canCheckIn}
            >
              <span className={styles.btnText}>
                <span className={styles.btnSub}>
                  {busy ? "รอระบบตรวจสอบ..." : "กดเข้างาน"}
                </span>

                <span className={styles.btnSmall} aria-hidden="true">
                  <FontAwesomeIcon icon={faRightToBracket} />
                </span>
              </span>
            </button>

            <div className={styles.nowBig}>
              <div className={styles.nowDate}>{nowDate}</div>
              <div className={styles.nowTime}>{nowTime} น.</div>
            </div>

            <button
              type="button"
              className={`${styles.btn} ${styles.btnOut}`}
              onClick={handleCheckOutClick}
              disabled={!canCheckOut}
              title={
                !hasCheckedIn
                  ? "กรุณาเข้างานก่อนออกงาน"
                  : hasCheckedOut
                    ? "รายการนี้ออกงานแล้ว"
                    : "กดออกงาน"
              }
            >
              <span className={styles.btnText}>
                <span className={styles.btnSub}>กดออกงาน</span>

                <span className={styles.btnSmall} aria-hidden="true">
                  <FontAwesomeIcon icon={faRightFromBracket} />
                </span>
              </span>
            </button>

            <div className="guts-fv-bottom">
              <BackButton onClick={onBack} className="guts-fv-backBtn" />
            </div>
          </div>
        </section>
      </div>

      <CheckInOutModal
        open={checkInOutModalOpen}
        onClose={() => setCheckInOutModalOpen(false)}
      />
    </main>
  );
}