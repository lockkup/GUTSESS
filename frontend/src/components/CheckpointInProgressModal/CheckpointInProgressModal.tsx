// src/components/CheckpointInProgressModal/CheckpointInProgressModal.tsx

import { useEffect, useMemo, useRef } from "react";

import styles from "./CheckpointInProgressModal.module.css";

type CheckpointInProgressModalProps = {
  open: boolean;
  message: string;
  onClose: () => void;
  confirmText?: string;
  closeOnBackdrop?: boolean;
};

function buildMessageLines(message: string): string[] {
  const fallbackMessage = "จุดนี้อยู่ระหว่างการเข้าตรวจ";
  const sourceMessage = (message || fallbackMessage).trim();

  return sourceMessage
    .split("\n")
    .flatMap((line) => {
      const cleanLine = line.trim();

      if (!cleanLine) {
        return [""];
      }

    /*
    * รองรับทั้ง 2 รูปแบบจาก Backend:
    * 1) "หากมีความจำเป็น ให้ไปใช้เมนูเข้าพื้นที่\n\"ติดตาม / มอบหมาย\""
    * 2) "หากมีความจำเป็น ให้ไปใช้เมนูเข้าพื้นที่ \"ติดตาม / มอบหมาย\""
    *
    * เพื่อให้ "ติดตาม / มอบหมาย" อยู่บรรทัดใหม่เสมอ
    */
      const outOfPlanIndex = cleanLine.indexOf('"ติดตาม / มอบหมาย"');

      if (outOfPlanIndex > 0) {
        const beforeOutOfPlan = cleanLine
          .slice(0, outOfPlanIndex)
          .trimEnd();
        const outOfPlanText = cleanLine.slice(outOfPlanIndex).trim();

        return beforeOutOfPlan
          ? [beforeOutOfPlan, outOfPlanText]
          : [outOfPlanText];
      }

      return [cleanLine];
    });
}

export default function CheckpointInProgressModal({
  open,
  message,
  onClose,
  confirmText = "ปิด",
  closeOnBackdrop = true,
}: CheckpointInProgressModalProps) {
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null);

  const messageLines = useMemo(() => buildMessageLines(message), [message]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    window.setTimeout(() => {
      confirmButtonRef.current?.focus();
    }, 0);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  const handleBackdropMouseDown = () => {
    if (closeOnBackdrop) {
      onClose();
    }
  };

  return (
    <div
      className={styles.overlay}
      role="presentation"
      onMouseDown={handleBackdropMouseDown}
    >
      <section
        className={styles.modal}
        role="alertdialog"
        aria-modal="true"
        aria-describedby="checkpoint-in-progress-modal-message"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className={styles.content}>
          <div className={styles.warningIcon} aria-hidden="true">
            !
          </div>

          <div className={styles.messageCard}>
            <p id="checkpoint-in-progress-modal-message">
              {messageLines.map((line, index) => {
                if (!line) {
                  return (
                    <span
                      key={`empty-line-${index}`}
                      className={styles.emptyLine}
                      aria-hidden="true"
                    />
                  );
                }

                const isOutOfPlanLine = line.includes('"นอกแผน"');

                return (
                  <span
                    key={`${line}-${index}`}
                    className={
                      isOutOfPlanLine
                        ? `${styles.messageLine} ${styles.outOfPlanLine}`
                        : styles.messageLine
                    }
                  >
                    {line}
                  </span>
                );
              })}
            </p>
          </div>
        </div>

        <footer className={styles.actions}>
          <button
            ref={confirmButtonRef}
            type="button"
            className={styles.confirmButton}
            onClick={onClose}
          >
            {confirmText}
          </button>
        </footer>
      </section>
    </div>
  );
}
