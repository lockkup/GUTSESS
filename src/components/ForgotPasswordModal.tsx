import { useEffect, useRef } from "react";
import styles from "./ForgotPasswordModal.module.css";

type Props = {
  open: boolean;
  empCode: string;
  onChangeEmp: (v: string) => void;
  onClose: () => void;
  onSend: () => void;
};

export default function ForgotPasswordModal({
  open,
  empCode,
  onChangeEmp,
  onClose,
  onSend,
}: Props) {
  const empValid = /^\d{6}$/.test(empCode);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // โฟกัสช่องกรอกอัตโนมัติเมื่อเปิด
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  // ปิดด้วย ESC
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className={styles.modalOverlay}
      role="dialog"
      aria-modal="true"
      aria-label="Forgot password"
      onMouseDown={(e) => {
        // คลิกพื้นหลังเพื่อปิด
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.modal}>
        <div className={styles.modalHead}>
          <h3 className={styles.modalTitle}>ลืมรหัสผ่าน</h3>
          <button className={styles.iconBtn} type="button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <p className={styles.modalDesc}>
          กรอกรหัสพนักงาน 6 หลัก แล้วกดส่งรหัส ระบบจะส่งรหัสไปยังอีเมลที่ลงทะเบียนไว้
        </p>

        <div className={styles.form} style={{ marginTop: 10 }}>
          <div>
            <div className={styles.label}>รหัสพนักงาน (6 หลัก)</div>
            <input
              ref={inputRef}
              className={styles.input}
              value={empCode}
              onChange={(e) => onChangeEmp(e.target.value)}
              inputMode="numeric"
              autoComplete="off"
            />
          </div>

          <div className={styles.modalActions}>
            <button type="button" className={styles.btn} disabled={!empValid} onClick={onSend}>
              กดส่งรหัสผ่าน
            </button>
            <button type="button" className={styles.btnBack} onClick={onClose}>
            ย้อนกลับ
            </button>
          </div>

          <div className={styles.warn} style={{ marginTop: 10 }}>
            **ระบบจะส่งรหัสไปอีเมลที่ลงทะเบียนไว้ (ตัวอย่าง: @xxxxx)
          </div>
        </div>
      </div>
    </div>
  );
}
