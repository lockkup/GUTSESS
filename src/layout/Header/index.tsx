// src/layout/Header/index.tsx
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUser } from "@fortawesome/free-solid-svg-icons";
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
        <span className={styles.logoGuts}>GUTS</span>{" "}
        <span className={styles.logoEss}>ESS</span>
      </h1>

      <div className={styles.subEn}>Employee Self Service</div>
      <div className={styles.subTh}>ระบบบริการตนเอง</div>
      <div className={styles.subSmall}>สำหรับพนักงานสำนักงานและสายตรวจ</div>

      {showUserCard && (
        <div className={styles.usercard} role="status" aria-label="ผู้ใช้งาน">
          <span className={styles.usercardIcon} aria-hidden="true">
            <FontAwesomeIcon icon={faUser} />
          </span>

          <span className={styles.usercardLabel}>ผู้ใช้งาน:</span>

          <span className={styles.usercardValue}>
            {empCode}
            {displayName ? `-${displayName}` : ""}
          </span>
        </div>
      )}
    </header>
  );
}
