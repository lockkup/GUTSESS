// src/components/popup/ForgetPassSuccessSmsPopUp.tsx
import { useCallback, useEffect, useState } from "react";
import { Check } from "lucide-react";

import styles from "./ForgetPassSuccessSmsPopUp.module.css";

type Contact = {
  team?: string;
  email?: string;
};

type Props = {
  open: boolean;
  message?: string;
  contacts?: Contact[];
  closeOnBackdrop?: boolean;
  closeOnEsc?: boolean;
  onClose?: () => void;
};

const EXIT_ANIMATION_DURATION = 200;
const AUTO_CLOSE_DELAY = 3000;

export default function ForgetPassSuccessSmsPopUp({
  open,
  message = "กรุณาตรวจสอบรหัสผ่านของคุณในอีเมล",
  contacts = [],
  closeOnBackdrop = false,
  closeOnEsc = true,
  onClose,
}: Props) {
  const [shouldRender, setShouldRender] = useState(open);
  const [closing, setClosing] = useState(false);

  const hasContacts = contacts.length > 0;

  const startClosing = useCallback(() => {
    if (closing) return;

    setClosing(true);

    window.setTimeout(() => {
      setShouldRender(false);
      setClosing(false);
      onClose?.();
    }, EXIT_ANIMATION_DURATION);
  }, [closing, onClose]);

  useEffect(() => {
    if (open) {
      setClosing(false);
      setShouldRender(true);
      return;
    }

    if (shouldRender) {
      startClosing();
    }
  }, [open, shouldRender, startClosing]);

  useEffect(() => {
    if (!shouldRender || !closeOnEsc || closing) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        startClosing();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [shouldRender, closeOnEsc, closing, startClosing]);

  useEffect(() => {
    if (!shouldRender || closing) return;

    const timer = window.setTimeout(() => {
      startClosing();
    }, AUTO_CLOSE_DELAY);

    return () => {
      window.clearTimeout(timer);
    };
  }, [shouldRender, closing, startClosing]);

  if (!shouldRender) return null;

  return (
    <div
      className={`${styles.backdrop} ${closing ? styles.backdropClosing : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label="ส่งรหัสผ่านสำเร็จ"
      onClick={() => {
        if (!closeOnBackdrop) return;
        startClosing();
      }}
    >
      <div
        className={`${styles.modal} ${closing ? styles.modalClosing : ""}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.badge} aria-hidden="true">
          <Check className={styles.badgeIcon} />
        </div>

        <div className={styles.successTitle}>สำเร็จ</div>

        <div className={styles.body}>
          {message && (
            <div className={styles.messageArea}>
              {message.split("\n").map((line, index) => (
                <div key={`${line}-${index}`} className={styles.messageLine}>
                  {line}
                </div>
              ))}
            </div>
          )}

          {hasContacts && (
            <div className={styles.contacts}>
              {contacts.map((contact, index) => (
                <div
                  key={`${contact.email || contact.team || "contact"}-${index}`}
                  className={styles.contact}
                >
                  {contact.team && (
                    <div>
                      <span className={styles.contactLabel}>ติดต่อ: </span>
                      <span className={styles.contactValue}>
                        {contact.team}
                      </span>
                    </div>
                  )}

                  {contact.email && (
                    <div className={styles.contactEmail}>
                      ( {contact.email} )
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}