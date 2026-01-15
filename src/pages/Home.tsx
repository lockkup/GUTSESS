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
import styles from "./Home.module.css";

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
    <main className={styles.bg}>
      <div className={styles.home}>
        <section className={styles.homeCard} aria-label="Home">
          {/* ✅ Header ใช้ร่วมทุกหน้า */}
          <AppHeader empCode={empCode} displayName={displayName} />

          <h2 className={styles.homeTitle}>หน้าหลัก</h2>

          <div className={styles.menuStack}>
            <button type="button" className={styles.menuBtn} onClick={onGoCheckInOut}>
              <div className={styles.menuBox}>
                <div className={styles.menuIconWrap} aria-hidden="true">
                  <FontAwesomeIcon className={styles.menuFa} icon={faClock} />
                </div>
                <div className={styles.menuText}>ลงเวลา เข้า-ออกงาน</div>
              </div>
            </button>

            <button type="button" className={styles.menuBtn} onClick={onGoLeaveOnline}>
              <div className={styles.menuBox}>
                <div className={styles.menuIconWrap} aria-hidden="true">
                  <FontAwesomeIcon className={styles.menuFa} icon={faBed} />
                </div>
                <div className={styles.menuText}>ลาออนไลน์</div>
              </div>
            </button>

            <button type="button" className={styles.menuBtn} onClick={onGoManpower}>
              <div className={styles.menuBox}>
                <div className={styles.menuIconWrap} aria-hidden="true">
                  <FontAwesomeIcon className={styles.menuFa} icon={faUsers} />
                </div>
                <div className={styles.menuText}>จัดกำลังพล</div>
              </div>
            </button>

            <button type="button" className={styles.menuBtn} onClick={onGoDiscipline}>
              <div className={styles.menuBox}>
                <div className={styles.menuIconWrap} aria-hidden="true">
                  <FontAwesomeIcon className={styles.menuFa} icon={faGavel} />
                </div>
                <div className={styles.menuText}>บทลงโทษ</div>
              </div>
            </button>

            <button type="button" className={styles.menuBtn} onClick={onGoUniform}>
              <div className={styles.menuBox}>
                <div className={styles.menuIconWrap} aria-hidden="true">
                  <FontAwesomeIcon className={styles.menuFa} icon={faShirt} />
                </div>
                <div className={styles.menuText}>ชุดแต่งกาย</div>
              </div>
            </button>

            <button type="button" className={styles.menuBtn} onClick={onGoOther}>
              <div className={styles.menuBox}>
                <div className={styles.menuIconWrap} aria-hidden="true">
                  <FontAwesomeIcon className={styles.menuFa} icon={faEllipsis} />
                </div>
                <div className={styles.menuText}>อื่นๆ</div>
              </div>
            </button>
          </div>

          <div className={styles.homeActions}>
            <button className={styles.homeLogout} type="button" onClick={onLogout}>
              ออกจากระบบ
              <FontAwesomeIcon className={styles.logoutFa} icon={faRightFromBracket} />
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
