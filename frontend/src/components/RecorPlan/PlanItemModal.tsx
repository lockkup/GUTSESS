import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import styles from "./PlanItemModal.module.css";

/** หัวข้อหลักของรายงานตามแผน (ข้อ 2–6) */
export type PlanItemSectionNo = "2" | "3" | "4" | "5" | "6";

export type PlanItemModalProps = {
  /** ควบคุมการเปิด/ปิดจาก RecorPlan.tsx */
  open: boolean;
  /** หมายเลขหัวข้อที่กำลังเพิ่ม/แก้ไข */
  sectionNo: PlanItemSectionNo;
  /** ชื่อหัวข้อ ส่งมาจากหน้าหลักหรือข้อมูล Backend */
  sectionTitle: string;
  /** เลขรายการ เช่น 2.1, 3.2 (มีหรือไม่มีก็ได้) */
  itemNumber?: string;
  /** true เมื่อแก้ไขรายการที่มีอยู่แล้ว; false เมื่อเพิ่มรายการ */
  editing?: boolean;
  /** รายละเอียดเดิมหรือข้อมูลล่าสุดที่หน้าหลักโหลดมาให้ */
  initialValue?: string | null;
  /** ใช้ระหว่างการบันทึก/โหลดข้อมูลของหน้าหลัก */
  disabled?: boolean;
  /** ความยาวข้อความสูงสุด */
  maxLength?: number;
  onClose: () => void;
  /** ส่งข้อความที่ผู้ใช้กรอกกลับหน้าหลัก ไม่ยิง API เอง */
  onSave: (value: string) => void | Promise<void>;
};

/**
 * Modal สำหรับเพิ่ม/แก้ไขรายการในหัวข้อหลักของ RecorPlan
 * - ไม่มีข้อมูลตัวอย่างหรือรายการ Hardcode
 * - หน้าหลักเป็นผู้โหลด initialValue และจัดการ API / ฐานข้อมูล
 * - การใส่รูปภาพและรายละเอียดกำลังพลอยู่ใน PlanDetailModal แยกต่างหาก
 */
export default function PlanItemModal({
  open,
  sectionNo,
  sectionTitle,
  itemNumber,
  editing = false,
  initialValue = "",
  disabled = false,
  maxLength = 1000,
  onClose,
  onSave,
}: PlanItemModalProps) {
  const [value, setValue] = useState(initialValue ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  const errorId = useId();

  useEffect(() => {
    if (!open) return;

    setValue(initialValue ?? "");
    setError("");
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    textAreaRef.current?.focus();

    return () => {
      previousFocusRef.current?.focus();
    };
  }, [open, initialValue, sectionNo, editing]);

  useEffect(() => {
    if (!open || disabled || saving) return;

    function handleEscape(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, disabled, saving, onClose]);

  if (!open) return null;

  const busy = disabled || saving;
  const cleanedValue = value.trim();

  function close() {
    if (!busy) onClose();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    if (!cleanedValue) {
      setError("กรุณากรอกรายละเอียดก่อนบันทึก");
      textAreaRef.current?.focus();
      return;
    }

    setSaving(true);
    setError("");
    try {
      await onSave(cleanedValue);
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

  function handleDialogKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return;

    const focusableElements = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (!focusableElements?.length) return;

    const first = focusableElements[0];
    const last = focusableElements[focusableElements.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      className={styles.backdrop}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        className={styles.dialog}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onKeyDown={handleDialogKeyDown}
      >
        <div className={styles.header}>
          <h2 className={styles.title} id={titleId}>
            {editing ? "แก้ไขข้อมูล" : "เพิ่มข้อมูล"} ข้อ {sectionNo}
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
        </div>

        <form className={styles.form} onSubmit={(event) => void handleSubmit(event)}>
          <p className={styles.description} id={descriptionId}>
            {sectionTitle}
            {itemNumber ? ` — รายการ ${itemNumber}` : ""}
          </p>

          <label className={styles.label} htmlFor={`${titleId}-detail`}>
            รายละเอียด <span aria-hidden="true">*</span>
          </label>
          <textarea
            ref={textAreaRef}
            id={`${titleId}-detail`}
            className={styles.textarea}
            value={value}
            maxLength={maxLength}
            rows={4}
            placeholder="กรอกรายละเอียด"
            required
            disabled={busy}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
            onChange={(event) => {
              setValue(event.target.value);
              if (error) setError("");
            }}
          />
          <div className={styles.charCount} aria-live="off">
            {value.length}/{maxLength} ตัวอักษร
          </div>

          {error && (
            <p className={styles.error} role="alert" id={errorId}>
              {error}
            </p>
          )}

          <div className={styles.actions}>
            <button
              className={styles.cancelButton}
              type="button"
              disabled={busy}
              onClick={close}
            >
              ยกเลิก
            </button>
            <button
              className={styles.saveButton}
              type="submit"
              disabled={busy || !cleanedValue}
            >
              {saving ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
