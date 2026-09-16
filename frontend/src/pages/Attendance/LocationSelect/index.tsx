// src/pages/Attendance/LocationSelect/index.tsx

import Header from "@/layout/Header";
import BackButton from "@/components/BackButton";

import styles from "./LocationSelect.module.css";

export type AttendancePunchType = "in" | "out";

export type AttendanceLocationOption = {
  locationId: number;
  contractCode?: string | null;
  locationName: string;

  /**
   * true  = หน่วยงานนี้มีรายการเข้างานที่ยังไม่ได้ออกงาน
   * false = หน่วยงานนี้สามารถลงเวลาเข้างานได้
   *
   * แต่ละหน่วยงานแยกสถานะออกจากกัน ผู้ใช้จึงสามารถเข้างาน
   * หน่วยงานอื่นได้ แม้จะมีรายการค้างอยู่ демคนละหน่วยงาน
   */
  hasOpenRecord: boolean;
};

export type AttendanceHistoryStatus = "in_progress" | "completed";

export type AttendanceHistoryItem = {
  timeRecordId: number;
  contractCode?: string | null;
  locationName: string;
  status: AttendanceHistoryStatus;
};

export type AttendanceLocationSelection = {
  location: AttendanceLocationOption;
  punchType: AttendancePunchType;
};

type Props = {
  empCode: string;
  displayName?: string;

  /** รายการหน่วยงานที่ GPS ปัจจุบันอยู่ภายในรัศมี */
  locations: AttendanceLocationOption[];

  /** locationId ที่กำลังเปิดหน้าถัดไปหรือกำลังประมวลผล */
  busyLocationId?: number | null;

  /** โครงสำหรับประวัติการเข้าทำงาน ซึ่งจะเชื่อม API ภายหลัง */
  historyDate: string;
  historyItems?: AttendanceHistoryItem[];

  onHistoryDateChange: (value: string) => void;
  onSelectLocation: (selection: AttendanceLocationSelection) => void;
  onEditHistory?: (item: AttendanceHistoryItem) => void;
  onBack: () => void;
};

function getLocationLabel(params: {
  locationId: number;
  contractCode?: string | null;
  locationName: string;
}) {
  const contractCode = params.contractCode?.trim() || "";
  const locationName = params.locationName.trim();

  if (contractCode && locationName) {
    return `${contractCode} - ${locationName}`;
  }

  return contractCode || locationName || `หน่วยงาน ${params.locationId}`;
}

function getHistoryStatusText(status: AttendanceHistoryStatus) {
  return status === "completed" ? "เรียบร้อย" : "อยู่ระหว่างดำเนินการ";
}

export default function AttendanceLocationSelect({
  empCode,
  displayName,
  locations,
  busyLocationId = null,
  historyDate,
  historyItems = [],
  onHistoryDateChange,
  onSelectLocation,
  onEditHistory,
  onBack,
}: Props) {
  const isBusy = busyLocationId !== null;

  function handleSelectLocation(location: AttendanceLocationOption) {
    if (isBusy) return;

    onSelectLocation({
      location,
      punchType: location.hasOpenRecord ? "out" : "in",
    });
  }

  function handleBackClick() {
    if (isBusy) return;

    onBack();
  }

  return (
    <main className="guts-bg">
      <div className="guts-home">
        <section
          className="guts-home-card"
          aria-label="เลือกหน่วยงานสำหรับลงเวลาเข้า-ออกงาน"
        >
          <Header empCode={empCode} displayName={displayName} />

          <h2 className={styles.attTitle}>
            หน้าจอ - เลือกหน่วยงาน (ติดตาม/มอบหมาย)
          </h2>

          <section
            className={styles.section}
            aria-labelledby="attendance-location-heading"
          >
            <h3
              id="attendance-location-heading"
              className={styles.sectionTitle}
            >
              1. เลือกหน่วยงานที่ต้องเข้าปฏิบัติงาน
            </h3>

            <div className={styles.tableCard}>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">หน่วยงาน</th>
                      <th scope="col" className={styles.actionColumn}>
                        เลือกทำรายการ
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {locations.length > 0 ? (
                      locations.map((location) => {
                        const punchType: AttendancePunchType =
                          location.hasOpenRecord ? "out" : "in";

                        const rowBusy =
                          busyLocationId === location.locationId;

                        return (
                          <tr key={location.locationId}>
                            <td className={styles.locationCell}>
                              {getLocationLabel(location)}
                            </td>

                            <td className={styles.actionCell}>
                              <button
                                type="button"
                                className={`${styles.actionButton} ${
                                  punchType === "out"
                                    ? styles.checkOutButton
                                    : styles.checkInButton
                                }`}
                                disabled={isBusy}
                                onClick={() => handleSelectLocation(location)}
                              >
                                {rowBusy
                                  ? "กำลังดำเนินการ..."
                                  : punchType === "out"
                                    ? "กดลงเวลาออก"
                                    : "กดลงเวลาเข้า"}
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td className={styles.emptyCell} colSpan={2}>
                          ไม่พบหน่วยงานในพื้นที่ปัจจุบัน
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section
            className={styles.section}
            aria-labelledby="attendance-history-heading"
          >
            <div className={styles.historyHeadingRow}>
              <h3
                id="attendance-history-heading"
                className={styles.sectionTitle}
              >
                2. ประวัติการบันทึกรายงาน
              </h3>

              <input
                type="date"
                className={styles.dateInput}
                value={historyDate}
                onChange={(event) =>
                  onHistoryDateChange(event.currentTarget.value)
                }
                aria-label="เลือกวันที่ของประวัติการเข้าทำงาน"
              />
            </div>

            <div className={styles.tableCard}>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">หน่วยงาน</th>
                      <th scope="col" className={styles.statusColumn}>
                        สถานะ
                      </th>
                      <th scope="col" className={styles.editColumn}>
                        จัดการ
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {historyItems.length > 0 ? (
                      historyItems.map((item) => (
                        <tr key={item.timeRecordId}>
                          <td className={styles.locationCell}>
                            {getLocationLabel({
                              locationId: item.timeRecordId,
                              contractCode: item.contractCode,
                              locationName: item.locationName,
                            })}
                          </td>

                          <td
                            className={`${styles.historyStatus} ${
                              item.status === "completed"
                                ? styles.completedStatus
                                : styles.inProgressStatus
                            }`}
                          >
                            {getHistoryStatusText(item.status)}
                          </td>

                          <td className={styles.editCell}>
                            <button
                              type="button"
                              className={styles.editButton}
                              disabled={!onEditHistory}
                              onClick={() => onEditHistory?.(item)}
                            >
                              แก้ไข
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className={styles.emptyCell} colSpan={3}>
                          ยังไม่มีข้อมูลประวัติการเข้าทำงาน
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <div className="guts-fv-bottom">
            <BackButton
              onClick={handleBackClick}
              disabled={isBusy}
              className="guts-fv-backBtn"
            />
          </div>
        </section>
      </div>
    </main>
  );
}