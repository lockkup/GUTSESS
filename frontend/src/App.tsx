// src/App.tsx

import { useMemo, useState } from "react";
import Login from "./pages/Login";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Checkpoint from "./pages/Attendance/Checkpoint";
import CheckInOut from "./pages/Attendance/CheckInOut";
import PatrolReportPage from "./pages/Attendance/PatrolReport";
import FaceVerify from "./pages/Attendance/FaceVerify";
import AttendanceFaceVerify from "./pages/Attendance/CheckInOut/AttendanceFaceVerify";
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
  | "patrolReport"
  | "faceVerify"
  | "attendanceFaceVerify"
  | "shifts"
  | "faceProfiles";

type PunchType = "in" | "out";

type CheckpointActionMode = "checkin" | "checkout";

type EmployeesResponse = {
  employee_code: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
};

type PassedLocation = {
  latitude: number;
  longitude: number;
  accuracy: number;
};

type SelectedCheckpoint = {
  assignmentId: number;
  unitName: string;
  mode: CheckpointActionMode;
  passedLocation: PassedLocation;
  workDate?: string | null;
};

type GoCheckInOutPayload = {
  assignmentId: number;
  unitName: string;
  mode: CheckpointActionMode;
  passedLocation: PassedLocation;
  workDate?: string | null;
};

type LocationCoords = {
  latitude: number;
  longitude: number;
  accuracy?: number;
  assignmentId?: number | null;
  unitName?: string | null;
};

type AttendanceTimeContext = {
  workDate: string;
};

type OpenAttendanceTimeRecordParams = {
  work_date: string;
};

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

const FIRST_LOGIN_EMPLOYEE_CODES = new Set(["632071"]);

/**
 * false = ถ่ายรูป + เช็กพิกัด + บันทึกเวลา แต่ไม่เทียบใบหน้า
 * true  = เปิดใช้การเทียบใบหน้ากับข้อมูลพนักงานในอนาคต
 */
const ENABLE_FACE_VERIFY = false;

async function getEmployeeData(employeeCode: string) {
  const response = await fetch(`${API_BASE_URL}/api/employees/${employeeCode}`);

  if (!response.ok) {
    throw new Error("ไม่พบข้อมูลพนักงานในฐานข้อมูล");
  }

  const employee = (await response.json()) as EmployeesResponse;

  return {
    displayName: `${employee.first_name} ${employee.last_name}`.trim(),
  };
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

function toOpenRecordParams(
  context: AttendanceTimeContext,
): OpenAttendanceTimeRecordParams {
  return {
    work_date: context.workDate,
  };
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

  const [attendanceTimeContext, setAttendanceTimeContext] =
    useState<AttendanceTimeContext | null>(null);

  const [, setOpenTimeRecord] = useState<TimeRecordResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [selectedCheckpoint, setSelectedCheckpoint] =
    useState<SelectedCheckpoint | null>(null);

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

  function clearCheckInOutTimeState() {
    setOpenTimeRecord(null);
    setLastInAt(null);
    setLastOutAt(null);
  }

  function makeAttendanceTimeContext(params?: {
    date?: Date;
    workDate?: string | null;
  }): AttendanceTimeContext {
    const date = params?.date ?? new Date();

    return {
      workDate: params?.workDate ?? formatWorkDate(date),
    };
  }

  async function loadOpenAttendanceTimeRecord(
    employeeCode: string,
    context?: AttendanceTimeContext | null,
  ) {
    try {
      const attendanceContext = context ?? makeAttendanceTimeContext();

      const record =
        await timeRecordService.getOpenAttendanceTimeRecordByEmployeeCode(
          employeeCode,
          toOpenRecordParams(attendanceContext),
        );

      if (!record) {
        clearCheckInOutTimeState();
        return;
      }

      setOpenTimeRecord(record);
      setLastInAt(record.checkin ?? null);
      setLastOutAt(record.checkout ?? null);
    } catch (error) {
      console.error("loadOpenAttendanceTimeRecord error:", error);
      clearCheckInOutTimeState();
    }
  }

  async function loadOpenCheckpointTimeRecord(
    employeeCode: string,
    assignmentId: number,
  ) {
    try {
      const record =
        await timeRecordService.getOpenCheckpointTimeRecordByEmployeeCode(
          employeeCode,
          assignmentId,
        );

      if (!record) {
        clearCheckInOutTimeState();
        return;
      }

      setOpenTimeRecord(record);
      setLastInAt(record.checkin ?? null);
      setLastOutAt(record.checkout ?? null);
    } catch (error) {
      console.error("loadOpenCheckpointTimeRecord error:", error);
      clearCheckInOutTimeState();
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
      const employeeData = await getEmployeeData(empCode);

      setDisplayName(employeeData.displayName);

      const context = makeAttendanceTimeContext();

      setAttendanceTimeContext(context);
      await loadOpenAttendanceTimeRecord(empCode, context);
    } catch (error) {
      alert(error instanceof Error ? error.message : "โหลดชื่อพนักงานไม่สำเร็จ");
      return;
    }

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
    setAttendanceTimeContext(null);
    clearCheckInOutTimeState();
    setSelectedCheckpoint(null);
    reset("login");
  }

  async function goDirectCheckInOut() {
    setSelectedCheckpoint(null);

    const context = makeAttendanceTimeContext();

    setAttendanceTimeContext(context);
    await loadOpenAttendanceTimeRecord(empCode, context);

    push("checkInOut");
  }

  async function goCheckpoint() {
    setSelectedCheckpoint(null);
    setAttendanceTimeContext(null);
    clearCheckInOutTimeState();
    push("checkpoint");
  }

  async function goCheckInOut(payload: GoCheckInOutPayload) {
    setSelectedCheckpoint({
      assignmentId: payload.assignmentId,
      unitName: payload.unitName,
      mode: payload.mode,
      passedLocation: payload.passedLocation,
      workDate: payload.workDate ?? formatWorkDate(),
    });

    if (payload.mode === "checkout") {
      await loadOpenCheckpointTimeRecord(empCode, payload.assignmentId);
    } else {
      clearCheckInOutTimeState();
    }

    push("checkInOut");
  }

  function goShifts() {
    push("shifts");
  }

  function goFaceProfiles() {
    push("faceProfiles");
  }

  function goPatrolReport() {
    push("patrolReport");
  }

  function goAttendanceFaceVerify(
    type: PunchType,
    payload?: {
      workDate?: string | null;
    },
  ) {
    setSelectedCheckpoint(null);

    const context = makeAttendanceTimeContext({
      workDate: payload?.workDate ?? null,
    });

    setAttendanceTimeContext(context);
    setPunchType(type);
    push("attendanceFaceVerify");
  }

  function goFaceVerify(
    type: PunchType,
    payload?: {
      assignmentId?: number | null;
      unitName?: string | null;
      passedLocation?: PassedLocation | null;
      workDate?: string | null;
    },
  ) {
    if (payload?.assignmentId) {
      const passedLocation =
        payload.passedLocation ?? selectedCheckpoint?.passedLocation ?? null;

      if (!passedLocation) {
        alert(
          "ไม่พบข้อมูลพิกัดที่ผ่านการตรวจสอบ กรุณากลับไปเลือกจุดจากตารางงานสายตรวจก่อน",
        );
        return;
      }

      const resolvedWorkDate =
        payload.workDate ?? selectedCheckpoint?.workDate ?? formatWorkDate();

      setSelectedCheckpoint({
        assignmentId: payload.assignmentId,
        unitName: payload.unitName ?? "",
        mode: type === "in" ? "checkin" : "checkout",
        passedLocation,
        workDate: resolvedWorkDate,
      });
    }

    setPunchType(type);
    push("faceVerify");
  }

  async function onVerifyFaceOnly(embedding: number[]): Promise<void> {
    /**
     * ตอนนี้ไม่ต้องตรวจว่าใบหน้าเป็นใคร
     * ให้ผ่านทันที เพื่อให้ flow เป็น:
     * ถ่ายรูป + เช็กพิกัด + บันทึกเวลา
     */
    if (!ENABLE_FACE_VERIFY) {
      return;
    }

    const result = await faceVerifyService.verify({
      employee_code: empCode,
      face_embedding: embedding,
    });

    if (!result.is_match) {
      throw new Error(result.message || "ใบหน้าไม่ตรงกับข้อมูลพนักงาน");
    }
  }

  async function onAttendanceFaceConfirm(
    photoDataUrl: string,
    type: PunchType,
    _embedding: number[],
    location: LocationCoords,
  ) {
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);

      const now = new Date();
      const nowText = formatCheckTime(now);

      const context =
        attendanceTimeContext ??
        makeAttendanceTimeContext({
          date: now,
        });

      const workDate = context.workDate;
      const openRecordParams = toOpenRecordParams(context);

      if (type === "in") {
        const existingOpen =
          await timeRecordService.getOpenAttendanceTimeRecordByEmployeeCode(
            empCode,
            openRecordParams,
          );

        if (existingOpen) {
          setOpenTimeRecord(existingOpen);
          setLastInAt(existingOpen.checkin ?? null);
          setLastOutAt(existingOpen.checkout ?? null);
          throw new Error("มีการลงเวลาเข้างานค้างไว้แล้วในระบบ");
        }

        const createPayload = {
          employee_code: empCode,
          work_date: workDate,

          current_latitude: location.latitude,
          current_longitude: location.longitude,
          gps_accuracy: location.accuracy ?? null,

          checkin: nowText,
          checkin_lat: location.latitude,
          checkin_lng: location.longitude,
          images_checkin_1: photoDataUrl,
          images_checkin_2: null,

          created_by: empCode,
        } as Parameters<typeof timeRecordService.createTimeRecord>[0] & {
          current_latitude: number;
          current_longitude: number;
          gps_accuracy: number | null;
        };

        const created = await timeRecordService.createTimeRecord(createPayload);

        setOpenTimeRecord(created);
        setLastInAt(created.checkin ?? null);
        setLastOutAt(created.checkout ?? null);
      } else {
        const record =
          await timeRecordService.getOpenAttendanceTimeRecordByEmployeeCode(
            empCode,
            openRecordParams,
          );

        if (!record) {
          throw new Error("ไม่พบข้อมูลการเข้างานเพื่อทำการออกงาน");
        }

        const updatePayload = {
          current_latitude: location.latitude,
          current_longitude: location.longitude,
          gps_accuracy: location.accuracy ?? null,

          checkout: nowText,
          checkout_lat: location.latitude,
          checkout_lng: location.longitude,
          images_checkout_1: photoDataUrl,
          images_checkout_2: null,

          updated_by: empCode,
        } as Parameters<typeof timeRecordService.updateTimeRecord>[1] & {
          current_latitude: number;
          current_longitude: number;
          gps_accuracy: number | null;
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
      console.error("onAttendanceFaceConfirm error:", error);

      throw error instanceof Error
        ? error
        : new Error("การบันทึกเวลาล้มเหลว");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onFaceConfirm(
    photoDataUrl: string,
    type: PunchType,
    _embedding: number[],
    location: LocationCoords,
  ) {
    if (isSubmitting) return;

    if (!location.assignmentId) {
      throw new Error(
        "ไม่พบ assignment_id ของจุดรักษาการณ์ กรุณากลับไปเลือกจุดจากตารางงานสายตรวจก่อน",
      );
    }

    try {
      setIsSubmitting(true);

      const now = new Date();
      const nowText = formatCheckTime(now);

      const workDate = selectedCheckpoint?.workDate ?? formatWorkDate(now);

      if (type === "in") {
        const existingOpen =
          await timeRecordService.getOpenCheckpointTimeRecordByEmployeeCode(
            empCode,
            location.assignmentId,
          );

        if (existingOpen) {
          setOpenTimeRecord(existingOpen);
          setLastInAt(existingOpen.checkin ?? null);
          setLastOutAt(existingOpen.checkout ?? null);
          throw new Error("มีการลงเวลาเข้างานค้างไว้แล้วในระบบ");
        }

        const createPayload = {
          employee_code: empCode,
          work_date: workDate,

          assignment_id: location.assignmentId,
          current_latitude: location.latitude,
          current_longitude: location.longitude,
          gps_accuracy: location.accuracy ?? null,

          checkin: nowText,
          checkin_lat: location.latitude,
          checkin_lng: location.longitude,
          images_checkin_1: photoDataUrl,
          images_checkin_2: null,

          created_by: empCode,
        } as Parameters<typeof timeRecordService.createTimeRecord>[0] & {
          assignment_id: number;
          current_latitude: number;
          current_longitude: number;
          gps_accuracy: number | null;
        };

        const created = await timeRecordService.createTimeRecord(createPayload);

        setOpenTimeRecord(created);
        setLastInAt(created.checkin ?? null);
        setLastOutAt(created.checkout ?? null);
      } else {
        const record =
          await timeRecordService.getOpenCheckpointTimeRecordByEmployeeCode(
            empCode,
            location.assignmentId,
          );

        if (!record) {
          throw new Error("ไม่พบข้อมูลการเข้างานเพื่อทำการออกงาน");
        }

        const updatePayload = {
          assignment_id: location.assignmentId,
          current_latitude: location.latitude,
          current_longitude: location.longitude,
          gps_accuracy: location.accuracy ?? null,

          checkout: nowText,
          checkout_lat: location.latitude,
          checkout_lng: location.longitude,
          images_checkout_1: photoDataUrl,
          images_checkout_2: null,

          updated_by: empCode,
        } as Parameters<typeof timeRecordService.updateTimeRecord>[1] & {
          assignment_id: number;
          current_latitude: number;
          current_longitude: number;
          gps_accuracy: number | null;
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

      throw error instanceof Error
        ? error
        : new Error("การบันทึกเวลาล้มเหลว");
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

  function goCheckpointFromFaceVerify() {
    setSelectedCheckpoint(null);
    clearCheckInOutTimeState();

    setStack((s) => {
      const checkpointIndex = s.lastIndexOf("checkpoint");

      if (checkpointIndex >= 0) {
        return s.slice(0, checkpointIndex + 1);
      }

      return [...s.slice(0, -1), "checkpoint"];
    });
  }

  const isCheckpointCheckout = selectedCheckpoint?.mode === "checkout";
  const checkInOutMode = selectedCheckpoint ? "checkpoint" : "attendance";

  const checkInOutWorkDate = selectedCheckpoint
    ? selectedCheckpoint.workDate ?? null
    : attendanceTimeContext?.workDate ?? null;

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
            void goDirectCheckInOut();
          }}
          onGoCheckpoint={() => {
            void goCheckpoint();
          }}
          onGoPatrolReport={goPatrolReport}
          onGoLeaveShifts={goShifts}
          onGoFaceProfiles={goFaceProfiles}
        />
      )}

      {route === "checkpoint" && (
        <Checkpoint
          empCode={empCode}
          displayName={displayName}
          onBack={back}
          onGoCheckInOut={(payload) => {
            void goCheckInOut(payload);
          }}
        />
      )}

      {route === "checkInOut" && (
        <CheckInOut
          empCode={empCode}
          displayName={displayName}
          mode={checkInOutMode}
          workDate={checkInOutWorkDate}
          assignmentId={selectedCheckpoint?.assignmentId ?? null}
          unitName={selectedCheckpoint?.unitName ?? null}
          passedLocation={selectedCheckpoint?.passedLocation ?? null}
          lastInAt={
            selectedCheckpoint
              ? isCheckpointCheckout
                ? lastInAt
                : null
              : lastInAt
          }
          lastOutAt={
            selectedCheckpoint
              ? isCheckpointCheckout
                ? lastOutAt
                : null
              : lastOutAt
          }
          onBack={back}
          onCheckIn={(payload) => {
            if (payload.mode === "attendance") {
              goAttendanceFaceVerify("in", payload);
              return;
            }

            goFaceVerify("in", payload);
          }}
          onCheckOut={(payload) => {
            if (payload.mode === "attendance") {
              goAttendanceFaceVerify("out", payload);
              return;
            }

            goFaceVerify("out", payload);
          }}
        />
      )}

      {route === "patrolReport" && <PatrolReportPage onBack={back} />}

      {route === "attendanceFaceVerify" && (
        <AttendanceFaceVerify
          empCode={empCode}
          displayName={displayName}
          punchType={punchType}
          onBack={back}
          onVerifyFace={onVerifyFaceOnly}
          onConfirm={onAttendanceFaceConfirm}
          onGoCheckInOut={goCheckInOutFromFaceVerify}
        />
      )}

      {route === "faceVerify" && (
        <FaceVerify
          empCode={empCode}
          displayName={displayName}
          assignmentId={selectedCheckpoint?.assignmentId ?? null}
          unitName={selectedCheckpoint?.unitName ?? null}
          passedLocation={selectedCheckpoint?.passedLocation ?? null}
          punchType={punchType}
          onBack={back}
          onVerifyFace={onVerifyFaceOnly}
          onConfirm={onFaceConfirm}
          onGoCheckInOut={goCheckInOutFromFaceVerify}
          onGoCheckpoint={goCheckpointFromFaceVerify}
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