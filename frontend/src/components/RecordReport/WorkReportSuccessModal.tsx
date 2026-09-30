import { useEffect } from "react";

import styles from "./WorkReportSuccessModal.module.css";

type Props = {
  open: boolean;
  onOk: () => void;

  /**
   * หัวข้อของ Modal
   *
   * ถ้าไม่ส่งมา จะใช้ข้อความสำหรับกรณีบันทึกรายงานสำเร็จ
   */
  title?: string;

  /**
   * ข้อความรายละเอียดภายใน Modal
   *
   * ถ้าไม่ส่งมา จะใช้ข้อความสำหรับกรณีบันทึกรายงานสำเร็จ
   */
  message?: string;

  /**
   * ข้อความบนปุ่มยืนยัน
   */
  okText?: string;

  closeOnBackdrop?: boolean;
  closeOnEsc?: boolean;
};

export default function WorkReportSuccessModal({
  open,
  onOk,
  title = "บันทึกรายงานสำเร็จ",
  message = "ข้อมูลบันทึกรายงานถูกบันทึกเรียบร้อยแล้ว",
  okText = "ตกลง",
  closeOnBackdrop = false,
  closeOnEsc = true,
}: Props) {
  useEffect(() => {
    if (!open || !closeOnEsc) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onOk();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeOnEsc, onOk, open]);

  if (!open) {
    return null;
  }

  return (
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={() => {
        if (closeOnBackdrop) {
          onOk();
        }
      }}
    >
      <div
        className={styles.modal}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.header}>
          <div className={styles.badge} aria-hidden="true">
            ✓
          </div>

          <div className={styles.title}>
            {title}
          </div>
        </div>

        <div className={styles.body}>
          {message}
        </div>

        <div className={styles.footer}>
          <button
            type="button"
            className={styles.okBtn}
            onClick={onOk}
          >
            {okText}
          </button>
        </div>
      </div>
    </div>
  );
}