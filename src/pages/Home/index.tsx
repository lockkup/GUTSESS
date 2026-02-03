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

import Header from "@/layout/Header";
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
    <main className="guts-bg">
      <div className={styles.home}>
        <section className="guts-home-card" aria-label="Home">
          <Header empCode={empCode} displayName={displayName} />

          <h2 className={styles.title}>หน้าหลัก</h2>

          <div className={styles.menuStack}>
            <button type="button" className={styles.menuBtn} onClick={onGoCheckInOut}>
              <div className={styles.menuBox}>
                <div className={styles.iconWrap} aria-hidden="true">
                  <FontAwesomeIcon className={styles.fa} icon={faClock} />
                </div>
                <div className={styles.text}>ลงเวลา เข้า-ออกงาน</div>
              </div>
            </button>

            <button type="button" className={styles.menuBtn} onClick={onGoLeaveOnline}>
              <div className={styles.menuBox}>
                <div className={styles.iconWrap} aria-hidden="true">
                  <FontAwesomeIcon className={styles.fa} icon={faBed} />
                </div>
                <div className={styles.text}>ลาออนไลน์</div>
              </div>
            </button>

            <button type="button" className={styles.menuBtn} onClick={onGoManpower}>
              <div className={styles.menuBox}>
                <div className={styles.iconWrap} aria-hidden="true">
                  <FontAwesomeIcon className={styles.fa} icon={faUsers} />
                </div>
                <div className={styles.text}>รายงานประจำวันฝ่ายปฏิบัติการ</div>
              </div>
            </button>

            <button type="button" className={styles.menuBtn} onClick={onGoDiscipline}>
              <div className={styles.menuBox}>
                <div className={styles.iconWrap} aria-hidden="true">
                  <FontAwesomeIcon className={styles.fa} icon={faGavel} />
                </div>
                <div className={styles.text}>ผิดข้อปฏิบัติ</div>
              </div>
            </button>

            <button type="button" className={styles.menuBtn} onClick={onGoUniform}>
              <div className={styles.menuBox}>
                <div className={styles.iconWrap} aria-hidden="true">
                  <FontAwesomeIcon className={styles.fa} icon={faShirt} />
                </div>
                <div className={styles.text}>ชุดแต่งกาย</div>
              </div>
            </button>

            <button type="button" className={styles.menuBtn} onClick={onGoOther}>
              <div className={styles.menuBox}>
                <div className={styles.iconWrap} aria-hidden="true">
                  <FontAwesomeIcon className={styles.fa} icon={faEllipsis} />
                </div>
                <div className={styles.text}>อื่นๆ</div>
              </div>
            </button>
          </div>

          <div className={styles.actions}>
            <button className={styles.logout} type="button" onClick={onLogout}>
              ออกจากระบบ
              <FontAwesomeIcon className={styles.logoutFa} icon={faRightFromBracket} />
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
