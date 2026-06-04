// src/pages/Attendance/CheckInOut/AttendanceFaceVerify.tsx

import { useEffect, useRef, useState } from "react";
import * as faceapi from "face-api.js";

import Header from "@/layout/Header";
import BackButton from "@/components/BackButton";
import OutOfAreaModal from "@/components/OutOfAreaModal";
import CameraModal from "@/components/CameraModal";
import SuccessModal from "@/components/SuccessModal";
import FaceNotFoundModal from "@/components/FaceNotFoundModal";
import CheckInOutModal from "@/components/CheckInOutModal";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCamera,
  faImage,
  faRotateLeft,
} from "@fortawesome/free-solid-svg-icons";

import styles from "./AttendanceFaceVerify.module.css";

type PunchType = "in" | "out";
type Step = "capture" | "confirm";

export type AttendanceLocationCoords = {
  latitude: number;
  longitude: number;
  accuracy: number;
};

type Props = {
  empCode: string;
  displayName?: string;

  punchType: PunchType;
  onBack: () => void;

  /**
   * เก็บไว้ก่อน เผื่ออนาคตเปิดใช้ตรวจใบหน้า
   * ตอนนี้จะไม่ถูกเรียก ถ้า ENABLE_FACE_VERIFY = false
   */
  onVerifyFace: (embedding: number[]) => Promise<void>;

  onConfirm: (
    photoDataUrl: string,
    punchType: PunchType,
    embedding: number[],
    location: AttendanceLocationCoords,
  ) => Promise<void>;

  onGoCheckInOut: () => void;
};

type LocStatus =
  | "idle"
  | "checking"
  | "allowed"
  | "outside"
  | "blocked"
  | "unavailable"
  | "error";

/**
 * false = ถ่ายรูป + ตรวจ GPS + บันทึกเวลา แต่ไม่ตรวจว่าเป็นใคร
 * true  = เปิดใช้ตรวจใบหน้าในอนาคต
 */
const ENABLE_FACE_VERIFY = false;

const GEO = {
  desiredAccuracyM: 50,
  maxAccuracyM: 10000,
  watchWindowMs: 6000,
  hardTimeoutMs: 15000,
};

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
      const acc = pos.coords.accuracy ?? 999999;

      if (!best || acc < (best.coords.accuracy ?? 999999)) {
        best = pos;
      }

      if (acc <= desiredAccuracyM) {
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

function isPendingCheckinMessage(message: string) {
  return (
    message.includes("มีการลงเวลาเข้างานค้างไว้แล้วในระบบ") ||
    message.includes("ลงเวลาเข้างานค้างไว้แล้วในระบบ")
  );
}

function isOutOfAreaMessage(message: string) {
  const text = message.toLowerCase();

  return (
    message.includes("นอกพื้นที่") ||
    message.includes("ไม่อยู่ในพื้นที่") ||
    message.includes("อยู่นอกพื้นที่") ||
    message.includes("ไม่อยู่ในรัศมี") ||
    text.includes("outside") ||
    text.includes("out of area") ||
    text.includes("not in radius")
  );
}

export default function AttendanceFaceVerify({
  empCode,
  displayName,
  punchType,
  onBack,
  onVerifyFace,
  onConfirm,
  onGoCheckInOut,
}: Props) {
  const [step, setStep] = useState<Step>("capture");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [photo, setPhoto] = useState("");

  const [camOpen, setCamOpen] = useState(false);

  const [locStatus, setLocStatus] = useState<LocStatus>("idle");
  const [locHint, setLocHint] = useState("");
  const [outModalOpen, setOutModalOpen] = useState(false);

  const [locFix, setLocFix] = useState<{
    lat: number;
    lng: number;
    accuracy: number;
    ts: number;
  } | null>(null);

  const [successOpen, setSuccessOpen] = useState(false);
  const [faceNotFoundOpen, setFaceNotFoundOpen] = useState(false);
  const [verifyErrorOpen, setVerifyErrorOpen] = useState(false);
  const [faceVerifyFailed, setFaceVerifyFailed] = useState(false);
  const [checkInOutModalOpen, setCheckInOutModalOpen] = useState(false);

  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [faceEmbedding, setFaceEmbedding] = useState<number[] | null>(null);
  const [faceVerified, setFaceVerified] = useState(false);

  const locReqRef = useRef(0);
  const saveReqRef = useRef(0);

  useEffect(() => {
    if (!ENABLE_FACE_VERIFY) {
      setModelsLoaded(true);
      return;
    }

    let cancelled = false;

    const loadModels = async () => {
      try {
        const MODEL_URL = "/models";

        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);

        if (!cancelled) {
          setModelsLoaded(true);
        }
      } catch (error) {
        console.error("loadModels error:", error);

        if (!cancelled) {
          setErr("โหลดโมเดลตรวจจับใบหน้าไม่สำเร็จ");
          setModelsLoaded(false);
        }
      }
    };

    void loadModels();

    return () => {
      cancelled = true;
    };
  }, []);

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

    setFaceEmbedding(null);
    setFaceNotFoundOpen(false);
    setFaceVerified(false);
    setVerifyErrorOpen(false);
    setFaceVerifyFailed(false);
    setCheckInOutModalOpen(false);
  }, [punchType]);

  async function checkLocationGate(): Promise<{
    ok: boolean;
    status: LocStatus;
    location?: AttendanceLocationCoords;
  }> {
    const reqId = ++locReqRef.current;

    setLocStatus("checking");
    setLocHint("กำลังตรวจสอบตำแหน่ง GPS...");

    try {
      const pos = await getBestPositionAsync({
        desiredAccuracyM: GEO.desiredAccuracyM,
        watchWindowMs: GEO.watchWindowMs,
        hardTimeoutMs: GEO.hardTimeoutMs,
      });

      if (reqId !== locReqRef.current) {
        return { ok: false, status: "error" };
      }

      const { latitude, longitude, accuracy } = pos.coords;
      const roundedAccuracy = Math.round(accuracy ?? 0);

      if ((accuracy ?? 999999) > GEO.maxAccuracyM) {
        setLocStatus("error");
        setLocHint(
          "สัญญาณ GPS ยังไม่ดี กรุณาไปที่โล่งหรือเปิด Wi-Fi แล้วตรวจสอบตำแหน่งอีกครั้ง",
        );
        setOutModalOpen(true);

        return { ok: false, status: "error" };
      }

      const location: AttendanceLocationCoords = {
        latitude,
        longitude,
        accuracy: roundedAccuracy,
      };

      setLocFix({
        lat: latitude,
        lng: longitude,
        accuracy: roundedAccuracy,
        ts: Date.now(),
      });

      setLocStatus("allowed");
      setLocHint("");
      setOutModalOpen(false);

      return {
        ok: true,
        status: "allowed",
        location,
      };
    } catch (e: any) {
      if (reqId !== locReqRef.current) {
        return { ok: false, status: "error" };
      }

      if (e?.code === 1) {
        setLocStatus("blocked");
        setLocHint(
          "ไม่อนุญาตให้เข้าถึงตำแหน่ง กรุณาเปิด Location และอนุญาตสิทธิ์ตำแหน่ง",
        );
        setOutModalOpen(true);

        return { ok: false, status: "blocked" };
      }

      if (String(e?.message).includes("unavailable")) {
        setLocStatus("unavailable");
        setLocHint("อุปกรณ์หรือเบราว์เซอร์ไม่รองรับการอ่านตำแหน่ง");
        setOutModalOpen(true);

        return { ok: false, status: "unavailable" };
      }

      setLocStatus("error");
      setLocHint("อ่านตำแหน่งไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
      setOutModalOpen(true);

      return { ok: false, status: "error" };
    }
  }

  async function extractFaceEmbedding(dataUrl: string): Promise<number[] | null> {
    if (!ENABLE_FACE_VERIFY || !modelsLoaded) {
      return null;
    }

    return new Promise((resolve) => {
      const img = new Image();
      img.src = dataUrl;

      img.onload = async () => {
        try {
          const result = await faceapi
            .detectSingleFace(
              img,
              new faceapi.TinyFaceDetectorOptions({
                inputSize: 320,
                scoreThreshold: 0.5,
              }),
            )
            .withFaceLandmarks()
            .withFaceDescriptor();

          if (!result) {
            resolve(null);
            return;
          }

          resolve(Array.from(result.descriptor));
        } catch (error) {
          console.error("extractFaceEmbedding error:", error);
          resolve(null);
        }
      };

      img.onerror = () => resolve(null);
    });
  }

  async function saveAndShowSuccess(
    photoDataUrl: string,
    embeddingToSave: number[],
    location: AttendanceLocationCoords,
  ) {
    const saveId = ++saveReqRef.current;

    setErr("");

    try {
      await onConfirm(photoDataUrl, punchType, embeddingToSave, location);

      if (saveId !== saveReqRef.current) return;

      setSuccessOpen(true);
    } catch (error) {
      console.error("saveAndShowSuccess error:", error);

      if (saveId !== saveReqRef.current) return;

      const message =
        error instanceof Error
          ? error.message
          : "บันทึกเวลาไม่สำเร็จ กรุณาลองใหม่";

      if (isPendingCheckinMessage(message)) {
        setLocStatus("idle");
        setLocHint("");
        setErr("");
        setCheckInOutModalOpen(true);

        return;
      }

      if (isOutOfAreaMessage(message)) {
        setLocStatus("outside");
        setLocHint(message);
        setOutModalOpen(true);
        setErr("");

        return;
      }

      setErr(message);
    }
  }

  async function verifyFaceAndContinue(dataUrl: string, embedding: number[]) {
    setLocStatus("checking");
    setLocHint("กำลังตรวจสอบใบหน้ากับข้อมูลในระบบ...");

    try {
      await onVerifyFace(embedding);

      setFaceVerified(true);
      setFaceVerifyFailed(false);

      setLocHint("ยืนยันใบหน้าสำเร็จ กำลังตรวจสอบตำแหน่ง...");

      const res = await checkLocationGate();

      if (res.ok && res.location) {
        await saveAndShowSuccess(dataUrl, embedding, res.location);
      }
    } catch (error) {
      console.error("verifyFaceAndContinue error:", error);

      setFaceVerified(false);
      setFaceVerifyFailed(true);

      setLocStatus("idle");
      setLocHint("");
      setErr("");
      setVerifyErrorOpen(true);
    }
  }

  async function processCapturedImage(dataUrl: string) {
    setFaceNotFoundOpen(false);
    setVerifyErrorOpen(false);
    setFaceVerifyFailed(false);
    setCheckInOutModalOpen(false);

    setPhoto(dataUrl);
    setStep("confirm");

    setFaceEmbedding(null);
    setFaceVerified(false);

    setErr("");
    setLocFix(null);
    setOutModalOpen(false);

    if (!ENABLE_FACE_VERIFY) {
      const emptyEmbedding: number[] = [];

      setFaceEmbedding(emptyEmbedding);
      setFaceVerified(true);
      setFaceVerifyFailed(false);

      setLocHint("กำลังตรวจสอบตำแหน่ง GPS...");
      setLocStatus("checking");

      const res = await checkLocationGate();

      if (res.ok && res.location) {
        await saveAndShowSuccess(dataUrl, emptyEmbedding, res.location);
      }

      return;
    }

    setLocHint("กำลังประมวลผลใบหน้า...");
    setLocStatus("checking");

    const embedding = await extractFaceEmbedding(dataUrl);

    if (!embedding) {
      setLocStatus("idle");
      setLocHint("");
      setFaceEmbedding(null);
      setFaceNotFoundOpen(true);

      return;
    }

    setFaceEmbedding(embedding);
    await verifyFaceAndContinue(dataUrl, embedding);
  }

  async function onPickFile(file?: File | null) {
    if (!file) return;

    if (ENABLE_FACE_VERIFY && !modelsLoaded) {
      setErr("ระบบ AI ยังโหลดไม่เสร็จ กรุณารอสักครู่");
      return;
    }

    setErr("");
    setBusy(true);

    try {
      const reader = new FileReader();

      const dataUrl: string = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("อ่านไฟล์ไม่สำเร็จ"));
        reader.readAsDataURL(file);
      });

      await processCapturedImage(dataUrl);
    } catch {
      setErr("อัปโหลดรูปไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setBusy(false);
    }
  }

  async function recheckAndAutoConfirm() {
    if (!photo) {
      setErr("กรุณาถ่ายรูปใหม่เพื่อบันทึกเวลา");
      return;
    }

    if (ENABLE_FACE_VERIFY && (!faceEmbedding || !faceVerified)) {
      setErr("กรุณาถ่ายใหม่เพื่อยืนยันตัวตน");
      return;
    }

    setBusy(true);
    setErr("");

    setLocFix(null);
    setLocHint("");
    setOutModalOpen(false);
    setLocStatus("idle");

    try {
      const res = await checkLocationGate();

      if (res.ok && res.location) {
        await saveAndShowSuccess(
          photo,
          ENABLE_FACE_VERIFY ? faceEmbedding ?? [] : [],
          res.location,
        );
      }
    } finally {
      setBusy(false);
    }
  }

  function retrySaveWithLastLocation() {
    if (!photo || !locFix) return;

    if (ENABLE_FACE_VERIFY && (!faceEmbedding || !faceVerified)) {
      setErr("กรุณาถ่ายใหม่เพื่อยืนยันตัวตน");
      return;
    }

    void saveAndShowSuccess(
      photo,
      ENABLE_FACE_VERIFY ? faceEmbedding ?? [] : [],
      {
        latitude: locFix.lat,
        longitude: locFix.lng,
        accuracy: locFix.accuracy,
      },
    );
  }

  function retake() {
    locReqRef.current++;
    saveReqRef.current++;

    setSuccessOpen(false);
    setFaceNotFoundOpen(false);
    setVerifyErrorOpen(false);
    setFaceVerifyFailed(false);
    setCheckInOutModalOpen(false);

    setPhoto("");
    setErr("");
    setStep("capture");

    setLocStatus("idle");
    setLocHint("");
    setOutModalOpen(false);
    setLocFix(null);

    setCamOpen(false);

    setFaceEmbedding(null);
    setFaceVerified(false);
  }

  function handleSuccessOk() {
    setSuccessOpen(false);
    onGoCheckInOut();
  }

  const title = ENABLE_FACE_VERIFY
    ? "กรุณาถ่ายภาพใบหน้าเพื่อยืนยันตัวตน"
    : "กรุณาถ่ายภาพเพื่อบันทึกเวลา";

  const canOpenCamera =
    !busy && step === "capture" && (!ENABLE_FACE_VERIFY || modelsLoaded);

  const shouldShowRecheckButton =
    (ENABLE_FACE_VERIFY ? faceVerified : true) &&
    !outModalOpen &&
    ["outside", "blocked", "unavailable", "error"].includes(locStatus);

  const shouldShowRetakeButton = ENABLE_FACE_VERIFY
    ? faceVerifyFailed && !verifyErrorOpen
    : step === "confirm" && !busy && !successOpen && !checkInOutModalOpen;

  /**
   * ล็อกปุ่มย้อนกลับระหว่างระบบกำลังทำงาน
   * โดยเฉพาะตอนกำลังตรวจสอบตำแหน่ง GPS
   */
  const isNavigationLocked = busy || locStatus === "checking";

  function handleBackClick() {
    if (isNavigationLocked) return;

    onBack();
  }

  return (
    <main className="guts-bg">
      <div className="guts-home">
        <section className="guts-home-card" aria-label="Attendance Face Verify">
          <Header empCode={empCode} displayName={displayName} />

          <h2 className={styles.attTitle}>หน้าจอ - ลงเวลาเข้า-ออกงาน</h2>

          <div className={styles.unitNameText}>
            ระบบจะตรวจสอบพื้นที่จากตำแหน่ง GPS
          </div>

          <div className={`guts-fv-card ${styles.fvCard}`}>
            <div className={styles.fvTitle}>{title}</div>

            {ENABLE_FACE_VERIFY && !modelsLoaded ? (
              <div className={styles.fvLocHint}>
                กำลังโหลดระบบตรวจจับใบหน้า...
              </div>
            ) : null}

            <div
              className={`guts-fv-frame ${styles.fvFrame}`}
              aria-label="กรอบแสดงรูปบันทึกเวลา"
            >
              {photo ? (
                <img
                  className={`guts-fv-img ${styles.fvImg}`}
                  src={photo}
                  alt={
                    ENABLE_FACE_VERIFY
                      ? "รูปยืนยันตัวตน"
                      : "รูปบันทึกเวลา"
                  }
                />
              ) : (
                <div className={styles.fvEmpty}>
                  <div className={styles.fvEmptyIcon} aria-hidden="true">
                    <FontAwesomeIcon icon={faImage} />
                  </div>
                  <div className={styles.fvEmptyText}>ยังไม่มีภาพถ่าย</div>
                </div>
              )}

              <input
                className={`guts-fv-file ${styles.fvFile}`}
                type="file"
                accept="image/*"
                capture="user"
                disabled={!canOpenCamera}
                onChange={(e) => void onPickFile(e.target.files?.[0])}
              />
            </div>

            {err ? (
              <div className={`guts-fv-error ${styles.fvError}`}>{err}</div>
            ) : null}

            {step === "confirm" &&
            (locStatus === "checking" || (locStatus === "allowed" && busy)) ? (
              <div className={styles.fvLocHint}>
                {locStatus === "checking"
                  ? locHint || "กำลังตรวจสอบข้อมูล..."
                  : "กำลังบันทึก..."}
              </div>
            ) : null}

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
                <FontAwesomeIcon
                  icon={faCamera}
                  className={styles.fvPrimaryIcon}
                />
                {!modelsLoaded
                  ? "กำลังโหลด AI..."
                  : ENABLE_FACE_VERIFY
                    ? "ถ่ายภาพและยืนยัน"
                    : "ถ่ายภาพและบันทึก"}
              </button>
            ) : (
              <>
                {shouldShowRecheckButton ? (
                  <button
                    type="button"
                    className={`guts-fv-primary ${styles.fvPrimary}`}
                    onClick={() => void recheckAndAutoConfirm()}
                    disabled={busy}
                  >
                    ตรวจสอบตำแหน่งอีกครั้ง
                  </button>
                ) : locStatus === "allowed" && err ? (
                  <button
                    type="button"
                    className={`guts-fv-primary ${styles.fvPrimary}`}
                    onClick={retrySaveWithLastLocation}
                    disabled={busy || !locFix}
                  >
                    ลองบันทึกอีกครั้ง
                  </button>
                ) : locStatus === "allowed" && busy ? (
                  <button
                    type="button"
                    className={`guts-fv-primary ${styles.fvPrimary}`}
                    disabled
                    style={{ opacity: 0.7, cursor: "not-allowed" }}
                  >
                    รอระบบบันทึก...
                  </button>
                ) : null}

                {shouldShowRetakeButton ? (
                  <button
                    type="button"
                    className={`guts-fv-secondary ${styles.fvSecondary}`}
                    onClick={retake}
                    disabled={busy}
                  >
                    <FontAwesomeIcon icon={faRotateLeft} />
                    ถ่ายใหม่
                  </button>
                ) : null}
              </>
            )}

            <div className={`guts-fv-bottom ${styles.fvBottom}`}>
              <BackButton
                onClick={handleBackClick}
                disabled={isNavigationLocked}
                className={`guts-fv-backBtn ${styles.fvBackBtn}`}
              />
            </div>
          </div>
        </section>
      </div>

      <CameraModal
        open={camOpen}
        onClose={() => setCamOpen(false)}
        onCaptured={async (dataUrl) => {
          if (ENABLE_FACE_VERIFY && !modelsLoaded) {
            setErr("ระบบ AI ยังโหลดไม่เสร็จ กรุณารอสักครู่");
            return;
          }

          setCamOpen(false);
          setBusy(true);
          setErr("");

          try {
            await processCapturedImage(dataUrl);
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

      <FaceNotFoundModal
        open={faceNotFoundOpen}
        title="ไม่พบใบหน้าในรูปภาพ"
        message="กรุณาถ่ายใหม่ให้เห็นใบหน้าชัดเจน"
        onClose={() => setFaceNotFoundOpen(false)}
      />

      <FaceNotFoundModal
        open={verifyErrorOpen}
        title="ใบหน้าไม่ตรงกับข้อมูลพนักงาน"
        message="กรุณาถ่ายใหม่ หรือตรวจสอบข้อมูลพนักงานในระบบ"
        onClose={() => setVerifyErrorOpen(false)}
      />

      <CheckInOutModal
        open={checkInOutModalOpen}
        onClose={() => setCheckInOutModalOpen(false)}
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
        onOk={handleSuccessOk}
      />
    </main>
  );
}