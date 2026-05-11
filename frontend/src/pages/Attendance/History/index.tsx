// src/pages/Attendance/History/index.tsx
import Header from "@/layout/Header";
import BackButton from "@/components/BackButton";
import styles from "./History.module.css";

type HistoryStatus =
  | "checked"
  | "in_progress"
  | "pending"
  | "cancelled";

type HistoryItem = {
  id: string;
  roundName: string;
  dateText: string;
  pointCode: string;
  pointName: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  operatorName: string | null;
  status: HistoryStatus;
  reason: string | null;
};

type AttendanceHistoryPageProps = {
  employeeCode?: string;
  employeeName?: string;
  periodLabel?: string;
  dateRangeLabel?: string;
  onBack: () => void;
};

const mockHistory: HistoryItem[] = [
  {
    id: "1",
    roundName: "ผลัดกลางวัน",
    dateText: "1 ม.ค. 2569",
    pointCode: "ST1-ZN1-R1-CP0001",
    pointName: "AAAAAA",
    checkInTime: "09:50",
    checkOutTime: "10:10",
    operatorName: "000001 - กกกกก กกกกก",
    status: "checked",
    reason: null,
  },
  {
    id: "2",
    roundName: "ผลัดกลางวัน",
    dateText: "1 ม.ค. 2569",
    pointCode: "ST1-ZN1-R1-CP0002",
    pointName: "BBBBBB",
    checkInTime: "10:50",
    checkOutTime: "11:30",
    operatorName: "000001 - กกกกก กกกกก",
    status: "checked",
    reason: null,
  },
  {
    id: "3",
    roundName: "ผลัดกลางวัน",
    dateText: "1 ม.ค. 2569",
    pointCode: "ST1-ZN1-R1-CP0003",
    pointName: "CCCCCC",
    checkInTime: "13:00",
    checkOutTime: "13:15",
    operatorName: "000001 - กกกกก กกกกก",
    status: "checked",
    reason: null,
  },
  {
    id: "4",
    roundName: "ผลัดกลางวัน",
    dateText: "1 ม.ค. 2569",
    pointCode: "ST1-ZN1-R1-CP0004",
    pointName: "DDDDDD",
    checkInTime: "14:00",
    checkOutTime: "14:30",
    operatorName: "000001 - กกกกก กกกกก",
    status: "checked",
    reason: null,
  },
  {
    id: "5",
    roundName: "ผลัดกลางวัน",
    dateText: "1 ม.ค. 2569",
    pointCode: "ST1-ZN1-R1-CP0005",
    pointName: "EEEEEE",
    checkInTime: null,
    checkOutTime: null,
    operatorName: "000001 - กกกกก กกกกก",
    status: "cancelled",
    reason: "ลืมเข้าตรวจ มีธุระด่วนที่บ้าน",
  },
  {
    id: "6",
    roundName: "ผลัดกลางวัน",
    dateText: "1 ม.ค. 2569",
    pointCode: "ST1-ZN1-R1-CP0006",
    pointName: "FFFFFF",
    checkInTime: null,
    checkOutTime: null,
    operatorName: null,
    status: "pending",
    reason: null,
  },
  {
    id: "7",
    roundName: "ผลัดกลางวัน",
    dateText: "1 ม.ค. 2569",
    pointCode: "ST1-ZN1-R1-CP0007",
    pointName: "GGGGGG",
    checkInTime: "15:00",
    checkOutTime: null,
    operatorName: "000001 - กกกกก กกกกก",
    status: "in_progress",
    reason: null,
  },
];

function getStatusLabel(status: HistoryStatus) {
  switch (status) {
    case "checked":
      return "ตรวจแล้ว";
    case "in_progress":
      return "อยู่ระหว่างการเข้าตรวจ";
    case "pending":
      return "รอดำเนินการเข้าตรวจ";
    case "cancelled":
      return "ยกเลิกการเข้าตรวจ";
    default:
      return "-";
  }
}

function getStatusClass(status: HistoryStatus) {
  switch (status) {
    case "checked":
      return styles.statusChecked;
    case "in_progress":
      return styles.statusInProgress;
    case "pending":
      return styles.statusPending;
    case "cancelled":
      return styles.statusCancelled;
    default:
      return "";
  }
}

function getTimeClass(value: string | null, status: HistoryStatus) {
  if (value) return styles.timeOk;
  if (status === "cancelled" || status === "in_progress") {
    return styles.timeWarning;
  }
  return styles.timeEmpty;
}

export default function AttendanceHistoryPage({
  employeeCode = "",
  employeeName = "",
  periodLabel = "ย้อนหลัง 1 เดือน",
  dateRangeLabel = "6 เม.ย. 2569 - 5 พ.ค. 2569",
  onBack,
}: AttendanceHistoryPageProps) {
  return (
    <main className="guts-bg">
      <div className="guts-home">
        <section className="guts-home-card" aria-label="AttendanceHistory">
          <Header empCode={employeeCode} displayName={employeeName} />

          <div className={styles.body}>
            <div className={styles.titleRow}>
              <h2 className={styles.title}>ประวัติการลงเวลางาน</h2>
            </div>

            <div className={styles.filterCard}>
              <div className={styles.filterIconWrap} aria-hidden="true">
                <svg viewBox="0 0 24 24" className={styles.filterIcon}>
                  <path
                    d="M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 1 1 2 0v1h1a3 3 0 0 1 3 3v11a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V7a3 3 0 0 1 3-3h1V3a1 1 0 0 1 1-1Zm13 9H4v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7ZM5 6a1 1 0 0 0-1 1v2h16V7a1 1 0 0 0-1-1H5Z"
                    fill="currentColor"
                  />
                </svg>
              </div>

              <div className={styles.filterText}>
                <div className={styles.filterTitle}>{periodLabel}</div>
                <div className={styles.filterDate}>{dateRangeLabel}</div>
              </div>

              <button
                type="button"
                className={styles.filterButton}
                aria-label="เลือกช่วงเวลา"
              >
                <svg viewBox="0 0 20 20" className={styles.chevronIcon}>
                  <path
                    d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4Z"
                    fill="currentColor"
                  />
                </svg>
              </button>
            </div>

            <div className={styles.tableCard}>
              <div className={styles.tableScroll}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>รอบการตรวจ</th>
                      <th>ตารางของวันที่</th>
                      <th>รหัสจุดรายการ</th>
                      <th>ชื่อจุดรายการ</th>
                      <th>ลงเวลาเข้าตรวจ</th>
                      <th>ลงเวลาออกตรวจ</th>
                      <th>ผู้ดำเนินการ</th>
                      <th>สถานะการตรวจ</th>
                      <th>สาเหตุกรณีไม่ได้ตรวจตามรอบที่กำหนด</th>
                    </tr>
                  </thead>

                  <tbody>
                    {mockHistory.map((item) => (
                      <tr key={item.id}>
                        <td>{item.roundName}</td>
                        <td>{item.dateText}</td>
                        <td className={styles.breakText}>{item.pointCode}</td>
                        <td>{item.pointName}</td>

                        <td>
                          <span
                            className={`${styles.timeChip} ${getTimeClass(
                              item.checkInTime,
                              item.status,
                            )}`}
                          >
                            {item.checkInTime ?? "-"}
                          </span>
                        </td>

                        <td>
                          <span
                            className={`${styles.timeChip} ${getTimeClass(
                              item.checkOutTime,
                              item.status,
                            )}`}
                          >
                            {item.checkOutTime ?? "-"}
                          </span>
                        </td>

                        <td className={styles.breakText}>
                          {item.operatorName ?? "-"}
                        </td>

                        <td>
                          <span
                            className={`${styles.statusChip} ${getStatusClass(item.status)}`}
                          >
                            {getStatusLabel(item.status)}
                          </span>
                        </td>

                        <td className={item.reason ? styles.reasonText : ""}>
                          {item.reason ?? "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className={styles.noteCard}>
              <div className={styles.noteIcon} aria-hidden="true">
                i
              </div>
              <div className={styles.noteText}>
                หมายเหตุ: เวลาเข้าตรวจ / ออกตรวจ แสดงตามเวลาที่บันทึกจริง
                <br />
                สถานะการตรวจอาจเปลี่ยนแปลงตามการอัปเดตข้อมูลล่าสุด
              </div>
            </div>

            <div className="guts-fv-bottom">
              <BackButton onClick={onBack} className="guts-fv-backBtn" />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}