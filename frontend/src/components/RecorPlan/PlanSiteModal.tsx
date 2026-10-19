import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent as ReactKeyboardEvent } from "react";
import CameraModal from "@/components/CameraModal";
import styles from "./PlanSiteModal.module.css";

/** ฟอร์มจุดรักษาการณ์ของหัวข้อ 2 เท่านั้น (ไม่ใช่ฟอร์มกำลังพลรายคน) */
export type PlanSiteModalValue = {
  text: string;
  detail: string;
  /** รูปที่ถ่ายใหม่ในการตรวจครั้งปัจจุบัน หรือ null หากยังไม่แนบ/นำออก */
  imageDataUrl: string | null;
};

type Props = {
  open: boolean;
  itemNumber: string;
  editing?: boolean;
  initialValue?: Partial<PlanSiteModalValue> | null;
  disabled?: boolean;
  onClose: () => void;
  onSave: (value: PlanSiteModalValue) => void | Promise<void>;
};

const PHOTO_DATA_URL = /^data:image\/(?:jpeg|jpg|png|webp);base64,/i;

/**
 * Modal เพิ่ม/แก้ไขจุดรักษาการณ์ (ข้อ 2)
 * ใช้ CameraModal ของระบบในการถ่ายรูปใหม่ ไม่มีการเลือกรูปเก่าจากเครื่อง
 * บันทึกเฉพาะเข้า state ของ RecorPlan; Backend เป็นหน้าที่ของหน้าหลัก
 */
export default function PlanSiteModal({
  open,
  itemNumber,
  editing = false,
  initialValue = null,
  disabled = false,
  onClose,
  onSave,
}: Props) {
  const [name, setName] = useState(initialValue?.text ?? "");
  const [detail, setDetail] = useState(initialValue?.detail ?? "");
  const [photo, setPhoto] = useState<string | null>(initialValue?.imageDataUrl ?? null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const headingId = useId();
  const descriptionId = useId();
  const busy = disabled || saving;

  useEffect(() => {
    if (!open) return;
    setName(initialValue?.text ?? "");
    setDetail(initialValue?.detail ?? "");
    // ภาพจาก RecorPlan ต้องเป็นของรอบการตรวจปัจจุบันเท่านั้น
    setPhoto(initialValue?.imageDataUrl ?? null);
    setCameraOpen(false);
    setSaving(false);
    setError("");
  }, [open, initialValue?.text, initialValue?.detail, initialValue?.imageDataUrl]);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (open && !cameraOpen) nameRef.current?.focus();
  }, [open, cameraOpen]);

  useEffect(() => {
    if (!open || cameraOpen || busy) return;
    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [open, cameraOpen, busy, onClose]);

  if (!open) return null;

  function close() {
    if (!busy && !cameraOpen) onClose();
  }

  function trapTab(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab" || cameraOpen) return;
    const nodes = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (!nodes?.length) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || cameraOpen) return;
    const text = name.trim();
    if (!text) {
      setError("กรุณาระบุชื่อจุดรักษาการณ์");
      nameRef.current?.focus();
      return;
    }
    setError("");
    setSaving(true);
    try {
      await onSave({ text, detail: detail.trim(), imageDataUrl: photo });
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "ไม่สามารถบันทึกข้อมูลได้");
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
            if (event.target === event.currentTarget) close();
          }}
        >
          <div
            ref={dialogRef}
            className={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby={headingId}
            aria-describedby={descriptionId}
            onKeyDown={trapTab}
          >
            <header className={styles.header}>
              <h2 className={styles.title} id={headingId}>
                {editing ? "แก้ไขข้อมูล" : "เพิ่มข้อมูล"} ข้อ 2
              </h2>
              <button
                className={styles.closeButton}
                type="button"
                aria-label="ปิดหน้าต่าง"
                disabled={busy}
                onClick={close}
              >
                ×
              </button>
            </header>
            <form className={styles.form} onSubmit={(event) => void submit(event)}>
              <p className={styles.context} id={descriptionId}>
                2. การตรวจจุดรักษาการณ์ประจำวัน — รายการ {itemNumber}
              </p>
              <label className={styles.label} htmlFor={`${headingId}-name`}>
                ชื่อจุดรักษาการณ์ <span className={styles.required}>*</span>
              </label>
              <input
                ref={nameRef}
                id={`${headingId}-name`}
                className={styles.input}
                value={name}
                maxLength={150}
                required
                disabled={busy}
                placeholder="เช่น ป้อมหน้า"
                onChange={(event) => { setName(event.target.value); setError(""); }}
              />
              <label className={styles.label} htmlFor={`${headingId}-detail`}>
                ข้อมูลย่อ / หมายเหตุ
              </label>
              <textarea
                id={`${headingId}-detail`}
                className={styles.textarea}
                value={detail}
                maxLength={250}
                rows={3}
                disabled={busy}
                placeholder="ระบุข้อมูลเพิ่มเติมของจุดรักษาการณ์ (ถ้ามี)"
                onChange={(event) => setDetail(event.target.value)}
              />
              <div className={styles.counter}>{detail.length}/250 ตัวอักษร</div>
              <div className={styles.label}>รูปถ่ายจุดรักษาการณ์</div>
              <p className={styles.hint}>ต้องถ่ายใหม่ผ่านกล้อง ไม่ดึงรูปจากการตรวจครั้งก่อน</p>
              {photo && (
                <div className={styles.photoBox}>
                  <img className={styles.photo} src={photo} alt="รูปจุดรักษาการณ์ที่ถ่ายในการตรวจครั้งนี้" />
                </div>
              )}
              <div className={styles.photoActions}>
                <button
                  type="button"
                  className={styles.cameraButton}
                  disabled={busy}
                  onClick={() => setCameraOpen(true)}
                >
                  {photo ? "ถ่ายรูปใหม่" : "เปิดกล้องถ่ายรูป"}
                </button>
                {photo && (
                  <button
                    type="button"
                    className={styles.removeButton}
                    disabled={busy}
                    onClick={() => setPhoto(null)}
                  >
                    นำรูปออก
                  </button>
                )}
              </div>
              {error && <p className={styles.error} role="alert">{error}</p>}
              <div className={styles.actions}>
                <button className={styles.cancelButton} type="button" disabled={busy} onClick={close}>
                  ยกเลิก
                </button>
                <button className={styles.saveButton} type="submit" disabled={busy || !name.trim()}>
                  {saving ? "กำลังบันทึก..." : "บันทึก"}
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
          if (!PHOTO_DATA_URL.test(dataUrl)) {
            setError("รูปภาพจากกล้องไม่ถูกต้อง กรุณาถ่ายใหม่");
            setCameraOpen(false);
            return;
          }
          setPhoto(dataUrl);
          setError("");
          setCameraOpen(false);
        }}
      />
    </>
  );
}
