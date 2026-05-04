import styles from "./CheckInOutModal.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function CheckInOutModal({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="มีการลงเวลาเข้างานค้างไว้แล้วในระบบ"
      >
        <div className={styles.title}>มีการลงเวลาเข้างานค้างไว้แล้วในระบบ</div>
        <div className={styles.message}>
          กรุณากดออกงาน
        </div>

        <button
          type="button"
          className={styles.button}
          onClick={onClose}
        >
          ตกลง
        </button>
      </div>
    </div>
  );
}