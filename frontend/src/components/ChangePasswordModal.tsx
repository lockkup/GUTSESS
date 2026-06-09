import { useEffect, useRef, useState, type ReactNode } from "react";
import { User, Lock, Eye, EyeOff, CheckCircle, X } from "lucide-react";

import styles from "./ChangePasswordModal.module.css";
import TimingMessagePopUp from "./popup/TimingMessagePopUp";
import BigIconSuccessSmsPopUp from "./popup/BigIconSuccessSmsPopUp";

type Props = {
  open: boolean;
  empCode: string;
  oldPin: string;
  newPin: string;
  onChangeEmp: (v: string) => void;
  onChangeOldPin: (v: string) => void;
  onChangeNewPin: (v: string) => void;
  onClose: () => void;
  /** Called when the user clicks "คลิกลืมรหัสผ่าน" */
  onForgotPassword?: () => void;
  onSubmit: () => Promise<{
    success: boolean;
    message: string;
    error?: string;
    contacts?: Array<{ team?: string; email?: string }>;
  }>;
  /** Custom icon for the success popup */
  successIcon?: ReactNode;
  /** Color for the success icon */
  successIconColor?: string;
  /** Title shown in the success popup */
  successTitle?: string;
  /** Sub-text shown below the title in the success popup */
  successSubText?: string;
};

export default function ChangePasswordModal({
  open,
  empCode,
  oldPin,
  newPin,
  onChangeEmp,
  onChangeOldPin,
  onChangeNewPin,
  onClose,
  onForgotPassword,
  onSubmit,
  successIcon = <CheckCircle />,
  successIconColor = "#16a34a",
  successTitle = "เปลี่ยนรหัสผ่านสำเร็จ",
  successSubText = "ระบบได้เปลี่ยนรหัสผ่านของคุณเรียบร้อยแล้ว",
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [loading, setLoading] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [resultSuccess, setResultSuccess] = useState(false);
  const [resultMessage, setResultMessage] = useState("");
  const [resultContacts, setResultContacts] = useState<
    Array<{ team?: string; email?: string }> | undefined
  >(undefined);
  const [localErrorMessage, setLocalErrorMessage] = useState<string | null>(
    null,
  );

  const [showOldPin, setShowOldPin] = useState(false);
  const [showNewPin, setShowNewPin] = useState(false);

  useEffect(() => {
    if (!open) return;

    setTimeout(() => inputRef.current?.focus(), 0);
    setShowResult(false);
    setResultSuccess(false);
    setResultMessage("");
    setResultContacts(undefined);
    setLoading(false);
    setLocalErrorMessage(null);
    setShowOldPin(false);
    setShowNewPin(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !loading) {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, loading, onClose]);

  const handleSubmit = async () => {
    if (!/^\d{6}$/.test(empCode)) {
      setLocalErrorMessage("กรุณากรอกรหัสพนักงาน 6 หลัก");
      return;
    }

    if (!oldPin) {
      setLocalErrorMessage("กรุณากรอกรหัสผ่านล่าสุด  (6 ตัวอักษร)");
      return;
    }

    if (!newPin) {
      setLocalErrorMessage("กรุณากรอกรหัสผ่านใหม่  (6 ตัวอักษร)");
      return;
    }

    if (oldPin === newPin) {
      setLocalErrorMessage("รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านล่าสุด");
      return;
    }

    setLocalErrorMessage(null);
    setLoading(true);

    try {
      const result = await onSubmit();

      setResultSuccess(result.success);
      setResultMessage(result.message || (result.success ? successTitle : "เกิดข้อผิดพลาด"));
      setResultContacts(result.success ? undefined : result.contacts);
      setShowResult(true);
    } catch (err) {
      console.error("ChangePasswordModal error:", err);

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

    if (resultSuccess) {
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label="Change password"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !loading) {
          onClose();
        }
      }}
    >
      <div className={styles.modal}>
        <div className={styles.head}>
          <h3 className={styles.title}>เปลี่ยนรหัสผ่าน</h3>

          <X
            size={35}
            strokeWidth={2.5}
            onClick={() => {
              if (!loading) {
                onClose();
              }
            }}
            className={styles.closeBtn}
          />
        </div>

        <>
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
                onChange={(event) => onChangeEmp(event.target.value)}
                inputMode="numeric"
                autoComplete="off"
                disabled={loading}
              />
            </div>
          </div>

          <div className={styles.form}>
            <div className={styles.label}>รหัสผ่านล่าสุด (6 ตัวอักษร)</div>

            <div className={styles.field}>
              <span className={styles.iconLeft} aria-hidden="true">
                <Lock size={18} />
              </span>

              <input
                className={styles.inputWithIcon}
                value={oldPin}
                onChange={(event) =>
                  onChangeOldPin(event.target.value.replace(/\s/g, ""))
                }
                autoComplete="off"
                type={showOldPin ? "text" : "password"}
                maxLength={6}
                disabled={loading}
              />

              <button
                type="button"
                className={styles.iconRightBtn}
                onClick={() => setShowOldPin((value) => !value)}
                aria-label={showOldPin ? "ซ่อน" : "แสดง"}
                disabled={loading}
              >
                {showOldPin ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className={styles.form}>
            <div className={styles.label}>รหัสผ่านใหม่ (6 ตัวอักษร)</div>

            <div className={styles.field}>
              <span className={styles.iconLeft} aria-hidden="true">
                <Lock size={18} />
              </span>

              <input
                className={styles.inputWithIcon}
                value={newPin}
                onChange={(event) =>
                  onChangeNewPin(event.target.value.replace(/\s/g, ""))
                }
                autoComplete="off"
                type={showNewPin ? "text" : "password"}
                maxLength={6}
                disabled={loading}
              />

              <button
                type="button"
                className={styles.iconRightBtn}
                onClick={() => setShowNewPin((value) => !value)}
                aria-label={showNewPin ? "ซ่อน" : "แสดง"}
                disabled={loading}
              >
                {showNewPin ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.primaryBtn}
              disabled={loading}
              onClick={handleSubmit}
            >
              {loading ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
            </button>

            <button
              type="button"
              className={styles.backBtn}
              onClick={onClose}
              disabled={loading}
            >
              ย้อนกลับ
            </button>

            <button
              type="button"
              className={styles["link-label"]}
              onClick={onForgotPassword}
              disabled={loading}
            >
              คลิกลืมรหัสผ่าน
            </button>
          </div>
        </>
      </div>

      <TimingMessagePopUp
        open={!!localErrorMessage}
        variant="warning"
        message={localErrorMessage || ""}
        errorKey={null}
        onClose={() => setLocalErrorMessage(null)}
      />

      {resultSuccess ? (
        <BigIconSuccessSmsPopUp
          open={showResult}
          icon={successIcon}
          iconColor={successIconColor}
          title={successTitle}
          subText={successSubText}
          onClose={closeResult}
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