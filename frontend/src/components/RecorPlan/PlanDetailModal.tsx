import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import CameraModal from "@/components/CameraModal";
import styles from "./PlanDetailModal.module.css";

/** กลุ่มรายละเอียดภายในจุดรักษาการณ์ของ RecorPlan */
export type PlanDetailType = "appearance" | "staffing" | "note";

/** รูปภาพที่ส่งกลับเป็นรูปที่เพิ่งถ่ายในรอบนี้เท่านั้น */
export type PlanDetailModalValue = {
  detail: string;
  staffName: string;
  namePrefix?: string;
  position: string;
  imageDataUrl: string | null;
};

export type PlanDetailModalProps = {
  open: boolean;
  detailType: PlanDetailType;
  /** ชื่อจุดตรวจจากข้อมูลจริงของหน้าหลัก */
  siteName?: string;
  /** สีแถบหัวข้อสำหรับใช้ Modal ร่วมกันในข้อ 3–6 */
  headerColor?: "blue" | "red" | "yellow";
  /** เช่น 2.1.1 หรือ 2.1.1.2 */
  itemNumber?: string;
  /** ชื่อหัวข้อจากหน้าหลัก; ไม่ระบุจะใช้ชื่อมาตรฐานตาม detailType */
  sectionTitle?: string;
  editing?: boolean;
  /** ค่าเดิมเฉพาะข้อความ: ไม่รับ/ไม่แสดงรูปภาพเก่าจาก Backend */
  initialValue?: Partial<Omit<PlanDetailModalValue, "imageDataUrl">> | null;
  disabled?: boolean;
  /** เปิดใช้เมื่อรายการนั้นบังคับให้ต้องถ่ายรูปใหม่ */
  requireNewPhoto?: boolean;
  maxLength?: number;
  onClose: () => void;
  /** ส่งค่ากลับหน้าหลักให้เป็นผู้จัดการ state และบันทึกผ่าน API */
  onSave: (value: PlanDetailModalValue) => void | Promise<void>;
};

/**
 * หน้าต่างเพิ่ม/แก้ไขรายละเอียดจุดรักษาการณ์ (ตามแผน)
 * - appearance: ระบุการแต่งกายที่ไม่ถูกระเบียบ
 * - staffing: ระบุชื่อ ตำแหน่ง และรายละเอียดกำลังพล
 * - note: กรอกรายการข้อความของหัวข้อ 3–6 โดยไม่แสดงช่องรูป/ชื่อพนักงาน
 * - ใช้ CameraModal เดิม; รูปต้องถ่ายใหม่ ไม่ใช้รูปเก่าแทน
 * - ไม่เรียก Backend และไม่สร้างข้อมูลตัวอย่างเอง
 */
export default function PlanDetailModal({
  open,
  detailType,
  siteName = "",
  headerColor,
  itemNumber,
  sectionTitle,
  editing = false,
  initialValue = null,
  disabled = false,
  requireNewPhoto = false,
  maxLength = 1000,
  onClose,
  onSave,
}: PlanDetailModalProps) {
  const initialDetail = initialValue?.detail ?? "";
  const initialStaffName = initialValue?.staffName ?? "";
  const initialNamePrefix = initialValue?.namePrefix ?? "";
  const initialPosition = initialValue?.position ?? "";

  const [detail, setDetail] = useState(initialDetail);
  const [staffName, setStaffName] = useState(initialStaffName);
  const [namePrefix, setNamePrefix] = useState(initialNamePrefix);
  const [position, setPosition] = useState(initialPosition);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const dialogRef = useRef<HTMLDivElement>(null);
  const staffInputRef = useRef<HTMLInputElement>(null);
  const detailInputRef = useRef<HTMLTextAreaElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  const errorId = useId();
  const busy = saving || disabled;
  const isStaffing = detailType === "staffing";
  const isAppearance = detailType === "appearance";
  const isNote = detailType === "note";
  const headerStyle = headerColor ?? (isStaffing ? "blue" : "red");

  useEffect(() => {
    if (!open) return;
    setDetail(initialDetail);
    setStaffName(initialStaffName);
    setNamePrefix(initialNamePrefix);
    setPosition(initialPosition);
    setImageDataUrl(null); // ห้ามนำรูปเก่ามาเป็นรูปถ่ายใหม่
    setError("");
    setSaving(false);
    setCameraOpen(false);
  }, [open, detailType, initialDetail, initialStaffName, initialNamePrefix, initialPosition]);

  useEffect(() => {
    if (!open) return;
    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
      previouslyFocusedRef.current?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (open && !cameraOpen) {
      (isStaffing ? staffInputRef.current : detailInputRef.current)?.focus();
    }
  }, [open, cameraOpen, detailType]);

  useEffect(() => {
    if (!open || cameraOpen || busy) return;
    function handleEscape(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, cameraOpen, busy, onClose]);

  if (!open) return null;

  const title = sectionTitle?.trim() ||
    (isStaffing ? "กำลังพลประจำจุดรักษาการณ์" : isNote ? "รายละเอียดรายงาน" : "การแต่งกาย (ไม่ถูกระเบียบที่กำหนด)");

  function handleClose() {
    if (!busy && !cameraOpen) onClose();
  }

  function handleKeyboardTrap(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
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

    const cleanDetail = detail.trim();
    const cleanStaffName = staffName.trim();
    const cleanPosition = position.trim();

    if (isStaffing ? !cleanStaffName : !cleanDetail) {
      setError(isStaffing ? "กรุณาระบุชื่อ-นามสกุล" : "กรุณาระบุรายละเอียด");
      (isStaffing ? staffInputRef.current : detailInputRef.current)?.focus();
      return;
    }
    if (isStaffing && requireNewPhoto && !imageDataUrl) {
      setError("กรุณาถ่ายรูปใหม่ก่อนบันทึก");
      return;
    }

    setError("");
    setSaving(true);
    try {
      await onSave({
        detail: cleanDetail,
        staffName: isStaffing ? cleanStaffName : "",
        namePrefix: isStaffing ? namePrefix : "",
        position: isStaffing ? cleanPosition : "",
        imageDataUrl,
      });
      onClose();
    } catch (saveError) {
      setError(
        saveError instanceof Error && saveError.message
          ? saveError.message
          : "ไม่สามารถบันทึกข้อมูลได้ กรุณาลองอีกครั้ง",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {!cameraOpen && (
        <div
          className={`${styles.backdrop} ${isAppearance ? styles.compactBackdrop : ""}`}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) handleClose();
          }}
        >
          <div
            ref={dialogRef}
            className={`${styles.dialog} ${isAppearance ? styles.compactDialog : ""}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            onKeyDown={handleKeyboardTrap}
          >
            <header className={`${styles.header} ${headerStyle === "red" ? styles.alertHeader : headerStyle === "yellow" ? styles.yellowHeader : ""}`}>
              <h2 id={titleId} className={styles.title}>
                {editing ? "แก้ไขข้อมูล" : "เพิ่มข้อมูล"} — {title}
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
              {(siteName || itemNumber) && (
                <p id={descriptionId} className={styles.context}>
                  {siteName && <><strong>จุดรักษาการณ์:</strong> {siteName}</>}
                  {itemNumber ? <span className={styles.itemNumber}>รายการ {itemNumber}</span> : null}
                </p>
              )}

              {isStaffing && (
                <>
                  <label className={styles.label} htmlFor={`${titleId}-prefix`}>
                    คำนำหน้า
                  </label>
                  <select
                    id={`${titleId}-prefix`}
                    className={styles.input}
                    value={namePrefix}
                    disabled={busy}
                    onChange={(event) => { setNamePrefix(event.target.value); setError(""); }}
                  >
                    <option value="">เลือกคำนำหน้า</option>
                    <option value="นาย">นาย</option>
                    <option value="นาง">นาง</option>
                    <option value="นางสาว">นางสาว</option>
                  </select>

                  <label className={styles.label} htmlFor={`${titleId}-name`}>
                    ชื่อ-นามสกุล <span className={styles.required}>*</span>
                  </label>
                  <input
                    ref={staffInputRef}
                    id={`${titleId}-name`}
                    className={styles.input}
                    type="text"
                    value={staffName}
                    maxLength={150}
                    autoComplete="off"
                    required
                    disabled={busy}
                    placeholder="ชื่อและนามสกุล (ไม่ต้องใส่คำนำหน้า)"
                    onChange={(event) => { setStaffName(event.target.value); setError(""); }}
                  />

                  <label className={styles.label} htmlFor={`${titleId}-position`}>
                    ตำแหน่ง / หน้าที่
                  </label>
                  <input
                    id={`${titleId}-position`}
                    className={styles.input}
                    type="text"
                    value={position}
                    maxLength={150}
                    disabled={busy}
                    placeholder="ระบุตำแหน่งหรือหน้าที่"
                    onChange={(event) => { setPosition(event.target.value); setError(""); }}
                  />
                </>
              )}

              <label className={styles.label} htmlFor={`${titleId}-detail`}>
                {isStaffing ? "ข้อมูลย่อ / หมายเหตุ" : isNote ? "รายละเอียด" : "รายละเอียดสิ่งที่พบ"}
                {!isStaffing && <span className={styles.required}> *</span>}
              </label>
              <textarea
                ref={detailInputRef}
                id={`${titleId}-detail`}
                className={styles.textarea}
                value={detail}
                rows={isAppearance ? 3 : 4}
                maxLength={maxLength}
                required={!isStaffing}
                disabled={busy}
                placeholder="กรอกรายละเอียด"
                onChange={(event) => { setDetail(event.target.value); setError(""); }}
              />
              <div className={styles.charCount}>{detail.length}/{maxLength} ตัวอักษร</div>

              {isStaffing && <div className={styles.photoSection}>
                <div className={styles.photoHeading}>
                  รูปภาพที่ถ่ายใหม่ {requireNewPhoto ? <span className={styles.required}>*</span> : <span className={styles.optional}>(ถ้ามี)</span>}
                </div>
                <p className={styles.photoHint}>ใช้กล้องถ่ายใหม่เท่านั้น ไม่ดึงรูปภาพจากรายงานเดิม</p>
                {imageDataUrl ? (
                  <div className={styles.photoPreview}>
                    <img src={imageDataUrl} alt="รูปภาพที่เพิ่งถ่าย" />
                    <div className={styles.photoActions}>
                      <button type="button" className={styles.cameraButton} disabled={busy} onClick={() => setCameraOpen(true)}>ถ่ายใหม่</button>
                      <button type="button" className={styles.removeButton} disabled={busy} onClick={() => setImageDataUrl(null)}>นำรูปออก</button>
                    </div>
                  </div>
                ) : (
                  <button type="button" className={styles.cameraButton} disabled={busy} onClick={() => setCameraOpen(true)}>
                    เปิดกล้องถ่ายรูป
                  </button>
                )}
              </div>}

              {error && <p id={errorId} className={styles.error} role="alert">{error}</p>}

              <div className={styles.actions}>
                <button type="button" className={styles.cancelButton} onClick={handleClose} disabled={busy}>
                  ยกเลิก
                </button>
                <button type="submit" className={styles.saveButton} disabled={busy}>
                  {saving ? "กำลังบันทึก..." : "บันทึก"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isStaffing && <CameraModal
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCaptured={(dataUrl) => {
          if (!/^data:image\/(?:jpeg|jpg|png|webp);base64,/i.test(dataUrl)) {
            setError("รูปภาพจากกล้องไม่ถูกต้อง กรุณาถ่ายใหม่");
            setCameraOpen(false);
            return;
          }
          setImageDataUrl(dataUrl);
          setError("");
          setCameraOpen(false);
        }}
      />}
    </>
  );
}
