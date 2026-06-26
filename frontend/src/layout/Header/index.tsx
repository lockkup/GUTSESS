// src/layout/Header/index.tsx
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUser } from "@fortawesome/free-solid-svg-icons";

import logoImage from "@/assets/logoguts.svg";
import styles from "./Header.module.css";

type Props = {
  empCode?: string;
  displayName?: string;

  /** ซ่อน/แสดงแถบผู้ใช้งาน (default: true) */
  showUserCard?: boolean;
};

export default function Header({
  empCode = "",
  displayName,
  showUserCard = true,
}: Props) {
  return (
    <header className={styles.header}>
      <h1 className={styles.logo}>
        <img className={styles.logoImage} src={logoImage} alt="GUTS" />
      </h1>

      <div className={styles.subEn}>
        <span className={styles.redLetter}>E</span>mployee{" "}
        <span className={styles.redLetter}>S</span>elf{" "}
        <span className={styles.redLetter}>S</span>ervice
      </div>

      <div className={styles.subTh}>ระบบบริการตนเอง</div>

      {showUserCard && (
        <>
          <div
            className={styles.usercard}
            role="status"
            aria-label="ผู้ใช้งาน"
            style={{
              background: "transparent",
              border: "none",
              boxShadow: "none",
            }}
          >
            <span className={styles.usercardIcon} aria-hidden="true">
              <FontAwesomeIcon icon={faUser} />
            </span>

            <span className={styles.usercardLabel}>ผู้ใช้งาน:</span>

            <span className={styles.usercardValue}>
              {empCode}
              {displayName ? `-${displayName}` : ""}
            </span>
          </div>

          <div className={styles.usercardDivider} aria-hidden="true" />
        </>
      )}
    </header>
  );
}
