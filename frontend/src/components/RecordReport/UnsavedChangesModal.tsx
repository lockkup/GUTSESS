import { useEffect } from "react";

import styles from "./UnsavedChangesModal.module.css";

type Props = {
  busy?: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onStay: () => void;
};

export default function UnsavedChangesModal({
  busy = false,
  onSave,
  onDiscard,
  onStay,
}: Props) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) {
        onStay();
      }
    }

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleEscape);
    };
  }, [busy, onStay]);

  return (
    <div
      className={styles.modalOverlay}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) {
          onStay();
        }
      }}
    >
      <section
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="unsaved-report-title"
        aria-describedby="unsaved-report-description"
      >
        <header className={styles.modalHeader}>
          <h2 id="unsaved-report-title">มีข้อมูลที่ยังไม่ได้บันทึก</h2>
        </header>

        <div
          id="unsaved-report-description"
          className={styles.modalBody}
        >
          คุณได้แก้ไขข้อมูลในบันทึกรายงาน
          แต่ยังไม่ได้บันทึกรายงาน?
        </div>

        <div className={styles.modalActions}>
          <button
            type="button"
            className={styles.saveButton}
            onClick={onSave}
            disabled={busy}
          >
            {busy ? "กำลังบันทึก..." : "บันทึกรายงาน"}
          </button>

          <button
            type="button"
            className={styles.discardButton}
            onClick={onDiscard}
            disabled={busy}
          >
            ออกโดยไม่บันทึก
          </button>

          <button
            type="button"
            className={styles.stayButton}
            onClick={onStay}
            disabled={busy}
          >
            อยู่หน้านี้ต่อ
          </button>
        </div>
      </section>
    </div>
  );
}
