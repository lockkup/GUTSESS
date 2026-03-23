import { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCamera } from "@fortawesome/free-solid-svg-icons";
import styles from "./CameraModal.module.css";

// ✅ Face Detection (TensorFlow.js)
import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-backend-webgl";
import * as faceDetection from "@tensorflow-models/face-detection";

type Props = {
  open: boolean;
  onClose: () => void;

  /** ได้รูปกลับไปเป็น dataUrl */
  onCaptured: (dataUrl: string) => void;

  /** ถ้าจะให้ปิดด้วยการคลิกฉากหลัง */
  closeOnBackdrop?: boolean;
  closeOnEsc?: boolean;
};

function normalizeBox(box: any) {
  const xMin = Number(box?.xMin ?? box?.left ?? box?.topLeft?.[0] ?? box?.topLeft?.x ?? 0);
  const yMin = Number(box?.yMin ?? box?.top ?? box?.topLeft?.[1] ?? box?.topLeft?.y ?? 0);

  const w = Number(
    box?.width ??
      (box?.xMax != null && box?.xMin != null ? Number(box.xMax) - Number(box.xMin) : undefined) ??
      (box?.bottomRight?.[0] != null && box?.topLeft?.[0] != null
        ? Number(box.bottomRight[0]) - Number(box.topLeft[0])
        : undefined) ??
      (box?.bottomRight?.x != null && box?.topLeft?.x != null
        ? Number(box.bottomRight.x) - Number(box.topLeft.x)
        : 0)
  );

  const h = Number(
    box?.height ??
      (box?.yMax != null && box?.yMin != null ? Number(box.yMax) - Number(box.yMin) : undefined) ??
      (box?.bottomRight?.[1] != null && box?.topLeft?.[1] != null
        ? Number(box.bottomRight[1]) - Number(box.topLeft[1])
        : undefined) ??
      (box?.bottomRight?.y != null && box?.topLeft?.y != null
        ? Number(box.bottomRight.y) - Number(box.topLeft.y)
        : 0)
  );

  return { xMin, yMin, w, h };
}

export default function CameraModal({
  open,
  onClose,
  onCaptured,
  closeOnBackdrop = true,
  closeOnEsc = true,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const detectorRef = useRef<faceDetection.FaceDetector | null>(null);
  const rafRef = useRef<number | null>(null);

  const [busy, setBusy] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const [detectorReady, setDetectorReady] = useState(false);
  const [hasFace, setHasFace] = useState(false);
  const [faceInCircle, setFaceInCircle] = useState(false);
  const [faceMessage, setFaceMessage] = useState("กำลังโหลดระบบตรวจจับใบหน้า...");

  const [forceEnableCapture, setForceEnableCapture] = useState(false);

  // โหลด detector ครั้งเดียว
  useEffect(() => {
    let canceled = false;

    const load = async () => {
      try {
        await tf.ready();
        await tf.setBackend("webgl");
        await tf.ready();

        const model = faceDetection.SupportedModels.MediaPipeFaceDetector;
        const detector = await faceDetection.createDetector(model, { runtime: "tfjs" });

        if (canceled) return;
        detectorRef.current = detector;
        setDetectorReady(true);
        setFaceMessage("✅ พร้อมตรวจจับใบหน้า");
      } catch (e) {
        console.error("❌ load face detector failed:", e);
        detectorRef.current = null;
        setDetectorReady(false);
        setFaceMessage("❌ ตรวจจับใบหน้าไม่ได้");
      }
    };

    load();
    return () => {
      canceled = true;
    };
  }, []);

  // ESC ปิด
  useEffect(() => {
    if (!open || !closeOnEsc) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, closeOnEsc, onClose]);

  // เปิดกล้องเมื่อ open
  useEffect(() => {
    if (!open) return;

    let canceled = false;

    // reset state เมื่อเปิด
    setBusy(false);
    setIsReady(false);
    setHasFace(false);
    setFaceInCircle(false);
    setForceEnableCapture(false);
    setFaceMessage(detectorRef.current ? "✅ พร้อมตรวจจับใบหน้า" : "กำลังโหลดระบบตรวจจับใบหน้า...");

    const startCamera = async () => {
      try {
        setBusy(true);

        if (!navigator.mediaDevices?.getUserMedia) {
          setFaceMessage("อุปกรณ์นี้ไม่รองรับการเปิดกล้อง");
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
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
          video.onloadedmetadata = async () => {
            try {
              await video.play();
              if (canceled) return;
              setIsReady(true);
            } catch {
              setFaceMessage("ไม่สามารถเล่นวิดีโอได้");
            }
          };
        }
      } catch {
        setFaceMessage("ไม่สามารถเปิดกล้องได้ กรุณาอนุญาตกล้อง");
      } finally {
        setBusy(false);
      }
    };

    startCamera();

    return () => {
      canceled = true;

      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }

      setIsReady(false);
      setHasFace(false);
      setFaceInCircle(false);
      setForceEnableCapture(false);

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [open]);

  // fallback ปลดล็อกถ่าย ถ้าโมเดลยังไม่ตอบ
  useEffect(() => {
    if (!open) return;
    setForceEnableCapture(false);
    if (!isReady) return;

    const t = window.setTimeout(() => setForceEnableCapture(true), 2500);
    return () => window.clearTimeout(t);
  }, [open, isReady]);

  // detection loop
  useEffect(() => {
    if (!open) return;
    if (!isReady) return;
    if (!detectorReady) return;

    const detector = detectorRef.current;
    if (!detector) return;

    let lastTime = 0;
    const INTERVAL = 250;

    const loop = async () => {
      const video = videoRef.current;
      const now = performance.now();

      if (!open) return;

      if (!video || video.readyState !== 4) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      if (now - lastTime < INTERVAL) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }
      lastTime = now;

      try {
        const faces = await detector.estimateFaces(video, { flipHorizontal: true });

        if (!faces.length) {
          setHasFace(false);
          setFaceInCircle(false);
          setFaceMessage("🔍 ไม่พบใบหน้า");
          rafRef.current = requestAnimationFrame(loop);
          return;
        }

        setHasFace(true);

        const bestFace: any = faces.reduce((best: any, cur: any) => {
          const bb = normalizeBox(best?.box);
          const cb = normalizeBox(cur?.box);
          const bestArea = Math.max(0, bb.w) * Math.max(0, bb.h);
          const curArea = Math.max(0, cb.w) * Math.max(0, cb.h);
          return curArea > bestArea ? cur : best;
        }, faces[0]);

        const { xMin, yMin, w, h } = normalizeBox(bestFace.box);
        const frameWidth = video.videoWidth || 1;
        const frameHeight = video.videoHeight || 1;
        const minDim = Math.min(frameWidth, frameHeight);

        if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
          setFaceInCircle(false);
          setFaceMessage("✅ พบใบหน้าแล้ว (แนะนำขยับให้อยู่กลางวง)");
          rafRef.current = requestAnimationFrame(loop);
          return;
        }

        const faceCenterX = (xMin + w / 2) / frameWidth;
        const faceCenterY = (yMin + h / 2) / frameHeight;

        const dx = faceCenterX - 0.5;
        const dy = faceCenterY - 0.5;
        const distN = Math.hypot(dx, dy);

        const radiusN = 0.30;
        const minFaceSize = minDim * 0.16;
        const faceOkSize = Math.max(w, h) >= minFaceSize;

        const inside = distN <= radiusN * 1.05 && faceOkSize;

        setFaceInCircle(inside);
        if (inside) setFaceMessage("✅ ใบหน้าอยู่ในวงแล้ว");
        else if (!faceOkSize) setFaceMessage("➡️ เข้ามาใกล้กล้องอีกนิด");
        else setFaceMessage("⬅️➡️ ขยับใบหน้าให้อยู่กึ่งกลางวง");
      } catch {
        setFaceInCircle(false);
        setFaceMessage("⚠️ ตรวจจับขัดข้อง ลองเพิ่มแสง/ขยับเล็กน้อย");
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [open, isReady, detectorReady]);

  const canCapture = isReady && !busy && (hasFace || forceEnableCapture);

  const capture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    if (!hasFace && !forceEnableCapture) return;

    const w = video.videoWidth || 720;
    const h = video.videoHeight || 720;
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, w, h);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);

    onCaptured(dataUrl);
    onClose();
  };

  if (!open) return null;

  return (
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-label="เปิดกล้องถ่ายภาพ"
      onMouseDown={(e) => {
        if (!closeOnBackdrop) return;
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.title}>เปิดกล้องถ่ายภาพ</div>
          <button type="button" className={styles.close} onClick={onClose} aria-label="ปิด">
            ✕
          </button>
        </div>

        <div className={styles.body}>
          <div className={`guts-fv-frame ${styles.frame}`}>
            {/* overlay guide (คงชื่อ class เดิมไว้) */}
            <div
              className={`guts-fv-circle ${styles.circle}`}
              aria-hidden="true"
              style={{
                borderColor: faceInCircle || hasFace ? "#00FF00" : "#fff",
                boxShadow: faceInCircle || hasFace ? "0 0 0 3px rgba(31,191,91,0.35)" : "none",
                transition: "border-color 0.2s ease, box-shadow 0.2s ease",
              }}
            />

            <span className={`guts-fv-corner tl ${styles.corner} ${styles.tl}`} aria-hidden="true" />
            <span className={`guts-fv-corner tr ${styles.corner} ${styles.tr}`} aria-hidden="true" />
            <span className={`guts-fv-corner bl ${styles.corner} ${styles.bl}`} aria-hidden="true" />
            <span className={`guts-fv-corner br ${styles.corner} ${styles.br}`} aria-hidden="true" />

            <video ref={videoRef} className={`guts-fv-video ${styles.video}`} playsInline muted />

            <div
              className={styles.status}
              style={{ color: faceInCircle ? "#00FF00" : "#fff" }}
            >
              {isReady ? faceMessage : "กำลังเปิดกล้อง..."}
            </div>

            <canvas ref={canvasRef} className={styles.canvas} />
          </div>

          <button type="button" className={styles.captureBtn} onClick={capture} disabled={!canCapture}>
            <FontAwesomeIcon icon={faCamera} />
            ถ่ายภาพ
          </button>
        </div>
      </div>
    </div>
  );
}
