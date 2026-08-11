// src/pages/Home/index.tsx
import { useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faClock,
  faBed,
  faUsers,
  faClipboardList,
  faFileLines,
  faRoute,
  faEllipsis,
  faRightFromBracket,
} from "@fortawesome/free-solid-svg-icons";

import Header from "@/layout/Header";
import api from "@/lib/api";
import styles from "./Home.module.css";

type PatrolAreaInfo = {
  fieldName: string;
  divisionName: string;
  routeName: string;
};

type EmployeePatrolAreaResponse = {
  field_name?: string | null;
  division_name?: string | null;
  route_name?: string | null;
};

type Props = {
  empCode: string;
  displayName?: string;

  /**
   * ค่าที่ App.tsx เก็บไว้ เป็น fallback ระหว่างรอ Home โหลด API
   */
  fieldName?: string | null;
  divisionName?: string | null;
  routeName?: string | null;

  /**
   * Home.tsx โหลดข้อมูลเสร็จแล้วส่งค่ากลับไป App.tsx
   * เพื่อให้ App.tsx ส่งต่อไปหน้า Checkpoint
   */
  onPatrolAreaLoaded?: (patrolArea: PatrolAreaInfo) => void;

  onLogout: () => void;
  onGoCheckInOut: () => void;
  onGoOrganizationInfo: () => void;
  onGoCheckpoint: () => void;
  onGoPatrolReport: () => void;
  onGoLeaveShifts: () => void;
  onGoFaceProfiles: () => void;
  onGoOther?: () => void;
};

const ADMIN_EMPLOYEE_CODE = "036259";

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Home เป็นหน้าแรก:
 * ดึงข้อมูล ภาค / เขต / เส้นทาง ตั้งแต่เข้าหน้า Home
 */
async function getEmployeePatrolArea(
  employeeCode: string,
): Promise<PatrolAreaInfo> {
  const cleanEmployeeCode = employeeCode.trim();

  if (!cleanEmployeeCode) {
    return {
      fieldName: "",
      divisionName: "",
      routeName: "",
    };
  }

  const data = await api.get<EmployeePatrolAreaResponse>(
    `/employees/${encodeURIComponent(cleanEmployeeCode)}`,
  );

  return {
    fieldName: cleanText(data.field_name),
    divisionName: cleanText(data.division_name),
    routeName: cleanText(data.route_name),
  };
}

function getOrganizationValues(
  fieldName?: string | null,
  divisionName?: string | null,
  routeName?: string | null,
): string[] {
  return [fieldName, divisionName, routeName]
    .map((value) => value?.trim() || "")
    .filter(Boolean);
}

export default function Home({
  empCode,
  displayName,
  fieldName,
  divisionName,
  routeName,
  onPatrolAreaLoaded,
  onLogout,
  onGoCheckInOut,
  onGoOrganizationInfo,
  onGoCheckpoint,
  onGoPatrolReport,
  onGoLeaveShifts,
  onGoFaceProfiles,
  onGoOther,
}: Props) {
  const isAdmin = empCode === ADMIN_EMPLOYEE_CODE;

  /**
   * เก็บค่าที่ Home โหลดจาก API ไว้แสดงเองทันที
   */
  const [loadedPatrolArea, setLoadedPatrolArea] = useState<PatrolAreaInfo>({
    fieldName: "",
    divisionName: "",
    routeName: "",
  });

  useEffect(() => {
    const cleanEmployeeCode = empCode.trim();

    if (!cleanEmployeeCode) {
      const emptyPatrolArea = {
        fieldName: "",
        divisionName: "",
        routeName: "",
      };

      setLoadedPatrolArea(emptyPatrolArea);
      onPatrolAreaLoaded?.(emptyPatrolArea);
      return;
    }

    let cancelled = false;

    async function loadPatrolAreaFromHome() {
      try {
        const patrolArea = await getEmployeePatrolArea(cleanEmployeeCode);

        if (cancelled) return;

        setLoadedPatrolArea(patrolArea);

        /**
         * ส่งข้อมูลกลับไป App.tsx
         * แล้ว App.tsx จะส่งต่อไป Checkpoint
         */
        onPatrolAreaLoaded?.(patrolArea);
      } catch (error) {
        console.error("[Home] load patrol area error:", error);

        if (cancelled) return;

        const emptyPatrolArea = {
          fieldName: "",
          divisionName: "",
          routeName: "",
        };

        setLoadedPatrolArea(emptyPatrolArea);
        onPatrolAreaLoaded?.(emptyPatrolArea);
      }
    }

    void loadPatrolAreaFromHome();

    return () => {
      cancelled = true;
    };
  }, [empCode, onPatrolAreaLoaded]);

  /**
   * ใช้ค่าที่ Home โหลดเองก่อน
   * ถ้ายังโหลดไม่เสร็จ จึงใช้ fallback จาก App.tsx
   */
  const organizationValues = useMemo(
    () =>
      getOrganizationValues(
        loadedPatrolArea.fieldName || fieldName,
        loadedPatrolArea.divisionName || divisionName,
        loadedPatrolArea.routeName || routeName,
      ),
    [
      divisionName,
      fieldName,
      loadedPatrolArea.divisionName,
      loadedPatrolArea.fieldName,
      loadedPatrolArea.routeName,
      routeName,
    ],
  );

  return (
    <main className="guts-bg">
      <div className={styles.home}>
        <section className="guts-home-card" aria-label="Home">
          <Header empCode={empCode} displayName={displayName} />

          <h2 className={styles.title}>หน้าหลัก</h2>

          {organizationValues.length > 0 ? (
            <div className={styles.orgInfo} aria-label="ข้อมูลแนวสายตรวจ">
              {organizationValues.map((value, index) => (
                <span className={styles.orgItem} key={`${value}-${index}`}>
                  {value}
                </span>
              ))}
            </div>
          ) : null}

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
                  <span className={styles.menuSubLine}>(ติดตาม\มอบหมาย)</span>
                </div>
              </div>
            </button>

            <button
              type="button"
              className={styles.menuBtn}
              onClick={onGoOrganizationInfo}
            >
              <div className={styles.menuBox}>
                <div className={styles.iconWrap} aria-hidden="true">
                  <FontAwesomeIcon className={styles.fa} icon={faRoute} />
                </div>

                <div className={styles.text}>ข้อมูลหน่วยงาน</div>
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

                    <div className={styles.text}>
                      เพิ่มข้อมูลใบหน้าพนักงาน
                    </div>
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
                      <FontAwesomeIcon
                        className={styles.fa}
                        icon={faEllipsis}
                      />
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