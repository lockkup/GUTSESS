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

  /**
   * ส่งเผื่อให้ parent ใช้ต่อได้
   */
  workDate?: string | null;
  shiftId?: number | null;
};

type Props = {
  empCode: string;
  displayName?: string;

  /**
   * attendance = ลงเวลาเข้า-ออกงานปกติ
   * checkpoint = ลงเวลาจากตารางงานสายตรวจ
   */
  mode?: CheckInOutMode;

  /**
   * ใช้กับการกรอง open time record รายวัน
   * ถ้า parent มี workDate/shiftId ควรส่งเข้ามา
   */
  workDate?: string | null; // YYYY-MM-DD
  shiftId?: number | null;

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

function toLocalYmd(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function addDays(d: Date, amount: number) {
  const next = new Date(d);
  next.setDate(next.getDate() + amount);

  return next;
}

function isSameLocalYmd(value: string | null | undefined, ymd: string) {
  const d = safeDate(value);

  if (!d) return false;

  return toLocalYmd(d) === ymd;
}

function resolveWorkDate(params: {
  now: Date;
  workDate?: string | null;
  shiftId?: number | null;
}) {
  const { now, workDate, shiftId } = params;

  if (workDate) return workDate;

  /**
   * กะกลางคืน:
   * ถ้า parent ส่ง shiftId = 2 และเวลาอยู่หลังเที่ยงคืนถึงก่อน 07:00
   * ให้ถือว่า work_date เป็นวันก่อนหน้า
   */
  if (shiftId === 2 && now.getHours() < 7) {
    return toLocalYmd(addDays(now, -1));
  }

  return toLocalYmd(now);
}

export default function CheckInOut({
  empCode,
  displayName,
  mode = "attendance",
  workDate = null,
  shiftId = null,
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

  const workDateForOpenRecord = useMemo(() => {
    return resolveWorkDate({
      now,
      workDate,
      shiftId,
    });
  }, [now, workDate, shiftId]);

  /**
   * กันข้อมูลเก่าค้าง:
   * ถ้า lastInAt / lastOutAt ไม่ใช่ workDate ปัจจุบัน ไม่เอามาแสดง
   */
  const visibleLastInAt = useMemo(() => {
    if (isCheckpointMode) return lastInAt ?? null;

    return isSameLocalYmd(lastInAt, workDateForOpenRecord) ? lastInAt : null;
  }, [isCheckpointMode, lastInAt, workDateForOpenRecord]);

  const visibleLastOutAt = useMemo(() => {
    if (isCheckpointMode) return lastOutAt ?? null;

    return isSameLocalYmd(lastOutAt, workDateForOpenRecord) ? lastOutAt : null;
  }, [isCheckpointMode, lastOutAt, workDateForOpenRecord]);

  const lastIn = useMemo(() => safeDate(visibleLastInAt), [visibleLastInAt]);
  const lastOut = useMemo(() => safeDate(visibleLastOutAt), [visibleLastOutAt]);

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
      workDate: workDateForOpenRecord,
      shiftId,
    }),
    [
      mode,
      assignmentId,
      unitName,
      passedLocation,
      workDateForOpenRecord,
      shiftId,
    ],
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

      /**
       * ถ้า parent ส่ง shiftId มา:
       * เช็ก open record เฉพาะ work_date + shift_id
       *
       * ถ้า parent ยังไม่ส่ง shiftId:
       * ไม่บล็อกผู้ใช้ด้วย alert
       * ให้ parent/backend ตอน createTimeRecord ตรวจต่ออีกชั้น
       */
      if (shiftId) {
        const openRecord =
          await timeRecordService.getOpenAttendanceTimeRecordByEmployeeCode(
            empCode,
            {
              work_date: workDateForOpenRecord,
              shift_id: shiftId,
            },
          );

        if (openRecord) {
          setCheckInOutModalOpen(true);
          return;
        }
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