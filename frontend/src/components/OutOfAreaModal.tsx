// src/components/OutOfAreaModal.tsx
// เวอร์ชันปรับใหม่:
// - ใช้ CSS classes ทั้งหมด ไม่มี inline style
// - แสดงปุ่มยืนยันการเข้าตรวจ เมื่อยังไม่ได้จอง
// - แสดงปุ่มยกเลิกการเข้าตรวจ เมื่อผู้ใช้คนเดิมจองไว้แล้ว

import { useEffect } from "react";
import styles from "./OutOfAreaModal.module.css";

type Props = {
  open: boolean;

  /**
   * ยังรับ props นี้ไว้เพื่อให้ Checkpoint/index.tsx เดิมใช้งานได้
   * แต่ไม่แสดงข้อความนี้ใน Modal
   */
  locHint?: string;

  /**
   * แสดงปุ่มยืนยันเฉพาะเมื่อ Backend ยืนยันว่าอยู่นอกพื้นที่
   * และรายการยังไม่ได้ถูกจองโดยผู้ใช้ปัจจุบัน
   */
  showReserveButton?: boolean;

  /**
   * ยังรับชื่อหน่วยงานไว้เพื่อให้ Parent เดิมใช้งานได้
   * แต่ไม่แสดงชื่อหน่วยงานใน Modal
   */
  reserveUnitName?: string;

  /**
   * ป้องกันการกดซ้ำระหว่างเรียก API ยืนยันการเข้าตรวจ
   */
  reserveLoading?: boolean;

  /**
   * Parent เป็นผู้จัดการ assignmentId ของหน่วยงานที่ผู้ใช้กด
   */
  onReserve?: () => void;

  /**
   * แสดงปุ่มยกเลิก เมื่อรายการถูกจองโดยผู้ใช้คนปัจจุบัน
   */
  showCancelButton?: boolean;

  /**
   * ป้องกันการกดซ้ำระหว่างเรียก API ยกเลิกการเข้าตรวจ
   */
  cancelLoading?: boolean;

  /**
   * Parent เป็นผู้เรียก API ยกเลิกการจอง
   */
  onCancel?: () => void;

  onClose: () => void;

  closeOnBackdrop?: boolean;
  closeOnEsc?: boolean;
};

export default function OutOfAreaModal({
  open,
  showReserveButton = false,
  reserveLoading = false,
  onReserve,
  showCancelButton = false,
  cancelLoading = false,
  onCancel,
  onClose,
  closeOnBackdrop = true,
  closeOnEsc = true,
}: Props) {
  const isLoading = reserveLoading || cancelLoading;

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!closeOnEsc || isLoading) {
        return;
      }

      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, closeOnEsc, isLoading, onClose]);

  if (!open) {
    return null;
  }

  const handleClose = () => {
    if (isLoading) {
      return;
    }

    onClose();
  };

  const handleReserve = () => {
    if (
      isLoading ||
      !showReserveButton ||
      typeof onReserve !== "function"
    ) {
      return;
    }

    onReserve();
  };

  const handleCancel = () => {
    if (
      isLoading ||
      !showCancelButton ||
      typeof onCancel !== "function"
    ) {
      return;
    }

    onCancel();
  };

  const handleBackdropMouseDown = () => {
    if (!closeOnBackdrop || isLoading) {
      return;
    }

    onClose();
  };

  const canShowCancelButton =
    showCancelButton && typeof onCancel === "function";

  const canShowReserveButton =
    !canShowCancelButton &&
    showReserveButton &&
    typeof onReserve === "function";

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="out-of-area-title"
      onMouseDown={handleBackdropMouseDown}
    >
      <div
        className={styles.modal}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className={styles.closeButton}
          onClick={handleClose}
          disabled={isLoading}
          aria-label="ปิดหน้าต่าง"
          title="ปิด"
        >
         ปิด X
        </button>

        <div className={styles.icon} aria-hidden="true">
          !
        </div>

        <div className={styles.body}>
          <span id="out-of-area-title">ขณะนี้ท่านอยู่นอก</span>
          <span>พื้นที่ลงเวลางาน</span>
        </div>

        {canShowCancelButton && (
          <div className={styles.actions}>
            <button
              type="button"
              className={`${styles.btn} ${styles.cancelButton}`}
              onClick={handleCancel}
              disabled={isLoading}
            >
              {cancelLoading
                ? "กำลังยกเลิก..."
                : "กดปุ่ม ยกเลิกการจองเข้าตรวจ"}
            </button>
          </div>
        )}

        {canShowReserveButton && (
          <div className={styles.actions}>
            <button
              type="button"
              className={`${styles.btn} ${styles.confirmButton}`}
              onClick={handleReserve}
              disabled={isLoading}
            >
              {reserveLoading
                ? "กำลังยืนยัน..."
                : "กดปุ่ม ยืนยันการจองเข้าตรวจ"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}