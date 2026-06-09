import { useEffect, useState, useCallback } from "react";
import { Check } from "lucide-react";
import styles from "./TimingSuccessMessagePopUp.module.css";

type Props = {
  open: boolean;
  message?: string;
  contacts?: Array<{ team?: string; email?: string }>;
  closeOnBackdrop?: boolean;
  closeOnEsc?: boolean;
  onClose?: () => void;
};

const EXIT_ANIMATION_DURATION = 200; // ms, matches CSS exit animations

export default function TimingSuccessMessagePopUp({
  open,
  message = "",
  contacts,
  closeOnBackdrop = false,
  closeOnEsc = true,
  onClose,
}: Props) {
  const [shouldRender, setShouldRender] = useState(open);
  const [closing, setClosing] = useState(false);

  // Track the open prop: open → mount immediately, close → animate out then unmount
  useEffect(() => {
    if (open) {
      setClosing(false);
      setShouldRender(true);
    } else if (shouldRender) {
      setClosing(true);
      const timer = setTimeout(() => {
        setShouldRender(false);
        setClosing(false);
      }, EXIT_ANIMATION_DURATION);
      return () => clearTimeout(timer);
    }
  }, [open, shouldRender]);

  const startClosing = useCallback(() => {
    if (closing) return;
    setClosing(true);
    setTimeout(() => {
      setShouldRender(false);
      setClosing(false);
      onClose?.();
    }, EXIT_ANIMATION_DURATION);
  }, [closing, onClose]);

  // Listen for Escape key to close
  useEffect(() => {
    if (!shouldRender || !closeOnEsc || closing) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") startClosing();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [shouldRender, closeOnEsc, closing, startClosing]);

  // Auto-close after 3.5 seconds
  useEffect(() => {
    if (!shouldRender || closing) return;
    const timer = setTimeout(() => {
      startClosing();
    }, 3000);
    return () => clearTimeout(timer);
  }, [shouldRender, closing, startClosing]);

  if (!shouldRender) return null;

  return (
    <div
      className={`${styles.backdrop} ${closing ? styles.backdropClosing : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label="สำเร็จ"
      onClick={() => {
        if (!closeOnBackdrop) return;
        startClosing();
      }}
    >
      <div
        className={`${styles.modal} ${closing ? styles.modalClosing : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.badge} aria-hidden="true">
          <Check className={styles.badgeIcon} />
        </div>

        <div className={styles.successTitle}>สำเร็จ</div>

        <div className={styles.body}>
          <div className={styles.messageLine}>{message}</div>

          <div className={styles.contacts}>
            <div className={styles.contactEmail}>( hr0008@gmail.com )</div>
          </div>
          {/*{contacts && contacts.length > 0 && (
            <div className={styles.contacts}>
              {contacts.map((c, idx) => (
                <div key={idx} className={styles.contact}>
                  <div>
                    <span className={styles.contactLabel}>ติดต่อ: </span>
                    <span className={styles.contactValue}>
                      {c.team || "ไม่ระบุ"}
                    </span>
                  </div>
                  {c.email && (
                    <div className={styles.contactEmail}>อีเมล: {c.email}</div>
                  )}
                </div>
              ))}
            </div>
          )}*/}
        </div>
      </div>
    </div>
  );
}
