import { useEffect, useId, useRef } from "react";

import styles from "./CheckpointTakeoverConfirmModal.module.css";

type CheckpointTakeoverConfirmModalProps = {
  open: boolean;
  unitName: string;
  holderEmployeeCode: string | null;
  holderEmployeeName: string | null;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function CheckpointTakeoverConfirmModal({
  open,
  unitName,
  holderEmployeeCode,
  holderEmployeeName,
  loading = false,
  onCancel,
  onConfirm,
}: CheckpointTakeoverConfirmModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cancelButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !loading) {
        onCancel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [loading, onCancel, open]);

  if (!open) {
    return null;
  }

  const holderText = [holderEmployeeCode, holderEmployeeName]
    .map((value) => value?.trim() ?? "")
    .filter(Boolean)
    .join(" ");

  return (
    <div className={styles.overlay}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <div className={styles.icon} aria-hidden="true">
          !
        </div>

        <h2 id={titleId} className={styles.title}>
          กรณี คนตรวจก่อนหน้า
          <br />
          ไม่ได้กดออกจากงาน
        </h2>

        <div id={descriptionId} className={styles.content}>
          <p>ท่านต้องทำรายการเข้าและออกใหม่อีกครั้ง</p>
          <p className={styles.unitName}>{unitName || "-"}</p>

          {holderText && (
            <p className={styles.holderText}>
              ผู้เข้าตรวจเดิม: {holderText}
            </p>
          )}
        </div>

        <div className={styles.actions}>
          <button
            ref={cancelButtonRef}
            type="button"
            className={styles.cancelButton}
            onClick={onCancel}
            disabled={loading}
          >
            ยกเลิก
          </button>

          <button
            type="button"
            className={styles.confirmButton}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "กำลังดำเนินการ..." : "ตกลง"}
          </button>
        </div>
      </div>
    </div>
  );
}