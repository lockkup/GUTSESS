import styles from "./ConfirmCancelDialog.module.css";

type Props = {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
};

export default function ConfirmCancelDialog({
  open,
  onCancel,
  onConfirm,
  title = "ยกเลิกการบันทึก?",
  description = "ข้อมูลที่คุณกรอกไว้จะสูญหาย คุณต้องการยืนยันที่จะยกเลิกใช่หรือไม่?",
}: Props) {
  if (!open) return null;

  return (
    <div className={styles["dialog-overlay"]} role="dialog" aria-modal="true">
      <div className={styles["dialog-card"]}>
        <div className={styles["dialog-title"]}>{title}</div>
        <div className={styles["dialog-desc"]}>{description}</div>

        <div className={styles["dialog-actions"]}>
          <button
            type="button"
            className={[styles.btn, styles["keep-btn"]].join(" ")}
            onClick={onCancel}
          >
            ป้อนข้อมูลต่อ
          </button>
          <button
            type="button"
            className={[styles.btn, styles["discard-btn"]].join(" ")}
            onClick={onConfirm}
          >
            ยกเลิกและละทิ้ง
          </button>
        </div>
      </div>
    </div>
  );
}

export { ConfirmCancelDialog };
