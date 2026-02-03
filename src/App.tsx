// src/App.tsx
import { useMemo, useState } from "react";
import Login from "./pages/Login";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import CheckInOut from "./pages/Attendance/CheckInOut";
import FaceVerify from "./pages/Attendance/FaceVerify";
import FirstLoginModal from "./components/FirstLoginModal";

type Route = "login" | "home" | "dashboard" | "checkInOut" | "faceVerify";
type PunchType = "in" | "out";

export default function App() {
  const [stack, setStack] = useState<Route[]>(["login"]);
  const route = stack[stack.length - 1];

  const [empCode, setEmpCode] = useState("632070");
  const [pin, setPin] = useState("");

  const [firstLoginOpen, setFirstLoginOpen] = useState(false);

  const empValid = useMemo(() => /^\d{6}$/.test(empCode), [empCode]);
  const pinValid = useMemo(() => /^\d{6}$/.test(pin), [pin]);
  const canSubmit = empValid && pinValid;

  const [displayName] = useState("สุพจน์ หอมดอก");

  const [lastInAt, setLastInAt] = useState<string | null>(null);
  const [lastOutAt, setLastOutAt] = useState<string | null>(null);

  const [punchType, setPunchType] = useState<PunchType>("in");

  // ===== Navigation helpers =====
  const reset = (r: Route) => setStack([r]);

  const push = (r: Route) =>
    setStack((s) => (s[s.length - 1] === r ? s : [...s, r]));

  const back = () =>
    setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));

  function onlyDigits6(v: string) {
    return v.replace(/\D/g, "").slice(0, 6);
  }

  function isFirstTimeUser(code: string) {
    return code === "632070";
  }

  async function onLogin() {
    if (!canSubmit) return;

    if (isFirstTimeUser(empCode)) {
      setPin("");
      setFirstLoginOpen(true);
      return;
    }

    reset("home");
  }

  async function onRequestPassword() {
    if (!empValid) return;
    alert("ส่งรหัสไปอีเมลแล้ว (ตัวอย่าง)");
  }

  function onLogout() {
    setPin("");
    reset("login");
  }

  function goFaceVerify(type: PunchType) {
    setPunchType(type);
    push("faceVerify");
  }

  // ✅ onConfirm = บันทึกอย่างเดียว (ไม่ navigate)
  async function onFaceConfirm(_photoDataUrl: string, type: PunchType) {
    const nowIso = new Date().toISOString();
    if (type === "in") setLastInAt(nowIso);
    else setLastOutAt(nowIso);

    // TODO: เรียก backend จริง (await fetch/axios/google script)
    return;
  }

  // ✅ ให้ FaceVerify เรียกตอนกด OK ใน SuccessModal เพื่อไปหน้า CheckInOut
  function goCheckInOutFromFaceVerify() {
    setStack((s) => {
      const prev = s[s.length - 2];
      if (prev === "checkInOut") return s.slice(0, -1); // pop faceVerify
      return [...s.slice(0, -1), "checkInOut"]; // replace top
    });
  }

  return (
    <>
      {route === "login" && (
        <>
          <Login
            empCode={empCode}
            pin={pin}
            onChangeEmp={(v) => setEmpCode(onlyDigits6(v))}
            onChangePin={(v) => setPin(onlyDigits6(v))}
            onSubmit={onLogin}
            onSendForgot={onRequestPassword}
          />

          <FirstLoginModal
            open={firstLoginOpen}
            empCode={empCode}
            onClose={() => {
              setPin("");
              setFirstLoginOpen(false);
            }}
            onRequestPassword={() => {
              onRequestPassword();
              setFirstLoginOpen(false);
            }}
          />
        </>
      )}

      {route === "home" && (
        <Home
          empCode={empCode}
          displayName={displayName}
          onLogout={onLogout}
          onGoCheckInOut={() => push("checkInOut")}
          onGoLeaveOnline={() => alert("TODO: ไปหน้า ลาออนไลน์")}
        />
      )}

      {route === "checkInOut" && (
        <CheckInOut
          empCode={empCode}
          displayName={displayName}
          lastInAt={lastInAt}
          lastOutAt={lastOutAt}
          onBack={back}
          onCheckIn={() => goFaceVerify("in")}
          onCheckOut={() => goFaceVerify("out")}
          onViewHistory={() => alert("TODO: เปิดหน้าประวัติย้อนหลัง 1 เดือน")}
        />
      )}

      {route === "faceVerify" && (
        <FaceVerify
          empCode={empCode}
          displayName={displayName}
          punchType={punchType}
          onBack={back}
          onConfirm={onFaceConfirm}                // ✅ save only
          onGoCheckInOut={goCheckInOutFromFaceVerify} // ✅ ไปหน้า checkInOut ตอนกด OK
          onViewHistory={() => alert("TODO: เปิดหน้าประวัติย้อนหลัง 1 เดือน")}
        />
      )}

      {route === "dashboard" && (
        <Dashboard empCode={empCode} onLogout={onLogout} />
      )}
    </>
  );
}
