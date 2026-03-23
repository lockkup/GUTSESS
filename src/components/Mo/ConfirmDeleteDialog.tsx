import React from "react";
import styles from "./ConfirmDeleteDialog.module.css";

type Props = {
  open: boolean;
  title?: string;
  description?: React.ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function ConfirmDeleteDialog({ open, title, description, onCancel, onConfirm }: Props) {
  if (!open) return null;

  return (
    <div className={styles["confirm-dialog-overlay"]} role="dialog" aria-modal="true">
      <div className={styles["confirm-dialog-card"]}>
        <div className={styles["confirm-dialog-title"]}>{title ?? "ยืนยัน"}</div>
        {description ? <div className={styles["confirm-dialog-desc"]}>{description}</div> : null}

        <div className={styles["confirm-dialog-actions"]}>
          <button type="button" className={[styles.btn, styles["cancel-btn"]].join(" ")} onClick={onCancel}>
            ยกเลิก
          </button>
          <button type="button" className={[styles.btn, styles["submit-btn"]].join(" ")} onClick={onConfirm}>
            ตกลง
          </button>
        </div>
      </div>
    </div>
  );
}

export { ConfirmDeleteDialog };
