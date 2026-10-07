import styles from "./DuplicateCheckInModal.module.css";

type Props = {
  open: boolean;
  onGoHome: () => void;
};

export default function DuplicateCheckInModal({
  open,
  onGoHome,
}: Props) {
  if (!open) return null;

  return (
    <div className={styles.overlay}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="duplicate-checkin-title"
        aria-describedby="duplicate-checkin-message"
      >
        <div
          id="duplicate-checkin-title"
          className={styles.title}
        >
          มีรายการลงเวลาเข้างานแล้ว
        </div>

        <div
          id="duplicate-checkin-message"
          className={styles.message}
        >
          กรุณาตรวจสอบหน้าจอ
          <br />
          ที่เปิดค้างไว้และทำการปิด
        </div>

        <button
          type="button"
          className={styles.homeButton}
          onClick={onGoHome}
        >
          กลับหน้าหลัก
        </button>
      </div>
    </div>
  );
}
