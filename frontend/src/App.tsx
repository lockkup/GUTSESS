import { useCallback, useEffect, useRef, useState } from "react";

import Login from "./pages/Login";

import Home from "./pages/Home";

import Dashboard from "./pages/Dashboard";

import Checkpoint from "./pages/Attendance/Checkpoint";

import CheckInOut from "./pages/Attendance/CheckInOut";

import LocationSelect, {

  type AttendanceHistoryItem,

  type AttendanceLocationSelection,

} from "./pages/Attendance/LocationSelect";

import PatrolReportPage from "./pages/Attendance/PatrolReport";

import FaceVerify from "./pages/Attendance/FaceVerify";

import AttendanceFaceVerify from "./pages/Attendance/CheckInOut/AttendanceFaceVerify";

import WorkRecordReport from "./pages/Attendance/WorkRecordReport";

import Shifts from "./pages/Shifts";

import FaceProfiles from "./pages/FaceProfiles";

import PatrolAreaInfoPage from "./pages/PatrolAreaInfo";

import PatrolAreaInfoModal, {

  type PatrolAreaInfoModalLocation,

} from "./components/PatrolAreaInfoModal";

import { useStore, type AuthEmployee } from "./store/store";

import { timeRecordService } from "./services/timeRecord.service";

import { workReportService } from "./services/workReport.service";

import { faceVerifyService } from "./services/faceVerify.service";

import { api } from "./lib/api";

import type {

  AttendanceLocationOptionResponse,

  TimeRecordResponse,

} from "./types/timeRecord";

type Route =

  | "login"

  | "home"

  | "dashboard"

  | "checkpoint"

  | "locationSelect"

  | "workRecordReport"

  | "checkInOut"

  | "patrolReport"

  | "patrolAreaInfo"

  | "faceVerify"

  | "attendanceFaceVerify"

  | "shifts"

  | "faceProfiles";

type PunchType = "in" | "out";

type CheckpointActionMode = "checkin" | "checkout";

type CheckpointAreaSelection = {

  divisionId: number;

  routeId: number;

};

type PassedLocation = {

  latitude: number;

  longitude: number;

  accuracy: number;

};

type SelectedAttendanceLocation = {

  locationId: number;

  contractCode: string | null;

  locationName: string;

  hasOpenRecord: boolean;

  openTimeRecordId: number | null;

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

type AttendanceHistoryListApiItem = {

  time_record_id: number;

  work_date?: string;

  shift_id?: number | null;

  location_id?: number | null;

  location_name?: string | null;

  checkin?: string | null;

  checkout?: string | null;

};

type SiteLocationMapResponse = {

  location_id: number;

  contract_code?: string | null;

  location_name?: string | null;

  location_detail?: string | null;

  latitude: number | string | null;

  longitude: number | string | null;

  radius_meter?: number | string | null;

  grace_meter?: number | string | null;

  updated_at?: string | null;

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

const APP_ATTENDANCE_LOCATIONS_KEY = "app_attendance_locations";

const APP_SELECTED_ATTENDANCE_LOCATION_KEY =

  "app_selected_attendance_location";

const APP_ATTENDANCE_HISTORY_DATE_KEY = "app_attendance_history_date";

// 2 นาที ให้ตรงกับ auth.ts

const SESSION_TIMEOUT_MS = 2 * 60 * 60 * 1000;

const RESTORABLE_ROUTES: Route[] = [

  "home",

  "checkpoint",

  "locationSelect",

  "checkInOut",

  "patrolReport",

  "patrolAreaInfo",

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

  localStorage.removeItem(APP_ATTENDANCE_LOCATIONS_KEY);

  localStorage.removeItem(APP_SELECTED_ATTENDANCE_LOCATION_KEY);

  localStorage.removeItem(APP_ATTENDANCE_HISTORY_DATE_KEY);

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

function loadInitialAttendanceLocations(): AttendanceLocationOptionResponse[] {

  try {

    const rawLocations = localStorage.getItem(APP_ATTENDANCE_LOCATIONS_KEY);

    if (!rawLocations) {

      return [];

    }

    const parsed = JSON.parse(rawLocations) as AttendanceLocationOptionResponse[];

    return Array.isArray(parsed) ? parsed : [];

  } catch (error) {

    console.error("loadInitialAttendanceLocations error:", error);

    localStorage.removeItem(APP_ATTENDANCE_LOCATIONS_KEY);

    return [];

  }

}

function loadInitialSelectedAttendanceLocation(): SelectedAttendanceLocation | null {

  try {

    const rawLocation = localStorage.getItem(

      APP_SELECTED_ATTENDANCE_LOCATION_KEY,

    );

    if (!rawLocation) {

      return null;

    }

    const parsed = JSON.parse(

      rawLocation,

    ) as Partial<SelectedAttendanceLocation>;

    if (

      typeof parsed.locationId !== "number" ||

      typeof parsed.locationName !== "string"

    ) {

      localStorage.removeItem(APP_SELECTED_ATTENDANCE_LOCATION_KEY);

      return null;

    }

    return {

      locationId: parsed.locationId,

      contractCode:

        typeof parsed.contractCode === "string" ? parsed.contractCode : null,

      locationName: parsed.locationName,

      hasOpenRecord: parsed.hasOpenRecord === true,

      openTimeRecordId:

        typeof parsed.openTimeRecordId === "number"

          ? parsed.openTimeRecordId

          : null,

    };

  } catch (error) {

    console.error("loadInitialSelectedAttendanceLocation error:", error);

    localStorage.removeItem(APP_SELECTED_ATTENDANCE_LOCATION_KEY);

    return null;

  }

}

function loadInitialAttendanceHistoryDate(): string {

  const storedDate = localStorage.getItem(APP_ATTENDANCE_HISTORY_DATE_KEY);

  if (storedDate && /^\d{4}-\d{2}-\d{2}$/.test(storedDate)) {

    return storedDate;

  }

  return getAttendanceWorkDate();

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

/**

 * วันปฏิบัติงานของ Attendance ปกติ

 *

 * ตามช่วงกะปัจจุบัน:

 * - 08:01 เป็นต้นไป = วันที่ปฏิทินปัจจุบัน

 * - 00:00 - 08:00 = ยังถือเป็นวันปฏิบัติงานของวันก่อนหน้า

 *

 * ตัวอย่าง:

 * 3 ต.ค. 21:30 เข้า -> work_date = 2026-10-03

 * 4 ต.ค. 00:56 ออก -> ยังใช้ work_date = 2026-10-03

 *

 * หมายเหตุ:

 * ใช้เฉพาะ Attendance ปกติ

 * Checkpoint ยังคงใช้ work_date จาก Assignment/Flow เดิม

 */

function getAttendanceWorkDate(date = new Date()) {

  const operationalDate = new Date(date);

  const currentMinutes =

    operationalDate.getHours() * 60 + operationalDate.getMinutes();

  const nightShiftEndMinutes = 8 * 60;

  if (currentMinutes <= nightShiftEndMinutes) {

    operationalDate.setDate(operationalDate.getDate() - 1);

  }

  return formatWorkDate(operationalDate);

}

function getCurrentLocation(): Promise<PassedLocation> {

  return new Promise((resolve, reject) => {

    if (!navigator.geolocation) {

      reject(new Error("อุปกรณ์นี้ไม่รองรับการอ่านตำแหน่ง GPS"));

      return;

    }

    navigator.geolocation.getCurrentPosition(

      (position) => {

        resolve({

          latitude: position.coords.latitude,

          longitude: position.coords.longitude,

          accuracy: position.coords.accuracy,

        });

      },

      (error) => {

        if (error.code === error.PERMISSION_DENIED) {

          reject(

            new Error(

              "ไม่ได้รับอนุญาตให้เข้าถึงตำแหน่ง กรุณาเปิดสิทธิ์ GPS แล้วลองใหม่",

            ),

          );

          return;

        }

        if (error.code === error.TIMEOUT) {

          reject(new Error("ใช้เวลาค้นหาตำแหน่งนานเกินไป กรุณาลองใหม่"));

          return;

        }

        reject(new Error("ไม่สามารถอ่านตำแหน่ง GPS ปัจจุบันได้"));

      },

      {

        enableHighAccuracy: true,

        timeout: 20_000,

        maximumAge: 0,

      },

    );

  });

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

  const [attendanceLocations, setAttendanceLocations] = useState<

    AttendanceLocationOptionResponse[]

  >(() => loadInitialAttendanceLocations());

  const [selectedAttendanceLocation, setSelectedAttendanceLocation] =

    useState<SelectedAttendanceLocation | null>(() =>

      loadInitialSelectedAttendanceLocation(),

    );

  const [busyAttendanceLocationId, setBusyAttendanceLocationId] = useState<

    number | null

  >(null);

  const [attendanceHistoryDate, setAttendanceHistoryDate] = useState(() =>

    loadInitialAttendanceHistoryDate(),

  );

  const [attendanceHistoryItems, setAttendanceHistoryItems] = useState<

    AttendanceHistoryItem[]

  >([]);

  const [selectedWorkRecordTimeRecordId, setSelectedWorkRecordTimeRecordId] =

    useState<number | null>(null);

  const [historyMapOpen, setHistoryMapOpen] = useState(false);

  const [historyMapLoading, setHistoryMapLoading] = useState(false);

  const [historyMapError, setHistoryMapError] = useState<string | null>(null);

  const [historyMapLocation, setHistoryMapLocation] =

    useState<PatrolAreaInfoModalLocation | null>(null);

  useEffect(() => {

    if (attendanceLocations.length > 0) {

      localStorage.setItem(

        APP_ATTENDANCE_LOCATIONS_KEY,

        JSON.stringify(attendanceLocations),

      );

      return;

    }

    localStorage.removeItem(APP_ATTENDANCE_LOCATIONS_KEY);

  }, [attendanceLocations]);

  useEffect(() => {

    if (selectedAttendanceLocation) {

      localStorage.setItem(

        APP_SELECTED_ATTENDANCE_LOCATION_KEY,

        JSON.stringify(selectedAttendanceLocation),

      );

      return;

    }

    localStorage.removeItem(APP_SELECTED_ATTENDANCE_LOCATION_KEY);

  }, [selectedAttendanceLocation]);

  useEffect(() => {

    localStorage.setItem(APP_ATTENDANCE_HISTORY_DATE_KEY, attendanceHistoryDate);

  }, [attendanceHistoryDate]);

  const loadAttendanceHistory = useCallback(

    async (workDate: string) => {

      if (!empCode || !workDate) {

        setAttendanceHistoryItems([]);

        return;

      }

      try {

        const response = await timeRecordService.getTimeRecordListItems({

          employee_code: empCode,

          work_date: workDate,

          skip: 0,

          limit: 200,

        });

        const rows = response as unknown as AttendanceHistoryListApiItem[];

        const attendanceRows = rows.filter((item) => {

          // ประวัติหน้านี้ใช้เฉพาะ Attendance ปกติ

          // checkpoint จะมี shift_id ส่วน attendance ปกติเป็น null

          return (

            item.shift_id == null &&

            Boolean(item.checkin) &&

            typeof item.time_record_id === "number"

          );

        });

        const historyItems = await Promise.all(

          attendanceRows.map<Promise<AttendanceHistoryItem>>(async (item) => {

            const matchedLocation =

              typeof item.location_id === "number"

                ? attendanceLocations.find(

                    (location) => location.location_id === item.location_id,

                  )

                : undefined;

            let documentNo: string | null = null;

            let reportStatus: "active" | "cancelled" | null = null;

            try {

              const reports = await workReportService.getWorkReports({

                time_record_id: item.time_record_id,

                include_deleted: false,

                skip: 0,

                limit: 1,

              });

              const report = reports[0];

              documentNo = report?.document_no ?? null;

              reportStatus = report?.report_status ?? null;

            } catch (workReportError) {

              console.error(

                "loadAttendanceHistory work_report error:",

                workReportError,

              );

            }

            return {

              timeRecordId: item.time_record_id,

              documentNo,

              contractCode: matchedLocation?.contract_code ?? null,

              locationName:

                item.location_name?.trim() ||

                matchedLocation?.location_name ||

                (typeof item.location_id === "number"

                  ? `หน่วยงาน ${item.location_id}`

                  : "-"),

              checkin: item.checkin ?? null,

              checkout: item.checkout ?? null,

              status:

                reportStatus === "cancelled"

                  ? "cancelled"

                  : item.checkout

                    ? "completed"

                    : "in_progress",

            };

          }),

        );

        setAttendanceHistoryItems(historyItems);

      } catch (error) {

        console.error("loadAttendanceHistory error:", error);

        setAttendanceHistoryItems([]);

      }

    },

    [attendanceLocations, empCode],

  );

  useEffect(() => {

    if (route !== "locationSelect") return;

    void loadAttendanceHistory(attendanceHistoryDate);

  }, [route, attendanceHistoryDate, loadAttendanceHistory]);

  const [, setOpenTimeRecord] = useState<TimeRecordResponse | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  /**

   * กันยิง create/update time_record ซ้ำ

   * ใช้ ref เพราะเปลี่ยนค่าได้ทันที ไม่ต้องรอ React setState

   */

  const submittingRef = useRef(false);

  const attendanceLocationSearchRef = useRef(false);

  const [selectedCheckpoint, setSelectedCheckpoint] =

    useState<SelectedCheckpoint | null>(null);

  /**

   * จำเขต / เส้นทางที่ผู้ใช้เลือกในหน้า Checkpoint

   * หลัง Check-in / Check-out แล้วกลับมา ให้ยังคงพื้นที่เดิม

   * หากต้องการกลับพื้นที่ประจำ ผู้ใช้เลือกจาก Dropdown ตามเดิม

   */

  const [checkpointAreaSelection, setCheckpointAreaSelection] =

    useState<CheckpointAreaSelection | null>(null);

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

  function clearAttendanceLocationState() {

    localStorage.removeItem(APP_ATTENDANCE_LOCATIONS_KEY);

    localStorage.removeItem(APP_SELECTED_ATTENDANCE_LOCATION_KEY);

    localStorage.removeItem(APP_ATTENDANCE_HISTORY_DATE_KEY);

    setAttendanceLocations([]);

    setSelectedAttendanceLocation(null);

    setBusyAttendanceLocationId(null);

    setAttendanceHistoryItems([]);

    setSelectedWorkRecordTimeRecordId(null);

  }

  function updateAttendanceLocationOpenRecord(

    locationId: number,

    openTimeRecordId: number | null,

  ) {

    const hasOpenRecord = openTimeRecordId !== null;

    setAttendanceLocations((currentLocations) =>

      currentLocations.map((location) =>

        location.location_id === locationId

          ? {

              ...location,

              has_open_record: hasOpenRecord,

              open_time_record_id: openTimeRecordId,

            }

          : location,

      ),

    );

    setSelectedAttendanceLocation((currentLocation) =>

      currentLocation?.locationId === locationId

        ? {

            ...currentLocation,

            hasOpenRecord,

            openTimeRecordId,

          }

        : currentLocation,

    );

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

      workDate: params?.workDate ?? getAttendanceWorkDate(date),

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

    /**

     * Attendance Phase 2 ต้องมีหน่วยงานที่เลือกก่อนเข้าหน้าลงเวลา

     * หาก Refresh แล้ว state ชั่วคราวหาย ให้กลับ Home เพื่อค้นหา GPS ใหม่

     */

    if (!selectedAttendanceLocation) {

      reset("home");

      return;

    }

    const context = attendanceTimeContext ?? makeAttendanceTimeContext();

    setAttendanceTimeContext(context);

    void loadSelectedAttendanceTimeRecord(selectedAttendanceLocation).catch(

      (error) => {

        console.error("loadSelectedAttendanceTimeRecord error:", error);

        clearCheckInOutTimeState();

      },

    );

  }, [route, empCode, selectedCheckpoint, selectedAttendanceLocation]);

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

    clearAttendanceLocationState();

    setSelectedCheckpoint(null);

    setCheckpointAreaSelection(null);

    setPunchType("in");

    reset("home");

  }

  async function loadSelectedAttendanceTimeRecord(

    location: SelectedAttendanceLocation,

  ) {

    if (!location.hasOpenRecord || !location.openTimeRecordId) {

      clearCheckInOutTimeState();

      return;

    }

    const record = await timeRecordService.getTimeRecordById(

      location.openTimeRecordId,

    );

    setOpenTimeRecord(record);

    setLastInAt(record.checkin ?? null);

    setLastOutAt(record.checkout ?? null);

  }

  async function selectAttendanceLocation(

    location: AttendanceLocationOptionResponse,

  ) {

    const selectedLocation: SelectedAttendanceLocation = {

      locationId: location.location_id,

      contractCode: location.contract_code || null,

      locationName: location.location_name,

      hasOpenRecord: location.has_open_record,

      openTimeRecordId: location.open_time_record_id,

    };

    setSelectedAttendanceLocation(selectedLocation);

    setPunchType(location.has_open_record ? "out" : "in");

    setSelectedWorkRecordTimeRecordId(

      location.open_time_record_id ?? null,

    );

    await loadSelectedAttendanceTimeRecord(selectedLocation);

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

    clearAttendanceLocationState();

    setSelectedCheckpoint(null);

    setCheckpointAreaSelection(null);

    setPunchType("in");

    reset("login");

  }

  async function goDirectCheckInOut() {

    if (attendanceLocationSearchRef.current) {

      return;

    }

    if (!empCode) {

      alert("ไม่พบรหัสพนักงาน กรุณาเข้าสู่ระบบใหม่");

      return;

    }

    attendanceLocationSearchRef.current = true;

    /**

     * กรณีกดเมนู "ลงเวลา เข้า-ออกงาน" จากหน้า Home

     * ตรวจ GPS และค้นหาหน่วยงานทั้งหมดที่พื้นที่ทับซ้อนกันก่อน

     */

    try {

      setSelectedCheckpoint(null);

      clearAttendanceLocationState();

      clearCheckInOutTimeState();

      localStorage.setItem(APP_CHECK_IN_OUT_MODE_KEY, "attendance");

      const context = makeAttendanceTimeContext();

      const currentLocation = await getCurrentLocation();

      setAttendanceTimeContext(context);

      setAttendanceHistoryDate(context.workDate);

      const locations = await timeRecordService.searchAttendanceLocations({

        employee_code: empCode,

        work_date: context.workDate,

        current_latitude: currentLocation.latitude,

        current_longitude: currentLocation.longitude,

        gps_accuracy: currentLocation.accuracy,

      });

      if (locations.length === 0) {

        alert("ไม่พบหน่วยงานที่สามารถลงเวลาได้จากตำแหน่งปัจจุบัน");

        return;

      }

      setAttendanceLocations(locations);

      if (locations.length === 1) {

        await selectAttendanceLocation(locations[0]);

        push("checkInOut");

        return;

      }

      push("locationSelect");

    } catch (error) {

      console.error("goDirectCheckInOut error:", error);

      alert(

        error instanceof Error

          ? error.message

          : "ไม่สามารถค้นหาหน่วยงานจากตำแหน่งปัจจุบันได้",

      );

    } finally {

      attendanceLocationSearchRef.current = false;

    }

  }

  async function handleAttendanceLocationSelect(

    selection: AttendanceLocationSelection,

  ) {

    if (busyAttendanceLocationId !== null) {

      return;

    }

    const location = attendanceLocations.find(

      (item) => item.location_id === selection.location.locationId,

    );

    if (!location) {

      alert("ไม่พบข้อมูลหน่วยงานที่เลือก กรุณาค้นหาใหม่อีกครั้ง");

      return;

    }

    setBusyAttendanceLocationId(location.location_id);

    try {

      await selectAttendanceLocation(location);

      push("checkInOut");

    } catch (error) {

      console.error("handleAttendanceLocationSelect error:", error);

      alert(

        error instanceof Error

          ? error.message

          : "ไม่สามารถเปิดข้อมูลลงเวลาของหน่วยงานที่เลือกได้",

      );

    } finally {

      setBusyAttendanceLocationId(null);

    }

  }

  async function openAttendanceHistoryMap(

    item: AttendanceHistoryItem,

  ) {

    setHistoryMapOpen(true);

    setHistoryMapLoading(true);

    setHistoryMapError(null);

    setHistoryMapLocation(null);

    try {

      const record = await timeRecordService.getTimeRecordById(

        item.timeRecordId,

      );

      const locationId =

        record.checkin_location_id ??

        record.checkout_location_id ??

        null;

      if (!locationId) {

        throw new Error("ไม่พบ location_id ของหน่วยงาน");

      }

      const location = await api.get<SiteLocationMapResponse>(

        `/site-locations/${locationId}`,

      );

      setHistoryMapLocation({

        locationId: location.location_id,

        contractCode:

          location.contract_code ??

          item.contractCode ??

          "",

        locationName:

          location.location_name?.trim() ||

          item.locationName,

        locationDetail: location.location_detail ?? null,

        latitude: location.latitude,

        longitude: location.longitude,

        radiusMeter: location.radius_meter ?? null,

        graceMeter: location.grace_meter ?? null,

        updatedAt: location.updated_at ?? null,

      });

    } catch (error) {

      console.error("openAttendanceHistoryMap error:", error);

      setHistoryMapError(

        error instanceof Error

          ? error.message

          : "ไม่สามารถโหลดข้อมูลแผนที่ได้",

      );

    } finally {

      setHistoryMapLoading(false);

    }

  }

  async function openAttendanceHistoryItem(

    item: AttendanceHistoryItem,

  ) {

    try {

      const record = await timeRecordService.getTimeRecordById(

        item.timeRecordId,

      );

      const locationId =

        record.checkin_location_id ??

        record.checkout_location_id ??

        null;

      if (!locationId) {

        throw new Error("ไม่พบ location_id ของรายการที่เลือก");

      }

      const matchedLocation = attendanceLocations.find(

        (location) => location.location_id === locationId,

      );

      setSelectedAttendanceLocation({

        locationId,

        contractCode:

          item.contractCode ??

          matchedLocation?.contract_code ??

          null,

        locationName:

          item.locationName ||

          matchedLocation?.location_name ||

          `หน่วยงาน ${locationId}`,

        hasOpenRecord: item.status === "in_progress",

        openTimeRecordId:

          item.status === "in_progress"

            ? item.timeRecordId

            : null,

      });

      setSelectedWorkRecordTimeRecordId(item.timeRecordId);

      setSelectedCheckpoint(null);

      push("workRecordReport");

    } catch (error) {

      console.error("openAttendanceHistoryItem error:", error);

      alert(

        error instanceof Error

          ? error.message

          : "ไม่สามารถเปิดข้อมูลบันทึกรายงานได้",

      );

    }

  }

  async function cancelAttendanceHistoryItem(

    item: AttendanceHistoryItem,

  ) {

    if (!empCode) {

      alert("ไม่พบรหัสพนักงาน กรุณาเข้าสู่ระบบใหม่");

      return;

    }

    try {

      /**

       * ค้นหา work_report ของ time_record ที่เลือก

       * แล้วเปลี่ยนสถานะรายงานเป็น cancelled

       * โดยไม่ลบรายละเอียดที่เคยบันทึก

       */

      const reports = await workReportService.getWorkReports({

        time_record_id: item.timeRecordId,

        include_deleted: false,

        skip: 0,

        limit: 1,

      });

      const report = reports[0];

      if (!report) {

        throw new Error("รายการนี้ยังไม่มีข้อมูลบันทึกรายงานให้ยกเลิก");

      }

      await workReportService.cancelWorkReport(

        report.work_report_id,

        {

          updated_by: empCode,

        },

      );

      /**

       * โหลดประวัติใหม่เพื่อรับ report_status = cancelled

       */

      await loadAttendanceHistory(attendanceHistoryDate);

    } catch (error) {

      console.error("cancelAttendanceHistoryItem error:", error);

      alert(

        error instanceof Error

          ? error.message

          : "ไม่สามารถยกเลิกข้อมูลบันทึกรายงานได้",

      );

      throw error;

    }

  }

  async function goCheckpoint() {

    localStorage.removeItem(APP_CHECK_IN_OUT_MODE_KEY);

    clearAttendanceLocationState();

    setSelectedCheckpoint(null);

    setAttendanceTimeContext(null);

    clearCheckInOutTimeState();

    setPunchType("in");

    push("checkpoint");

  }

  async function goCheckInOut(payload: GoCheckInOutPayload) {

    localStorage.setItem(APP_CHECK_IN_OUT_MODE_KEY, "checkpoint");

    clearAttendanceLocationState();

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

  function goPatrolAreaInfo() {

    push("patrolAreaInfo");

  }

  function goAttendanceFaceVerify(

    type: PunchType,

    payload?: {

      workDate?: string | null;

    },

  ) {

    if (!selectedAttendanceLocation) {

      alert("ไม่พบหน่วยงานที่เลือก กรุณากลับไปเลือกหน่วยงานใหม่");

      return;

    }

    /**

     * Attendance ปกติ:

     * - ล้าง selectedCheckpoint

     * - ไม่มี assignment_id

     * - ไม่ส่ง shift_id

     * - ใช้ location_id จากหน่วยงานที่เลือก

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

    const attendanceLocation = selectedAttendanceLocation;

    if (!attendanceLocation) {

      throw new Error("ไม่พบหน่วยงานที่เลือก กรุณากลับไปเลือกหน่วยงานใหม่");

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

      if (type === "in") {

        /**

         * Attendance ปกติ:

         * - ไม่มี assignment_id

         * - ไม่ส่ง shift_id

         * - ส่ง checkin_location_id ของหน่วยงานที่ผู้ใช้เลือก

         */

        const createPayload = {

          employee_code: empCode,

          work_date: workDate,

          checkin_location_id: attendanceLocation.locationId,

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

          checkin_location_id: number;

          current_latitude: number;

          current_longitude: number;

          gps_accuracy: number | null;

        };

        const created = await timeRecordService.createTimeRecord(createPayload);

        /**

         * Check-in สำเร็จแล้ว ให้สร้าง work_report ทันที

         * เพื่อให้ Backend สร้าง document_no ตั้งแต่เริ่มเข้างาน

         *

         * ใช้ ensure เพื่อป้องกันการสร้าง work_report ซ้ำ

         * หาก time_record_id นี้มี work_report อยู่แล้ว

         */

        let workReportDocumentNo: string | null = null;

        try {

          const ensuredWorkReport =

            await workReportService.ensureWorkReportByTimeRecordId(

              created.time_record_id,

            );

          workReportDocumentNo = ensuredWorkReport.document_no ?? null;

        } catch (workReportError) {

          /**

           * time_record ถูกสร้างสำเร็จแล้ว

           * จึงไม่ throw กลับไปให้ Check-in ดูเหมือนล้มเหลว

           * เพื่อป้องกันผู้ใช้กด Check-in ซ้ำ

           */

          console.error(

            "ensureWorkReportByTimeRecordId after check-in error:",

            workReportError,

          );

        }

        setOpenTimeRecord(created);

        setLastInAt(created.checkin ?? null);

        setLastOutAt(created.checkout ?? null);

        updateAttendanceLocationOpenRecord(

          attendanceLocation.locationId,

          created.time_record_id,

        );

        setSelectedWorkRecordTimeRecordId(created.time_record_id);

        setAttendanceHistoryItems((currentItems) => {

          const nextItem: AttendanceHistoryItem = {

            timeRecordId: created.time_record_id,

            documentNo: workReportDocumentNo,

            contractCode: attendanceLocation.contractCode,

            locationName: attendanceLocation.locationName,

            checkin: created.checkin ?? null,

            checkout: created.checkout ?? null,

            status: "in_progress",

          };

          return [

            nextItem,

            ...currentItems.filter(

              (item) => item.timeRecordId !== created.time_record_id,

            ),

          ];

        });

      } else {

        if (!attendanceLocation.openTimeRecordId) {

          throw new Error("ไม่พบข้อมูลการเข้างานเพื่อทำการออกงาน");

        }

        /**

         * Attendance ปกติ:

         * - ไม่มี assignment_id

         * - ไม่ส่ง shift_id

         * - ส่ง checkout_location_id ของหน่วยงานที่ผู้ใช้เลือก

         * - ส่ง current_latitude/current_longitude ให้ Backend ตรวจพิกัด

         */

        const updatePayload = {

          checkout_location_id: attendanceLocation.locationId,

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

          checkout_location_id: number;

          current_latitude: number;

          current_longitude: number;

          gps_accuracy: number | null;

        };

        const updated = await timeRecordService.updateTimeRecord(

          attendanceLocation.openTimeRecordId,

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

        updateAttendanceLocationOpenRecord(

          attendanceLocation.locationId,

          null,

        );

        setSelectedWorkRecordTimeRecordId(updated.time_record_id);

        setAttendanceHistoryItems((currentItems) =>

          currentItems.map((item) =>

            item.timeRecordId === updated.time_record_id

              ? {

                  ...item,

                  checkin: updated.checkin ?? item.checkin ?? null,

                  checkout: updated.checkout ?? null,

                  status: "completed",

                }

              : item,

          ),

        );

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

    clearAttendanceLocationState();

    setPunchType("in");

    reset("home");

  }

  async function goCheckInOutFromFaceVerify() {

    /**

     * Attendance ปกติ:

     * หลังลงเวลาเข้าสำเร็จและกด "ตกลง" ใน SuccessModal

     * ให้กลับหน้าเลือกหน่วยงานทันที

     *

     * work_report ถูก ensure ไว้แล้วตั้งแต่ Check-in สำเร็จ

     * เพื่อให้ document_no ถูกสร้างตั้งแต่เริ่มเข้างาน

     */

    if (!selectedCheckpoint && punchType === "in") {

      setPunchType("in");

      reset("locationSelect");

      return;

    }

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

          onGoOrganizationInfo={goPatrolAreaInfo}

          onGoPatrolReport={goPatrolReport}

          onGoLeaveShifts={goShifts}

          onGoFaceProfiles={goFaceProfiles}

        />

      )}

      {route === "locationSelect" && (

        <LocationSelect

          empCode={empCode}

          displayName={displayName}

          locations={attendanceLocations.map((location) => ({

            locationId: location.location_id,

            contractCode: location.contract_code ?? null,

            locationName: location.location_name,

            hasOpenRecord: location.has_open_record,

          }))}

          busyLocationId={busyAttendanceLocationId}

          historyDate={attendanceHistoryDate}

          historyItems={attendanceHistoryItems}

          onHistoryDateChange={setAttendanceHistoryDate}

          onSelectLocation={(selection) => {

            void handleAttendanceLocationSelect(selection);

          }}

          onOpenHistory={(item) => {

            void openAttendanceHistoryMap(item);

          }}

          onEditHistory={(item) => {

            void openAttendanceHistoryItem(item);

          }}

          onDeleteHistory={(item) => {

            void cancelAttendanceHistoryItem(item);

          }}

          onBack={() => {

            clearAttendanceLocationState();

            back();

          }}

        />

      )}

      {route === "workRecordReport" &&

        selectedWorkRecordTimeRecordId !== null && (

          <WorkRecordReport

            empCode={empCode}

            displayName={displayName}

            unitCode={selectedAttendanceLocation?.contractCode ?? null}

            unitName={selectedAttendanceLocation?.locationName ?? null}

            routeLabel={null}

            employeePosition={authEmployee?.position_name ?? null}

            timeRecordId={selectedWorkRecordTimeRecordId}

            isCheckoutFlow={false}

            onBack={() => {

              void loadAttendanceHistory(attendanceHistoryDate);

              setSelectedWorkRecordTimeRecordId(null);

              back();

            }}

          />

        )}

      {route === "patrolAreaInfo" && (

        <PatrolAreaInfoPage

          empCode={empCode}

          displayName={displayName}

          onOutsidePlanCheckInOut={() => {

            void goDirectCheckInOut();

          }}

          onBack={back}

        />

      )}

      {route === "checkpoint" && (

        <Checkpoint

          empCode={empCode}

          displayName={displayName}

          regionLabel={patrolArea.fieldName || null}

          districtLabel={patrolArea.divisionName || null}

          routeLabel={patrolArea.routeName || null}

          restoreDivisionId={checkpointAreaSelection?.divisionId ?? null}

          restoreRouteId={checkpointAreaSelection?.routeId ?? null}

          onPatrolAreaChange={(divisionId, routeId) => {

            setCheckpointAreaSelection({

              divisionId,

              routeId,

            });

          }}

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

          unitName={

            selectedCheckpoint?.unitName ??

            selectedAttendanceLocation?.locationName ??

            null

          }

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

      <PatrolAreaInfoModal

        open={historyMapOpen}

        location={historyMapLocation}

        loading={historyMapLoading}

        errorMessage={historyMapError}

        onClose={() => {

          setHistoryMapOpen(false);

          setHistoryMapLocation(null);

          setHistoryMapError(null);

        }}

      />

      </>

  );

}
