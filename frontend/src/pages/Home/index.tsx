import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faClock,
  faBed,
  faUsers,
  faClipboardList,
  faFileLines,
  faEllipsis,
  faRightFromBracket,
} from "@fortawesome/free-solid-svg-icons";

import Header from "@/layout/Header";
import styles from "./Home.module.css";

type Props = {
  empCode: string;
  displayName?: string;

  onLogout: () => void;

  // ไปหน้า CheckInOut
  onGoCheckInOut: () => void;

  // ไปหน้า Checkpoint
  onGoCheckpoint: () => void;

  // ไปหน้า PatrolReport
  onGoPatrolReport: () => void;

  onGoLeaveShifts: () => void;
  onGoFaceProfiles: () => void;

  onGoOther?: () => void;
};

const ADMIN_EMPLOYEE_CODE = "036259";

export default function Home({
  empCode,
  displayName,
  onLogout,
  onGoCheckInOut,
  onGoCheckpoint,
  onGoPatrolReport,
  onGoLeaveShifts,
  onGoFaceProfiles,
  onGoOther,
}: Props) {
  const isAdmin = empCode === ADMIN_EMPLOYEE_CODE;

  return (
    <main className="guts-bg">
      <div className={styles.home}>
        <section className="guts-home-card" aria-label="Home">
          <Header empCode={empCode} displayName={displayName} />

          <h2 className={styles.title}>หน้าหลัก</h2>

          <div className={styles.menuStack}>
            {/* 1) ตารางงานสายตรวจ (ตามแผน) */}
            <button
              type="button"
              className={styles.menuBtn}
              onClick={onGoCheckpoint}
            >
              <div className={styles.menuBox}>
                <div className={styles.iconWrap} aria-hidden="true">
                  <FontAwesomeIcon
                    className={styles.fa}
                    icon={faClipboardList}
                  />
                </div>
                <div className={styles.text}>
                  <span className={styles.menuMainLine}>ตารางงานสายตรวจ</span>
                  <span className={styles.menuSubLine}>(ตามแผน)</span>
                </div>
              </div>
            </button>

            {/* 2) ลงเวลา เข้า-ออกงาน (นอกแผน) */}
            <button
              type="button"
              className={styles.menuBtn}
              onClick={onGoCheckInOut}
            >
              <div className={styles.menuBox}>
                <div className={styles.iconWrap} aria-hidden="true">
                  <FontAwesomeIcon className={styles.fa} icon={faClock} />
                </div>
                <div className={styles.text}>
                  <span className={styles.menuMainLine}>
                    ลงเวลา เข้า-ออกงาน
                  </span>
                  <span className={styles.menuSubLine}>(นอกแผน)</span>
                </div>
              </div>
            </button>

            {/* 3) รายงานสายตรวจ */}
            <button
              type="button"
              className={styles.menuBtn}
              onClick={onGoPatrolReport}
            >
              <div className={styles.menuBox}>
                <div className={styles.iconWrap} aria-hidden="true">
                  <FontAwesomeIcon className={styles.fa} icon={faFileLines} />
                </div>
                <div className={styles.text}>รายงานสายตรวจ</div>
              </div>
            </button>

            {isAdmin ? (
              <>
                <button
                  type="button"
                  className={styles.menuBtn}
                  onClick={onGoLeaveShifts}
                >
                  <div className={styles.menuBox}>
                    <div className={styles.iconWrap} aria-hidden="true">
                      <FontAwesomeIcon className={styles.fa} icon={faBed} />
                    </div>
                    <div className={styles.text}>แก้ไขข้อมูลกะงาน</div>
                  </div>
                </button>

                <button
                  type="button"
                  className={styles.menuBtn}
                  onClick={onGoFaceProfiles}
                >
                  <div className={styles.menuBox}>
                    <div className={styles.iconWrap} aria-hidden="true">
                      <FontAwesomeIcon className={styles.fa} icon={faUsers} />
                    </div>
                    <div className={styles.text}>เพิ่มข้อมูลใบหน้าพนักงาน</div>
                  </div>
                </button>

                <button
                  type="button"
                  className={styles.menuBtn}
                  onClick={onGoOther}
                  disabled={!onGoOther}
                >
                  <div className={styles.menuBox}>
                    <div className={styles.iconWrap} aria-hidden="true">
                      <FontAwesomeIcon className={styles.fa} icon={faEllipsis} />
                    </div>
                    <div className={styles.text}>อื่นๆ</div>
                  </div>
                </button>
              </>
            ) : null}
          </div>

          <div className={styles.actions}>
            <button className={styles.logout} type="button" onClick={onLogout}>
              ออกจากระบบ
              <FontAwesomeIcon
                className={styles.logoutFa}
                icon={faRightFromBracket}
              />
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}