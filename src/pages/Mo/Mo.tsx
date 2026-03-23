// src/pages/Home.tsx
import { useState } from "react";
import Header from "../../layout/Header";
import styles from "./Mo.module.css";
import MoHome from "./MoHomePage/MoHome";
import MoNewPage from "./MoNewPage/MoNewPage";
import MoDetailPage from "./MoDetailPage/MoDetailPage";
import MoUpdatePage from "./MoUpdatePage/MoUpdatePage";
import MoDashboard from "./MoDashboard/MoDashborad";

type Props = {
  empCode: string;
  displayName?: string;
  onBackHome?: () => void;
};

type ViewType = "home" | "new" | "detail" | "update" | "dashboard";
type MoHomeViewType = "home" | "addNew" | "search";

export default function Mo({ empCode, displayName, onBackHome }: Props) {
  const [currentView, setCurrentView] = useState<ViewType>("home");
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [moHomeView, setMoHomeView] = useState<MoHomeViewType>("home");
  const [selectedLocation, setSelectedLocation] = useState<string>("");

  // use window.history.back() to avoid adding new router dependency

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
    <main className="guts-bg">
      <div className="guts-home">
        <section className="guts-home-card" aria-label="Mo">
          <Header empCode={empCode} displayName={displayName} />

          <div className={styles["guts-card-meta"]}>
            <div className={styles["guts-meta-year"]}>{longThaiDate}</div>
            <div className={styles["guts-meta-date"]}>เวลา {timeNow} น.</div>
          </div>

          <h3 className={styles["guts-att-title"]}>
            MO - รายงานประจำวันฝ่ายปฏิบัติการ
          </h3>

          {/* Render different pages based on current view */}
          {currentView === "home" ? (
            <MoHome
              empCode={empCode}
              initialView={moHomeView}
              onAdd={(location?: string) => {
                setMoHomeView("addNew");
                setSelectedLocation(location || "");
                setCurrentView("new");
              }}
              onOpenDetail={(item) => {
                setSelectedItem(item);
                setMoHomeView("addNew");
                setCurrentView("detail");
              }}
              onOpenUpdate={(item) => {
                setSelectedItem(item);
                setMoHomeView("addNew");
                setCurrentView("update");
              }}
              onOpenDashboard={() => setCurrentView("dashboard")}
              onBackHome={onBackHome}
            />
          ) : currentView === "new" ? (
            <MoNewPage              empCode={empCode}              selectedLocation={selectedLocation}
              onCancel={() => setCurrentView("home")}
            />
          ) : currentView === "detail" ? (
            <MoDetailPage
              item={selectedItem}
              onCancel={() => setCurrentView("home")}
            />
          ) : currentView === "update" ? (
            <MoUpdatePage
              item={selectedItem}
              onCancel={() => setCurrentView("home")}
            />
          ) : currentView === "dashboard" ? (
            <MoDashboard
              empCode={empCode}
              displayName={displayName}
              onCancel={() => setCurrentView("home")}
            />
          ) : null}
        </section>
      </div>
    </main>
  );
}
