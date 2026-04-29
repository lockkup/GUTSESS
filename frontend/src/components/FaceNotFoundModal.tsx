import styles from "./FaceNotFoundModal.module.css";

type Props = {
  open: boolean;
  title: string;
  message: string;
  onClose: () => void;
};

export default function FaceNotFoundModal({
  open,
  title,
  message,
  onClose,
}: Props) {
  if (!open) return null;

  return (
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby="face-not-found-title"
    >
      <div className={styles.modal}>
        <div className={styles.iconWrap}>
          <span className={styles.icon}>!</span>
        </div>

        <h3 id="face-not-found-title" className={styles.title}>
          {title}
        </h3>

        <p className={styles.message}>{message}</p>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={onClose}
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
}