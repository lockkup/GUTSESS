import { useState } from "react";
import ForgotPasswordModal from "../components/ForgotPasswordModal";
import { User, Lock, Eye, EyeOff } from "lucide-react";

type Props = {
  empCode: string;
  pin: string;
  onChangeEmp: (v: string) => void;
  onChangePin: (v: string) => void;
  onSubmit: () => void;
  onSendForgot: () => void;
};

export default function Login({
  empCode,
  pin,
  onChangeEmp,
  onChangePin,
  onSubmit,
  onSendForgot,
}: Props) {
  const [forgotOpen, setForgotOpen] = useState(false);
  const [showPin, setShowPin] = useState(false);

  const empValid = /^\d{6}$/.test(empCode);
  const pinValid = /^\d{6}$/.test(pin);
  const canSubmit = empValid && pinValid;

  return (
    <main className="guts-bg">
      {/* ✅ App header (แยกจาก login) อยู่บนสุดและกึ่งกลาง */}
      <header className="guts-app-header" aria-label="Employee Self Service">
        <h1 className="guts-logo">
          <span className="guts">GUTS</span> <span className="ess">ESS</span>
        </h1>
        <div className="guts-sub-en">Employee Self Service</div>
        <div className="guts-sub-th">ระบบบริการตนเอง</div>
        <div className="guts-sub-small">สำหรับพนักงานสำนักงานและสายตรวจ</div>
      </header>

      {/* ✅ Login card แยกส่วนชัดเจน */}
      <section className="guts-card" aria-label="Login form">
        <div className="guts-card-title">เข้าสู่ระบบ</div>

        <form
          className="guts-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) onSubmit();
          }}
        >
          {/* Employee */}
          <div>
            <div className="guts-label">รหัสพนักงาน (6 หลัก)</div>

            <div className="guts-field">
              <span className="guts-icon-left" aria-hidden="true">
                <User size={18} />
              </span>

              <input
                className="guts-input guts-input--with-left"
                value={empCode}
                onChange={(e) => onChangeEmp(e.target.value)}
                inputMode="numeric"
                autoComplete="off"
                aria-label="Employee code 6 digits"
              />
            </div>
          </div>

          {/* PIN */}
          <div>
            <div className="guts-label">กรอกรหัส ( PIN 6 หลัก )</div>

            <div className="guts-field">
              <span className="guts-icon-left" aria-hidden="true">
                <Lock size={18} />
              </span>

              <input
                className="guts-input guts-input--with-left guts-input--with-right"
                value={pin}
                onChange={(e) => onChangePin(e.target.value)}
                inputMode="numeric"
                autoComplete="off"
                type={showPin ? "text" : "password"}
                aria-label="PIN 6 digits"
              />

              <button
                type="button"
                className="guts-icon-right-btn"
                onClick={() => setShowPin((v) => !v)}
                aria-label={showPin ? "ซ่อนรหัส PIN" : "แสดงรหัส PIN"}
                title={showPin ? "ซ่อนรหัส" : "แสดงรหัส"}
              >
                {showPin ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button className="guts-btn" type="submit" disabled={!canSubmit}>
            กดเข้าสู่ระบบ
          </button>

          <div className="guts-links">
            <button
              type="button"
              className="guts-link primary"
              onClick={() => setForgotOpen(true)}
            >
              คลิกลืมรหัสผ่าน
            </button>

            <button
              type="button"
              className="guts-link secondary"
              onClick={() => alert("TODO: คู่มือการใช้งาน")}
            >
              คลิกอ่านคู่มือ
            </button>
          </div>
        </form>
      </section>

      <ForgotPasswordModal
        open={forgotOpen}
        empCode={empCode}
        onChangeEmp={onChangeEmp}
        onClose={() => {
          onChangePin("");
          setForgotOpen(false);
        }}
        onSend={() => {
          onSendForgot();
          setForgotOpen(false);
        }}
      />
    </main>
  );
}
