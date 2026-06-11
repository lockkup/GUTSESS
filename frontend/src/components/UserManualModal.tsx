// src/components/UserManualModal.tsx
import { useEffect } from "react";
import { BookOpen, ExternalLink, X } from "lucide-react";

import styles from "./UserManualModal.module.css";

type Props = {
  open: boolean;
  url: string;
  onClose: () => void;
};

export default function UserManualModal({ open, url, onClose }: Props) {
  const manualUrl = (() => {
    try {
      return new URL(url).href;
    } catch {
      return url;
    }
  })();

  useEffect(() => {
    if (!open) return;

    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = oldOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <div className={styles.modal}>
        <div className={styles.header}>
          <div>
            <div className={styles.title}>คู่มือการใช้งาน</div>
            <div className={styles.subtitle}>
              ระบบลงเวลาเข้าและออกหน่วยงาน
            </div>
          </div>

          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="ปิดคู่มือการใช้งาน"
            title="ปิด"
          >
            <X size={20} />
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.contentBox}>
            <div className={styles.iconCircle}>
              <BookOpen size={38} />
            </div>

            <div className={styles.contentTitle}>เปิดคู่มือการใช้งาน</div>

            <div className={styles.contentText}>
              คู่มืออยู่บน Google Sites ซึ่งไม่อนุญาตให้แสดงภายในกรอบ iframe
              ของระบบโดยตรง กรุณากดปุ่มด้านล่างเพื่อเปิดคู่มือแบบหน้าเต็ม
            </div>

            <a
              className={styles.openManualButton}
              href={manualUrl}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink size={18} />
              เปิดคู่มือหน้าเต็ม
            </a>

            <button
              type="button"
              className={styles.cancelButton}
              onClick={onClose}
            >
              ปิดหน้าต่างนี้
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}