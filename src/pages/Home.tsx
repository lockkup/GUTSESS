// src/pages/Home.tsx
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faClock,
  faBed,
  faUsers,
  faGavel,
  faShirt,
  faEllipsis,
  faRightFromBracket,
} from "@fortawesome/free-solid-svg-icons";

import AppHeader from "../components/AppHeader";

type Props = {
  empCode: string;
  displayName?: string;

  onLogout: () => void;
  onGoCheckInOut: () => void;
  onGoLeaveOnline: () => void;

  onGoManpower?: () => void;
  onGoDiscipline?: () => void;
  onGoUniform?: () => void;
  onGoOther?: () => void;
};

export default function Home({
  empCode,
  displayName,
  onLogout,
  onGoCheckInOut,
  onGoLeaveOnline,
  onGoManpower,
  onGoDiscipline,
  onGoUniform,
  onGoOther,
}: Props) {
  return (
    <main className="guts-bg">
      <div className="guts-home">
        <section className="guts-home-card" aria-label="Home">
          {/* ✅ Header ใช้ร่วมทุกหน้า */}
          <AppHeader empCode={empCode} displayName={displayName} />

          <h2 className="guts-home-title">หน้าหลัก</h2>

          <div className="guts-menu-stack">
            <button type="button" className="guts-menu-btn" onClick={onGoCheckInOut}>
              <div className="guts-menu-box">
                <div className="guts-menu-iconWrap" aria-hidden="true">
                  <FontAwesomeIcon className="guts-menu-fa" icon={faClock} />
                </div>
                <div className="guts-menu-text">ลงเวลา เข้า-ออกงาน</div>
              </div>
            </button>

            <button type="button" className="guts-menu-btn" onClick={onGoLeaveOnline}>
              <div className="guts-menu-box">
                <div className="guts-menu-iconWrap" aria-hidden="true">
                  <FontAwesomeIcon className="guts-menu-fa" icon={faBed} />
                </div>
                <div className="guts-menu-text">ลาออนไลน์</div>
              </div>
            </button>

            <button type="button" className="guts-menu-btn" onClick={onGoManpower}>
              <div className="guts-menu-box">
                <div className="guts-menu-iconWrap" aria-hidden="true">
                  <FontAwesomeIcon className="guts-menu-fa" icon={faUsers} />
                </div>
                <div className="guts-menu-text">จัดกำลังพล</div>
              </div>
            </button>

            <button type="button" className="guts-menu-btn" onClick={onGoDiscipline}>
              <div className="guts-menu-box">
                <div className="guts-menu-iconWrap" aria-hidden="true">
                  <FontAwesomeIcon className="guts-menu-fa" icon={faGavel} />
                </div>
                <div className="guts-menu-text">บทลงโทษ</div>
              </div>
            </button>

            <button type="button" className="guts-menu-btn" onClick={onGoUniform}>
              <div className="guts-menu-box">
                <div className="guts-menu-iconWrap" aria-hidden="true">
                  <FontAwesomeIcon className="guts-menu-fa" icon={faShirt} />
                </div>
                <div className="guts-menu-text">ชุดแต่งกาย</div>
              </div>
            </button>

            <button type="button" className="guts-menu-btn" onClick={onGoOther}>
              <div className="guts-menu-box">
                <div className="guts-menu-iconWrap" aria-hidden="true">
                  <FontAwesomeIcon className="guts-menu-fa" icon={faEllipsis} />
                </div>
                <div className="guts-menu-text">อื่นๆ</div>
              </div>
            </button>
          </div>

          <div className="guts-home-actions">
            <button className="guts-home-logout" type="button" onClick={onLogout}>
              ออกจากระบบ
              <FontAwesomeIcon className="guts-logout-fa" icon={faRightFromBracket} />
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
