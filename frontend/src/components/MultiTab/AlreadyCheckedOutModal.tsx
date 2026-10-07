import styles from "./AlreadyCheckedOutModal.module.css";

type Props = {
  open: boolean;
  onGoHome: () => void;
};

export default function AlreadyCheckedOutModal({
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
        aria-labelledby="already-checked-out-title"
        aria-describedby="already-checked-out-message"
      >
        <div
          id="already-checked-out-title"
          className={styles.title}
        >
          มีรายการลงเวลาออกงานแล้ว
        </div>

        <div
          id="already-checked-out-message"
          className={styles.message}
        >
          กรุณาตรวจสอบหน้าจอ
          <br />
          ที่เปิดค้างไว้ และทำการปิด
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
