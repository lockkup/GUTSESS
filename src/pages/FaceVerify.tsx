// src/pages/FaceVerify.tsx
import { useEffect, useRef, useState } from "react";
import AppHeader from "../components/AppHeader";
import BackButton from "../components/BackButton"; // ✅ ใช้ปุ่มกลาง
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCamera,
  faCircleCheck,
  faRotateLeft,
} from "@fortawesome/free-solid-svg-icons";
import styles from "./FaceVerify.module.css";

type PunchType = "in" | "out";
type Step = "capture" | "confirm";

type Props = {
  empCode: string;
  displayName?: string;

  /** มาจากปุ่ม "กดเข้างาน/กดออกงาน" */
  punchType: PunchType;

  /** ย้อนกลับไปหน้า 1.1 */
  onBack: () => void;

  /** ยืนยันตัวตนสำเร็จ -> ส่งรูป base64 + ประเภท (in/out) กลับไปให้ App */
  onConfirm: (photoDataUrl: string, punchType: PunchType) => void;

  /** ไปดูประวัติ (ถ้าต้องการ) */
  onViewHistory?: () => void;
};

export default function FaceVerify({
  empCode,
  displayName,
  punchType,
  onBack,
  onConfirm,
}: Props) {
  const [step, setStep] = useState<Step>("capture");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [photo, setPhoto] = useState<string>("");

  // ถ้าเปลี่ยน punchType (in/out) ให้รีเซ็ตเป็น capture ใหม่
  useEffect(() => {
    setPhoto("");
    setErr("");
    setStep("capture");
  }, [punchType]);

  // ===== เปิดกล้อง (capture) =====
  useEffect(() => {
    if (step !== "capture") return;
    let canceled = false;
    setErr("");

    async function startCamera() {
      try {
        setBusy(true);
        if (!navigator.mediaDevices?.getUserMedia) {
          setErr("อุปกรณ์นี้ไม่รองรับการเปิดกล้อง กรุณาอัปโหลดรูปแทน");
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" }, // กล้องหน้า
          audio: false,
        });

        if (canceled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play();
        }
      } catch {
        setErr("ไม่สามารถเปิดกล้องได้ กรุณาอนุญาตกล้อง หรือใช้การอัปโหลดรูปแทน");
      } finally {
        setBusy(false);
      }
    }

    startCamera();

    return () => {
      canceled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [step]);

  function captureFromVideo() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const w = video.videoWidth || 720;
    const h = video.videoHeight || 720;
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, w, h);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    setPhoto(dataUrl);
    setStep("confirm");
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
    } catch {
      setErr("อัปโหลดรูปไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setBusy(false);
    }
  }

  function confirm() {
    if (!photo) return;
    onConfirm(photo, punchType);
  }

  function retake() {
    setPhoto("");
    setStep("capture");
  }

  const title =
    punchType === "in" ? "ยืนยันตัวตนเพื่อเข้างาน" : "ยืนยันตัวตนเพื่อออกงาน";

  return (
    <main className={styles.bg}>
      <div className={styles.home}>
        <section className={styles.homeCard} aria-label="Face Verify">
          <AppHeader empCode={empCode} displayName={displayName} />

          <h2 className={styles.title}>ลงเวลาเข้า-ออกงาน</h2>

          <div className={styles.card}>
            <div className={styles.titleText}>{title}</div>

            {/* ====== กล้อง/รูป ====== */}
            <div className={styles.frame} aria-label="กรอบถ่ายรูปใบหน้า">
              <div className={styles.topIcons} aria-hidden="true"></div>

              {/* overlay guide */}
              <div className={styles.circle} aria-hidden="true" />
              <span className={`${styles.corner} ${styles.tl}`} aria-hidden="true" />
              <span className={`${styles.corner} ${styles.tr}`} aria-hidden="true" />
              <span className={`${styles.corner} ${styles.bl}`} aria-hidden="true" />
              <span className={`${styles.corner} ${styles.br}`} aria-hidden="true" />

              {step === "capture" ? (
                <video
                  ref={videoRef}
                  className={styles.video}
                  playsInline
                  muted
                />
              ) : (
                <img className={styles.img} src={photo} alt="รูปยืนยันตัวตน" />
              )}

              {/* fallback: file input (ถ้าเปิดกล้องไม่ได้) */}
              <input
                className={styles.file}
                type="file"
                accept="image/*"
                capture="user"
                onChange={(e) => onPickFile(e.target.files?.[0])}
              />

              {/* canvas ซ่อนไว้ใช้ capture */}
              <canvas ref={canvasRef} className={styles.canvas} />
            </div>

            <div className={styles.text}>กรุณาถ่ายภาพใบหน้าเพื่อยืนยันตัวตน</div>
            {err ? <div className={styles.error}>{err}</div> : null}

            {/* ====== ปุ่มหลัก ====== */}
            {step === "capture" ? (
              <button
                type="button"
                className={styles.primary}
                onClick={captureFromVideo}
                disabled={busy}
              >
                <FontAwesomeIcon icon={faCamera} className={styles.primaryIcon} />
                ถ่ายภาพและยืนยัน
              </button>
            ) : (
              <>
                <button
                type="button"
                className={`${styles.primary} ${styles.green}`}
                onClick={confirm}
                disabled={busy}
                >
                <FontAwesomeIcon icon={faCircleCheck} className={styles.primaryIcon} />
                กดยืนยันตัวตน
                </button>


                <button
                  type="button"
                  className={styles.secondary}
                  onClick={retake}
                  disabled={busy}
                >
                  <FontAwesomeIcon icon={faRotateLeft} />
                  ถ่ายใหม่
                </button>
              </>
            )}

            <div className={styles.bottom}>
              <BackButton
                onClick={onBack}
                disabled={busy}
                className={styles.backBtn}
              />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
