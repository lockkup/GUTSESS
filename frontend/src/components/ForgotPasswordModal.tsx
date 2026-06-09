// src/components/ForgotPasswordModal.tsx
import { useEffect, useRef, useState } from "react";
import { User, X, MailCheck } from "lucide-react";

import styles from "./ForgotPasswordModal.module.css";
import TimingMessagePopUp from "./popup/TimingMessagePopUp";
import BigIconSuccessSmsPopUp from "./popup/BigIconSuccessSmsPopUp";

type Contact = {
  team?: string;
  email?: string;
};

type SendResult = {
  success: boolean;
  message: string;
  error?: string;
  contacts?: Contact[];
};

type Props = {
  open: boolean;
  empCode: string;
  onChangeEmp: (v: string) => void;
  onClose: () => void;
  onSend: () => Promise<SendResult>;
};

export default function ForgotPasswordModal({
  open,
  empCode,
  onChangeEmp,
  onClose,
  onSend,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [loading, setLoading] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [resultSuccess, setResultSuccess] = useState(false);
  const [resultMessage, setResultMessage] = useState("");
  const [resultContacts, setResultContacts] = useState<Contact[] | undefined>(
    undefined,
  );

  const cleanEmpCode = empCode.trim();
  const empValid = /^\d{6}$/.test(cleanEmpCode);

  useEffect(() => {
    if (!open) return;

    window.setTimeout(() => inputRef.current?.focus(), 0);

    setLoading(false);
    setShowResult(false);
    setResultSuccess(false);
    setResultMessage("");
    setResultContacts(undefined);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !loading && !showResult) {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, loading, showResult, onClose]);

  const handleSend = async () => {
    if (loading || showResult) return;

    if (!empValid) {
      setResultSuccess(false);
      setResultMessage("กรุณากรอกรหัสพนักงาน 6 หลักให้ถูกต้อง");
      setResultContacts(undefined);
      setShowResult(true);
      return;
    }

    setLoading(true);
    setShowResult(false);
    setResultSuccess(false);
    setResultMessage("");
    setResultContacts(undefined);

    try {
      const result = await onSend();

      if (result.success) {
        setResultSuccess(true);
        setResultMessage(
          result.message || "ระบบได้ส่งรหัสผ่านไปยังอีเมลที่ลงทะเบียนไว้แล้ว",
        );
        setResultContacts(undefined);
        setShowResult(true);
        return;
      }

      setResultSuccess(false);
      setResultMessage(result.message || "เกิดข้อผิดพลาด");
      setResultContacts(result.contacts);
      setShowResult(true);
    } catch (error) {
      console.error("Forgot password modal error:", error);

      setResultSuccess(false);
      setResultMessage(
        "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้งหรือติดต่อฝ่ายบุคคล",
      );
      setResultContacts(undefined);
      setShowResult(true);
    } finally {
      setLoading(false);
    }
  };

  const closeResult = () => {
    setShowResult(false);
    setResultSuccess(false);
    setResultMessage("");
    setResultContacts(undefined);
  };

  if (!open) return null;

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label="Forgot password"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !loading && !showResult) {
          onClose();
        }
      }}
    >
      <div className={styles.modal}>
        <div className={styles.head}>
          <h3 className={styles.title}>ลืมรหัสผ่าน</h3>

          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            disabled={loading || showResult}
            aria-label="ปิด"
          >
            <X size={35} strokeWidth={2.5} />
          </button>
        </div>

        <p className={styles.desc}>
          กรอกรหัสพนักงาน 6 หลัก แล้วกดส่งรหัส
          ระบบจะส่งรหัสไปยังอีเมลที่ลงทะเบียนไว้
        </p>

        <div className={styles.form}>
          <div className={styles.label}>รหัสพนักงาน (6 หลัก)</div>

          <div className={styles.field}>
            <span className={styles.iconLeft} aria-hidden="true">
              <User size={18} />
            </span>

            <input
              ref={inputRef}
              className={styles.inputWithIcon}
              value={empCode}
              onChange={(event) => {
                const onlyNumber = event.target.value
                  .replace(/\D/g, "")
                  .slice(0, 6);

                onChangeEmp(onlyNumber);
              }}
              inputMode="numeric"
              autoComplete="off"
              maxLength={6}
              disabled={loading || showResult}
            />
          </div>
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primaryBtn}
            disabled={loading || !empValid || showResult}
            onClick={handleSend}
          >
            {loading ? "กำลังส่ง..." : "กดส่งรหัสผ่าน"}
          </button>

          <button
            type="button"
            className={styles.backBtn}
            onClick={onClose}
            disabled={loading || showResult}
          >
            ย้อนกลับ
          </button>
        </div>
      </div>

      {resultSuccess ? (
        <BigIconSuccessSmsPopUp
          open={showResult}
          icon={<MailCheck size={150} strokeWidth={1.8} />}
          iconColor="#7a7a7a"
          title={"กรุณาตรวจสอบรหัสผ่านของคุณใน\nอีเมล์"}
          subText=""
          onClose={() => {
            closeResult();
            onClose();
          }}
        />
      ) : (
        <TimingMessagePopUp
          open={showResult}
          variant="warning"
          message={resultMessage}
          errorKey={null}
          contacts={resultContacts}
          closeOnBackdrop={true}
          closeOnEsc={true}
          onClose={closeResult}
        />
      )}
    </div>
  );
}