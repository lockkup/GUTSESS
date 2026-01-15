// src/components/AppHeader.tsx
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUser, faChevronRight } from "@fortawesome/free-solid-svg-icons";
import styles from "./AppHeader.module.css";

type Props = {
  empCode: string;
  displayName?: string;
};

export default function AppHeader({ empCode, displayName }: Props) {
  return (
    <header className={styles.header}>
      {/* ✅ คงเดิมตามที่คุณล็อกไว้ */}
      <h1 className={styles.logo}>
        <span className={styles.guts}>GUTS</span> <span className={styles.ess}>ESS</span>
      </h1>
      <div className={styles.subEn}>Employee Self Service</div>
      <div className={styles.subTh}>ระบบบริการตนเอง</div>
      <div className={styles.subSmall}>สำหรับพนักงานสำนักงานและสายตรวจ</div>

      {/* ✅ usercard แบบในภาพ (ไอคอน + ลูกศร) */}
      <div className={styles.usercard} role="status" aria-label="ผู้ใช้งาน">
        <span className={styles.usercardIcon} aria-hidden="true">
          <FontAwesomeIcon icon={faUser} />
        </span>

        <span className={styles.usercardLabel}>ผู้ใช้งาน:</span>

        <span className={styles.usercardValue}>
          {empCode}
          {displayName ? `-${displayName}` : ""}
        </span>

        <span className={styles.usercardChevron} aria-hidden="true">
          <FontAwesomeIcon icon={faChevronRight} />
        </span>
      </div>
    </header>
  );
}
