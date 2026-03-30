// src/pages/Mo/Mo.tsx
import Header from "../../layout/Header";
import styles from "./Mo.module.css";
import MoHome from "./MoHomePage/MoHome";

type Props = {
  empCode: string;
  displayName?: string;
  onBackHome?: () => void;
};

export default function Mo({ empCode, displayName, onBackHome }: Props) {
  const now = new Date();
  const thaiDay = now.getDate();
  const thaiMonth = new Intl.DateTimeFormat("th-TH", { month: "long" }).format(
    now,
  );
  const thaiYear = new Intl.DateTimeFormat("th-TH", { year: "numeric" }).format(
    now,
  );
  const longThaiDate = `วันที่ ${thaiDay} เดือน ${thaiMonth} พ.ศ. ${thaiYear}`;
  const timeNow = now.toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <main className={`guts-bg ${styles["mo-bg"]}`}>
      <div className={`guts-home ${styles["mo-page-wrap"]}`}>
        <section className="guts-home-card" aria-label="Mo">
          <Header empCode={empCode} displayName={displayName} />

          <div className={styles["guts-card-meta"]}>
            <div className={styles["guts-meta-year"]}>{longThaiDate}</div>
            <div className={styles["guts-meta-date"]}>เวลา {timeNow} น.</div>
          </div>

          <h3 className={styles["guts-att-title"]}>
            MO - รายงานประจำวันฝ่ายปฏิบัติการ
          </h3>

          <MoHome
            empCode={empCode}
            displayName={displayName}
            onBackHome={onBackHome}
          />
        </section>
      </div>
    </main>
  );
}
