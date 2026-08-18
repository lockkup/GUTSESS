import { useEffect } from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRoute } from "@fortawesome/free-solid-svg-icons";

import styles from "./CheckpointAreaConfirmModal.module.css";

type Props = {
  open: boolean;
  regionLabel: string;
  districtLabel: string;
  routeLabel: string;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  closeOnBackdrop?: boolean;
  closeOnEsc?: boolean;
};

export default function CheckpointAreaConfirmModal({
  open,
  regionLabel,
  districtLabel,
  routeLabel,
  loading = false,
  onCancel,
  onConfirm,
  closeOnBackdrop = true,
  closeOnEsc = true,
}: Props) {
  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === "Escape" &&
        closeOnEsc &&
        !loading
      ) {
        onCancel();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [closeOnEsc, loading, onCancel, open]);

  if (!open) return null;

  return createPortal(
    <div
      className={styles.overlay}
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget &&
          closeOnBackdrop &&
          !loading
        ) {
          onCancel();
        }
      }}
    >
      <section
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkpoint-area-confirm-title"
        aria-describedby="checkpoint-area-confirm-description"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className={styles.iconCircle} aria-hidden="true">
          <FontAwesomeIcon
            icon={faRoute}
            className={styles.icon}
          />
        </div>

        <h2
          id="checkpoint-area-confirm-title"
          className={styles.title}
        >
          ยืนยันหน่วยงานที่ได้รับมอบหมายให้ช่วยตรวจ
        </h2>

        <p
          id="checkpoint-area-confirm-description"
          className={styles.description}
        >
          <span>กรุณาตรวจสอบข้อมูลหน่วยงาน</span>
          <span className={styles.warningText}>
          (กรณีช่วยตรวจต้องได้รับมอบหมายจากผู้บังคับบัญชาเท่านั้น)
          </span>
        </p>

        <div className={styles.detailCard}>
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>ภาค</span>
            <span className={styles.detailValue}>{regionLabel || "-"}</span>
          </div>

          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>เขต</span>
            <span className={styles.detailValue}>{districtLabel || "-"}</span>
          </div>

          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>เส้นทาง</span>
            <span className={styles.detailValue}>{routeLabel || "-"}</span>
          </div>
        </div>

        <div className={styles.actions}>
          <button
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
            autoFocus
          >
            {loading ? "กำลังโหลด..." : "ตกลง"}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}