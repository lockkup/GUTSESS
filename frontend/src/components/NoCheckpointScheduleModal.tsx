import { useEffect } from "react";
import { createPortal } from "react-dom";
import { ClipboardList, Info, Search, X } from "lucide-react";

import styles from "./NoCheckpointScheduleModal.module.css";

type NoCheckpointScheduleModalProps = {
  open: boolean;
  message?: string;
  shiftText?: string;
  onClose: () => void;
  onBack?: () => void;
};

export default function NoCheckpointScheduleModal({
  open,
  message = "ไม่พบตารางงานสายตรวจของวันนี้",
  shiftText,
  onClose,
  onBack,
}: NoCheckpointScheduleModalProps) {
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    const originalOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  const handleOk = () => {
    onClose();

    if (onBack) {
      onBack();
    }
  };

  return createPortal(
    <div className={styles.backdrop} role="presentation">
      <section
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="no-checkpoint-schedule-title"
      >
        <button
          type="button"
          className={styles.closeBtn}
          onClick={onClose}
          aria-label="ปิดหน้าต่างแจ้งเตือน"
        >
          <X size={18} strokeWidth={2.6} />
        </button>

        <div className={styles.iconWrap} aria-hidden="true">
          <div className={styles.iconCircle}>
            <ClipboardList
              className={styles.clipboardIcon}
              size={58}
              strokeWidth={1.8}
            />

            <span className={styles.searchBadge}>
              <Search size={26} strokeWidth={2.6} />
            </span>

            <span className={styles.closeBadge}>×</span>
          </div>
        </div>

        <h2 id="no-checkpoint-schedule-title" className={styles.title}>
          {message}
        </h2>

        {shiftText && <div className={styles.shiftPill}>{shiftText}</div>}

        <div className={styles.divider} />

        <div className={styles.hint}>
          <Info
            className={styles.hintIcon}
            size={22}
            strokeWidth={2.5}
            aria-hidden="true"
          />
          <span>กรุณาติดต่อผู้ดูแลระบบ</span>
        </div>

        <button type="button" className={styles.okBtn} onClick={handleOk}>
          ตกลง
        </button>
      </section>
    </div>,
    document.body,
  );
}