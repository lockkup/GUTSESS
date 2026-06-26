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
   * ข้อความจากหน้า Checkpoint เช่น
   * ["ภาค 2", "เขต 2.1", "เส้นทางที่ 1"]
   *
   * แสดงบนหน้า CheckInOut โดยไม่ fix หัวข้อ
   */
  patrolAreaValues?: string[] | null;

  /**
   * ใช้เฉพาะกรณีมาจากหน้า Checkpoint
   * - checkpoint: ต้องมี shiftId เพื่อบันทึกลง time_record.shift_id
   * - attendance: ไม่ต้องส่ง shiftId / ส่งเป็น null
   */
  shiftId?: number | null;

  workDate?: string | null;
};

type Props = {
  empCode: string;
  displayName?: string;

  /**
   * attendance = ลงเวลาเข้า-ออกงานปกติจากหน้า Home
   * checkpoint = ลงเวลาจากตารางงานสายตรวจ
   */
  mode?: CheckInOutMode;

  /**
   * ถ้า parent/backend ส่ง workDate มา จะใช้ค่านั้น
   * ถ้าไม่ส่งมา จะใช้วันที่ปัจจุบัน
   */
  workDate?: string | null; // YYYY-MM-DD

  /**
   * ใช้เฉพาะ mode checkpoint
   */
  assignmentId?: number | null;
  unitName?: string | null;
  passedLocation?: PassedLocation | null;

  /**
   * รับจาก App.tsx เมื่อเข้ามาจากหน้าตารางงานสายตรวจ
   * เช่น ภาค 2 / เขต 2.1 / เส้นทางที่ 1
   */
  patrolAreaValues?: string[] | null;

  shiftId?: number | null;

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

function isSameLocalYmd(value: string | null | undefined, ymd: string) {
  const d = safeDate(value);

  if (!d) return false;

  return toLocalYmd(d) === ymd;
}

function resolveWorkDate(params: {
  now: Date;
  workDate?: string | null;
}) {
  const { now, workDate } = params;

  if (workDate) return workDate;

  return toLocalYmd(now);
}

export default function CheckInOut({
  empCode,
  displayName,
  mode = "attendance",
  workDate = null,
  assignmentId = null,
  unitName = null,
  passedLocation = null,
  patrolAreaValues = null,
  shiftId = null,
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

  /**
   * แสดงเฉพาะข้อความจริงที่ส่งมาจากหน้า Checkpoint
   * - แสดงเฉพาะ mode checkpoint
   * - ตัดข้อความว่างและข้อความซ้ำ
   * - ไม่มีหัวข้อ fix เช่น ภาค: เขต: หรือ เส้นทาง:
   */
  const visiblePatrolAreaValues = useMemo(() => {
    if (!isCheckpointMode || !Array.isArray(patrolAreaValues)) {
      return [];
    }

    const uniqueValues = new Set<string>();

    patrolAreaValues.forEach((value) => {
      if (typeof value !== "string") {
        return;
      }

      const cleanValue = value.trim();

      if (cleanValue) {
        uniqueValues.add(cleanValue);
      }
    });

    return Array.from(uniqueValues);
  }, [isCheckpointMode, patrolAreaValues]);

  /**
   * ใช้ล็อกปุ่มย้อนกลับระหว่างระบบกำลังตรวจสอบ / กำลังทำงาน
   */
  const isNavigationLocked = busy;

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);

    return () => clearInterval(t);
  }, []);

  const workDateForOpenRecord = useMemo(() => {
    return resolveWorkDate({
      now,
      workDate,
    });
  }, [now, workDate]);

  /**
   * สำคัญ:
   * สำหรับเมนูลงเวลาเข้า-ออกงานปกติ
   * ถ้ารายการของวันนั้นมีทั้งเวลาเข้าและเวลาออกแล้ว
   * ให้ถือว่ารอบนั้นปิดงานแล้ว
   *
   * ผลลัพธ์:
   * - กลับมาหน้านี้อีกครั้ง จะแสดง --:--
   * - ปุ่มเข้างานกลับมา enabled
   * - ปุ่มออกงาน disabled
   *
   * ใช้เฉพาะ mode attendance
   * ไม่กระทบ checkpoint เพราะ checkpoint ต้องอิง assignment เดิม
   */
  const isCompletedAttendanceRecord = useMemo(() => {
    if (isCheckpointMode) return false;

    const hasTodayCheckIn = isSameLocalYmd(lastInAt, workDateForOpenRecord);
    const hasTodayCheckOut = isSameLocalYmd(lastOutAt, workDateForOpenRecord);

    return hasTodayCheckIn && hasTodayCheckOut;
  }, [isCheckpointMode, lastInAt, lastOutAt, workDateForOpenRecord]);

  /**
   * กันข้อมูลเก่าค้าง:
   * 1) ถ้า lastInAt / lastOutAt ไม่ใช่ workDate ปัจจุบัน ไม่เอามาแสดง
   * 2) ถ้า attendance ออกงานครบแล้ว ให้เคลียร์หน้าเป็นรอบใหม่
   */
  const visibleLastInAt = useMemo(() => {
    if (isCheckpointMode) return lastInAt ?? null;

    if (isCompletedAttendanceRecord) return null;

    return isSameLocalYmd(lastInAt, workDateForOpenRecord) ? lastInAt : null;
  }, [
    isCheckpointMode,
    isCompletedAttendanceRecord,
    lastInAt,
    workDateForOpenRecord,
  ]);

  const visibleLastOutAt = useMemo(() => {
    if (isCheckpointMode) return lastOutAt ?? null;

    if (isCompletedAttendanceRecord) return null;

    return isSameLocalYmd(lastOutAt, workDateForOpenRecord) ? lastOutAt : null;
  }, [
    isCheckpointMode,
    isCompletedAttendanceRecord,
    lastOutAt,
    workDateForOpenRecord,
  ]);

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
      patrolAreaValues: isCheckpointMode ? visiblePatrolAreaValues : null,

      /**
       * สำคัญ:
       * ถ้ามาจาก checkpoint ให้ส่ง shiftId ต่อไป
       * ถ้ามาจาก attendance ปกติ ไม่ส่ง shiftId ไปบันทึก
       */
      shiftId: isCheckpointMode ? shiftId : null,

      workDate: workDateForOpenRecord,
    }),
    [
      mode,
      assignmentId,
      unitName,
      passedLocation,
      visiblePatrolAreaValues,
      shiftId,
      isCheckpointMode,
      workDateForOpenRecord,
    ],
  );

  const nowDate = fmtThaiDate(now);
  const nowTime = fmtTimeHHMM(now);

  function handleBackClick() {
    if (isNavigationLocked) return;

    onBack();
  }

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

    if (isCheckpointMode && !shiftId) {
      alert("ไม่พบข้อมูลผลัด กรุณากลับไปเลือกผลัดจากตารางงานสายตรวจก่อน");
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

      const openRecord =
        await timeRecordService.getOpenAttendanceTimeRecordByEmployeeCode(
          empCode,
          {
            work_date: workDateForOpenRecord,
          },
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

    if (isCheckpointMode && !shiftId) {
      alert("ไม่พบข้อมูลผลัด กรุณากลับไปเลือกผลัดจากตารางงานสายตรวจก่อน");
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

          {isCheckpointMode && visiblePatrolAreaValues.length > 0 ? (
            <div
              className={styles.patrolAreaInfo}
              aria-label="ข้อมูลแนวสายตรวจ"
            >
              {visiblePatrolAreaValues.map((value, index) => (
                <span
                  className={styles.patrolAreaValue}
                  key={`${value}-${index}`}
                >
                  {value}
                </span>
              ))}
            </div>
          ) : null}

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
              <BackButton
                onClick={handleBackClick}
                disabled={isNavigationLocked}
                className="guts-fv-backBtn"
              />
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