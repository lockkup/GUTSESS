import { useEffect } from "react";
import { Check, AlertCircle } from "lucide-react";
import styles from "./EmailModal.module.css";

type Props = {
  open: boolean;
  success: boolean;
  message: string;
  contacts?: Array<{ team?: string; email?: string }>;
  onOk: () => void;
  closeOnBackdrop?: boolean;
  closeOnEsc?: boolean;
  onClose?: () => void;
};

export default function EmailModal({
  open,
  success,
  message,
  contacts,
  onOk,
  closeOnBackdrop = false,
  closeOnEsc = true,
  onClose,
}: Props) {
  useEffect(() => {
    if (!open || !closeOnEsc) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, closeOnEsc, onClose]);

  if (!open) return null;

  return (
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-label={success ? "ส่งอีเมลสำเร็จ" : "ส่งอีเมลไม่สำเร็จ"}
      onClick={() => {
        if (!closeOnBackdrop) return;
        onClose?.();
      }}
    >
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.badge} aria-hidden="true">
            {success ? (
              <Check size={24} aria-hidden="true" />
            ) : (
              <AlertCircle size={24} aria-hidden="true" />
            )}
          </div>

          <div className={styles.title}>
            {success ? "ส่งอีเมลสำเร็จ" : "ส่งอีเมลไม่สำเร็จ"}
          </div>

          <button
            className={styles.closeBtn}
            type="button"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className={styles.body}>
          {/* Render message as a single line like TimingMessagePopUp */}
          <div>{message ? message.replace(/\s*\n\s*/g, " ") : ""}</div>

          {!success && contacts && contacts.length > 0 && (
            <div className={styles.contacts}>
              {contacts.map((c, idx) => (
                <div key={idx} className={styles.contact}>
                  <div className={styles.contactLabel}>ติดต่อ:</div>
                  <div className={styles.contactValue}>
                    {c.team || "ไม่ระบุ"}
                  </div>
                  <div className={styles.contactEmail}>
                    {c.email || "ไม่ระบุ"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
