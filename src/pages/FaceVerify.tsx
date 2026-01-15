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
    <main className="guts-bg">
      <div className="guts-home">
        <section className="guts-home-card" aria-label="Face Verify">
          <AppHeader empCode={empCode} displayName={displayName} />

          <h2 className="guts-att-title">ลงเวลาเข้า-ออกงาน</h2>

          <div className="guts-fv-card">
            <div className="guts-fv-title">{title}</div>

            {/* ====== กล้อง/รูป ====== */}
            <div className="guts-fv-frame" aria-label="กรอบถ่ายรูปใบหน้า">
              <div className="guts-fv-topIcons" aria-hidden="true"></div>

              {/* overlay guide */}
              <div className="guts-fv-circle" aria-hidden="true" />
              <span className="guts-fv-corner tl" aria-hidden="true" />
              <span className="guts-fv-corner tr" aria-hidden="true" />
              <span className="guts-fv-corner bl" aria-hidden="true" />
              <span className="guts-fv-corner br" aria-hidden="true" />

              {step === "capture" ? (
                <video
                  ref={videoRef}
                  className="guts-fv-video"
                  playsInline
                  muted
                />
              ) : (
                <img className="guts-fv-img" src={photo} alt="รูปยืนยันตัวตน" />
              )}

              {/* fallback: file input (ถ้าเปิดกล้องไม่ได้) */}
              <input
                className="guts-fv-file"
                type="file"
                accept="image/*"
                capture="user"
                onChange={(e) => onPickFile(e.target.files?.[0])}
              />

              {/* canvas ซ่อนไว้ใช้ capture */}
              <canvas ref={canvasRef} className="guts-fv-canvas" />
            </div>

            <div className="guts-fv-text">กรุณาถ่ายภาพใบหน้าเพื่อยืนยันตัวตน</div>
            {err ? <div className="guts-fv-error">{err}</div> : null}

            {/* ====== ปุ่มหลัก ====== */}
            {step === "capture" ? (
              <button
                type="button"
                className="guts-fv-primary"
                onClick={captureFromVideo}
                disabled={busy}
              >
                <FontAwesomeIcon icon={faCamera} className="guts-fv-primaryIcon" />
                ถ่ายภาพและยืนยัน
              </button>
            ) : (
              <>
                <button
                type="button"
                className="guts-fv-primary guts-fv-primary--green"
                onClick={confirm}
                disabled={busy}
                >
                <FontAwesomeIcon icon={faCircleCheck} className="guts-fv-primaryIcon" />
                กดยืนยันตัวตน
                </button>


                <button
                  type="button"
                  className="guts-fv-secondary"
                  onClick={retake}
                  disabled={busy}
                >
                  <FontAwesomeIcon icon={faRotateLeft} />
                  ถ่ายใหม่
                </button>
              </>
            )}

            <div className="guts-fv-bottom">
              <BackButton
                onClick={onBack}
                disabled={busy}
                className="guts-fv-backBtn"
              />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
