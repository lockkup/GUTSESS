import Header from "@/layout/Header";
import BackButton from "@/components/BackButton";
import styles from "./Checkpoint.module.css";

type Props = {
  empCode: string;
  displayName?: string;
  onBack: () => void;
  onGoCheckInOut: () => void;
};

type RowStatus = "done" | "cancelled" | "pending" | "progress";

type CheckRow = {
  pointName: string;
  status: RowStatus;
};

const checkRows: CheckRow[] = [
  { pointName: "AAAAAA", status: "done" },
  { pointName: "BBBBBB", status: "done" },
  { pointName: "CCCCCC", status: "done" },
  { pointName: "DDDDDD", status: "done" },
  { pointName: "EEEEEE", status: "cancelled" },
  { pointName: "FFFFFF", status: "pending" },
  { pointName: "GGGGGG", status: "progress" },
  { pointName: "HHHHHH", status: "done" },
  { pointName: "IIIIIIIIII", status: "progress" },
  { pointName: "JJJJJJJJ", status: "pending" },
  { pointName: "Xxxxxxxx", status: "pending" },
  { pointName: "xxxxxxxxxx", status: "pending" },
];

const statusText: Record<RowStatus, string> = {
  done: "ตรวจแล้ว",
  cancelled: "ยกเลิกการเข้าตรวจ",
  pending: "รอดำเนินการเข้าตรวจ",
  progress: "อยู่ระหว่างการเข้าตรวจ",
};

export default function Checkpoint({
  empCode,
  displayName,
  onBack,
  onGoCheckInOut,
}: Props) {
  return (
    <main className="guts-bg">
      <div className="guts-home">
        <section className="guts-home-card" aria-label="Checkpoint">
          <Header empCode={empCode} displayName={displayName} />

          <h2 className={styles.attTitle}>ลงเวลาเข้า-ออกงาน</h2>

          <div className={styles.tableCard}>
            <div className={styles.tableWrap}>
              <div className={styles.headRow}>
                <div className={`${styles.cell} ${styles.headCell}`}>
                  ชื่อจุดรักษาการณ์
                </div>
                <div className={`${styles.cell} ${styles.headCell}`}>
                  สถานะการตรวจ
                </div>
              </div>

              {checkRows.map((row, index) => {
                const isPending = row.status === "pending";

                const statusClass =
                  row.status === "done"
                    ? styles.statusDone
                    : row.status === "cancelled"
                    ? styles.statusCancelled
                    : row.status === "progress"
                    ? styles.statusProgress
                    : styles.statusPending;

                return (
                  <div
                    className={styles.dataRow}
                    key={`${row.pointName}-${index}`}
                  >
                    <div className={`${styles.cell} ${styles.nameCell}`}>
                      {row.pointName}
                    </div>

                    <div className={`${styles.cell} ${styles.statusCell}`}>
                      <button
                        type="button"
                        className={`${styles.statusButton} ${statusClass}`}
                        onClick={isPending ? onGoCheckInOut : undefined}
                        disabled={!isPending}
                        aria-label={
                          isPending
                            ? `ไปหน้าลงเวลาเข้าออกงาน จุด ${row.pointName}`
                            : `${statusText[row.status]} จุด ${row.pointName}`
                        }
                      >
                        {statusText[row.status]}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="guts-fv-bottom">
            <BackButton onClick={onBack} className="guts-fv-backBtn" />
          </div>
        </section>
      </div>
    </main>
  );
}