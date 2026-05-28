import styles from "./LoadingModal.module.css";

type LoadingModalProps = {
  isOpen: boolean;
  message?: string;
};

export default function LoadingModal({
  isOpen,
  message = "กำลังบันทึกข้อมูล...",
}: LoadingModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <div className={styles.card}>
        <div className={styles.spinner} />

        <div className={styles.message}>{message}</div>
      </div>
    </div>
  );
}