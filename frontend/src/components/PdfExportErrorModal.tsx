import { useEffect } from "react";
import { CircleAlert } from "lucide-react";

import styles from "./PdfExportErrorModal.module.css";

type PdfExportErrorModalProps = {
  message: string | null;
  onClose: () => void;
};

const LEGACY_INVALID_REPORT_MESSAGE =
  "เงื่อนไขการสร้างรายงานไม่ถูกต้อง";
const ADMIN_CONTACT_MESSAGE = "กรุณาติดต่อผู้ดูแลระบบ";

function getDisplayMessage(message: string) {
  const normalizedMessage = message.trim();

  if (
    !normalizedMessage ||
    normalizedMessage === LEGACY_INVALID_REPORT_MESSAGE
  ) {
    return {
      detail: null,
      contact: ADMIN_CONTACT_MESSAGE,
    };
  }

  if (normalizedMessage.includes(ADMIN_CONTACT_MESSAGE)) {
    return {
      detail: normalizedMessage,
      contact: null,
    };
  }

  return {
    detail: normalizedMessage,
    contact: ADMIN_CONTACT_MESSAGE,
  };
}

export default function PdfExportErrorModal({
  message,
  onClose,
}: PdfExportErrorModalProps) {
  useEffect(() => {
    if (!message) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [message, onClose]);

  if (!message) {
    return null;
  }

  const displayMessage = getDisplayMessage(message);

  return (
    <div
      className={styles.overlay}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className={styles.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="patrol-export-error-title"
        aria-describedby="patrol-export-error-message"
      >
        <div className={styles.icon} aria-hidden="true">
          <CircleAlert size={34} strokeWidth={2.2} />
        </div>

        <h2 id="patrol-export-error-title" className={styles.title}>
          ไม่สามารถดาวน์โหลด PDF ได้
        </h2>

        <p id="patrol-export-error-message" className={styles.message}>
          {displayMessage.detail}
          {displayMessage.detail && displayMessage.contact && <br />}
          {displayMessage.contact}
        </p>

        <button
          type="button"
          className={styles.closeButton}
          onClick={onClose}
          autoFocus
        >
          ตกลง
        </button>
      </div>
    </div>
  );
}