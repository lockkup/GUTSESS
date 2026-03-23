// src/components/OutOfAreaModal.tsx
import { useEffect } from "react";
import styles from "./OutOfAreaModal.module.css";

type Props = {
  open: boolean;
  locHint?: string;
  onClose: () => void;

  closeOnBackdrop?: boolean;
  closeOnEsc?: boolean;
};

export default function OutOfAreaModal({
  open,
  locHint,
  onClose,
  closeOnBackdrop = true,
  closeOnEsc = true,
}: Props) {
  useEffect(() => {
    if (!open) return;

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(e: KeyboardEvent) {
      if (!closeOnEsc) return;
      if (e.key === "Escape") onClose();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, closeOnEsc, onClose]);

  if (!open) return null;

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      onMouseDown={() => {
        if (closeOnBackdrop) onClose();
      }}
    >
      <div className={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.icon}>!</div>

        <div className={styles.body}>
          <div>ขณะนี้ท่านอยู่นอกพื้นที่ลงเวลางาน</div>
          {locHint ? <div className={styles.sub}>{locHint}</div> : null}
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnGhost}`}
            onClick={onClose}
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
}
