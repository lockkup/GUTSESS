import { useMemo, useState } from "react";
import Login from "./pages/Login";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Checkpoint from "./pages/Attendance/Checkpoint";
import CheckInOut from "./pages/Attendance/CheckInOut";
import AttendanceHistoryPage from "./pages/Attendance/History";
import FaceVerify from "./pages/Attendance/FaceVerify";
import Shifts from "./pages/Shifts";
import FaceProfiles from "./pages/FaceProfiles";
import FirstLoginModal from "./components/FirstLoginModal";
import { timeRecordService } from "./services/timeRecord.service";
import { faceVerifyService } from "./services/faceVerify.service";
import type { TimeRecordResponse } from "./types/timeRecord";

type Route =
  | "login"
  | "home"
  | "dashboard"
  | "checkpoint"
  | "checkInOut"
  | "history"
  | "faceVerify"
  | "shifts"
  | "faceProfiles";

type PunchType = "in" | "out";

type EmployeesResponse = {
  employee_code: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
};

type LocationCoords = {
  latitude: number;
  longitude: number;
  accuracy?: number;
  siteLocationId?: number;
  siteLocationName?: string;
  distanceMeter?: number;
};

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

const FIRST_LOGIN_EMPLOYEE_CODES = new Set(["632071"]);

async function getEmployeeDisplayName(employeeCode: string) {
  const response = await fetch(`${API_BASE_URL}/api/employees/${employeeCode}`);

  if (!response.ok) {
    throw new Error("ไม่พบข้อมูลพนักงานในฐานข้อมูล");
  }

  const employee = (await response.json()) as EmployeesResponse;

  return `${employee.first_name} ${employee.last_name}`.trim();
}

function formatCheckTime(date = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");

  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const mi = pad(date.getMinutes());
  const ss = pad(date.getSeconds());

  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

function formatWorkDate(date = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");

  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());

  return `${yyyy}-${mm}-${dd}`;
}

export default function App() {
  const [stack, setStack] = useState<Route[]>(["login"]);
  const route = stack[stack.length - 1];

  const [empCode, setEmpCode] = useState("");
  const [pin, setPin] = useState("");
  const [firstLoginOpen, setFirstLoginOpen] = useState(false);

  const empValid = useMemo(() => /^\d{6}$/.test(empCode), [empCode]);
  const pinValid = useMemo(() => /^\d{6}$/.test(pin), [pin]);
  const canSubmit = empValid && pinValid;

  const [displayName, setDisplayName] = useState("");
  const [lastInAt, setLastInAt] = useState<string | null>(null);
  const [lastOutAt, setLastOutAt] = useState<string | null>(null);
  const [punchType, setPunchType] = useState<PunchType>("in");

  const [shiftId] = useState(1);
  const [openTimeRecord, setOpenTimeRecord] =
    useState<TimeRecordResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const reset = (r: Route) => setStack([r]);

  const push = (r: Route) =>
    setStack((s) => (s[s.length - 1] === r ? s : [...s, r]));

  const back = () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));

  function onlyDigits6(v: string) {
    return v.replace(/\D/g, "").slice(0, 6);
  }

  function isFirstTimeUser(code: string) {
    return FIRST_LOGIN_EMPLOYEE_CODES.has(code);
  }

  async function loadOpenTimeRecord(employeeCode: string) {
    try {
      const record =
        await timeRecordService.getOpenTimeRecordByEmployeeCode(employeeCode);

      setOpenTimeRecord(record);

      if (record) {
        setLastInAt(record.checkin ?? null);
        setLastOutAt(record.checkout ?? null);
      } else {
        setLastInAt(null);
        setLastOutAt(null);
      }
    } catch (error) {
      console.error("loadOpenTimeRecord error:", error);
      setOpenTimeRecord(null);
      setLastInAt(null);
      setLastOutAt(null);
    }
  }

  async function onLogin() {
    if (!canSubmit) return;

    if (isFirstTimeUser(empCode)) {
      setDisplayName("");
      setPin("");
      setFirstLoginOpen(true);
      return;
    }

    try {
      const name = await getEmployeeDisplayName(empCode);
      setDisplayName(name);
    } catch (error) {
      alert(error instanceof Error ? error.message : "โหลดชื่อพนักงานไม่สำเร็จ");
      return;
    }

    await loadOpenTimeRecord(empCode);
    reset("home");
  }

  async function onRequestPassword() {
    if (!empValid) return;
    alert("ส่งรหัสไปอีเมลแล้ว (ตัวอย่าง)");
  }

  function onLogout() {
    setEmpCode("");
    setPin("");
    setDisplayName("");
    setOpenTimeRecord(null);
    setLastInAt(null);
    setLastOutAt(null);
    reset("login");
  }

  async function goCheckpoint() {
    await loadOpenTimeRecord(empCode);
    push("checkpoint");
  }

  async function goCheckInOut() {
    await loadOpenTimeRecord(empCode);
    push("checkInOut");
  }

  function goShifts() {
    push("shifts");
  }

  function goFaceProfiles() {
    push("faceProfiles");
  }

  function goFaceVerify(type: PunchType) {
    setPunchType(type);
    push("faceVerify");
  }

  function goHistory() {
    push("history");
  }

  async function onVerifyFaceOnly(embedding: number[]): Promise<void> {
    const result = await faceVerifyService.verify({
      employee_code: empCode,
      face_embedding: embedding,
    });

    if (!result.is_match) {
      throw new Error(result.message || "ใบหน้าไม่ตรงกับข้อมูลพนักงาน");
    }
  }

  async function onFaceConfirm(
    photoDataUrl: string,
    type: PunchType,
    _embedding: number[],
    location: LocationCoords,
  ) {
    if (isSubmitting) return;

    if (!location.siteLocationId) {
      throw new Error("ไม่พบรหัสพื้นที่จากฐานข้อมูล กรุณาตรวจสอบ site_locations");
    }

    try {
      setIsSubmitting(true);

      const now = new Date();
      const nowText = formatCheckTime(now);
      const workDate = formatWorkDate(now);

      if (type === "in") {
        const existingOpen =
          await timeRecordService.getOpenTimeRecordByEmployeeCode(empCode);

        if (existingOpen) {
          setOpenTimeRecord(existingOpen);
          setLastInAt(existingOpen.checkin ?? null);
          setLastOutAt(existingOpen.checkout ?? null);
          throw new Error("มีการลงเวลาเข้างานค้างไว้แล้วในระบบ");
        }

        const createPayload: Parameters<
          typeof timeRecordService.createTimeRecord
        >[0] = {
          employee_code: empCode,
          shift_id: shiftId,
          work_date: workDate,

          checkin_location_id: location.siteLocationId,
          checkin: nowText,
          checkin_lat: location.latitude,
          checkin_lng: location.longitude,
          images_checkin_1: photoDataUrl,
          images_checkin_2: null,

          created_by: empCode,
        };

        const created = await timeRecordService.createTimeRecord(createPayload);

        setOpenTimeRecord(created);
        setLastInAt(created.checkin ?? null);
        setLastOutAt(created.checkout ?? null);
      } else {
        const record =
          openTimeRecord ??
          (await timeRecordService.getOpenTimeRecordByEmployeeCode(empCode));

        if (!record) {
          throw new Error("ไม่พบข้อมูลการเข้างานเพื่อทำการออกงาน");
        }

        const updatePayload: Parameters<
          typeof timeRecordService.updateTimeRecord
        >[1] = {
          checkout_location_id: location.siteLocationId,
          checkout: nowText,
          checkout_lat: location.latitude,
          checkout_lng: location.longitude,
          images_checkout_1: photoDataUrl,
          images_checkout_2: null,

          updated_by: empCode,
        };

        const updated = await timeRecordService.updateTimeRecord(
          record.time_record_id,
          updatePayload,
        );

        setOpenTimeRecord(null);
        setLastInAt(updated.checkin ?? null);
        setLastOutAt(updated.checkout ?? null);
      }
    } catch (error) {
      console.error("onFaceConfirm error:", error);
      alert(error instanceof Error ? error.message : "การบันทึกเวลาล้มเหลว");
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  }

  function goCheckInOutFromFaceVerify() {
    setStack((s) => {
      const prev = s[s.length - 2];

      if (prev === "checkInOut") return s.slice(0, -1);

      return [...s.slice(0, -1), "checkInOut"];
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
              void onRequestPassword();
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
          onGoCheckInOut={() => {
            void goCheckpoint();
          }}
          onGoLeaveShifts={goShifts}
          onGoFaceProfiles={goFaceProfiles}
        />
      )}

      {route === "checkpoint" && (
        <Checkpoint
          empCode={empCode}
          displayName={displayName}
          onBack={back}
          onGoCheckInOut={() => {
            void goCheckInOut();
          }}
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
          onViewHistory={goHistory}
        />
      )}

      {route === "history" && (
        <AttendanceHistoryPage
          employeeCode={empCode}
          employeeName={displayName}
          onBack={back}
        />
      )}

      {route === "faceVerify" && (
        <FaceVerify
          empCode={empCode}
          displayName={displayName}
          punchType={punchType}
          onBack={back}
          onVerifyFace={onVerifyFaceOnly}
          onConfirm={onFaceConfirm}
          onGoCheckInOut={goCheckInOutFromFaceVerify}
          onViewHistory={goHistory}
        />
      )}

      {route === "shifts" && <Shifts onBack={back} currentUserCode={empCode} />}

      {route === "faceProfiles" && (
        <FaceProfiles currentUserCode={empCode} onBack={back} />
      )}

      {route === "dashboard" && (
        <Dashboard empCode={empCode} onLogout={onLogout} />
      )}
    </>
  );
}