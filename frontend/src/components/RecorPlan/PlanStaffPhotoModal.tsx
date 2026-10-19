import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent as ReactKeyboardEvent } from "react";
import CameraModal from "@/components/CameraModal";
import styles from "./PlanStaffPhotoModal.module.css";

/** ฟอร์มเฉพาะรูปถ่ายและข้อมูลย่อของกำลังพลในข้อ 2 (ตามแผน) */
export type PlanStaffPhotoValue = {
  summary: string;
  /** รูปที่ถ่ายในรอบการตรวจปัจจุบัน; null เมื่อยังไม่มีรูป */
  imageDataUrl: string | null;
};

export type PlanStaffPhotoModalProps = {
  open: boolean;
  siteName: string;
  staffName: string;
  position?: string;
  itemNumber?: string;
  initialSummary?: string;
  /** ส่งได้เฉพาะรูปที่ถ่ายในรอบการตรวจปัจจุบัน ห้ามส่งรูปย้อนหลัง */
  currentPhotoDataUrl?: string | null;
  disabled?: boolean;
  onClose: () => void;
  onSave: (value: PlanStaffPhotoValue) => void | Promise<void>;
};

const MAX_SUMMARY_LENGTH = 250;
const CAPTURED_IMAGE_PATTERN = /^data:image\/(?:jpeg|jpg|png|webp);base64,/i;

/**
 * Modal ย่อยเฉพาะแถวกำลังพลในข้อ 2
 * - ดู/กรอกข้อมูลย่อและถ่ายรูปใหม่ผ่าน CameraModal ของระบบ
 * - ไม่มีช่องแก้ชื่อหรือตำแหน่ง (ใช้ Modal เพิ่ม/แก้ไขบุคลากรแยกต่างหาก)
 * - ไม่เรียก API เอง; ส่งผลกลับ RecorPlan ผ่าน onSave
 */
export default function PlanStaffPhotoModal({
  open,
  siteName,
  staffName,
  position = "",
  itemNumber,
  initialSummary = "",
  currentPhotoDataUrl = null,
  disabled = false,
  onClose,
  onSave,
}: PlanStaffPhotoModalProps) {
  const [summary, setSummary] = useState(initialSummary);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(
    currentPhotoDataUrl,
  );
  const [cameraOpen, setCameraOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const dialogRef = useRef<HTMLDivElement>(null);
  const summaryRef = useRef<HTMLTextAreaElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const headingId = useId();
  const descriptionId = useId();
  const busy = disabled || saving;

  useEffect(() => {
    if (!open) return;
    setSummary(initialSummary);
    // รูปนี้ต้องเป็นรูปของการตรวจครั้งปัจจุบันที่หน้าหลักส่งมาเท่านั้น
    setPhotoDataUrl(currentPhotoDataUrl);
    setCameraOpen(false);
    setSaving(false);
    setError("");
  }, [open, initialSummary, currentPhotoDataUrl]);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = oldOverflow;
      previousFocusRef.current?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (open && !cameraOpen) summaryRef.current?.focus();
  }, [open, cameraOpen]);

  useEffect(() => {
    if (!open || cameraOpen || busy) return;
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, cameraOpen, busy, onClose]);

  if (!open) return null;

  function handleClose() {
    if (!busy && !cameraOpen) onClose();
  }

  function handleFocusTrap(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab" || cameraOpen) return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), textarea:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (!focusable?.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || cameraOpen) return;

    const cleanSummary = summary.trim();
    if (!cleanSummary && !photoDataUrl) {
      setError("กรุณาเพิ่มข้อมูลย่อหรือถ่ายรูปอย่างน้อยหนึ่งรายการ");
      summaryRef.current?.focus();
      return;
    }
    setError("");
    setSaving(true);
    try {
      await onSave({ summary: cleanSummary, imageDataUrl: photoDataUrl });
      onClose();
    } catch (saveError) {
      setError(
        saveError instanceof Error && saveError.message
          ? saveError.message
          : "บันทึกข้อมูลไม่สำเร็จ กรุณาลองอีกครั้ง",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {!cameraOpen && (
        <div
          className={styles.backdrop}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) handleClose();
          }}
        >
          <div
            ref={dialogRef}
            className={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby={headingId}
            aria-describedby={descriptionId}
            onKeyDown={handleFocusTrap}
          >
            <header className={styles.header}>
              <h2 className={styles.title} id={headingId}>
                รูปถ่ายและข้อมูลย่อ — กำลังพล
              </h2>
              <button
                type="button"
                className={styles.closeButton}
                aria-label="ปิดหน้าต่าง"
                disabled={busy}
                onClick={handleClose}
              >
                ×
              </button>
            </header>

            <form className={styles.form} onSubmit={(event) => void handleSubmit(event)}>
              <div className={styles.context} id={descriptionId}>
                <div><strong>จุดรักษาการณ์:</strong> {siteName || "-"}</div>
                {itemNumber && <div><strong>รายการ:</strong> {itemNumber}</div>}
                <div><strong>ชื่อ:</strong> {staffName || "-"}</div>
                {position && <div><strong>ตำแหน่ง:</strong> {position}</div>}
              </div>

              <label className={styles.label} htmlFor={`${headingId}-summary`}>
                ข้อมูลย่อ / หมายเหตุ
              </label>
              <textarea
                ref={summaryRef}
                id={`${headingId}-summary`}
                className={styles.textarea}
                rows={4}
                maxLength={MAX_SUMMARY_LENGTH}
                value={summary}
                disabled={busy}
                placeholder="ระบุรายละเอียดสั้น ๆ ของการตรวจครั้งนี้"
                onChange={(event) => {
                  setSummary(event.target.value);
                  setError("");
                }}
              />
              <span className={styles.counter}>
                {summary.length}/{MAX_SUMMARY_LENGTH} ตัวอักษร
              </span>

              <div className={styles.photoHeading}>รูปถ่ายในการตรวจครั้งนี้</div>
              <p className={styles.photoHint}>
                ถ่ายภาพใหม่ผ่านกล้องเท่านั้น ไม่คัดลอกรูปจากรายงานครั้งก่อน
              </p>
              {photoDataUrl ? (
                <div className={styles.photoBox}>
                  <img
                    className={styles.photoPreview}
                    src={photoDataUrl}
                    alt={`ภาพที่ถ่ายในการตรวจครั้งนี้ของ ${staffName || "พนักงาน"}`}
                  />
                  <div className={styles.photoActions}>
                    <button
                      type="button"
                      className={styles.cameraButton}
                      disabled={busy}
                      onClick={() => setCameraOpen(true)}
                    >
                      ถ่ายใหม่
                    </button>
                    <button
                      type="button"
                      className={styles.removeButton}
                      disabled={busy}
                      onClick={() => setPhotoDataUrl(null)}
                    >
                      นำรูปออก
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className={styles.cameraButton}
                  disabled={busy}
                  onClick={() => setCameraOpen(true)}
                >
                  เปิดกล้องถ่ายรูป
                </button>
              )}

              {error && <p className={styles.error} role="alert">{error}</p>}

              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.cancelButton}
                  disabled={busy}
                  onClick={handleClose}
                >
                  ยกเลิก
                </button>
                <button type="submit" className={styles.saveButton} disabled={busy}>
                  {saving ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <CameraModal
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCaptured={(dataUrl) => {
          if (!CAPTURED_IMAGE_PATTERN.test(dataUrl)) {
            setError("รูปภาพจากกล้องไม่ถูกต้อง กรุณาถ่ายใหม่");
            setCameraOpen(false);
            return;
          }
          setPhotoDataUrl(dataUrl);
          setError("");
          setCameraOpen(false);
        }}
      />
    </>
  );
}
