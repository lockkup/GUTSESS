// src/components/FirstLoginModal.tsx
import { useEffect, useRef } from "react";
import styles from "./FirstLoginModal.module.css";

type Props = {
  open: boolean;
  empCode: string;
  onClose: () => void; // ปิด/ย้อนกลับ
  onRequestPassword: () => void; // ส่งรหัสไปอีเมล
};

export default function FirstLoginModal({
  open,
  empCode,
  onClose,
  onRequestPassword,
}: Props) {
  const btnRef = useRef<HTMLButtonElement | null>(null);

  // โฟกัสปุ่มหลักเมื่อเปิด
  useEffect(() => {
    if (open) setTimeout(() => btnRef.current?.focus(), 0);
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
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label="First login"
      onMouseDown={(e) => {
        // คลิกพื้นหลังเพื่อปิด
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.modal}>
        <div className={styles.head}>
          <h3 className={styles.title}>เข้าใช้งานครั้งแรก</h3>
          <button
            className={styles.iconBtn}
            type="button"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <p className={styles.desc}>
          กรุณากดขอรหัสผ่านเพื่อรับรหัสผ่านชั่วคราว <br></br>
          ระบบจะส่งไปที่อีเมลที่ลงทะเบียนไว้
        </p>

        <div className={styles.form}>
          <div className={styles.label}>รหัสพนักงาน (6 หลัก)</div>

          <div className={styles.codebox} aria-label="Employee code">
            {empCode || "______"}
          </div>

          <div className={styles.actions}>
            <button
              ref={btnRef}
              type="button"
              className={styles.btnPrimary}
              onClick={onRequestPassword}
            >
              กดขอรหัสผ่าน
            </button>

            <button
              type="button"
              className={styles.btnBack}
              onClick={onClose}
            >
              ย้อนกลับ
            </button>
          </div>

          <div className={styles.warn}>
            ระบบจะส่งรหัสไปอีเมลที่ลงทะเบียนไว้ (ตัวอย่าง: @xxxxx)
            <br />
            หากไม่ได้รับภายใน 5 นาที กรุณาติดต่อผู้ดูแลระบบ
          </div>
        </div>
      </div>
    </div>
  );
}
