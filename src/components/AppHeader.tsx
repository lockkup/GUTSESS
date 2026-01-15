// src/components/AppHeader.tsx
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUser, faChevronRight } from "@fortawesome/free-solid-svg-icons";

type Props = {
  empCode: string;
  displayName?: string;
};

export default function AppHeader({ empCode, displayName }: Props) {
  return (
    <header className="guts-header">
      {/* ✅ คงเดิมตามที่คุณล็อกไว้ */}
      <h1 className="guts-logo">
        <span className="guts">GUTS</span> <span className="ess">ESS</span>
      </h1>
      <div className="guts-sub-en">Employee Self Service</div>
      <div className="guts-sub-th">ระบบบริการตนเอง</div>
      <div className="guts-sub-small">สำหรับพนักงานสำนักงานและสายตรวจ</div>

      {/* ✅ usercard แบบในภาพ (ไอคอน + ลูกศร) */}
      <div className="guts-usercard" role="status" aria-label="ผู้ใช้งาน">
        <span className="guts-usercard-icon" aria-hidden="true">
          <FontAwesomeIcon icon={faUser} />
        </span>

        <span className="guts-usercard-label">ผู้ใช้งาน:</span>

        <span className="guts-usercard-value">
          {empCode}
          {displayName ? `-${displayName}` : ""}
        </span>

        <span className="guts-usercard-chevron" aria-hidden="true">
          <FontAwesomeIcon icon={faChevronRight} />
        </span>
      </div>
    </header>
  );
}
