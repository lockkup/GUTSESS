import { useEffect } from "react";
import styles from "./WorkReportSuccessModal.module.css";
type Props = {
  open: boolean;
  /**
   * ชื่อหน่วยงาน/รายการที่กำลังจะยกเลิก
   * เช่น "ทดสอบ05 - ร้านกาแฟ"
   */
  recordLabel?: string;
  /**
   * true ระหว่างรอ Backend ยกเลิกรายการ
   */
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
  closeOnBackdrop?: boolean;
  closeOnEsc?: boolean;
};
export default function WorkReportDeleteConfirmModal({
  open,
  recordLabel = "",
  busy = false,
  onCancel,
  onConfirm,
  closeOnBackdrop = false,
  closeOnEsc = true,
}: Props) {
  useEffect(() => {
    if (!open || !closeOnEsc || busy) {
      return;
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCancel();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [busy, closeOnEsc, onCancel, open]);
  if (!open) {
    return null;
  }
  const cleanRecordLabel = recordLabel.trim();
  return (
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby="work-report-delete-confirm-title"
      aria-describedby="work-report-delete-confirm-message"
      onClick={() => {
        if (closeOnBackdrop && !busy) {
          onCancel();
        }
      }}
    >
      <div
        className={styles.modal}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.header}>
          <div
            className={styles.badge}
            aria-hidden="true"
            style={{
              background: "#fff3f3",
              borderColor: "#f4b4b4",
              color: "#d60000",
            }}
          >
            !
          </div>
          <div
            id="work-report-delete-confirm-title"
            className={styles.title}
          >
            ยืนยันการยกเลิก
          </div>
        </div>
        <div
          id="work-report-delete-confirm-message"
          className={styles.body}
        >
          <div>
            ต้องการยกเลิกรายงานบันทึกงาน
            {cleanRecordLabel ? (
              <>
                {" "}
                ของ
                <br />
                <strong>
                  &quot;{cleanRecordLabel}&quot;
                </strong>
              </>
            ) : null}
            {" "}
            หรือไม่?
          </div>
          <div
            style={{
              marginTop: "12px",
              fontSize: "0.92em",
              lineHeight: 1.55,
            }}
          >
            หลังจากยืนยันการยกเลิก
            <br />
            <strong>กรุณากดลงเวลาออกทุกครั้ง</strong>
          </div>
        </div>
        <div
          className={styles.footer}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "10px",
          }}
        >
          <button
            type="button"
            className={styles.okBtn}
            onClick={onCancel}
            disabled={busy}
            style={{
              background: "#ffffff",
              color: "#374151",
              border: "1px solid #cbd5e1",
            }}
          >
            ไม่
          </button>
          <button
            type="button"
            className={styles.okBtn}
            onClick={() => void onConfirm()}
            disabled={busy}
            style={{
              background: "#e60000",
              color: "#ffffff",
              border: "1px solid #e60000",
            }}
          >
            {busy ? "กำลังยกเลิก..." : "ยืนยันยกเลิก"}
          </button>
        </div>
      </div>
    </div>
  );
}
