import { useEffect } from "react";
import { AlertCircle, AlertTriangle } from "lucide-react";
import styles from "./TimingMessagePopUp.module.css";

type Contact = {
  team?: string;
  email?: string;
};

type Props = {
  open: boolean;
  message?: string;
  /** @default "warning" */
  variant?: "warning" | "error";
  errorKey?: string | null;
  contacts?: Contact[];
  closeOnBackdrop?: boolean;
  closeOnEsc?: boolean;
  onClose?: () => void;
};

export default function TimingMessagePopUp({
  open,
  message = "",
  variant = "error",
  errorKey,
  contacts,
  closeOnBackdrop = true,
  closeOnEsc = true,
  onClose,
}: Props) {
  useEffect(() => {
    if (!open || !closeOnEsc) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, closeOnEsc, onClose]);

  useEffect(() => {
    if (!open) return;

    const showContacts =
      Boolean(contacts?.length) && errorKey !== "INVALID_CREDENTIALS";

    const delay = showContacts ? 4000 : 3000;

    const timer = window.setTimeout(() => {
      onClose?.();
    }, delay);

    return () => {
      window.clearTimeout(timer);
    };
  }, [open, contacts, errorKey, onClose]);

  if (!open) return null;

  const showContacts =
    Boolean(contacts?.length) && errorKey !== "INVALID_CREDENTIALS";

  let titleText = "แจ้งเตือน";

  if (variant === "error") {
    const normalizedMessage = message.toLowerCase();

    const isConnectionError =
      errorKey === "PROXY_AUTH_REQUIRED" ||
      errorKey === "NETWORK_AUTH_REQUIRED" ||
      errorKey === "INTERNAL_ERROR" ||
      !errorKey ||
      message.includes("เชื่อมต่อ") ||
      message.includes("เซิร์ฟเวอร์") ||
      message.includes("ฐานข้อมูล") ||
      normalizedMessage.includes("server") ||
      normalizedMessage.includes("database") ||
      normalizedMessage.includes("connect");

    titleText = isConnectionError
      ? "ข้อผิดพลาดในการเชื่อมต่อ"
      : "เกิดข้อผิดพลาด";
  }

  const handleBackdropClick = () => {
    if (!closeOnBackdrop) return;
    onClose?.();
  };

  return (
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-label={titleText}
      onClick={handleBackdropClick}
    >
      <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
        <div className={styles.badge} aria-hidden="true">
          {variant === "error" ? (
            <AlertCircle className={styles.badgeIcon} />
          ) : (
            <AlertTriangle className={styles.badgeIcon} />
          )}
        </div>

        <div
          className={
            variant === "error" ? styles.errorTitle : styles.warningTitle
          }
        >
          {titleText}
        </div>

        <div className={styles.body}>
          <div className={styles.messageArea}>
            {message.split("\n").map((line, index) => (
              <div key={`${line}-${index}`} className={styles.messageLine}>
                {line}
              </div>
            ))}

            {showContacts && (
              <div className={styles.contacts}>
                {contacts?.map((contact, index) => (
                  <div
                    key={`${contact.email || contact.team || "contact"}-${index}`}
                    className={styles.contact}
                  >
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
    </div>
  );
}