// src/pages/CheckInOut.tsx
import { useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPersonWalking,
  faRightToBracket,
  faRightFromBracket,
} from "@fortawesome/free-solid-svg-icons";

import AppHeader from "../components/AppHeader";
import BackButton from "../components/BackButton"; // ✅ เพิ่ม

type Props = {
  empCode: string;
  displayName?: string;

  // เวลาเข้างาน/ออกงานล่าสุด (ของวันนี้หรือครั้งล่าสุด) ส่งเป็น ISO string
  lastInAt?: string | null;
  lastOutAt?: string | null;

  onBack: () => void; // ✅ เพิ่ม (ให้ใช้ back กลางเหมือน FaceVerify)
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
          {/* ✅ Header คงเดิม (ย้ายไปอยู่ AppHeader) */}
          <AppHeader empCode={empCode} displayName={displayName} />

          <h2 className="guts-att-title">ลงเวลาเข้า-ออกงาน</h2>

          {/* ===== Card สรุป เข้างาน/ออกงาน ===== */}
          <div
            className="guts-att-summaryCard"
            role="status"
            aria-label="สรุปเวลาเข้า-ออกงาน"
          >
            <div className="guts-att-col in">
              <div className="guts-att-colHead">
                <FontAwesomeIcon icon={faPersonWalking} className="guts-att-walk" />
                <span>เข้างาน</span>
              </div>

              <div className="guts-att-time in">
                {lastIn ? fmtTimeHHMM(lastIn) : "--:--"}
              </div>
              <div className="guts-att-date">{lastIn ? fmtThaiDate(lastIn) : "—"}</div>
            </div>

            <div className="guts-att-divider" aria-hidden="true" />

            <div className="guts-att-col out">
              <div className="guts-att-colHead">
                <FontAwesomeIcon icon={faPersonWalking} className="guts-att-walk" />
                <span>ออกงาน</span>
              </div>

              <div className="guts-att-time out">
                {lastOut ? fmtTimeHHMM(lastOut) : "--:--"}
              </div>
              <div className="guts-att-date">{lastOut ? fmtThaiDate(lastOut) : "—"}</div>
            </div>
          </div>

          {/* ===== Card เวลาใหญ่ + ปุ่ม ===== */}
          <div className="guts-att-actionCard" aria-label="ลงเวลา">
            <div className="guts-att-nowBig">
              <div className="guts-att-nowDate">{nowDate}</div>
              <div className="guts-att-nowTime">{nowTime} น.</div>
            </div>

            <button type="button" className="guts-att-btn in" onClick={onCheckIn}>
              <span className="guts-att-btnText">
                <span className="guts-att-btnSub">กดเข้างาน</span>
                <span className="guts-att-btnSmall" aria-hidden="true">
                  <FontAwesomeIcon icon={faRightToBracket} />
                </span>
              </span>
            </button>

            <button type="button" className="guts-att-btn out" onClick={onCheckOut}>
              <span className="guts-att-btnText">
                <span className="guts-att-btnSub">กดออกงาน</span>
                <span className="guts-att-btnSmall" aria-hidden="true">
                  <FontAwesomeIcon icon={faRightFromBracket} />
                </span>
              </span>
            </button>
            <div className="guts-fv-bottom">
            <BackButton
                onClick={onBack}
                className="guts-fv-backBtn"
            />
            </div>
            <button type="button" className="guts-att-history" onClick={onViewHistory}>
              ดูประวัติการลงเวลางาน (ย้อนหลัง 1 เดือน)
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
