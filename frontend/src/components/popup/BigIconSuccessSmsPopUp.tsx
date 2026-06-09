import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Check } from "lucide-react";

import styles from "./BigIconSuccessSmsPopUp.module.css";

type Props = {
  open: boolean;
  /** Large icon displayed at the top of the popup */
  icon?: ReactNode;
  /** Color applied to the default check icon */
  iconColor?: string;
  /** Bold headline shown below the icon */
  title?: string;
  /** Smaller descriptive text shown below the title */
  subText?: string;
  closeOnBackdrop?: boolean;
  closeOnEsc?: boolean;
  onClose?: () => void;
};

const EXIT_ANIMATION_DURATION = 200;
const AUTO_CLOSE_DELAY = 3000;

export default function BigIconSuccessSmsPopUp({
  open,
  icon,
  iconColor = "#16a34a",
  title = "สำเร็จ",
  subText = "",
  closeOnBackdrop = false,
  closeOnEsc = true,
  onClose,
}: Props) {
  const [shouldRender, setShouldRender] = useState(open);
  const [closing, setClosing] = useState(false);

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
      aria-label={title}
      onClick={() => {
        if (!closeOnBackdrop) return;
        startClosing();
      }}
    >
      <div
        className={`${styles.modal} ${closing ? styles.modalClosing : ""}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.iconBadge}>
          <div className={styles.iconWrap} style={{ color: iconColor }}>
            {icon ?? <Check className={styles.defaultIcon} />}
          </div>
        </div>

        {title && (
          <h2 className={styles.title} style={{ color: iconColor }}>
            {title}
          </h2>
        )}

        {subText && <p className={styles.subText}>{subText}</p>}

        <div className={styles.progressTrack} aria-hidden="true">
          <div className={styles.progressBar} />
        </div>
      </div>
    </div>
  );
}