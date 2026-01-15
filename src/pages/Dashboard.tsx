// src/pages/Dashboard.tsx
import styles from "./Dashboard.module.css";

type Props = {
  empCode: string;
  onLogout: () => void;
};

export default function Dashboard({ empCode, onLogout }: Props) {
  const items = [
    {
      title: "ลงเวลา (เข้า–ออก) งาน",
      desc: "บันทึกเวลาเข้างาน/ออกงาน พร้อมดูสถานะล่าสุด",
      icon: "🕒",
      onClick: () => alert("TODO: ไปหน้า ลงเวลา (เข้า–ออก) งาน"),
    },
    {
      title: "ทำการลาออนไลน์",
      desc: "ยื่นคำขอลา ติดตามสถานะ และดูประวัติการลา",
      icon: "📝",
      onClick: () => alert("TODO: ไปหน้า ทำการลาออนไลน์"),
    },
    {
      title: "ข่าวสาร / ประกาศ",
      desc: "อ่านประกาศบริษัท นโยบาย และข่าวอัปเดต",
      icon: "📢",
      onClick: () => alert("TODO: ไปหน้า ข่าวสาร"),
    },
    {
      title: "โปรไฟล์ของฉัน",
      desc: "ดูข้อมูลพนักงาน เบอร์ติดต่อ และข้อมูลพื้นฐาน",
      icon: "👤",
      onClick: () => alert("TODO: ไปหน้า โปรไฟล์"),
    },
  ];

  return (
    <main className={styles.bg}>
      <section className={styles.dash}>
        {/* Top bar */}
        <header className={styles.dashTop}>
          <div>
            <div className={styles.dashBrand}>
              <span className={styles.guts}>GUTS</span> <span className={styles.ess}>ESS</span>
            </div>
            <div className={styles.dashSub}>
              Employee Self Service • ผู้ใช้: <strong>{empCode}</strong>
            </div>
          </div>

          <button className={styles.dashLogout} type="button" onClick={onLogout}>
            ออกจากระบบ
          </button>
        </header>

        {/* Welcome card */}
        <div className={styles.dashHero}>
          <div>
            <div className={styles.dashHello}>ยินดีต้อนรับ 👋</div>
            <div className={styles.dashHint}>
              เลือกเมนูด้านล่างเพื่อใช้งานระบบบริการตนเอง
            </div>
          </div>
          <div className={styles.dashBadge}>GUTS ESS</div>
        </div>

        {/* Menu grid */}
        <div className={styles.dashGrid}>
          {items.map((it) => (
            <button key={it.title} className={styles.dashCard} onClick={it.onClick}>
              <div className={styles.dashIcon}>{it.icon}</div>
              <div className={styles.dashTitle}>{it.title}</div>
              <div className={styles.dashDesc}>{it.desc}</div>
              <div className={styles.dashGo}>ไปต่อ →</div>
            </button>
          ))}
        </div>

        <footer className={styles.dashFooter}>
          © {new Date().getFullYear()} GUTS ESS • ระบบบริการตนเอง
        </footer>
      </section>
    </main>
  );
}
