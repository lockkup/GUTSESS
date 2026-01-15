import { useEffect, useRef } from "react";

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
      className="guts-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Forgot password"
      onMouseDown={(e) => {
        // คลิกพื้นหลังเพื่อปิด
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="guts-modal">
        <div className="guts-modal-head">
          <h3 className="guts-modal-title">ลืมรหัสผ่าน</h3>
          <button className="guts-icon-btn" type="button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <p className="guts-modal-desc">
          กรอกรหัสพนักงาน 6 หลัก แล้วกดส่งรหัส ระบบจะส่งรหัสไปยังอีเมลที่ลงทะเบียนไว้
        </p>

        <div className="guts-form" style={{ marginTop: 10 }}>
          <div>
            <div className="guts-label">รหัสพนักงาน (6 หลัก)</div>
            <input
              ref={inputRef}
              className="guts-input"
              value={empCode}
              onChange={(e) => onChangeEmp(e.target.value)}
              inputMode="numeric"
              autoComplete="off"
            />
          </div>

          <div className="guts-modal-actions">
            <button type="button" className="guts-btn" disabled={!empValid} onClick={onSend}>
              กดส่งรหัสผ่าน
            </button>
            <button type="button" className="guts-btn-back" onClick={onClose}>
            ย้อนกลับ
            </button>
          </div>

          <div className="guts-warn" style={{ marginTop: 10 }}>
            **ระบบจะส่งรหัสไปอีเมลที่ลงทะเบียนไว้ (ตัวอย่าง: @xxxxx)
          </div>
        </div>
      </div>
    </div>
  );
}
