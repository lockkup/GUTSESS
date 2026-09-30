import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

import styles from "./SignatureModal.module.css";

export type SignatureModalValue = {
  firstName: string;
  lastName: string;
  position: string;
  signatureDataUrl: string;
};

type Props = {
  initialValue?: SignatureModalValue | null;
  onClose: () => void;
  onSave: (value: SignatureModalValue) => void;
};

export default function SignatureModal({
  initialValue = null,
  onClose,
  onSave,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  const [firstName, setFirstName] = useState(initialValue?.firstName ?? "");
  const [lastName, setLastName] = useState(initialValue?.lastName ?? "");
  const [position, setPosition] = useState(initialValue?.position ?? "");
  const [hasSignature, setHasSignature] = useState(
    Boolean(initialValue?.signatureDataUrl),
  );
  const [error, setError] = useState("");

  const drawInitialSignature = useCallback(
    (canvas: HTMLCanvasElement) => {
      if (!initialValue?.signatureDataUrl) return;

      const context = canvas.getContext("2d");
      if (!context) return;

      const image = new Image();

      image.onload = () => {
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
      };

      image.src = initialValue.signatureDataUrl;
    },
    [initialValue],
  );

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const pixelRatio = window.devicePixelRatio || 1;

    canvas.width = Math.round(rect.width * pixelRatio);
    canvas.height = Math.round(rect.height * pixelRatio);

    const context = canvas.getContext("2d");
    if (!context) return;

    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = Math.max(2, 2.2 * pixelRatio);
    context.strokeStyle = "#111";

    drawInitialSignature(canvas);
  }, [drawInitialSignature]);

  useEffect(() => {
    resizeCanvas();

    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, [resizeCanvas]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function getCanvasPoint(event: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();

    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const point = getCanvasPoint(event);

    if (!canvas || !point) return;

    canvas.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    lastPointRef.current = point;
    setError("");
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;

    const canvas = canvasRef.current;
    const point = getCanvasPoint(event);
    const lastPoint = lastPointRef.current;

    if (!canvas || !point || !lastPoint) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    context.beginPath();
    context.moveTo(lastPoint.x, lastPoint.y);
    context.lineTo(point.x, point.y);
    context.stroke();

    lastPointRef.current = point;
    setHasSignature(true);
  }

  function stopDrawing(event: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;

    if (canvas?.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }

    drawingRef.current = false;
    lastPointRef.current = null;
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    context.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    setError("");
  }

  function handleConfirm() {
    const cleanFirstName = firstName.trim();
    const cleanLastName = lastName.trim();
    const cleanPosition = position.trim();

    if (!cleanFirstName || !cleanLastName || !cleanPosition) {
      setError("กรุณากรอกชื่อ นามสกุล และตำแหน่งงานให้ครบ");
      return;
    }

    if (!hasSignature) {
      setError("กรุณาลงลายมือชื่อ");
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    onSave({
      firstName: cleanFirstName,
      lastName: cleanLastName,
      position: cleanPosition,
      signatureDataUrl: canvas.toDataURL("image/png"),
    });
  }

  return (
    <div
      className={styles.overlay}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="signature-modal-title"
      >
        <header className={styles.header}>
          <h2 id="signature-modal-title">ลงลายมือชื่อ</h2>

          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="ปิด"
          >
            ×
          </button>
        </header>

        <div className={styles.body}>
          <label className={styles.field}>
            <span>ชื่อ</span>
            <input
              type="text"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              placeholder="กรอกชื่อ"
              autoComplete="given-name"
            />
          </label>

          <label className={styles.field}>
            <span>นามสกุล</span>
            <input
              type="text"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              placeholder="กรอกนามสกุล"
              autoComplete="family-name"
            />
          </label>

          <label className={styles.field}>
            <span>ตำแหน่งงาน</span>
            <input
              type="text"
              value={position}
              onChange={(event) => setPosition(event.target.value)}
              placeholder="กรอกตำแหน่งงาน"
            />
          </label>

          <div className={styles.signatureField}>
            <span className={styles.signatureLabel}>ลายมือชื่อ</span>

            <div className={styles.canvasWrap}>
              <canvas
                ref={canvasRef}
                className={styles.canvas}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={stopDrawing}
                onPointerCancel={stopDrawing}
                onPointerLeave={(event) => {
                  if (drawingRef.current) {
                    stopDrawing(event);
                  }
                }}
              />

              {!hasSignature ? (
                <div className={styles.canvasHint}>
                  ใช้นิ้ว ปากกา หรือเมาส์เซ็นในกรอบนี้
                </div>
              ) : null}
            </div>
          </div>

          {error ? (
            <div className={styles.error} role="alert">
              {error}
            </div>
          ) : null}
        </div>

        <footer className={styles.footer}>
          <button
            type="button"
            className={styles.clearButton}
            onClick={clearSignature}
          >
            ล้าง
          </button>

          <button
            type="button"
            className={styles.cancelButton}
            onClick={onClose}
          >
            ยกเลิก
          </button>

          <button
            type="button"
            className={styles.confirmButton}
            onClick={handleConfirm}
          >
            ยืนยัน
          </button>
        </footer>
      </section>
    </div>
  );
}
