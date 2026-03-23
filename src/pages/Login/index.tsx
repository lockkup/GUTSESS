// src/pages/Login/index.tsx
import { useState } from "react";
import Header from "@/layout/Header";
import ForgotPasswordModal from "@/components/ForgotPasswordModal";
import { User, Lock, Eye, EyeOff } from "lucide-react";

import styles from "./login.module.css";

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
    <main className={styles["guts-bg"]}>
      {/* ✅ ใช้ Header ร่วมทุกหน้า */}
      <div
        className={styles["guts-app-header"]}
        aria-label="Employee Self Service"
      >
        <Header showUserCard={false} />
      </div>

      <section className={styles["guts-card"]} aria-label="Login form">
        <div className={styles["guts-card-title"]}>เข้าสู่ระบบ</div>

        <form
          className={styles["guts-form"]}
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) onSubmit();
          }}
        >
          {/* Employee */}
          <div>
            <div className={styles["guts-label"]}>รหัสพนักงาน (6 หลัก)</div>

            <div className={styles["guts-field"]}>
              <span className={styles["guts-icon-left"]} aria-hidden="true">
                <User size={18} />
              </span>

              <input
                className={[
                  styles["guts-input"],
                  styles["guts-input--with-left"],
                ].join(" ")}
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
            <div className={styles["guts-label"]}>กรอกรหัส ( PIN 6 หลัก )</div>

            <div className={styles["guts-field"]}>
              <span className={styles["guts-icon-left"]} aria-hidden="true">
                <Lock size={18} />
              </span>

              <input
                className={[
                  styles["guts-input"],
                  styles["guts-input--with-left"],
                  styles["guts-input--with-right"],
                ].join(" ")}
                value={pin}
                onChange={(e) => onChangePin(e.target.value)}
                inputMode="numeric"
                autoComplete="off"
                type={showPin ? "text" : "password"}
                aria-label="PIN 6 digits"
              />

              <button
                type="button"
                className={styles["guts-icon-right-btn"]}
                onClick={() => setShowPin((v) => !v)}
                aria-label={showPin ? "ซ่อนรหัส PIN" : "แสดงรหัส PIN"}
                title={showPin ? "ซ่อนรหัส" : "แสดงรหัส"}
              >
                {showPin ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            className={styles["guts-btn"]}
            type="submit"
            disabled={!canSubmit}
          >
            กดเข้าสู่ระบบ
          </button>

          <div className={styles["guts-links"]}>
            <button
              type="button"
              className={[styles["guts-link"], styles.primary].join(" ")}
              onClick={() => setForgotOpen(true)}
            >
              คลิกลืมรหัสผ่าน
            </button>

            <button
              type="button"
              className={[styles["guts-link"], styles.secondary].join(" ")}
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
