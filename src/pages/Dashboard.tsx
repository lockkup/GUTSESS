// src/pages/Dashboard.tsx
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
    <main className="guts-bg">
      <section className="guts-dash">
        {/* Top bar */}
        <header className="guts-dash-top">
          <div>
            <div className="guts-dash-brand">
              <span className="guts">GUTS</span>{" "}
              <span className="ess">ESS</span>
            </div>
            <div className="guts-dash-sub">
              Employee Self Service • ผู้ใช้: <strong>{empCode}</strong>
            </div>
          </div>

          <button className="guts-dash-logout" type="button" onClick={onLogout}>
            ออกจากระบบ
          </button>
        </header>

        {/* Welcome card */}
        <div className="guts-dash-hero">
          <div>
            <div className="guts-dash-hello">ยินดีต้อนรับ 👋</div>
            <div className="guts-dash-hint">
              เลือกเมนูด้านล่างเพื่อใช้งานระบบบริการตนเอง
            </div>
          </div>
          <div className="guts-dash-badge">GUTS ESS</div>
        </div>

        {/* Menu grid */}
        <div className="guts-dash-grid">
          {items.map((it) => (
            <button
              key={it.title}
              className="guts-dash-card"
              onClick={it.onClick}
            >
              <div className="guts-dash-icon">{it.icon}</div>
              <div className="guts-dash-title">{it.title}</div>
              <div className="guts-dash-desc">{it.desc}</div>
              <div className="guts-dash-go">ไปต่อ →</div>
            </button>
          ))}
        </div>

        <footer className="guts-dash-footer">
          © {new Date().getFullYear()} GUTS ESS • ระบบบริการตนเอง
        </footer>
      </section>
    </main>
  );
}
