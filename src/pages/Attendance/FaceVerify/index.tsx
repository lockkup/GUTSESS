// src/pages/Attendance/FaceVerify/index.tsx
import { useEffect, useRef, useState } from "react";

import Header from "@/layout/Header";
import BackButton from "@/components/BackButton";
import OutOfAreaModal from "@/components/OutOfAreaModal";
import CameraModal from "@/components/CameraModal";
import SuccessModal from "@/components/SuccessModal";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCamera, faRotateLeft } from "@fortawesome/free-solid-svg-icons";

import styles from "./FaceVerify.module.css";

type PunchType = "in" | "out";
type Step = "capture" | "confirm";

type Props = {
  empCode: string;
  displayName?: string;
  punchType: PunchType;
  onBack: () => void;

  /** ✅ save only */
  onConfirm: (photoDataUrl: string, punchType: PunchType) => Promise<void>;

  /** ✅ กดตกลงใน SuccessModal แล้วไปหน้า CheckInOut */
  onGoCheckInOut: () => void;

  onViewHistory?: () => void;
};

type LocStatus =
  | "idle"
  | "checking"
  | "allowed"
  | "outside"
  | "blocked"
  | "unavailable"
  | "error";

// ✅ ตั้งค่าพื้นที่ลงเวลา (ปรับให้เป็นพิกัดจริง)
const SITE = {
  lat: 13.723,
  lng: 100.5813,
  radiusM: 200,
};

// ✅ ภาคสนาม: ตั้งค่า GPS ให้ใช้งานจริง
const GEO = {
  desiredAccuracyM: 25,
  maxAccuracyM: 200,
  watchWindowMs: 12000,
  hardTimeoutMs: 40000,
};

function toRad(v: number) {
  return (v * Math.PI) / 180;
}

function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(a));
}

// ✅ เก็บหลายจุด แล้วคืน "จุดที่ accuracy ดีที่สุด"
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

    // ✅ ถ้า permission = denied จบไว
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

    const finish = (ok: boolean, payload?: any) => {
      if (done) return;
      done = true;

      if (watchId != null) navigator.geolocation.clearWatch(watchId);
      if (tWindow) clearTimeout(tWindow);
      if (tHard) clearTimeout(tHard);

      ok ? resolve(payload) : reject(payload);
    };

    // ✅ กันค้าง
    tHard = setTimeout(() => {
      if (best) finish(true, best);
      else finish(false, new Error("timeout"));
    }, hardTimeoutMs);

    // ✅ เก็บภายในหน้าต่างนี้ ถ้าไม่ถึง desired ก็คืน best เท่าที่มี
    tWindow = setTimeout(() => {
      if (best) finish(true, best);
      else finish(false, new Error("timeout"));
    }, watchWindowMs);

    const onPos = (pos: GeolocationPosition) => {
      const acc = pos.coords.accuracy ?? 999999;

      if (!best || acc < (best.coords.accuracy ?? 999999)) best = pos;

      // ได้ตามเป้าแล้ว ปล่อยผ่านทันที
      if (acc <= desiredAccuracyM) finish(true, pos);
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

export default function FaceVerify({
  empCode,
  displayName,
  punchType,
  onBack,
  onConfirm,
  onGoCheckInOut,
}: Props) {
  const [step, setStep] = useState<Step>("capture");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [photo, setPhoto] = useState<string>("");

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // ✅ เปิด/ปิด Modal กล้อง
  const [camOpen, setCamOpen] = useState(false);

  // ✅ Location Gate
  const [locStatus, setLocStatus] = useState<LocStatus>("idle");
  const [locHint, setLocHint] = useState("");
  const [outModalOpen, setOutModalOpen] = useState(false);

  const [locFix, setLocFix] = useState<{
    lat: number;
    lng: number;
    accuracy: number;
    dist: number;
    ts: number;
  } | null>(null);

  // ✅ Success modal
  const [successOpen, setSuccessOpen] = useState(false);

  // ✅ กันผลเก่ามาทับ
  const locReqRef = useRef(0);
  const saveReqRef = useRef(0);

  // รีเซ็ตเมื่อเปลี่ยน in/out
  useEffect(() => {
    locReqRef.current++;
    saveReqRef.current++;
    setPhoto("");
    setErr("");
    setStep("capture");
    setLocStatus("idle");
    setLocHint("");
    setOutModalOpen(false);
    setLocFix(null);
    setCamOpen(false);
    setSuccessOpen(false);
    setBusy(false);
  }, [punchType]);

  async function checkLocationGate(): Promise<{ ok: boolean; status: LocStatus }> {
    const reqId = ++locReqRef.current;

    setLocStatus("checking");
    setLocHint("");

    try {
      const pos = await getBestPositionAsync({
        desiredAccuracyM: GEO.desiredAccuracyM,
        watchWindowMs: GEO.watchWindowMs,
        hardTimeoutMs: GEO.hardTimeoutMs,
      });

      if (reqId !== locReqRef.current) return { ok: false, status: "error" };

      const { latitude, longitude, accuracy } = pos.coords;
      const dist = distanceMeters(latitude, longitude, SITE.lat, SITE.lng);

      setLocFix({
        lat: latitude,
        lng: longitude,
        accuracy: Math.round(accuracy ?? 0),
        dist: Math.round(dist),
        ts: Date.now(),
      });

      if ((accuracy ?? 999999) > GEO.maxAccuracyM) {
        setLocStatus("error");
        setLocHint(
          `สัญญาณ GPS ยังไม่ดี (accuracy ~${Math.round(
            accuracy ?? 0
          )}m) กรุณาไปที่โล่ง/เปิด Wi-Fi แล้วกด “ตรวจสอบตำแหน่งอีกครั้ง”`
        );
        setOutModalOpen(true);
        return { ok: false, status: "error" };
      }

      const ok = dist <= SITE.radiusM;

      if (ok) {
        setLocStatus("allowed");
        setLocHint(
          `อยู่ในพื้นที่ ✅ (ห่าง ~${Math.round(dist)}m / กำหนด ${SITE.radiusM}m, accuracy ~${Math.round(
            accuracy ?? 0
          )}m)`
        );
        setOutModalOpen(false);
        return { ok: true, status: "allowed" };
      } else {
        setLocStatus("outside");
        setLocHint(
          `อยู่นอกพื้นที่ ❌ (ห่าง ~${Math.round(dist)}m / กำหนด ${SITE.radiusM}m, accuracy ~${Math.round(
            accuracy ?? 0
          )}m)`
        );
        setOutModalOpen(true);
        return { ok: false, status: "outside" };
      }
    } catch (e: any) {
      if (reqId !== locReqRef.current) return { ok: false, status: "error" };

      if (e?.code === 1) {
        setLocStatus("blocked");
        setLocHint(
          "ไม่อนุญาตให้เข้าถึงตำแหน่ง กรุณาเปิด Location และอนุญาตสิทธิ์ (ต้องเป็น HTTPS/localhost)"
        );
        setOutModalOpen(true);
        return { ok: false, status: "blocked" };
      }

      if (String(e?.message).includes("unavailable")) {
        setLocStatus("unavailable");
        setLocHint("อุปกรณ์/เบราว์เซอร์ไม่รองรับการอ่านตำแหน่ง");
        setOutModalOpen(true);
        return { ok: false, status: "unavailable" };
      }

      setLocStatus("error");
      setLocHint("อ่านตำแหน่งไม่สำเร็จ (timeout/สัญญาณอ่อน) กรุณาลองใหม่");
      setOutModalOpen(true);
      return { ok: false, status: "error" };
    }
  }

  async function saveAndShowSuccess(photoDataUrl: string) {
    const saveId = ++saveReqRef.current;

    setErr("");
    try {
      await onConfirm(photoDataUrl, punchType); // ✅ save only
      if (saveId !== saveReqRef.current) return;
      setSuccessOpen(true); // ✅ success หลังพิกัดถูกต้อง + บันทึกสำเร็จ
    } catch {
      if (saveId !== saveReqRef.current) return;
      setErr("บันทึกไม่สำเร็จ กรุณาลองใหม่");
    }
  }

  async function onPickFile(file?: File | null) {
    if (!file) return;

    setErr("");
    setBusy(true);

    try {
      const reader = new FileReader();
      const dataUrl: string = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("อ่านไฟล์ไม่สำเร็จ"));
        reader.readAsDataURL(file);
      });

      setPhoto(dataUrl);
      setStep("confirm");

      const res = await checkLocationGate();
      if (res.ok) {
        await saveAndShowSuccess(dataUrl); // ✅ ไม่มีปุ่ม “กดยืนยันตัวตน” แล้ว
      }
    } catch {
      setErr("อัปโหลดรูปไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setBusy(false);
    }
  }

  async function recheckAndAutoConfirm() {
    if (!photo) return;

    setBusy(true);
    setErr("");

    try {
      const res = await checkLocationGate();
      if (res.ok) {
        await saveAndShowSuccess(photo); // ✅ พิกัดถูกต้อง -> แสดง SuccessModal
      }
    } finally {
      setBusy(false);
    }
  }

  function retake() {
    locReqRef.current++;
    saveReqRef.current++;
    setSuccessOpen(false);
    setPhoto("");
    setErr("");
    setStep("capture");
    setLocStatus("idle");
    setLocHint("");
    setOutModalOpen(false);
    setLocFix(null);
    setCamOpen(false);
  }

  const title =
    punchType === "in" ? "ยืนยันตัวตนเพื่อเข้างาน" : "ยืนยันตัวตนเพื่อออกงาน";

  const canOpenCamera = !busy && step === "capture";

  return (
    <main className="guts-bg">
      <div className="guts-home">
        <section className="guts-home-card" aria-label="Face Verify">
          <Header empCode={empCode} displayName={displayName} />

          <h2 className="guts-att-title">ลงเวลาเข้า-ออกงาน</h2>

          <div className={`guts-fv-card ${styles.fvCard}`}>
            <div className={styles.fvTitle}>{title}</div>

            {/* ====== กรอบแสดงผล ====== */}
            <div
              className={`guts-fv-frame ${styles.fvFrame}`}
              aria-label="กรอบแสดงรูปยืนยันตัวตน"
            >
              {photo ? (
                <img
                  className={`guts-fv-img ${styles.fvImg}`}
                  src={photo}
                  alt="รูปยืนยันตัวตน"
                />
              ) : (
                <div className={styles.fvEmpty}>
                  <div className={styles.fvEmptyIcon} aria-hidden="true">
                    <FontAwesomeIcon icon={faCamera} />
                  </div>
                  <div className={styles.fvEmptyText}>ยังไม่มีภาพถ่าย</div>
                </div>
              )}

              {/* fallback: file input */}
              <input
                className={`guts-fv-file ${styles.fvFile}`}
                type="file"
                accept="image/*"
                capture="user"
                onChange={(e) => onPickFile(e.target.files?.[0])}
              />

              <canvas
                ref={canvasRef}
                className={`guts-fv-canvas ${styles.fvCanvas}`}
              />
            </div>

            <div className={`guts-fv-text ${styles.fvText}`}>
              กรุณาถ่ายภาพใบหน้าเพื่อยืนยันตัวตน
            </div>

            {err ? (
              <div className={`guts-fv-error ${styles.fvError}`}>{err}</div>
            ) : null}

            {/* ✅ แสดงสถานะตำแหน่ง */}
            {step === "confirm" ? (
              <div className={styles.fvLocHint}>
                {locStatus === "checking"
                  ? "กำลังตรวจสอบตำแหน่ง..."
                  : locStatus === "allowed" && busy
                  ? "พิกัดถูกต้อง ✅ กำลังบันทึก..."
                  : locHint}

                {locFix ? (
                  <div style={{ marginTop: 6, opacity: 0.85 }}>
                    lat: {locFix.lat.toFixed(6)} | lng: {locFix.lng.toFixed(6)} |
                    acc: ~{locFix.accuracy}m | dist: ~{locFix.dist}m
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* ====== ปุ่มหลัก ====== */}
            {step === "capture" ? (
              <button
                type="button"
                className={`guts-fv-primary ${styles.fvPrimary}`}
                onClick={() => setCamOpen(true)}
                disabled={!canOpenCamera}
                style={{
                  background: !canOpenCamera
                    ? "linear-gradient(90deg, #6c757d, #5a6268)"
                    : "linear-gradient(90deg, #024B76, #013a5a)",
                  opacity: !canOpenCamera ? 0.65 : 1,
                  cursor: !canOpenCamera ? "not-allowed" : "pointer",
                  transition: "all 0.25s ease",
                }}
              >
                <FontAwesomeIcon icon={faCamera} className={styles.fvPrimaryIcon} />
                ถ่ายภาพและยืนยัน
              </button>
            ) : (
              <>
                {/* ✅ ไม่มีปุ่ม “กดยืนยันตัวตน” แล้ว
                    ถ้าพิกัดไม่ผ่าน/ยังไม่เสถียร -> ให้กดตรวจสอบอีกครั้ง */}
                {locStatus !== "allowed" ? (
                  <button
                    type="button"
                    className={`guts-fv-primary ${styles.fvPrimary}`}
                    onClick={recheckAndAutoConfirm}
                    disabled={busy || locStatus === "checking"}
                  >
                    ตรวจสอบตำแหน่งอีกครั้ง
                  </button>
                ) : err ? (
                  <button
                    type="button"
                    className={`guts-fv-primary ${styles.fvPrimary}`}
                    onClick={() => photo && saveAndShowSuccess(photo)}
                    disabled={busy}
                  >
                    ลองบันทึกอีกครั้ง
                  </button>
                ) : (
                  <button
                    type="button"
                    className={`guts-fv-primary ${styles.fvPrimary}`}
                    disabled
                    style={{ opacity: 0.7, cursor: "not-allowed" }}
                  >
                    รอระบบบันทึก...
                  </button>
                )}

                <button
                  type="button"
                  className={`guts-fv-secondary ${styles.fvSecondary}`}
                  onClick={retake}
                  disabled={busy}
                >
                  <FontAwesomeIcon icon={faRotateLeft} />
                  ถ่ายใหม่
                </button>
              </>
            )}

            <div className={`guts-fv-bottom ${styles.fvBottom}`}>
              <BackButton
                onClick={onBack}
                disabled={busy}
                className={`guts-fv-backBtn ${styles.fvBackBtn}`}
              />
            </div>
          </div>
        </section>
      </div>

      {/* ✅ กล้องอยู่ใน component */}
      <CameraModal
        open={camOpen}
        onClose={() => setCamOpen(false)}
        onCaptured={async (dataUrl) => {
          setBusy(true);
          setErr("");
          try {
            setPhoto(dataUrl);
            setStep("confirm");
            const res = await checkLocationGate();
            if (res.ok) {
              await saveAndShowSuccess(dataUrl); // ✅ พิกัดถูกต้อง -> SuccessModal
            }
          } finally {
            setBusy(false);
          }
        }}
      />

      <OutOfAreaModal
        open={outModalOpen}
        locHint={locHint}
        onClose={() => setOutModalOpen(false)}
      />

      <SuccessModal
        open={successOpen}
        title="สำเร็จ"
        message={
          punchType === "in"
            ? "บันทึกเวลาเข้างานเรียบร้อย"
            : "บันทึกเวลาออกงานเรียบร้อย"
        }
        okText="ตกลง"
        onOk={() => {
          setSuccessOpen(false);
          onGoCheckInOut(); // ✅ ไปหน้า CheckInOut
        }}
      />
    </main>
  );
}
