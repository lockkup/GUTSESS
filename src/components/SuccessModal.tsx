import { useEffect } from "react";
import styles from "./SuccessModal.module.css";

type Props = {
  open: boolean;
  title?: string;
  message: string;
  okText?: string;

  onOk: () => void;

  /** ปิดด้วยคลิกฉากหลัง */
  closeOnBackdrop?: boolean;
  /** ปิดด้วยปุ่ม Esc */
  closeOnEsc?: boolean;
  /** ถ้าต้องการปิดแบบไม่ใช่ปุ่ม OK (เช่น backdrop/esc) */
  onClose?: () => void;
};

export default function SuccessModal({
  open,
  title = "สำเร็จ",
  message,
  okText = "ตกลง",
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
      aria-label={title}
      onClick={() => {
        if (!closeOnBackdrop) return;
        onClose?.();
      }}
    >
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.badge} aria-hidden="true">
            ✓
          </div>
          <div className={styles.title}>{title}</div>
        </div>

        <div className={styles.body}>{message}</div>

        <div className={styles.footer}>
          <button type="button" className={styles.okBtn} onClick={onOk}>
            {okText}
          </button>
        </div>
      </div>
    </div>
  );
}
