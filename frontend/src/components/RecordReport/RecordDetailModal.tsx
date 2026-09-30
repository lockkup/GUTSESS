import { useEffect, useState } from "react";

import styles from "./RecordDetailModal.module.css";

type Props = {
  sectionNumber: 3 | 4;
  itemNumber: number;
  title: string;
  initialValue?: string;
  onClose: () => void;
  onSave: (detail: string) => void;
};

export default function RecordDetailModal({
  sectionNumber,
  itemNumber,
  title,
  initialValue = "",
  onClose,
  onSave,
}: Props) {
  const [detail, setDetail] = useState(initialValue);
  const [error, setError] = useState("");

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  function handleSave() {
    const cleanDetail = detail.trim();

    if (!cleanDetail) {
      setError("กรุณากรอกข้อมูล");
      return;
    }

    onSave(cleanDetail);
  }

  return (
    <div
      className={styles.modalOverlay}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-detail-modal-title"
      >
        <header className={styles.modalHeader}>
          <h2 id="report-detail-modal-title">
            ข้อ {sectionNumber}. {title}
          </h2>

          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="ปิด"
          >
            ×
          </button>
        </header>

        <div className={styles.modalBody}>
          <label className={styles.detailLabel} htmlFor="report-detail-input">
            {sectionNumber}.{itemNumber} รายละเอียด
            <span className={styles.requiredMark} aria-hidden="true">
              *
            </span>
          </label>

          <textarea
            id="report-detail-input"
            className={styles.detailInput}
            value={detail}
            onChange={(event) => {
              setDetail(event.target.value);
              setError("");
            }}
            placeholder="กรอกรายละเอียด"
            maxLength={500}
            autoFocus
          />

          <div className={styles.characterCount}>{detail.length}/500</div>

          {error ? (
            <div className={styles.errorMessage} role="alert">
              {error}
            </div>
          ) : null}
        </div>

        <footer className={styles.modalActions}>
          <button
            type="button"
            className={styles.cancelButton}
            onClick={onClose}
          >
            ยกเลิก
          </button>

          <button
            type="button"
            className={styles.saveButton}
            onClick={handleSave}
            disabled={!detail.trim()}
          >
            บันทึก
          </button>
        </footer>
      </section>
    </div>
  );
}