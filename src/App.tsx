// src/App.tsx
import { useMemo, useState } from "react";
import Login from "./pages/Login";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import CheckInOut from "./pages/CheckInOut";
import FaceVerify from "./pages/FaceVerify";
import FirstLoginModal from "./components/FirstLoginModal";

type Route = "login" | "home" | "dashboard" | "checkInOut" | "faceVerify";
type PunchType = "in" | "out";

export default function App() {
  // ✅ Route Stack (แทน route ตัวเดียว)
  const [stack, setStack] = useState<Route[]>(["login"]);
  const route = stack[stack.length - 1];

  const [empCode, setEmpCode] = useState("632070");
  const [pin, setPin] = useState("");

  // ✅ First login popup state
  const [firstLoginOpen, setFirstLoginOpen] = useState(false);

  const empValid = useMemo(() => /^\d{6}$/.test(empCode), [empCode]);
  const pinValid = useMemo(() => /^\d{6}$/.test(pin), [pin]);
  const canSubmit = empValid && pinValid;

  // ✅ ยังไม่ทำ backend เลยตั้งไว้ชั่วคราว
  const [displayName] = useState("สุพจน์ หอมดอก");

  // ✅ เวลาเข้า/ออก (โชว์ในหน้า CheckInOut)
  const [lastInAt, setLastInAt] = useState<string | null>(null);
  const [lastOutAt, setLastOutAt] = useState<string | null>(null);

  // ✅ เก็บว่า flow นี้คือ “เข้างาน” หรือ “ออกงาน”
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
    return code === "632070"; // TODO: เปลี่ยนเป็นเรียก backend จริง
  }

  async function onLogin() {
    if (!canSubmit) return;

    if (isFirstTimeUser(empCode)) {
      setPin("");
      setFirstLoginOpen(true);
      return;
    }

    // ✅ login แล้ว reset stack ไปที่ home (ไม่ต้องค้าง login ใน history)
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

  // ✅ เริ่ม flow ถ่ายรูป
  function goFaceVerify(type: PunchType) {
    setPunchType(type);
    push("faceVerify");
  }

  // ✅ ยืนยันตัวตนสำเร็จ -> บันทึกเวลา + กลับไปหน้า checkInOut
  function onFaceConfirm(_photoDataUrl: string, type: PunchType) {
    const nowIso = new Date().toISOString();
    if (type === "in") setLastInAt(nowIso);
    else setLastOutAt(nowIso);

    // ✅ ถ้าก่อนหน้าเป็น checkInOut อยู่แล้ว แค่ pop faceVerify ก็พอ
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
          onBack={back} // ✅ ใช้ back ตัวเดียวกัน
          onConfirm={onFaceConfirm}
          onViewHistory={() => alert("TODO: เปิดหน้าประวัติย้อนหลัง 1 เดือน")}
        />
      )}

      {route === "dashboard" && (
        <Dashboard empCode={empCode} onLogout={onLogout} />
      )}
    </>
  );
}
