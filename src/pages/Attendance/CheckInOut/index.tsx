// src/pages/Attendance/CheckInOut/index.tsx
import { useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPersonWalking,
  faRightToBracket,
  faRightFromBracket,
} from "@fortawesome/free-solid-svg-icons";

import Header from "@/layout/Header";
import BackButton from "@/components/BackButton";

import styles from "./CheckInOut.module.css";

type Props = {
  empCode: string;
  displayName?: string;

  // เวลาเข้างาน/ออกงานล่าสุด (ของวันนี้หรือครั้งล่าสุด) ส่งเป็น ISO string
  lastInAt?: string | null;
  lastOutAt?: string | null;

  onBack: () => void;
  onCheckIn: () => void;
  onCheckOut: () => void;
  onViewHistory: () => void;
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
  lastInAt,
  lastOutAt,
  onBack,
  onCheckIn,
  onCheckOut,
  onViewHistory,
}: Props) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const lastIn = useMemo(() => safeDate(lastInAt), [lastInAt]);
  const lastOut = useMemo(() => safeDate(lastOutAt), [lastOutAt]);

  const nowDate = fmtThaiDate(now);
  const nowTime = fmtTimeHHMM(now);

  return (
    <main className="guts-bg">
      <div className="guts-home">
        <section className="guts-home-card" aria-label="CheckInOut">
          <Header empCode={empCode} displayName={displayName} />

          <h2 className={styles.attTitle}>ลงเวลาเข้า-ออกงาน</h2>

          {/* ===== Card สรุป เข้างาน/ออกงาน ===== */}
          <div
            className={styles.summaryCard}
            role="status"
            aria-label="สรุปเวลาเข้า-ออกงาน"
          >
            <div className={styles.col}>
              <div className={styles.colHead}>
                <FontAwesomeIcon icon={faPersonWalking} className={styles.walk} />
                <span>เข้างาน</span>
              </div>

              <div className={`${styles.time} ${styles.timeIn}`}>
                {lastIn ? fmtTimeHHMM(lastIn) : "--:--"}
              </div>
              <div className={styles.date}>{lastIn ? fmtThaiDate(lastIn) : "—"}</div>
            </div>

            <div className={styles.divider} aria-hidden="true" />

            <div className={styles.col}>
              <div className={styles.colHead}>
                <FontAwesomeIcon icon={faPersonWalking} className={styles.walk} />
                <span>ออกงาน</span>
              </div>

              <div className={`${styles.time} ${styles.timeOut}`}>
                {lastOut ? fmtTimeHHMM(lastOut) : "--:--"}
              </div>
              <div className={styles.date}>{lastOut ? fmtThaiDate(lastOut) : "—"}</div>
            </div>
          </div>

          {/* ===== Card เวลาใหญ่ + ปุ่ม ===== */}
          <div className={styles.actionCard} aria-label="ลงเวลา">
            <div className={styles.nowBig}>
              <div className={styles.nowDate}>{nowDate}</div>
              <div className={styles.nowTime}>{nowTime} น.</div>
            </div>

            <button
              type="button"
              className={`${styles.btn} ${styles.btnIn}`}
              onClick={onCheckIn}
            >
              <span className={styles.btnText}>
                <span className={styles.btnSub}>กดเข้างาน</span>
                <span className={styles.btnSmall} aria-hidden="true">
                  <FontAwesomeIcon icon={faRightToBracket} />
                </span>
              </span>
            </button>

            <button
              type="button"
              className={`${styles.btn} ${styles.btnOut}`}
              onClick={onCheckOut}
            >
              <span className={styles.btnText}>
                <span className={styles.btnSub}>กดออกงาน</span>
                <span className={styles.btnSmall} aria-hidden="true">
                  <FontAwesomeIcon icon={faRightFromBracket} />
                </span>
              </span>
            </button>

            {/* ยังคงใช้ของเดิมจาก index.css เพื่อไม่กระทบหน้าอื่น */}
            <div className="guts-fv-bottom">
              <BackButton onClick={onBack} className="guts-fv-backBtn" />
            </div>

            <button
              type="button"
              className={styles.history}
              onClick={onViewHistory}
            >
              ดูประวัติการลงเวลางาน (ย้อนหลัง 1 เดือน)
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
