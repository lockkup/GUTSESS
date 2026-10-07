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
import AlreadyCheckedOutModal from "@/components/MultiTab/AlreadyCheckedOutModal";
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
   * ข้อมูลแนวสายตรวจจากหน้า Home ผ่าน App.tsx
   * ใช้ใน mode attendance โดยแสดงข้อความจริง ไม่ fix คำว่า ภาค / เขต / เส้นทาง
   */
  fieldName?: string | null;
  divisionName?: string | null;
  routeName?: string | null;
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
  onGoHome: () => void;
  onCheckIn: (payload: CheckInOutPayload) => void;
  onCheckOut: (payload: CheckInOutPayload) => void | Promise<void>;
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
function isAlreadyCheckedOutMessage(message: string) {
  const text = message.toLowerCase();

  return (
    message.includes("รายการลงเวลาออกงานแล้ว") ||
    text.includes("time record already checked out") ||
    text.includes("open time record not found")
  );
}
export default function CheckInOut({
  empCode,
  displayName,
  fieldName = null,
  divisionName = null,
  routeName = null,
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
  onGoHome,
  onCheckIn,
  onCheckOut,
}: Props) {
  const [now, setNow] = useState(() => new Date());
  const [busy, setBusy] = useState(false);
  const [checkInOutModalOpen, setCheckInOutModalOpen] = useState(false);
  const [alreadyCheckedOutModalOpen, setAlreadyCheckedOutModalOpen] =
    useState(false);

  const isCheckpointMode = mode === "checkpoint";
  /**
   * แสดงข้อความแนวสายตรวจโดยไม่ fix คำว่า ภาค / เขต / เส้นทาง
   * - mode attendance: ใช้ fieldName / divisionName / routeName จากหน้า Home
   * - mode checkpoint: ใช้ patrolAreaValues ที่มาจากหน้า Checkpoint
   * - ตัดข้อความว่างและข้อความซ้ำ
   */
  const visiblePatrolAreaValues = useMemo(() => {
    const sourceValues = isCheckpointMode
      ? patrolAreaValues
      : [fieldName, divisionName, routeName];
    if (!Array.isArray(sourceValues)) {
      return [];
    }
    const uniqueValues = new Set<string>();
    sourceValues.forEach((value) => {
      if (typeof value !== "string") {
        return;
      }
      const cleanValue = value.trim();
      if (cleanValue) {
        uniqueValues.add(cleanValue);
      }
    });
    return Array.from(uniqueValues);
  }, [
    divisionName,
    fieldName,
    isCheckpointMode,
    patrolAreaValues,
    routeName,
  ]);
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
   * กันข้อมูลเก่าค้าง:
   * - ถ้า lastInAt / lastOutAt ไม่ใช่ workDate ปัจจุบัน ไม่เอามาแสดง
   * - ถ้ารายการมีทั้งเวลาเข้าและเวลาออกแล้ว ต้องคงสถานะ completed ไว้
   *   ห้ามล้างเป็น null เพราะจะทำให้ปุ่ม "เข้างาน" เปิดขึ้นมาใหม่
   *   ทั้งที่ผู้ใช้เพิ่งออกงานจากอีกแท็บแล้ว
   *
   * รอบใหม่จะเริ่มได้เมื่อผู้ใช้กลับ Home แล้วเข้าเมนูลงเวลาใหม่
   * ซึ่ง App.tsx จะโหลดสถานะล่าสุดจาก Server ใหม่อีกครั้ง
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

  /**
   * Attendance ปกติ:
   * ถ้าหน้านี้ได้รับสถานะล่าสุดแล้วพบว่ารายการมีทั้ง Check-in และ Check-out
   * ให้ถือว่าเป็นหน้าค้าง/สถานะเก่าที่ไม่ควรให้ผู้ใช้ดำเนินการต่อ
   * และเปิด AlreadyCheckedOutModal ทันที
   *
   * ไม่ใช้กับ Checkpoint / ตามแผน
   */
  useEffect(() => {
    if (isCheckpointMode) return;

    if (hasCheckedIn && hasCheckedOut) {
      setAlreadyCheckedOutModalOpen(true);
    }
  }, [isCheckpointMode, hasCheckedIn, hasCheckedOut]);

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
      /**
       * Attendance / LocationSelect:
       * ไม่ตรวจ open record แบบ employee_code + work_date ที่หน้านี้
       * เพราะพนักงานหนึ่งคนสามารถมี open record หลายหน่วยงานพร้อมกันได้
       *
       * หน่วยงานที่เลือกถูกกำหนดจาก LocationSelect แล้ว และ App.tsx
       * จะส่ง checkin_location_id ไป Backend
       *
       * Backend เป็นตัวตรวจซ้ำสุดท้ายด้วย:
       * employee_code + location_id + checkout IS NULL
       */
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
  async function handleCheckOutClick() {
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

    /**
     * Checkpoint ใช้ Flow เดิม ไม่เพิ่ม MultiTab logic
     */
    if (isCheckpointMode) {
      onCheckOut(checkInOutPayload);
      return;
    }

    /**
     * Attendance ปกติ:
     * App.tsx จะตรวจ time_record ล่าสุดจาก Server ก่อนเปิดหน้าถ่ายรูป
     *
     * ถ้าแท็บอื่น Check-out รายการนี้ไปแล้ว
     * App.tsx จะ throw "Time record already checked out"
     * และหน้านี้จะแสดง AlreadyCheckedOutModal ทันที
     */
    setBusy(true);

    try {
      await onCheckOut(checkInOutPayload);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "ไม่สามารถตรวจสอบสถานะลงเวลาออกงานได้";

      if (isAlreadyCheckedOutMessage(message)) {
        setAlreadyCheckedOutModalOpen(true);
        return;
      }

      console.error("handleCheckOutClick error:", error);
      alert(message);
    } finally {
      setBusy(false);
    }
  }

  function handleAlreadyCheckedOutGoHome() {
    setAlreadyCheckedOutModalOpen(false);
    onGoHome();
  }
  return (
    <main className="guts-bg">
      <div className="guts-home">
        <section className="guts-home-card" aria-label="CheckInOut">
          <Header empCode={empCode} displayName={displayName} />
          <h2 className={styles.attTitle}>หน้าจอ - ลงเวลาเข้า-ออกงาน</h2>
          {visiblePatrolAreaValues.length > 0 ? (
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
              onClick={() => void handleCheckOutClick()}
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

      <AlreadyCheckedOutModal
        open={alreadyCheckedOutModalOpen}
        onGoHome={handleAlreadyCheckedOutGoHome}
      />
    </main>
  );
}
