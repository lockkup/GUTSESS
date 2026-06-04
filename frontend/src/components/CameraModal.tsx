// src/components/CameraModal.tsx

import { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCamera } from "@fortawesome/free-solid-svg-icons";
import styles from "./CameraModal.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
  onCaptured: (dataUrl: string) => void;
  closeOnBackdrop?: boolean;
  closeOnEsc?: boolean;
};

type ErrorState = {
  message: string;
  closeParent?: boolean;
} | null;

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

  const hasCapturedRef = useRef(false);

  const [busy, setBusy] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [errorState, setErrorState] = useState<ErrorState>(null);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.onloadedmetadata = null;
    }
  };

  const showError = (message: string, closeParent = false) => {
    setErrorState({ message, closeParent });
  };

  const closeErrorModal = () => {
    const shouldCloseParent = errorState?.closeParent ?? false;
    setErrorState(null);

    if (shouldCloseParent) {
      onClose();
    }
  };

  const handleClose = () => {
    if (busy || errorState) return;

    onClose();
  };

  const getCameraErrorMessage = (error: unknown) => {
    const err = error as DOMException | undefined;

    switch (err?.name) {
      case "NotAllowedError":
      case "PermissionDeniedError":
        return "เปิดกล้องไม่สำเร็จ กรุณาอนุญาตการใช้กล้อง";

      case "NotFoundError":
      case "DevicesNotFoundError":
        return "เปิดกล้องไม่สำเร็จ ไม่พบอุปกรณ์กล้อง";

      case "NotReadableError":
      case "TrackStartError":
        return "เปิดกล้องไม่สำเร็จ กล้องกำลังถูกใช้งานโดยโปรแกรมอื่น";

      case "OverconstrainedError":
      case "ConstraintNotSatisfiedError":
        return "เปิดกล้องไม่สำเร็จ อุปกรณ์นี้ไม่รองรับการตั้งค่ากล้อง";

      case "AbortError":
        return "เปิดกล้องไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";

      default:
        return "เปิดกล้องไม่สำเร็จ กรุณาตรวจสอบการตั้งค่ากล้อง";
    }
  };

  useEffect(() => {
    if (!open || !closeOnEsc) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (errorState || busy) return;

      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, closeOnEsc, onClose, errorState, busy]);

  useEffect(() => {
    if (!open) return;

    let canceled = false;

    setBusy(false);
    setIsReady(false);
    setErrorState(null);
    hasCapturedRef.current = false;

    const startCamera = async () => {
      try {
        setBusy(true);

        if (!navigator.mediaDevices?.getUserMedia) {
          showError("อุปกรณ์นี้ไม่รองรับการเปิดกล้อง", true);
          return;
        }

        let stream: MediaStream;

        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: "user",
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          });
        } catch (firstError) {
          console.warn("primary camera open failed:", firstError);

          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        }

        if (canceled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        const video = videoRef.current;

        if (!video) return;

        video.srcObject = stream;

        await new Promise<void>((resolve, reject) => {
          video.onloadedmetadata = () => resolve();
          video.onerror = () => reject(new Error("video metadata load failed"));
        });

        await video.play();

        if (canceled) return;

        setIsReady(true);
      } catch (error) {
        console.error("open camera failed:", error);
        stopCamera();
        showError(getCameraErrorMessage(error), true);
      } finally {
        if (!canceled) {
          setBusy(false);
        }
      }
    };

    void startCamera();

    return () => {
      canceled = true;
      setIsReady(false);
      stopCamera();
    };
  }, [open]);

  const canCapture = isReady && !busy && !errorState;

  const capture = () => {
    if (hasCapturedRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) return;

    try {
      hasCapturedRef.current = true;
      setBusy(true);

      const width = video.videoWidth || 720;
      const height = video.videoHeight || 720;

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");

      if (!ctx) {
        throw new Error("ไม่สามารถเตรียมภาพจากกล้องได้");
      }

      ctx.drawImage(video, 0, 0, width, height);

      const dataUrl = canvas.toDataURL("image/jpeg", 0.92);

      stopCamera();
      onCaptured(dataUrl);
      onClose();
    } catch (error) {
      hasCapturedRef.current = false;

      showError(
        error instanceof Error ? error.message : "ถ่ายภาพไม่สำเร็จ",
        false,
      );
    } finally {
      setBusy(false);
    }
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
        if (errorState || busy) return;

        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
        <button
          type="button"
          className={styles.close}
          onClick={handleClose}
          aria-label="ปิด"
          disabled={busy || !!errorState}
        >
          ×
        </button>

        <div className={styles.hero}>
          <div className={styles.heroTitle}>กรุณาถ่ายรูปเพื่อยืนยัน</div>
        </div>

        <div className={styles.body}>
          <div className={styles.frame}>
            <video ref={videoRef} className={styles.video} playsInline muted />
            <canvas ref={canvasRef} className={styles.canvas} />
          </div>

          <button
            type="button"
            className={styles.captureBtn}
            onClick={capture}
            disabled={!canCapture}
          >
            <FontAwesomeIcon icon={faCamera} />
            {busy ? "กำลังถ่ายภาพ..." : "ถ่ายภาพ"}
          </button>
        </div>

        {errorState && (
          <div
            className={styles.errorOverlay}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className={styles.errorCard}>
              <div className={styles.errorTitle}>แจ้งเตือน</div>

              <div className={styles.errorMessage}>{errorState.message}</div>

              <button
                type="button"
                className={styles.errorBtn}
                onClick={closeErrorModal}
              >
                ตกลง
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}