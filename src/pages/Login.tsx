import { useState } from "react";
import ForgotPasswordModal from "../components/ForgotPasswordModal";
import { User, Lock, Eye, EyeOff } from "lucide-react";
import styles from "./Login.module.css";

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
    <main className={styles.bg}>
      {/* ✅ App header (แยกจาก login) อยู่บนสุดและกึ่งกลาง */}
      <header className={styles.appHeader} aria-label="Employee Self Service">
        <h1 className={styles.logo}>
          <span className={styles.guts}>GUTS</span> <span className={styles.ess}>ESS</span>
        </h1>
        <div className={styles.subEn}>Employee Self Service</div>
        <div className={styles.subTh}>ระบบบริการตนเอง</div>
        <div className={styles.subSmall}>สำหรับพนักงานสำนักงานและสายตรวจ</div>
      </header>

      {/* ✅ Login card แยกส่วนชัดเจน */}
      <section className={styles.card} aria-label="Login form">
        <div className={styles.cardTitle}>เข้าสู่ระบบ</div>

        <form
          className={styles.form}
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) onSubmit();
          }}
        >
          {/* Employee */}
          <div>
            <div className={styles.label}>รหัสพนักงาน (6 หลัก)</div>

            <div className={styles.field}>
              <span className={styles.iconLeft} aria-hidden="true">
                <User size={18} />
              </span>

              <input
                className={`${styles.input} ${styles.inputWithLeft}`}
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
            <div className={styles.label}>กรอกรหัส ( PIN 6 หลัก )</div>

            <div className={styles.field}>
              <span className={styles.iconLeft} aria-hidden="true">
                <Lock size={18} />
              </span>

              <input
                className={`${styles.input} ${styles.inputWithLeft} ${styles.inputWithRight}`}
                value={pin}
                onChange={(e) => onChangePin(e.target.value)}
                inputMode="numeric"
                autoComplete="off"
                type={showPin ? "text" : "password"}
                aria-label="PIN 6 digits"
              />

              <button
                type="button"
                className={styles.iconRightBtn}
                onClick={() => setShowPin((v) => !v)}
                aria-label={showPin ? "ซ่อนรหัส PIN" : "แสดงรหัส PIN"}
                title={showPin ? "ซ่อนรหัส" : "แสดงรหัส"}
              >
                {showPin ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button className={styles.btn} type="submit" disabled={!canSubmit}>
            กดเข้าสู่ระบบ
          </button>

          <div className={styles.links}>
            <button
              type="button"
              className={`${styles.link} ${styles.primary}`}
              onClick={() => setForgotOpen(true)}
            >
              คลิกลืมรหัสผ่าน
            </button>

            <button
              type="button"
              className={`${styles.link} ${styles.secondary}`}
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
