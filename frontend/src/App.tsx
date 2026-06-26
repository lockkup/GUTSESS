// src/App.tsx
import { useCallback, useEffect, useRef, useState } from "react";
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
import { useStore, type AuthEmployee } from "./store/store";
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

type PassedLocation = {
  latitude: number;
  longitude: number;
  accuracy: number;
};

type SelectedCheckpoint = {
  assignmentId: number;
  unitName: string;

  /**
   * ข้อความแนวสายตรวจที่รับมาจากหน้า Checkpoint
   * ตัวอย่าง: ["ภาค 2", "เขต 2.1", "เส้นทางที่ 1"]
   *
   * ใช้แสดงบนหน้า CheckInOut โดยไม่ fix หัวข้อ
   */
  patrolAreaValues: string[];

  mode: CheckpointActionMode;
  passedLocation: PassedLocation;

  /**
   * ใช้เฉพาะกรณีมาจากหน้า Checkpoint / ตารางงานสายตรวจ
   * ใช้ส่งต่อเพื่อบันทึกลง time_record.shift_id
   */
  shiftId: number;

  workDate?: string | null;
};

type GoCheckInOutPayload = {
  assignmentId: number;
  unitName: string;

  /**
   * รับมาจากหน้า Checkpoint / ตารางงานสายตรวจ
   * เช่น ["ภาค 2", "เขต 2.1", "เส้นทางที่ 1"]
   */
  patrolAreaValues: string[];

  mode: CheckpointActionMode;
  passedLocation: PassedLocation;

  /**
   * รับมาจากหน้า Checkpoint / ตารางงานสายตรวจ
   */
  shiftId: number;

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

type PatrolAreaInfo = {
  fieldName: string;
  divisionName: string;
  routeName: string;
};

type InitialAppAuth = {
  employeeCode: string;
  displayName: string;
};

/**
 * false = ถ่ายรูป + เช็กพิกัด + บันทึกเวลา แต่ไม่เทียบใบหน้า
 * true  = เปิดใช้การเทียบใบหน้ากับข้อมูลพนักงานในอนาคต
 */
const ENABLE_FACE_VERIFY = false;

const AUTH_EMPLOYEE_KEY = "auth_employee";
const AUTH_TOKEN_KEY = "auth_token";
const ACCESS_TOKEN_KEY = "access_token";
const AUTH_EXPIRES_AT_KEY = "auth_expires_at";
const EMP_CODE_KEY = "emp_code";
const DISPLAY_NAME_KEY = "display_name";
const APP_ROUTE_KEY = "app_route";
const APP_CHECK_IN_OUT_MODE_KEY = "app_check_in_out_mode";

// 2 นาที ให้ตรงกับ auth.ts
const SESSION_TIMEOUT_MS = 2 * 60 * 60 * 1000;

const RESTORABLE_ROUTES: Route[] = [
  "home",
  "checkpoint",
  "checkInOut",
  "patrolReport",
  "shifts",
  "faceProfiles",
];

function getEmployeeDisplayName(emp: AuthEmployee): string {
  return `${emp.first_name} ${emp.last_name}`.trim() || emp.employee_code;
}

function hasInitialAuthPayload(): boolean {
  return Boolean(
    localStorage.getItem(AUTH_EMPLOYEE_KEY) ||
      localStorage.getItem(AUTH_TOKEN_KEY) ||
      localStorage.getItem(ACCESS_TOKEN_KEY),
  );
}

function touchInitialAuthSession(): number {
  const expiresAt = Date.now() + SESSION_TIMEOUT_MS;
  localStorage.setItem(AUTH_EXPIRES_AT_KEY, String(expiresAt));

  return expiresAt;
}

function isInitialAuthExpired(): boolean {
  const rawExpiresAt = localStorage.getItem(AUTH_EXPIRES_AT_KEY);

  // รองรับ session เก่าที่ login ไว้ก่อนมี auth_expires_at
  // ถ้ามี auth_employee/auth_token อยู่ ให้ต่ออายุ session แทนการเด้งกลับหน้า login
  if (!rawExpiresAt) {
    if (hasInitialAuthPayload()) {
      touchInitialAuthSession();
      return false;
    }

    return true;
  }

  const expiresAt = Number(rawExpiresAt);

  if (!Number.isFinite(expiresAt)) {
    return true;
  }

  return Date.now() > expiresAt;
}

function clearInitialAuthSession() {
  localStorage.removeItem(AUTH_EMPLOYEE_KEY);
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(AUTH_EXPIRES_AT_KEY);
  localStorage.removeItem(DISPLAY_NAME_KEY);
  localStorage.removeItem(APP_ROUTE_KEY);
  localStorage.removeItem(APP_CHECK_IN_OUT_MODE_KEY);

  // ตั้งใจไม่ลบ emp_code เพื่อให้ช่องรหัสพนักงานยังจำค่าเดิมได้
  // ถ้าต้องการลบด้วย ให้เปิดบรรทัดนี้
  // localStorage.removeItem(EMP_CODE_KEY);
}

function loadInitialAppAuth(): InitialAppAuth | null {
  try {
    if (isInitialAuthExpired()) {
      clearInitialAuthSession();
      return null;
    }

    const rawEmployee = localStorage.getItem(AUTH_EMPLOYEE_KEY);

    if (rawEmployee) {
      const emp = JSON.parse(rawEmployee) as AuthEmployee;

      if (emp?.employee_code) {
        touchInitialAuthSession();

        return {
          employeeCode: emp.employee_code,
          displayName:
            localStorage.getItem(DISPLAY_NAME_KEY) ||
            getEmployeeDisplayName(emp),
        };
      }
    }

    const storedEmpCode = localStorage.getItem(EMP_CODE_KEY);
    const storedDisplayName = localStorage.getItem(DISPLAY_NAME_KEY);

    if (storedEmpCode && storedDisplayName) {
      touchInitialAuthSession();

      return {
        employeeCode: storedEmpCode,
        displayName: storedDisplayName,
      };
    }

    return null;
  } catch (error) {
    console.error("loadInitialAppAuth error:", error);
    clearInitialAuthSession();
    return null;
  }
}

function loadInitialCheckInOutMode(): "attendance" | "checkpoint" {
  return localStorage.getItem(APP_CHECK_IN_OUT_MODE_KEY) === "checkpoint"
    ? "checkpoint"
    : "attendance";
}

function loadInitialRoute(): Route {
  const rawRoute = localStorage.getItem(APP_ROUTE_KEY);

  /**
   * หน้า checkInOut มี 2 โหมด:
   * - attendance  = เมนูลงเวลาเข้า-ออกงานปกติ สามารถ restore กลับหน้าเดิมได้
   * - checkpoint  = มาจากตารางงานสายตรวจ มี state ชั่วคราว เช่น assignmentId/shiftId/passedLocation
   *                 หลัง refresh state เหล่านี้จะหาย จึงให้กลับหน้า checkpoint แทน
   */
  if (rawRoute === "checkInOut") {
    return loadInitialCheckInOutMode() === "checkpoint"
      ? "checkpoint"
      : "checkInOut";
  }

  if (rawRoute && RESTORABLE_ROUTES.includes(rawRoute as Route)) {
    return rawRoute as Route;
  }

  return "home";
}

function saveCurrentRoute(route: Route) {
  if (route === "login") {
    localStorage.removeItem(APP_ROUTE_KEY);
    localStorage.removeItem(APP_CHECK_IN_OUT_MODE_KEY);
    return;
  }

  if (RESTORABLE_ROUTES.includes(route)) {
    localStorage.setItem(APP_ROUTE_KEY, route);
  }

  if (route !== "checkInOut") {
    localStorage.removeItem(APP_CHECK_IN_OUT_MODE_KEY);
  }
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
  const authEmployee = useStore((s) => s.authEmployee);

  const initialAppAuth =
    authEmployee !== null
      ? {
          employeeCode: authEmployee.employee_code,
          displayName: getEmployeeDisplayName(authEmployee),
        }
      : loadInitialAppAuth();

  const [stack, setStack] = useState<Route[]>(() =>
    initialAppAuth ? [loadInitialRoute()] : ["login"],
  );
  const route = stack[stack.length - 1];

  useEffect(() => {
    saveCurrentRoute(route);
  }, [route]);

  const [empCode, setEmpCode] = useState(
    () => initialAppAuth?.employeeCode ?? "",
  );
  const [displayName, setDisplayName] = useState(
    () => initialAppAuth?.displayName ?? "",
  );

  /**
   * Home.tsx จะดึงข้อมูล ภาค / เขต / เส้นทาง จาก API
   * แล้วส่งค่ากลับมาผ่าน onPatrolAreaLoaded
   *
   * App.tsx เก็บค่าไว้ เพื่อส่งต่อไปหน้า Checkpoint
   * หลังผู้ใช้กดเมนู "ตารางงานสายตรวจ"
   */
  const [patrolArea, setPatrolArea] = useState<PatrolAreaInfo>({
    fieldName: "",
    divisionName: "",
    routeName: "",
  });

  const handlePatrolAreaLoaded = useCallback(
    (nextPatrolArea: PatrolAreaInfo) => {
      setPatrolArea((currentPatrolArea) => {
        const isSameValue =
          currentPatrolArea.fieldName === nextPatrolArea.fieldName &&
          currentPatrolArea.divisionName === nextPatrolArea.divisionName &&
          currentPatrolArea.routeName === nextPatrolArea.routeName;

        return isSameValue ? currentPatrolArea : nextPatrolArea;
      });
    },
    [],
  );

  const [lastInAt, setLastInAt] = useState<string | null>(null);
  const [lastOutAt, setLastOutAt] = useState<string | null>(null);
  const [punchType, setPunchType] = useState<PunchType>("in");

  const [attendanceTimeContext, setAttendanceTimeContext] =
    useState<AttendanceTimeContext | null>(null);

  const [, setOpenTimeRecord] = useState<TimeRecordResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * กันยิง create/update time_record ซ้ำ
   * ใช้ ref เพราะเปลี่ยนค่าได้ทันที ไม่ต้องรอ React setState
   */
  const submittingRef = useRef(false);

  const [selectedCheckpoint, setSelectedCheckpoint] =
    useState<SelectedCheckpoint | null>(null);

  const reset = (r: Route) => setStack([r]);

  const push = (r: Route) =>
    setStack((s) => (s[s.length - 1] === r ? s : [...s, r]));

  const back = () =>
    setStack((s) => {
      /**
       * กรณีเข้าหน้าเดิมจากการ Refresh เช่น patrolReport
       * stack จะเหลือแค่ ["patrolReport"] ทำให้ย้อนกลับแบบ slice ไม่ได้
       * ดังนั้นให้ย้อนกลับไปหน้า Home แทน
       */
      if (s.length <= 1) {
        return s[0] === "home" || s[0] === "login" ? s : ["home"];
      }

      return s.slice(0, -1);
    });

  function clearCheckInOutTimeState() {
    setOpenTimeRecord(null);
    setLastInAt(null);
    setLastOutAt(null);
  }

  /**
   * ใช้ล้างค่าชั่วคราวหลังจบ Flow สายตรวจ
   * ห้ามล้างข้อมูลใน DB เพราะ time_record บันทึกเรียบร้อยแล้ว
   */
  function clearCheckpointFlowState() {
    localStorage.removeItem(APP_CHECK_IN_OUT_MODE_KEY);
    setSelectedCheckpoint(null);
    clearCheckInOutTimeState();
    setPunchType("in");
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

  useEffect(() => {
    if (!authEmployee) return;

    const cleanEmpCode = authEmployee.employee_code
      .replace(/\D/g, "")
      .slice(0, 6);
    const safeDisplayName = getEmployeeDisplayName(authEmployee);

    setEmpCode(cleanEmpCode);
    setDisplayName(safeDisplayName);

    setAttendanceTimeContext((current) => current ?? makeAttendanceTimeContext());

    setStack((currentStack) => {
      if (currentStack.length === 1 && currentStack[0] === "login") {
        return ["home"];
      }

      return currentStack;
    });
  }, [authEmployee]);

  useEffect(() => {
    if (route !== "checkInOut") return;
    if (!empCode) return;

    /**
     * กรณี checkpoint mode:
     * - ถ้ามาจากหน้า Checkpoint ปกติ selectedCheckpoint จะมีค่าอยู่แล้ว
     *   ให้เปิดหน้า CheckInOut ต่อได้
     *
     * - ถ้า refresh หน้า checkInOut แล้ว state ชั่วคราวหาย selectedCheckpoint จะเป็น null
     *   ให้กลับหน้า checkpoint แทน
     */
    if (loadInitialCheckInOutMode() === "checkpoint") {
      if (!selectedCheckpoint) {
        reset("checkpoint");
      }

      return;
    }

    const context = attendanceTimeContext ?? makeAttendanceTimeContext();

    setAttendanceTimeContext(context);

    void loadOpenAttendanceTimeRecord(empCode, context);
  }, [route, empCode, selectedCheckpoint]);

  useEffect(() => {
    if (!empCode) return;

    const rawExpiresAt = localStorage.getItem(AUTH_EXPIRES_AT_KEY);
    let expiresAt = Number(rawExpiresAt);

    if (!rawExpiresAt || !Number.isFinite(expiresAt)) {
      if (hasInitialAuthPayload()) {
        expiresAt = touchInitialAuthSession();
      } else {
        void onLogout();
        return;
      }
    }

    const remainingMs = expiresAt - Date.now();

    if (remainingMs <= 0) {
      void onLogout();
      return;
    }

    const timer = window.setTimeout(() => {
      void onLogout();
    }, remainingMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [empCode]);

  function handleLoginSuccess(loginEmpCode: string, loginDisplayName: string) {
    const cleanEmpCode = loginEmpCode.replace(/\D/g, "").slice(0, 6);
    const safeDisplayName = loginDisplayName.trim() || cleanEmpCode;

    setEmpCode(cleanEmpCode);
    setDisplayName(safeDisplayName);
    setPatrolArea({
      fieldName: "",
      divisionName: "",
      routeName: "",
    });

    const context = makeAttendanceTimeContext();

    setAttendanceTimeContext(context);
    clearCheckInOutTimeState();
    setSelectedCheckpoint(null);
    setPunchType("in");

    reset("home");
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

  async function onLogout() {
    const logoutCode = empCode || localStorage.getItem("emp_code") || "";

    if (logoutCode) {
      try {
        await useStore.getState().logout(logoutCode);
      } catch (error) {
        console.error("logout error:", error);
      }
    }

    localStorage.removeItem("emp_code");
    localStorage.removeItem(APP_ROUTE_KEY);
    localStorage.removeItem(APP_CHECK_IN_OUT_MODE_KEY);

    setEmpCode("");
    setDisplayName("");
    setPatrolArea({
      fieldName: "",
      divisionName: "",
      routeName: "",
    });
    setAttendanceTimeContext(null);
    clearCheckInOutTimeState();
    setSelectedCheckpoint(null);
    setPunchType("in");

    reset("login");
  }

  async function goDirectCheckInOut() {
    /**
     * กรณีกดเมนู "ลงเวลา เข้า-ออกงาน" จากหน้า Home
     * เป็น Attendance ปกติ:
     * - ไม่มี assignment_id
     * - ไม่ส่ง shift_id
     */
    setSelectedCheckpoint(null);
    localStorage.setItem(APP_CHECK_IN_OUT_MODE_KEY, "attendance");

    const context = makeAttendanceTimeContext();

    setAttendanceTimeContext(context);
    await loadOpenAttendanceTimeRecord(empCode, context);

    push("checkInOut");
  }

  async function goCheckpoint() {
    localStorage.removeItem(APP_CHECK_IN_OUT_MODE_KEY);
    setSelectedCheckpoint(null);
    setAttendanceTimeContext(null);
    clearCheckInOutTimeState();
    setPunchType("in");
    push("checkpoint");
  }

  async function goCheckInOut(payload: GoCheckInOutPayload) {
    localStorage.setItem(APP_CHECK_IN_OUT_MODE_KEY, "checkpoint");

    /**
     * กรณีมาจากหน้า Checkpoint / ตารางงานสายตรวจ:
     * - ต้องเก็บ assignmentId
     * - ต้องเก็บ shiftId
     * - ใช้ส่ง shift_id ไปบันทึกลง time_record
     */
    setSelectedCheckpoint({
      assignmentId: payload.assignmentId,
      unitName: payload.unitName,
      patrolAreaValues: Array.isArray(payload.patrolAreaValues)
        ? payload.patrolAreaValues
        : [],
      mode: payload.mode,
      passedLocation: payload.passedLocation,
      shiftId: payload.shiftId,
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
    /**
     * Attendance ปกติ:
     * - ล้าง selectedCheckpoint
     * - ไม่มี assignment_id
     * - ไม่ส่ง shift_id
     */
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

      /**
       * รับต่อจากหน้า CheckInOut
       * เช่น ["ภาค 2", "เขต 2.1", "เส้นทางที่ 1"]
       */
      patrolAreaValues?: string[] | null;

      shiftId?: number | null;
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

      const resolvedShiftId = payload.shiftId ?? selectedCheckpoint?.shiftId;

      if (!resolvedShiftId) {
        alert("ไม่พบข้อมูลผลัด กรุณากลับไปเลือกผลัดจากตารางงานสายตรวจก่อน");
        return;
      }

      const resolvedWorkDate =
        payload.workDate ?? selectedCheckpoint?.workDate ?? formatWorkDate();

      setSelectedCheckpoint({
        assignmentId: payload.assignmentId,
        unitName: payload.unitName ?? "",
        patrolAreaValues: Array.isArray(payload.patrolAreaValues)
          ? payload.patrolAreaValues
          : selectedCheckpoint?.patrolAreaValues ?? [],
        mode: type === "in" ? "checkin" : "checkout",
        passedLocation,
        shiftId: resolvedShiftId,
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
    if (submittingRef.current || isSubmitting) {
      throw new Error("ระบบกำลังบันทึกอยู่ กรุณารอสักครู่");
    }

    submittingRef.current = true;
    setIsSubmitting(true);

    try {
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

        /**
         * Attendance ปกติ:
         * - ไม่มี assignment_id
         * - ไม่ส่ง shift_id
         */
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

        /**
         * Attendance ปกติ:
         * - ไม่มี assignment_id
         * - ไม่ส่ง shift_id
         * - ส่ง current_latitude/current_longitude ให้ Backend ตรวจพิกัด
         */
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

        /**
         * ออกงานสำเร็จ:
         * ให้บันทึกค่าไว้ก่อน เพื่อให้ popup success ทำงานตาม flow เดิม
         * หลังผู้ใช้กด "ตกลง" จะไปเคลียร์ state และกลับ Home ใน goCheckInOutFromFaceVerify()
         */
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
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  async function onFaceConfirm(
    photoDataUrl: string,
    type: PunchType,
    _embedding: number[],
    location: LocationCoords,
  ) {
    if (submittingRef.current || isSubmitting) {
      throw new Error("ระบบกำลังบันทึกอยู่ กรุณารอสักครู่");
    }

    if (!location.assignmentId) {
      throw new Error(
        "ไม่พบ assignment_id ของจุดรักษาการณ์ กรุณากลับไปเลือกจุดจากตารางงานสายตรวจก่อน",
      );
    }

    const checkpointShiftId = selectedCheckpoint?.shiftId ?? null;

    if (!checkpointShiftId) {
      throw new Error(
        "ไม่พบข้อมูลผลัด กรุณากลับไปเลือกผลัดจากตารางงานสายตรวจก่อน",
      );
    }

    submittingRef.current = true;
    setIsSubmitting(true);

    try {
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

        /**
         * Checkpoint / ตารางงานสายตรวจ:
         * - ส่ง assignment_id
         * - ส่ง shift_id
         * - Backend บันทึกลง time_record.shift_id
         */
        const createPayload = {
          employee_code: empCode,
          work_date: workDate,

          assignment_id: location.assignmentId,
          shift_id: checkpointShiftId,

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
          shift_id: number;
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

        /**
         * Checkpoint / ตารางงานสายตรวจ:
         * - ส่ง assignment_id
         * - ส่ง shift_id
         * - Backend อัปเดต time_record.shift_id
         */
        const updatePayload = {
          assignment_id: location.assignmentId,
          shift_id: checkpointShiftId,

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
          shift_id: number;
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
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  /**
   * ใช้หลังออกงาน attendance สำเร็จ แล้วกด "ตกลง"
   * ต้องกลับหน้า Home และเคลียร์สถานะปุ่ม disabled
   *
   * ผลลัพธ์:
   * - กลับหน้า Home
   * - ล้าง lastInAt / lastOutAt
   * - ล้าง open record
   * - พอกดเมนูลงเวลาอีกครั้ง จะขึ้นหน้าเริ่มต้น
   */
  function goHomeAfterAttendanceCheckout() {
    localStorage.removeItem(APP_CHECK_IN_OUT_MODE_KEY);
    setSelectedCheckpoint(null);

    const context = makeAttendanceTimeContext();

    setAttendanceTimeContext(context);
    clearCheckInOutTimeState();
    setPunchType("in");

    reset("home");
  }

  function goCheckInOutFromFaceVerify() {
    /**
     * กรณีเมนู "ลงเวลา เข้า-ออกงาน" ปกติ
     * หลังออกงานสำเร็จและกดตกลงใน SuccessModal
     * ให้กลับหน้า Home ไม่กลับหน้า CheckInOut
     */
    if (!selectedCheckpoint && punchType === "out") {
      goHomeAfterAttendanceCheckout();
      return;
    }

    setStack((s) => {
      const prev = s[s.length - 2];

      if (prev === "checkInOut") return s.slice(0, -1);

      return [...s.slice(0, -1), "checkInOut"];
    });
  }

  function goCheckpointFromFaceVerify() {
    /**
     * กรณี Checkpoint / ตารางงานสายตรวจ
     * หลังบันทึก time_record สำเร็จและกดตกลงใน SuccessModal:
     * - ล้าง selectedCheckpoint
     * - ล้าง open record / เวลาเข้า / เวลาออก
     * - reset punchType
     * - กลับหน้า Checkpoint เพื่อโหลดสถานะใหม่
     */
    clearCheckpointFlowState();

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
      {route === "login" && <Login onLoginSuccess={handleLoginSuccess} />}

      {route === "home" && (
        <Home
          empCode={empCode}
          displayName={displayName}
          fieldName={patrolArea.fieldName}
          divisionName={patrolArea.divisionName}
          routeName={patrolArea.routeName}
          onPatrolAreaLoaded={handlePatrolAreaLoaded}
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
          regionLabel={patrolArea.fieldName || null}
          districtLabel={patrolArea.divisionName || null}
          routeLabel={patrolArea.routeName || null}
          onBack={back}
          onGoCheckInOut={(payload) => {
            void goCheckInOut(payload).catch((error) => {
              console.error("[App] GO CHECKINOUT ERROR FROM CHECKPOINT", {
                payload,
                error,
              });

              alert(
                error instanceof Error
                  ? error.message
                  : "ไม่สามารถไปหน้าลงเวลาเข้า-ออกงานได้ กรุณาลองใหม่อีกครั้ง",
              );
            });
          }}
        />
      )}

      {route === "checkInOut" && (
        <CheckInOut
          empCode={empCode}
          displayName={displayName}
          fieldName={patrolArea.fieldName}
          divisionName={patrolArea.divisionName}
          routeName={patrolArea.routeName}
          mode={checkInOutMode}
          workDate={checkInOutWorkDate}
          assignmentId={selectedCheckpoint?.assignmentId ?? null}
          unitName={selectedCheckpoint?.unitName ?? null}
          passedLocation={selectedCheckpoint?.passedLocation ?? null}
          patrolAreaValues={selectedCheckpoint?.patrolAreaValues ?? null}
          shiftId={selectedCheckpoint?.shiftId ?? null}
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
          fieldName={patrolArea.fieldName}
          divisionName={patrolArea.divisionName}
          routeName={patrolArea.routeName}
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
          patrolAreaValues={selectedCheckpoint?.patrolAreaValues ?? null}
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