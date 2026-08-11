import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  Check,
  ChevronRight,
  ChevronUp,
  FileSearch,
  Hourglass,
  Info,
  PhoneCall,
  RefreshCcw,
  Search,
  UserRoundPen,
} from "lucide-react";
import { BsCalendar2Check, BsFileEarmarkPdf } from "react-icons/bs";

import BackButton from "@/components/BackButton";
import { useStore } from "@/store/store";
import {
  getPatrolReport,
  getPatrolReportFilterOptions,
  type PatrolReportFilterOptions,
  type PatrolReportRow,
  type PatrolStatus,
} from "@/services/patrolReportApi";

import ReportTimePhotoCell from "@/components/ReportTimePhotoCell";
import ReportImagePreviewModal, {
  type PreviewImageState,
} from "@/components/ReportImagePreviewModal";
import PdfExportErrorModal from "@/components/PdfExportErrorModal";
import {
  createPatrolReportExportJob,
  downloadPatrolReportExportFile,
  getPatrolReportExportJob,
  type PatrolReportExportJobResponse,
} from "@/services/patrolReportExportApi";

import styles from "./PatrolReport.module.css";

type ShiftValue = "all" | "day" | "night";
type ReportPlanMode = "planned" | "outside_plan";
type ReportPlanModeSelection = Record<ReportPlanMode, boolean>;

type PatrolNotificationLevel = "none" | "green" | "yellow" | "orange" | "red";

type ReportDisplayStatus = PatrolStatus | "completed_call";
type StatusFilterValue = "all" | ReportDisplayStatus | "pending_reserved";
type DatePickerField = "start" | "end";

type PatrolReportPageProps = {
  onBack: () => void;
};

type FetchPatrolReportOptions = {
  startDate: string;
  endDate: string;
  shiftValue: ShiftValue;
  planModes: ReportPlanMode[];
  searchText: string;
  departmentIdText: string;
  divisionIdText: string;
  routeIdText: string;
  locationIdText: string;
  employeeCodeText: string;
};

type ExtraPatrolReportFilterParams = {
  workdayStart?: string;
  planModes?: ReportPlanMode[];
  plan_modes?: ReportPlanMode[];
  workdayEnd?: string;
  startDate?: string;
  endDate?: string;
  shiftId?: number;
  departmentId?: number;
  divisionId?: number;
  routeId?: number;
  locationId?: number;
  employeeCode?: string;
};

type PatrolReportDisplayRow = PatrolReportRow & {
  reportPlanMode: ReportPlanMode;

  assignmentStatus?: PatrolStatus | null;
  assignment_status?: PatrolStatus | null;

  checkInDateTime?: string | null;
  check_in_date_time?: string | null;
  check_in_datetime?: string | null;

  checkOutDateTime?: string | null;
  check_out_date_time?: string | null;
  check_out_datetime?: string | null;

  checkInImageUrl?: string | null;
  check_in_image_url?: string | null;
  checkinImageUrl?: string | null;
  checkin_image_url?: string | null;
  checkInPicture?: string | null;
  check_in_picture?: string | null;
  firstInPicture?: string | null;
  first_in_picture?: string | null;

  checkOutImageUrl?: string | null;
  check_out_image_url?: string | null;
  checkoutImageUrl?: string | null;
  checkout_image_url?: string | null;
  checkOutPicture?: string | null;
  check_out_picture?: string | null;
  lastOutPicture?: string | null;
  last_out_picture?: string | null;

  imagesCheckin1?: string | null;
  images_checkin_1?: string | null;
  imagesCheckin2?: string | null;
  images_checkin_2?: string | null;
  imagesCheckout1?: string | null;
  images_checkout_1?: string | null;
  imagesCheckout2?: string | null;
  images_checkout_2?: string | null;

  departmentId?: number | string | null;
  department_id?: number | string | null;

  divisionId?: number | string | null;
  division_id?: number | string | null;

  routeId?: number | string | null;
  route_id?: number | string | null;

  locationId?: number | string | null;
  location_id?: number | string | null;

  effectiveFrom?: string | null;
  effective_from?: string | null;

  byContract?: number | string | null;
  by_contract?: number | string | null;

  lastInspectionDate?: string | null;
  last_inspection_date?: string | null;

  daysWithoutInspection?: number | string | null;
  days_without_inspection?: number | string | null;

  notificationLevel?: PatrolNotificationLevel | null;
  notification_level?: PatrolNotificationLevel | null;

  notificationText?: string | null;
  notification_text?: string | null;

  scheduleText?: string | null;
  schedule_text?: string | null;

  contactDetail?: string | null;
  contact_detail?: string | null;

  callStatus?: number | string | null;
  call_status?: number | string | null;

  callNote?: string | null;
  call_note?: string | null;

  employeeCode?: string | null;
  employee_code?: string | null;

  positionName?: string | null;
  position_name?: string | null;

  operatorName?: string | null;
  operator_name?: string | null;

  /**
   * ข้อมูลการจองของ checkpoint_assignment
   * การจองไม่เปลี่ยน assignment_status ซึ่งยังคงเป็น pending
   */
  reservedBy?: string | null;
  reserved_by?: string | null;

  reservedByName?: string | null;
  reserved_by_name?: string | null;

  reservedAt?: string | null;
  reserved_at?: string | null;
};

type CalendarCell = {
  date: Date;
  isCurrentMonth: boolean;
};

type EmptyReportStateProps = {
  title?: string;
  hint?: string;
};

type EmptyReportReason = "need_filter" | "no_data" | "error";

type ApiErrorLike = {
  message?: string;
  detail?: unknown;
  data?: {
    detail?: unknown;
  };
  response?: {
    status?: number;
    data?: {
      detail?: unknown;
    };
  };
};

const EMPTY_FILTER_OPTIONS: PatrolReportFilterOptions = {
  departments: [],
  divisions: [],
  routes: [],
  locations: [],
  employees: [],
};

const THAI_DATE_LOCALE = "th-TH-u-ca-buddhist";
const THAI_WEEKDAY_LOCALE = "th-TH";

type IntlDateTimePartType =
  "weekday" | "day" | "month" | "year" | "hour" | "minute";

const thaiShortDatePartsFormatter = new Intl.DateTimeFormat(THAI_DATE_LOCALE, {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const thaiLongDatePartsFormatter = new Intl.DateTimeFormat(THAI_DATE_LOCALE, {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const thaiMonthYearPartsFormatter = new Intl.DateTimeFormat(THAI_DATE_LOCALE, {
  month: "long",
  year: "numeric",
});

const thaiDateTimePartsFormatter = new Intl.DateTimeFormat(THAI_DATE_LOCALE, {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const thaiWeekdayShortFormatter = new Intl.DateTimeFormat(THAI_WEEKDAY_LOCALE, {
  weekday: "short",
});

function getIntlPart(
  formatter: Intl.DateTimeFormat,
  date: Date,
  type: IntlDateTimePartType,
) {
  return (
    formatter.formatToParts(date).find((part) => part.type === type)?.value ??
    ""
  );
}

function normalizeThaiWeekdayShort(value: string) {
  return value.replace(/\.$/, "");
}

function normalizeHourPart(value: string) {
  const hour = value.padStart(2, "0");

  return hour === "24" ? "00" : hour;
}

function getThaiWeekdaysShort() {
  const startDate = new Date();

  startDate.setHours(12, 0, 0, 0);
  startDate.setDate(startDate.getDate() - startDate.getDay());

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(startDate);

    date.setDate(startDate.getDate() + index);

    return normalizeThaiWeekdayShort(thaiWeekdayShortFormatter.format(date));
  });
}

const THAI_WEEKDAYS = getThaiWeekdaysShort();

function getTodayYYYYMMDD() {
  const today = new Date();

  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseYYYYMMDD(value: string) {
  if (!value) return undefined;

  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if (!year || !month || !day) return undefined;

  return new Date(year, month - 1, day);
}

function formatDateToYYYYMMDD(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDateThaiShort(value: string) {
  const date = parseYYYYMMDD(value);

  if (!date) return "เลือกวันที่";

  const day = getIntlPart(thaiShortDatePartsFormatter, date, "day");
  const month = getIntlPart(thaiShortDatePartsFormatter, date, "month");
  const year = getIntlPart(thaiShortDatePartsFormatter, date, "year");

  return `${day} ${month} ${year}`;
}

function formatDateThaiLong(value: string) {
  const date = parseYYYYMMDD(value);

  if (!date) return "-";

  const weekday = getIntlPart(thaiLongDatePartsFormatter, date, "weekday");
  const day = getIntlPart(thaiLongDatePartsFormatter, date, "day");
  const month = getIntlPart(thaiLongDatePartsFormatter, date, "month");
  const year = getIntlPart(thaiLongDatePartsFormatter, date, "year");

  return `${weekday}ที่ ${day} ${month} ${year}`;
}

function formatReportDateText(value: string | null | undefined) {
  if (!value) return "-";

  const text = String(value).trim();

  if (!text) return "-";

  const isoDateText = text.slice(0, 10);

  if (/^\d{4}-\d{2}-\d{2}$/.test(isoDateText)) {
    return formatDateThaiLong(isoDateText);
  }

  // แปลงปี ค.ศ. ในข้อความวันที่ไทย เช่น
  // "วันพฤหัสบดีที่ 11 มิถุนายน 2026" -> "วันพฤหัสบดีที่ 11 มิถุนายน 2569"
  return text.replace(/\b(19\d{2}|20\d{2})\b/g, (yearText) => {
    const yearValue = Number(yearText);

    if (!Number.isFinite(yearValue)) {
      return yearText;
    }

    return String(yearValue + 543);
  });
}

function parseApiDateTime(value: string | null | undefined) {
  if (!value) return null;

  const text = String(value).trim();

  if (!text) return null;

  const match = text.match(
    /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?/,
  );

  if (!match) return null;

  const [, yearText, monthText, dayText, hourText, minuteText, secondText] =
    match;

  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText ?? "0");

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    !Number.isFinite(hour) ||
    !Number.isFinite(minute) ||
    !Number.isFinite(second)
  ) {
    return null;
  }

  return new Date(year, month - 1, day, hour, minute, second);
}

function formatDateTimeThaiShort(value: string | null | undefined) {
  const date = parseApiDateTime(value);

  if (!date || Number.isNaN(date.getTime())) {
    return "-";
  }

  const day = getIntlPart(thaiDateTimePartsFormatter, date, "day");
  const month = getIntlPart(thaiDateTimePartsFormatter, date, "month");
  const year = getIntlPart(thaiDateTimePartsFormatter, date, "year");
  const hour = normalizeHourPart(
    getIntlPart(thaiDateTimePartsFormatter, date, "hour"),
  );
  const minute = getIntlPart(
    thaiDateTimePartsFormatter,
    date,
    "minute",
  ).padStart(2, "0");

  return `${day} ${month} ${year} ${hour}:${minute}`;
}

function getCalendarTitle(date: Date) {
  const month = getIntlPart(thaiMonthYearPartsFormatter, date, "month");
  const year = getIntlPart(thaiMonthYearPartsFormatter, date, "year");

  return `${month} ${year}`;
}

function getCalendarCells(monthDate: Date): CalendarCell[] {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();

  const firstDate = new Date(year, month, 1);
  const firstDayIndex = firstDate.getDay();

  const currentMonthDays = new Date(year, month + 1, 0).getDate();
  const previousMonthDays = new Date(year, month, 0).getDate();

  return Array.from({ length: 42 }, (_, index) => {
    const dayNumber = index - firstDayIndex + 1;

    if (dayNumber <= 0) {
      return {
        date: new Date(year, month - 1, previousMonthDays + dayNumber),
        isCurrentMonth: false,
      };
    }

    if (dayNumber > currentMonthDays) {
      return {
        date: new Date(year, month + 1, dayNumber - currentMonthDays),
        isCurrentMonth: false,
      };
    }

    return {
      date: new Date(year, month, dayNumber),
      isCurrentMonth: true,
    };
  });
}

function toPositiveNumber(value: string) {
  const text = value.trim();

  if (!text) return undefined;

  const numberValue = Number(text);

  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    return undefined;
  }

  return numberValue;
}

function getApiErrorStatus(error: unknown) {
  const errorLike = error as ApiErrorLike;

  return errorLike?.response?.status;
}

function stringifyErrorDetail(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => stringifyErrorDetail(item)).join(" ");
  }

  if (typeof value === "object") {
    const detailObject = value as {
      detail?: unknown;
      message?: unknown;
      error?: unknown;
      msg?: unknown;
    };

    return (
      stringifyErrorDetail(detailObject.detail) ||
      stringifyErrorDetail(detailObject.message) ||
      stringifyErrorDetail(detailObject.error) ||
      stringifyErrorDetail(detailObject.msg)
    );
  }

  return String(value);
}

function getApiErrorDetail(error: unknown) {
  const errorLike = error as ApiErrorLike;

  return (
    stringifyErrorDetail(errorLike?.response?.data?.detail) ||
    stringifyErrorDetail(errorLike?.data?.detail) ||
    stringifyErrorDetail(errorLike?.detail) ||
    stringifyErrorDetail(errorLike?.message)
  );
}

function isNeedFilterApiError(error: unknown) {
  const status = getApiErrorStatus(error);
  const detail = getApiErrorDetail(error);

  return (
    status === 400 &&
    (detail.includes("กรุณาเลือก ภาค") ||
      detail.includes("เลือก ภาค และ เขต") ||
      detail.includes("ก่อนค้นหา"))
  );
}

function getEmptyStateText(
  reason: EmptyReportReason,
  errorMessage: string | null,
) {
  if (reason === "need_filter") {
    return {
      title: "โปรดเลือก ภาค เขต",
      hint: "เลือก ภาค และ เขต แล้วกดค้นหา",
    };
  }

  if (reason === "error") {
    return {
      title: errorMessage || "ไม่สามารถโหลดข้อมูลได้",
      hint: "กรุณาลองค้นหาอีกครั้ง",
    };
  }

  return {
    title: "ไม่พบข้อมูลรายงานสายตรวจ",
    hint: "กรุณาตรวจสอบเงื่อนไขการค้นหาอีกครั้ง",
  };
}

function makeReactKey(...values: Array<string | number | null | undefined>) {
  return values.map((value) => String(value ?? "")).join("-");
}

const SHIFT_ID_BY_VALUE: Record<Exclude<ShiftValue, "all">, number> = {
  day: 1,
  night: 2,
};

const DEFAULT_SHIFT_VALUE: ShiftValue = "all";
const DEFAULT_PLAN_MODES: ReportPlanModeSelection = {
  planned: true,
  outside_plan: false,
};
const DEFAULT_STATUS_VALUE: StatusFilterValue = "all";
const DEFAULT_SEARCH_TEXT = "";

const DEFAULT_DEPARTMENT_ID_TEXT = "";
const DEFAULT_DIVISION_ID_TEXT = "";
const DEFAULT_ROUTE_ID_TEXT = "";
const DEFAULT_LOCATION_ID_TEXT = "";
const DEFAULT_EMPLOYEE_CODE_TEXT = "";

const HIDE_CONTRACT_COLUMNS = true;

function getReportStatusSortOrder(status: ReportDisplayStatus) {
  if (status === "completed_call") {
    return 2;
  }

  return 1;
}

function getStatusLabel(status: ReportDisplayStatus) {
  switch (status) {
    case "completed":
      return "ตรวจแล้ว";
    case "completed_call":
      return "ตรวจแล้ว(โทร)";
    case "in_progress":
      return "อยู่ระหว่างการเข้าตรวจ";
    case "pending":
      return "รอดำเนินการเข้าตรวจ";
    default:
      return "-";
  }
}

function getStatusClass(
  row: PatrolReportDisplayRow,
  status: ReportDisplayStatus,
) {
  if (row.reportPlanMode === "outside_plan" && status === "completed") {
    return styles.statusFinished;
  }

  switch (status) {
    case "completed":
      return styles.statusCompleted;
    case "completed_call":
      return styles.statusCompletedCall;
    case "in_progress":
      return styles.statusInProgress;
    case "pending":
      return styles.statusPending;
    default:
      return "";
  }
}

function getAssignmentStatus(row: PatrolReportDisplayRow): PatrolStatus {
  return row.assignmentStatus ?? row.assignment_status ?? row.status;
}

function getCallStatus(row: PatrolReportDisplayRow) {
  const value = row.callStatus ?? row.call_status ?? null;

  if (value === null || value === undefined) {
    return null;
  }

  const text = String(value).trim();

  if (!text) {
    return null;
  }

  const numberValue = Number(text);

  return Number.isFinite(numberValue) ? numberValue : null;
}

function getDisplayStatus(row: PatrolReportDisplayRow): ReportDisplayStatus {
  const callStatus = getCallStatus(row);

  if (callStatus !== null) {
    return "completed_call";
  }

  return getAssignmentStatus(row);
}

function getReportStatusLabel(
  row: PatrolReportDisplayRow,
  status: ReportDisplayStatus,
) {
  if (row.reportPlanMode === "outside_plan" && status === "completed") {
    return "เรียบร้อย(ติดตาม/มอบหมาย)";
  }

  return getStatusLabel(status);
}

function getEffectiveFromText(row: PatrolReportDisplayRow) {
  const value = row.effectiveFrom ?? row.effective_from ?? null;

  if (!value) {
    return "-";
  }

  const text = String(value).trim();

  if (!text) {
    return "-";
  }

  const dateText = text.slice(0, 10);

  if (/^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
    return formatDateThaiShort(dateText);
  }

  return text;
}

function getNotificationLevel(
  row: PatrolReportDisplayRow,
): PatrolNotificationLevel {
  const value = row.notificationLevel ?? row.notification_level ?? "none";

  if (
    value === "green" ||
    value === "yellow" ||
    value === "orange" ||
    value === "red" ||
    value === "none"
  ) {
    return value;
  }

  return "none";
}

function getNotificationText(row: PatrolReportDisplayRow) {
  const text = row.notificationText ?? row.notification_text ?? null;

  if (!text) {
    return "-";
  }

  const textValue = String(text).trim();

  return textValue || "-";
}

function getScheduleText(row: PatrolReportDisplayRow) {
  const scheduleText = row.scheduleText ?? row.schedule_text ?? null;

  if (scheduleText !== null && scheduleText !== undefined) {
    const textValue = String(scheduleText).trim();

    if (textValue) {
      return textValue;
    }
  }

  const byContract = row.byContract ?? row.by_contract ?? null;

  if (byContract === null || byContract === undefined) {
    return "-";
  }

  const textValue = String(byContract).trim();

  if (!textValue) {
    return "-";
  }

  if (textValue.includes("วัน")) {
    return textValue;
  }

  const numberValue = Number(textValue);

  if (Number.isFinite(numberValue) && numberValue > 0) {
    return `${numberValue} วัน`;
  }

  return textValue;
}

function getNotificationRowClass(row: PatrolReportDisplayRow) {
  const level = getNotificationLevel(row);

  switch (level) {
    case "green":
      return styles.notificationRowGreen;
    case "yellow":
      return styles.notificationRowYellow;
    case "orange":
      return styles.notificationRowOrange;
    case "red":
      return styles.notificationRowRed;
    default:
      return styles.notificationRowNone;
  }
}

function getReservedBy(row: PatrolReportDisplayRow): string | null {
  const value = row.reservedBy ?? row.reserved_by ?? null;

  if (value === null || value === undefined) {
    return null;
  }

  const text = String(value).trim();

  return text || null;
}

function matchesStatusFilter(
  row: PatrolReportDisplayRow,
  statusFilter: StatusFilterValue,
) {
  if (statusFilter === "all") {
    return true;
  }

  const displayStatus = getDisplayStatus(row);
  const reservedBy = getReservedBy(row);

  if (statusFilter === "pending_reserved") {
    return displayStatus === "pending" && reservedBy !== null;
  }

  if (statusFilter === "pending") {
    return displayStatus === "pending" && reservedBy === null;
  }

  return displayStatus === statusFilter;
}

function getEmployeeCode(row: PatrolReportDisplayRow) {
  return row.employeeCode ?? row.employee_code ?? "-";
}

function getPositionName(row: PatrolReportDisplayRow) {
  return row.positionName ?? row.position_name ?? "-";
}

function getContactDetail(row: PatrolReportDisplayRow) {
  return row.contactDetail ?? row.contact_detail ?? "-";
}

function getCallNote(row: PatrolReportDisplayRow) {
  return row.callNote ?? row.call_note ?? "-";
}

function getCheckInDateTimeText(row: PatrolReportDisplayRow) {
  return formatDateTimeThaiShort(
    row.checkInDateTime ??
      row.check_in_date_time ??
      row.check_in_datetime ??
      null,
  );
}

function getCheckInDateTime(row: PatrolReportDisplayRow) {
  return parseApiDateTime(
    row.checkInDateTime ??
      row.check_in_date_time ??
      row.check_in_datetime ??
      null,
  );
}

function getCheckOutDateTimeText(row: PatrolReportDisplayRow) {
  return formatDateTimeThaiShort(
    row.checkOutDateTime ??
      row.check_out_date_time ??
      row.check_out_datetime ??
      null,
  );
}

function getOperatorText(row: PatrolReportDisplayRow) {
  const employeeCode = getEmployeeCode(row);
  const operatorName = row.operatorName ?? row.operator_name ?? null;

  const hasEmployeeCode = employeeCode !== "-";

  if (operatorName) {
    const operatorNameText = String(operatorName).trim();

    if (operatorNameText) {
      // แสดงเป็น "รหัสพนักงาน - ชื่อ นามสกุล"
      // กันกรณี backend ส่งรหัสพนักงานนำหน้ามาแล้ว จะไม่ซ้ำเป็น 540386 - 540386 - ชื่อ
      if (
        hasEmployeeCode &&
        !operatorNameText.startsWith(`${employeeCode} -`) &&
        !operatorNameText.startsWith(`${employeeCode} –`) &&
        operatorNameText !== employeeCode
      ) {
        return `${employeeCode} - ${operatorNameText}`;
      }

      return operatorNameText;
    }
  }

  const positionName = getPositionName(row);
  const hasPositionName = positionName !== "-";

  if (hasEmployeeCode && hasPositionName) {
    return `${employeeCode} - ${positionName}`;
  }

  if (hasEmployeeCode) return employeeCode;
  if (hasPositionName) return positionName;

  return "-";
}

function getContractCodeText(contractCode: string | null | undefined) {
  if (!contractCode) return "-";

  const value = String(contractCode).trim();

  return value.replace(/^([^\d]+)(\d+)$/, "$1 $2");
}

function getReportCountText(count: number) {
  if (count <= 0) return "แสดง 0 รายการ";
  return `แสดง 1 - ${count} จาก ${count} รายการ`;
}

function getDepartmentOptionLabel(
  departmentName: string,
  departmentId: number,
) {
  const name = departmentName.trim();

  if (!name) {
    return `ภาค ${departmentId}`;
  }

  // แสดงเฉพาะชื่อ ไม่แสดงเลข id นำหน้า
  return name;
}

function getDivisionOptionLabel(divisionName: string, divisionId: number) {
  const name = divisionName.trim();

  if (!name) {
    return `เขต ${divisionId}`;
  }

  // แสดงเฉพาะชื่อ ไม่แสดงเลข id นำหน้า
  return name;
}

function getRouteOptionLabel(routeName: string, routeId: number) {
  const name = routeName.trim();

  if (!name) {
    return `เส้นทาง ${routeId}`;
  }

  // แสดงเฉพาะชื่อ ไม่แสดงเลข id นำหน้า
  return name;
}

function getLocationOptionLabel(
  contractCode: string,
  locationName: string,
  locationId: number,
) {
  const contractText = getContractCodeText(contractCode);
  const locationText = locationName.trim();

  // แสดงเฉพาะชื่อหน่วยงาน ไม่แสดงเลข id นำหน้า
  if (locationText) {
    return locationText;
  }

  // ถ้าไม่มีชื่อหน่วยงานจริง ๆ ค่อยแสดงรหัสสัญญาแทน
  if (contractText !== "-") {
    return contractText;
  }

  return `หน่วยงาน ${locationId}`;
}

function getEmployeeOptionLabel(
  employeeCode: string,
  employeeName: string | null,
  positionName: string | null,
) {
  const employeeNameText = employeeName?.trim();
  const positionNameText = positionName?.trim();

  // แสดงเฉพาะชื่อ/ตำแหน่ง ไม่แสดงรหัสพนักงานนำหน้า
  if (employeeNameText && positionNameText) {
    return `${employeeNameText} (${positionNameText})`;
  }

  if (employeeNameText) {
    return employeeNameText;
  }

  if (positionNameText) {
    return positionNameText;
  }

  return employeeCode;
}

function getApiOriginForImage() {
  const apiBaseUrl = String(import.meta.env.VITE_API_BASE_URL ?? "").trim();

  if (!apiBaseUrl) {
    return "";
  }

  return apiBaseUrl.replace(/\/api(?:\/v\d+)?\/?$/i, "").replace(/\/$/, "");
}

function resolveReportImageUrl(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const imageText = String(value).trim();

  if (!imageText || imageText === "-" || imageText.toUpperCase() === "NULL") {
    return null;
  }

  // รองรับรูปแบบที่เก็บใน DB เป็น data:image/jpeg;base64,...
  // ใช้กับ <img src="..."> ได้โดยตรง ไม่ต้อง decode ก่อน
  if (/^data:image\/[a-zA-Z0-9.+-]+;base64,/i.test(imageText)) {
    return imageText;
  }

  if (imageText.startsWith("blob:") || /^https?:\/\//i.test(imageText)) {
    return imageText;
  }

  // เผื่ออนาคต/ข้อมูลเก่าบางแถวเก็บเฉพาะ base64 ล้วน ไม่มี prefix
  if (/^(?:[A-Za-z0-9+/]{80,}={0,2})$/.test(imageText)) {
    return `data:image/jpeg;base64,${imageText}`;
  }

  const apiOrigin = getApiOriginForImage();

  if (!apiOrigin) {
    return imageText.startsWith("/") ? imageText : `/${imageText}`;
  }

  return imageText.startsWith("/")
    ? `${apiOrigin}${imageText}`
    : `${apiOrigin}/${imageText}`;
}

function getCheckInImageUrl(row: PatrolReportDisplayRow) {
  return resolveReportImageUrl(
    row.checkInImageUrl ??
      row.check_in_image_url ??
      row.checkinImageUrl ??
      row.checkin_image_url ??
      row.checkInPicture ??
      row.check_in_picture ??
      row.firstInPicture ??
      row.first_in_picture ??
      row.imagesCheckin1 ??
      row.images_checkin_1 ??
      row.imagesCheckin2 ??
      row.images_checkin_2 ??
      null,
  );
}

function getCheckOutImageUrl(row: PatrolReportDisplayRow) {
  return resolveReportImageUrl(
    row.checkOutImageUrl ??
      row.check_out_image_url ??
      row.checkoutImageUrl ??
      row.checkout_image_url ??
      row.checkOutPicture ??
      row.check_out_picture ??
      row.lastOutPicture ??
      row.last_out_picture ??
      row.imagesCheckout1 ??
      row.images_checkout_1 ??
      row.imagesCheckout2 ??
      row.images_checkout_2 ??
      null,
  );
}

function EmptyReportState({
  title = "ไม่พบข้อมูลรายงานสายตรวจ",
  hint = "กรุณาติดต่อผู้ดูแลระบบ",
}: EmptyReportStateProps) {
  return (
    <div className={styles.emptyState}>
      <div className={styles.emptyIconWrap} aria-hidden="true">
        <div className={styles.emptyIconCircle}>
          <FileSearch
            className={styles.emptyClipboardIcon}
            size={64}
            strokeWidth={1.9}
          />
        </div>
      </div>

      <h3 className={styles.emptyTitle}>{title}</h3>
      <div className={styles.emptyDivider} />

      <div className={styles.emptyHint}>
        <Info
          className={styles.emptyHintIcon}
          size={24}
          strokeWidth={2.5}
          aria-hidden="true"
        />
        <span>{hint}</span>
      </div>
    </div>
  );
}

function StatusIcon({
  status,
  isReservedPending,
  reportPlanMode,
}: {
  status: ReportDisplayStatus;
  isReservedPending: boolean;
  reportPlanMode: ReportPlanMode;
}) {
  if (status === "completed_call") {
    return (
      <span className={`${styles.statusIcon} ${styles.iconCompletedCall}`}>
        <PhoneCall size={17} strokeWidth={2.8} />
      </span>
    );
  }

  if (status === "completed") {
    const completedIconClass =
      reportPlanMode === "outside_plan"
        ? styles.iconFinished
        : styles.iconCompleted;

    return (
      <span className={`${styles.statusIcon} ${completedIconClass}`}>
        <Check size={18} strokeWidth={3} />
      </span>
    );
  }

  if (status === "in_progress") {
    return (
      <span className={`${styles.statusIcon} ${styles.iconInProgress}`}>
        <UserRoundPen size={17} strokeWidth={2.8} />
      </span>
    );
  }

  if (status === "pending" && isReservedPending) {
    return (
      <span className={`${styles.statusIcon} ${styles.iconReserved}`}>
        <BsCalendar2Check size={18} aria-hidden="true" />
      </span>
    );
  }

  return (
    <span className={`${styles.statusIcon} ${styles.iconPending}`}>
      <Hourglass size={17} strokeWidth={2.8} />
    </span>
  );
}

export default function PatrolReportPage({ onBack }: PatrolReportPageProps) {
  // รหัสผู้สั่ง Export ต้องเป็นผู้ที่ Login อยู่จริง
  // ไม่ใช้ employeeCodeText เพราะเป็นเพียงตัวกรองรายสายตรวจ
  const requestedBy = useStore(
    (state) => state.authEmployee?.employee_code ?? "",
  );

  const [patrolRows, setPatrolRows] = useState<PatrolReportDisplayRow[]>([]);
  const [filterOptions, setFilterOptions] =
    useState<PatrolReportFilterOptions>(EMPTY_FILTER_OPTIONS);

  const [startDateValue, setStartDateValue] = useState(() =>
    getTodayYYYYMMDD(),
  );
  const [endDateValue, setEndDateValue] = useState(() => getTodayYYYYMMDD());
  const [shiftValue, setShiftValue] = useState<ShiftValue>(DEFAULT_SHIFT_VALUE);
  const [planModes, setPlanModes] = useState<ReportPlanModeSelection>(() => ({
    ...DEFAULT_PLAN_MODES,
  }));
  const [statusValue, setStatusValue] =
    useState<StatusFilterValue>(DEFAULT_STATUS_VALUE);
  const [searchText, setSearchText] = useState(DEFAULT_SEARCH_TEXT);

  const [departmentIdText, setDepartmentIdText] = useState(
    DEFAULT_DEPARTMENT_ID_TEXT,
  );
  const [divisionIdText, setDivisionIdText] = useState(
    DEFAULT_DIVISION_ID_TEXT,
  );
  const [routeIdText, setRouteIdText] = useState(DEFAULT_ROUTE_ID_TEXT);
  const [locationIdText, setLocationIdText] = useState(
    DEFAULT_LOCATION_ID_TEXT,
  );
  const [employeeCodeText, setEmployeeCodeText] = useState(
    DEFAULT_EMPLOYEE_CODE_TEXT,
  );

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [activeDatePicker, setActiveDatePicker] =
    useState<DatePickerField | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    return parseYYYYMMDD(getTodayYYYYMMDD()) ?? new Date();
  });

  const [previewImage, setPreviewImage] = useState<PreviewImageState | null>(
    null,
  );

  const startDatePickerWrapRef = useRef<HTMLDivElement | null>(null);
  const endDatePickerWrapRef = useRef<HTMLDivElement | null>(null);
  const downloadedExportJobIdRef = useRef<number | null>(null);
  const exportPollingInFlightRef = useRef(false);

  const [loading, setLoading] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportJob, setExportJob] =
    useState<PatrolReportExportJobResponse | null>(null);
  const [exportErrorMessage, setExportErrorMessage] = useState<string | null>(
    null,
  );
  const [emptyReason, setEmptyReason] =
    useState<EmptyReportReason>("need_filter");
  const [emptyErrorMessage, setEmptyErrorMessage] = useState<string | null>(
    null,
  );

  const selectedDepartmentId = toPositiveNumber(departmentIdText);
  const selectedDivisionId = toPositiveNumber(divisionIdText);
  const selectedRouteId = toPositiveNumber(routeIdText);
  const todayText = getTodayYYYYMMDD();

  const hasSelectedDepartment = selectedDepartmentId !== undefined;
  const hasSelectedDivision = selectedDivisionId !== undefined;

  const hasRequiredReportScope = hasSelectedDepartment && hasSelectedDivision;

  const handleOpenImagePreview = useCallback(
    (imageUrl: string, title: string) => {
      setPreviewImage({
        url: imageUrl,
        title,
      });
    },
    [],
  );

  const handleCloseExportErrorModal = useCallback(() => {
    setExportErrorMessage(null);
  }, []);

  const handleCloseImagePreview = useCallback(() => {
    setPreviewImage(null);
  }, []);

  const fetchFilterOptions = useCallback(async () => {
    try {
      const options = await getPatrolReportFilterOptions();

      setFilterOptions(options);
    } catch (err) {
      console.error(err);
      setFilterOptions(EMPTY_FILTER_OPTIONS);
      setPatrolRows([]);
      setEmptyReason("error");
      setEmptyErrorMessage("ไม่สามารถโหลดตัวเลือกตัวกรองรายงานได้");
    }
  }, []);

  const fetchPatrolReport = useCallback(
    async ({
      startDate,
      endDate,
      shiftValue,
      planModes,
      searchText,
      departmentIdText,
      divisionIdText,
      routeIdText,
      locationIdText,
      employeeCodeText,
    }: FetchPatrolReportOptions) => {
      setLoading(true);
      setEmptyErrorMessage(null);

      try {
        const requestParams = {
          workday: startDate,
          workdayStart: startDate,
          workdayEnd: endDate,
          startDate,
          endDate,
          status: "all",
          keyword: searchText,
          planModes,
          plan_modes: planModes,
        } as Parameters<typeof getPatrolReport>[0] &
          ExtraPatrolReportFilterParams;

        if (shiftValue !== "all") {
          requestParams.shiftId = SHIFT_ID_BY_VALUE[shiftValue];
        }

        const departmentId = toPositiveNumber(departmentIdText);
        const divisionId = toPositiveNumber(divisionIdText);
        const routeId = toPositiveNumber(routeIdText);
        const locationId = toPositiveNumber(locationIdText);
        const employeeCode = employeeCodeText.trim();

        if (departmentId !== undefined) {
          requestParams.departmentId = departmentId;
        }

        if (divisionId !== undefined) {
          requestParams.divisionId = divisionId;
        }

        if (routeId !== undefined) {
          requestParams.routeId = routeId;
        }

        if (locationId !== undefined) {
          requestParams.locationId = locationId;
        }

        if (employeeCode) {
          requestParams.employeeCode = employeeCode;
        }

        // เรียกข้อมูลแยกทีละโหมดเพื่อระบุประเภทของแต่ละแถว
        // จากนั้นนำมารวมและเรียงตามเวลาเข้าแบบเดียวกับ PDF
        const rowsByMode = await Promise.all(
          planModes.map(async (mode) => {
            const modeRows = await getPatrolReport({
              ...requestParams,
              planModes: [mode],
              plan_modes: [mode],
            });

            return modeRows.map((row) => ({
              ...row,
              reportPlanMode: mode,
            })) as PatrolReportDisplayRow[];
          }),
        );

        setPatrolRows(rowsByMode.flat());
        setExpandedId(null);
        setEmptyReason("no_data");
      } catch (err) {
        console.error(err);
        setPatrolRows([]);

        if (isNeedFilterApiError(err)) {
          setEmptyReason("need_filter");
          setEmptyErrorMessage(null);
        } else {
          setEmptyReason("error");
          setEmptyErrorMessage("ไม่สามารถโหลดข้อมูลรายงานสายตรวจได้");
        }
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void fetchFilterOptions();
  }, [fetchFilterOptions]);

  useEffect(() => {
    if (
      !exportingPdf ||
      !exportJob ||
      (exportJob.jobStatus !== "queued" && exportJob.jobStatus !== "processing")
    ) {
      return;
    }

    let isDisposed = false;

    const pollExportJob = async () => {
      if (exportPollingInFlightRef.current || isDisposed) {
        return;
      }

      exportPollingInFlightRef.current = true;

      try {
        const updatedJob = await getPatrolReportExportJob(
          exportJob.reportExportJobId,
        );

        if (!isDisposed) {
          setExportJob(updatedJob);

          if (
            updatedJob.jobStatus === "failed" ||
            updatedJob.jobStatus === "cancelled" ||
            updatedJob.jobStatus === "expired"
          ) {
            setExportingPdf(false);
            setExportErrorMessage(
              updatedJob.errorMessage ||
                (updatedJob.jobStatus === "cancelled"
                  ? "ยกเลิกการสร้างรายงาน PDF แล้ว"
                  : updatedJob.jobStatus === "expired"
                    ? "ไฟล์รายงานหมดอายุแล้ว กรุณาสร้างใหม่"
                    : "ไม่สามารถสร้างรายงาน PDF ได้"),
            );
          }
        }
      } catch (error) {
        console.error("Poll backend PDF export failed:", error);

        if (!isDisposed) {
          setExportingPdf(false);
          setExportErrorMessage(
            error instanceof Error
              ? error.message
              : "ไม่สามารถตรวจสอบสถานะการสร้าง PDF ได้",
          );
        }
      } finally {
        exportPollingInFlightRef.current = false;
      }
    };

    void pollExportJob();

    const intervalId = window.setInterval(() => {
      void pollExportJob();
    }, 2500);

    return () => {
      isDisposed = true;
      window.clearInterval(intervalId);
    };
  }, [exportingPdf, exportJob]);

  useEffect(() => {
    if (!exportJob || exportJob.jobStatus !== "completed") {
      return;
    }

    if (downloadedExportJobIdRef.current === exportJob.reportExportJobId) {
      return;
    }

    downloadedExportJobIdRef.current = exportJob.reportExportJobId;
    let isDisposed = false;

    const downloadExportFile = async () => {
      try {
        await downloadPatrolReportExportFile(
          exportJob.reportExportJobId,
          exportJob.downloadFilename || "patrol_report.pdf",
        );
      } catch (error) {
        console.error("Download backend PDF export failed:", error);

        if (!isDisposed) {
          setExportErrorMessage(
            error instanceof Error
              ? error.message
              : "สร้างรายงานสำเร็จ แต่ไม่สามารถดาวน์โหลดไฟล์ได้",
          );
        }
      } finally {
        if (!isDisposed) {
          setExportingPdf(false);
        }
      }
    };

    void downloadExportFile();

    return () => {
      isDisposed = true;
    };
  }, [exportJob]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      if (
        startDatePickerWrapRef.current?.contains(target) ||
        endDatePickerWrapRef.current?.contains(target)
      ) {
        return;
      }

      setActiveDatePicker(null);
    };

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveDatePicker(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, []);

  const filteredRows = useMemo(() => {
    const rows = patrolRows.filter((row) =>
      matchesStatusFilter(row, statusValue),
    );

    return rows
      .map((row, originalIndex) => ({
        row,
        originalIndex,
      }))
      .sort((a, b) => {
        const aCheckInDateTime = getCheckInDateTime(a.row);
        const bCheckInDateTime = getCheckInDateTime(b.row);

        if (aCheckInDateTime && bCheckInDateTime) {
          const timeDifference =
            aCheckInDateTime.getTime() - bCheckInDateTime.getTime();

          if (timeDifference !== 0) {
            return timeDifference;
          }
        } else if (aCheckInDateTime) {
          return -1;
        } else if (bCheckInDateTime) {
          return 1;
        }

        const aStatus = getDisplayStatus(a.row);
        const bStatus = getDisplayStatus(b.row);

        const aOrder = getReportStatusSortOrder(aStatus);
        const bOrder = getReportStatusSortOrder(bStatus);

        if (aOrder !== bOrder) {
          return aOrder - bOrder;
        }

        return a.originalIndex - b.originalIndex;
      })
      .map(({ row }) => row);
  }, [patrolRows, statusValue]);

  const calendarCells = useMemo(
    () => getCalendarCells(calendarMonth),
    [calendarMonth],
  );

  const departmentOptions = useMemo(() => {
    return filterOptions.departments;
  }, [filterOptions.departments]);

  const divisionOptions = useMemo(() => {
    if (selectedDepartmentId === undefined) {
      return [];
    }

    return filterOptions.divisions.filter((division) => {
      return division.departmentId === selectedDepartmentId;
    });
  }, [filterOptions.divisions, selectedDepartmentId]);

  const routeOptions = useMemo(() => {
    // ต้องเลือก ภาค + เขต ก่อน จึงค่อยแสดงเส้นทาง
    // ส่วนการเช็ก routes.is_active ต้องให้ backend กรองออกมาก่อน
    if (
      selectedDepartmentId === undefined ||
      selectedDivisionId === undefined
    ) {
      return [];
    }

    return filterOptions.routes.filter((route) => {
      return (
        route.departmentId === selectedDepartmentId &&
        route.divisionId === selectedDivisionId
      );
    });
  }, [filterOptions.routes, selectedDepartmentId, selectedDivisionId]);

  const locationOptions = useMemo(() => {
    // ต้องเลือก ภาค + เขต ก่อน จึงค่อยแสดงรายหน่วยงาน
    if (
      selectedDepartmentId === undefined ||
      selectedDivisionId === undefined
    ) {
      return [];
    }

    return filterOptions.locations.filter((location) => {
      const matchDepartment = location.departmentId === selectedDepartmentId;
      const matchDivision = location.divisionId === selectedDivisionId;
      const matchRoute =
        selectedRouteId === undefined || location.routeId === selectedRouteId;

      return matchDepartment && matchDivision && matchRoute;
    });
  }, [
    filterOptions.locations,
    selectedDepartmentId,
    selectedDivisionId,
    selectedRouteId,
  ]);

  const employeeOptions = useMemo(() => {
    // ป้องกันไม่ให้รายสายตรวจแสดงก่อนเลือก ภาค + เขต
    if (
      selectedDepartmentId === undefined ||
      selectedDivisionId === undefined
    ) {
      return [];
    }

    // ถ้าเลือกเส้นทางแล้ว แต่เส้นทางนั้นไม่มีรายหน่วยงานผูกอยู่
    // ต้องไม่แสดงรายสายตรวจของเส้นทางอื่น
    if (selectedRouteId !== undefined && locationOptions.length === 0) {
      return [];
    }

    return filterOptions.employees;
  }, [
    filterOptions.employees,
    selectedDepartmentId,
    selectedDivisionId,
    selectedRouteId,
    locationOptions.length,
  ]);

  const reportCountText = getReportCountText(filteredRows.length);

  const displayEmptyReason: EmptyReportReason =
    patrolRows.length > 0 && filteredRows.length === 0
      ? "no_data"
      : emptyReason;

  const emptyStateText = useMemo(
    () => getEmptyStateText(displayEmptyReason, emptyErrorMessage),
    [displayEmptyReason, emptyErrorMessage],
  );

  const emptyTitle = emptyStateText.title;
  const emptyHint = emptyStateText.hint;

  const selectedPlanModes = (Object.keys(planModes) as ReportPlanMode[]).filter(
    (mode) => planModes[mode],
  );

  const hasSelectedPlanMode = selectedPlanModes.length > 0;

  const handlePlanModeChange = (value: ReportPlanMode) => {
    const nextPlanModes: ReportPlanModeSelection = {
      ...planModes,
      [value]: !planModes[value],
    };

    setPlanModes(nextPlanModes);

    setPatrolRows([]);
    setExpandedId(null);
    setEmptyReason("need_filter");
    setEmptyErrorMessage(null);
  };

  const handleSearch = () => {
    if (!hasSelectedPlanMode) {
      setPatrolRows([]);
      setExpandedId(null);
      setEmptyReason("error");
      setEmptyErrorMessage("กรุณาเลือกประเภทงานอย่างน้อย 1 รายการ");
      return;
    }

    if (!hasRequiredReportScope) {
      setPatrolRows([]);
      setExpandedId(null);
      setEmptyReason("need_filter");
      setEmptyErrorMessage(null);
      return;
    }

    const startDate = parseYYYYMMDD(startDateValue);
    const endDate = parseYYYYMMDD(endDateValue);

    if (startDate && endDate && startDate > endDate) {
      setPatrolRows([]);
      setExpandedId(null);
      setEmptyReason("error");
      setEmptyErrorMessage("วันที่เริ่มต้นต้องไม่มากกว่าวันที่สิ้นสุด");
      return;
    }

    void fetchPatrolReport({
      startDate: startDateValue,
      endDate: endDateValue,
      shiftValue,
      planModes: selectedPlanModes,
      searchText,
      departmentIdText,
      divisionIdText,
      routeIdText,
      locationIdText,
      employeeCodeText,
    });
  };

  const handleClear = () => {
    const today = getTodayYYYYMMDD();
    const todayDate = parseYYYYMMDD(today) ?? new Date();

    setStartDateValue(today);
    setEndDateValue(today);
    setCalendarMonth(
      new Date(todayDate.getFullYear(), todayDate.getMonth(), 1),
    );
    setShiftValue(DEFAULT_SHIFT_VALUE);
    setPlanModes({ ...DEFAULT_PLAN_MODES });
    setStatusValue(DEFAULT_STATUS_VALUE);
    setSearchText(DEFAULT_SEARCH_TEXT);
    setDepartmentIdText(DEFAULT_DEPARTMENT_ID_TEXT);
    setDivisionIdText(DEFAULT_DIVISION_ID_TEXT);
    setRouteIdText(DEFAULT_ROUTE_ID_TEXT);
    setLocationIdText(DEFAULT_LOCATION_ID_TEXT);
    setEmployeeCodeText(DEFAULT_EMPLOYEE_CODE_TEXT);
    setExpandedId(null);
    setActiveDatePicker(null);
    setPreviewImage(null);

    setPatrolRows([]);
    setEmptyReason("need_filter");
    setEmptyErrorMessage(null);
  };

  const handleOpenDatePicker = (field: DatePickerField) => {
    const selectedDateText = field === "start" ? startDateValue : endDateValue;

    setCalendarMonth(parseYYYYMMDD(selectedDateText) ?? new Date());
    setActiveDatePicker((prev) => (prev === field ? null : field));
  };

  const handleSelectDate = (field: DatePickerField, dateText: string) => {
    const selectedDate = parseYYYYMMDD(dateText);

    if (field === "start") {
      const currentEndDate = parseYYYYMMDD(endDateValue);

      setStartDateValue(dateText);

      if (selectedDate && currentEndDate && selectedDate > currentEndDate) {
        setEndDateValue(dateText);
      }
    } else {
      const currentStartDate = parseYYYYMMDD(startDateValue);

      setEndDateValue(dateText);

      if (selectedDate && currentStartDate && selectedDate < currentStartDate) {
        setStartDateValue(dateText);
      }
    }

    if (selectedDate) {
      setCalendarMonth(
        new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1),
      );
    }

    setActiveDatePicker(null);
    setEmptyErrorMessage(null);
  };

  const handleSelectToday = (field: DatePickerField) => {
    const today = getTodayYYYYMMDD();
    const todayDate = parseYYYYMMDD(today) ?? new Date();

    handleSelectDate(field, today);
    setCalendarMonth(
      new Date(todayDate.getFullYear(), todayDate.getMonth(), 1),
    );
  };

  const renderDatePopover = (field: DatePickerField) => {
    const selectedDateValue = field === "start" ? startDateValue : endDateValue;

    return (
      <div className={styles.datePopover}>
        <div className={styles.calendarBox}>
          <div className={styles.calendarHeader}>
            <button
              type="button"
              className={styles.calendarNavButton}
              onClick={() =>
                setCalendarMonth(
                  (prev) =>
                    new Date(prev.getFullYear(), prev.getMonth() - 1, 1),
                )
              }
              aria-label="เดือนก่อนหน้า"
            >
              ‹
            </button>

            <strong className={styles.calendarTitle}>
              {getCalendarTitle(calendarMonth)}
            </strong>

            <button
              type="button"
              className={styles.calendarNavButton}
              onClick={() =>
                setCalendarMonth(
                  (prev) =>
                    new Date(prev.getFullYear(), prev.getMonth() + 1, 1),
                )
              }
              aria-label="เดือนถัดไป"
            >
              ›
            </button>
          </div>

          <div className={styles.calendarWeekdays}>
            {THAI_WEEKDAYS.map((weekday) => (
              <span key={weekday} className={styles.calendarWeekday}>
                {weekday}
              </span>
            ))}
          </div>

          <div className={styles.calendarGrid}>
            {calendarCells.map((cell) => {
              const cellValue = formatDateToYYYYMMDD(cell.date);
              const isSelected = cellValue === selectedDateValue;
              const isToday = cellValue === todayText;

              return (
                <button
                  key={makeReactKey(field, cellValue)}
                  type="button"
                  className={`${styles.calendarDay} ${
                    !cell.isCurrentMonth ? styles.calendarDayOutside : ""
                  } ${isToday ? styles.calendarDayToday : ""} ${
                    isSelected ? styles.calendarDaySelected : ""
                  }`}
                  onClick={() => handleSelectDate(field, cellValue)}
                >
                  {cell.date.getDate()}
                </button>
              );
            })}
          </div>

          <div className={styles.calendarFooter}>
            <button
              type="button"
              className={styles.calendarTodayButton}
              onClick={() => handleSelectToday(field)}
            >
              วันนี้
            </button>
          </div>
        </div>
      </div>
    );
  };

  const exportButtonText = useMemo(() => {
    if (!exportingPdf) {
      return "ดาวน์โหลด PDF";
    }

    if (!exportJob || exportJob.jobStatus === "queued") {
      return "กำลังเตรียม...";
    }

    if (exportJob.jobStatus === "processing") {
      if (exportJob.progressTotal > 0) {
        return `กำลังสร้าง ${exportJob.progressCurrent}/${exportJob.progressTotal}`;
      }

      return "กำลังสร้าง...";
    }

    if (exportJob.jobStatus === "completed") {
      return "กำลังดาวน์โหลด...";
    }

    return "ดาวน์โหลด PDF";
  }, [exportingPdf, exportJob]);

  const handleExportPdf = async () => {
    if (loading || exportingPdf) {
      return;
    }

    if (!hasSelectedPlanMode) {
      setExportErrorMessage("กรุณาเลือกประเภทงานอย่างน้อย 1 รายการ");
      return;
    }

    if (!hasRequiredReportScope) {
      setExportErrorMessage("กรุณาเลือก ภาค และ เขต ก่อนดาวน์โหลด PDF");
      return;
    }

    if (filteredRows.length === 0) {
      setExportErrorMessage("ไม่มีข้อมูลรายงานสำหรับดาวน์โหลด PDF");
      return;
    }

    const departmentId = toPositiveNumber(departmentIdText);
    const divisionId = toPositiveNumber(divisionIdText);
    const requestedByText = requestedBy.trim();

    if (departmentId === undefined || divisionId === undefined) {
      setExportErrorMessage("กรุณาเลือก ภาค และ เขต ก่อนดาวน์โหลด PDF");
      return;
    }

    if (!requestedByText) {
      setExportErrorMessage(
        "ไม่พบรหัสพนักงานของผู้ใช้งานที่ Login สำหรับสร้างรายงาน PDF",
      );
      return;
    }

    const startDate = parseYYYYMMDD(startDateValue);
    const endDate = parseYYYYMMDD(endDateValue);

    if (startDate && endDate && startDate > endDate) {
      setExportErrorMessage("วันที่เริ่มต้นต้องไม่มากกว่าวันที่สิ้นสุด");
      return;
    }

    setExportingPdf(true);
    setExportErrorMessage(null);
    setExportJob(null);
    downloadedExportJobIdRef.current = null;

    try {
      const createdJob = await createPatrolReportExportJob({
        filters: {
          workdayStart: startDateValue,
          workdayEnd: endDateValue,
          departmentId,
          divisionId,
          routeId: toPositiveNumber(routeIdText),
          locationId: toPositiveNumber(locationIdText),
          employeeCode: employeeCodeText.trim() || undefined,
          planModes: selectedPlanModes,
          shiftType: shiftValue,
          status: statusValue === "pending_reserved" ? "pending" : statusValue,
          keyword: searchText.trim(),
        },
        includeImages: true,
        requestedBy: requestedByText,
      });

      setExportJob(createdJob);
    } catch (error) {
      console.error("Create backend PDF export failed:", error);

      setExportingPdf(false);
      setExportErrorMessage(
        error instanceof Error
          ? error.message
          : "ไม่สามารถส่งคำขอสร้างรายงาน PDF ได้ กรุณาลองใหม่อีกครั้ง",
      );
    }
  };

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.desktopHeaderRow}>
          <div className={styles.titleWrap}>
            <h1 className={styles.title}>รายงานการเข้าตรวจหน่วยงาน</h1>
            <p className={styles.subtitle}>
              ตรวจสอบสถานะการเข้าตรวจ เวลาเข้า-ออก และรายละเอียดการติดต่อ
            </p>
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={onBack}
            >
              กลับ
            </button>
          </div>
        </header>

        <header className={styles.topBar}>
          <h1 className={styles.pageTitle}>รายงานการเข้าตรวจหน่วยงาน</h1>
        </header>

        <section className={styles.filterPanel} aria-label="ตัวกรองรายงาน">
          <h2 className={styles.panelTitle}>ตัวกรองรายงาน</h2>

          <div
            className={styles.planModeGroup}
            role="group"
            aria-label="ประเภทงาน"
          >
            <label className={styles.planModeOption}>
              <input
                className={styles.planModeCheckbox}
                type="checkbox"
                checked={planModes.planned}
                onChange={() => handlePlanModeChange("planned")}
              />
              <span>ตามแผน</span>
            </label>

            <label className={styles.planModeOption}>
              <input
                className={styles.planModeCheckbox}
                type="checkbox"
                checked={planModes.outside_plan}
                onChange={() => handlePlanModeChange("outside_plan")}
              />
              <span>งานอื่น ๆ (ติดตาม / มอบหมาย)</span>
            </label>
          </div>

          <label className={styles.fieldGroup}>
            <span className={styles.fieldLabel}>ภาค</span>
            <select
              value={departmentIdText}
              onChange={(event) => {
                setDepartmentIdText(event.target.value);
                setDivisionIdText(DEFAULT_DIVISION_ID_TEXT);
                setRouteIdText(DEFAULT_ROUTE_ID_TEXT);
                setLocationIdText(DEFAULT_LOCATION_ID_TEXT);
                setEmployeeCodeText(DEFAULT_EMPLOYEE_CODE_TEXT);
                setShiftValue(DEFAULT_SHIFT_VALUE);
                setStatusValue(DEFAULT_STATUS_VALUE);
                setPatrolRows([]);
                setExpandedId(null);
                setEmptyReason("need_filter");
                setEmptyErrorMessage(null);
              }}
              className={styles.select}
            >
              <option value="">โปรดเลือก</option>
              {departmentOptions.map((option, index) => (
                <option
                  key={makeReactKey("department", option.departmentId, index)}
                  value={String(option.departmentId)}
                >
                  {getDepartmentOptionLabel(
                    option.departmentName,
                    option.departmentId,
                  )}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.fieldGroup}>
            <span className={styles.fieldLabel}>เขต</span>
            <select
              value={divisionIdText}
              onChange={(event) => {
                setDivisionIdText(event.target.value);
                setRouteIdText(DEFAULT_ROUTE_ID_TEXT);
                setLocationIdText(DEFAULT_LOCATION_ID_TEXT);
                setEmployeeCodeText(DEFAULT_EMPLOYEE_CODE_TEXT);
                setPatrolRows([]);
                setExpandedId(null);
                setEmptyReason("need_filter");
                setEmptyErrorMessage(null);
              }}
              className={styles.select}
              disabled={!hasSelectedDepartment}
            >
              <option value="">โปรดเลือก</option>
              {divisionOptions.map((option, index) => (
                <option
                  key={makeReactKey("division", option.divisionId, index)}
                  value={String(option.divisionId)}
                >
                  {getDivisionOptionLabel(
                    option.divisionName,
                    option.divisionId,
                  )}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.fieldGroup}>
            <span className={styles.fieldLabel}>เส้นทาง</span>
            <select
              value={routeIdText}
              onChange={(event) => {
                setRouteIdText(event.target.value);
                setLocationIdText(DEFAULT_LOCATION_ID_TEXT);
                setEmployeeCodeText(DEFAULT_EMPLOYEE_CODE_TEXT);
                setPatrolRows([]);
                setExpandedId(null);
                setEmptyReason("need_filter");
                setEmptyErrorMessage(null);
              }}
              className={styles.select}
              disabled={!hasRequiredReportScope}
            >
              <option value="">ทั้งหมด</option>
              {routeOptions.map((option, index) => (
                <option
                  key={makeReactKey("route", option.routeId, index)}
                  value={String(option.routeId)}
                >
                  {getRouteOptionLabel(option.routeName, option.routeId)}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.fieldGroup}>
            <span className={styles.fieldLabel}>รายหน่วยงาน</span>
            <select
              value={locationIdText}
              onChange={(event) => {
                setLocationIdText(event.target.value);
                setEmployeeCodeText(DEFAULT_EMPLOYEE_CODE_TEXT);
                setPatrolRows([]);
                setExpandedId(null);
                setEmptyReason("need_filter");
                setEmptyErrorMessage(null);
              }}
              className={styles.select}
              disabled={!hasRequiredReportScope}
            >
              <option value="">ทั้งหมด</option>
              {locationOptions.map((option, index) => (
                <option
                  key={makeReactKey("location", option.locationId, index)}
                  value={String(option.locationId)}
                >
                  {getLocationOptionLabel(
                    option.contractCode,
                    option.locationName,
                    option.locationId,
                  )}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.fieldGroup}>
            <span className={styles.fieldLabel}>รายสายตรวจ</span>
            <select
              value={employeeCodeText}
              onChange={(event) => {
                setEmployeeCodeText(event.target.value);
                setPatrolRows([]);
                setExpandedId(null);
                setEmptyReason("need_filter");
                setEmptyErrorMessage(null);
              }}
              className={styles.select}
              disabled={!hasRequiredReportScope || employeeOptions.length === 0}
            >
              <option value="">ทั้งหมด</option>
              {employeeOptions.map((option, index) => (
                <option
                  key={makeReactKey("employee", option.employeeCode, index)}
                  value={option.employeeCode}
                >
                  {getEmployeeOptionLabel(
                    option.employeeCode,
                    option.employeeName,
                    option.positionName,
                  )}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.fieldGroup}>
            <span className={styles.fieldLabel}>สถานะ</span>
            <select
              value={statusValue}
              onChange={(event) =>
                setStatusValue(event.target.value as StatusFilterValue)
              }
              className={styles.select}
              disabled={!hasRequiredReportScope}
            >
              <option value="all">ทั้งหมด</option>
              <option value="completed">
                {planModes.planned && planModes.outside_plan
                  ? "ตรวจแล้ว / เรียบร้อย(ติดตาม/มอบหมาย)"
                  : planModes.outside_plan
                    ? "เรียบร้อย(ติดตาม/มอบหมาย)"
                    : "ตรวจแล้ว"}
              </option>
              <option value="completed_call">ตรวจแล้ว(โทร)</option>
              <option value="in_progress">อยู่ระหว่างการเข้าตรวจ</option>
              <option value="pending_reserved">
                รอดำเนินการเข้าตรวจ (มีผู้จองแล้ว)
              </option>
              <option value="pending">รอดำเนินการเข้าตรวจ</option>
            </select>
          </label>

          <div className={styles.fieldGroup} ref={startDatePickerWrapRef}>
            <span className={styles.fieldLabel}>จากวันที่</span>

            <div
              className={`${styles.datePickerWrap} ${styles.startDatePickerWrap}`}
            >
              <button
                type="button"
                className={styles.dateControl}
                onClick={() => handleOpenDatePicker("start")}
                aria-label="เลือกวันที่เริ่มต้น"
              >
                <span className={styles.controlIcon}>
                  <CalendarDays size={14} strokeWidth={2.5} />
                </span>

                <span className={styles.dateDisplay}>
                  {formatDateThaiShort(startDateValue)}
                </span>
              </button>

              {activeDatePicker === "start" && renderDatePopover("start")}
            </div>
          </div>

          <div className={styles.fieldGroup} ref={endDatePickerWrapRef}>
            <span className={styles.fieldLabel}>ถึงวันที่</span>

            <div
              className={`${styles.datePickerWrap} ${styles.endDatePickerWrap}`}
            >
              <button
                type="button"
                className={styles.dateControl}
                onClick={() => handleOpenDatePicker("end")}
                aria-label="เลือกวันที่สิ้นสุด"
              >
                <span className={styles.controlIcon}>
                  <CalendarDays size={14} strokeWidth={2.5} />
                </span>

                <span className={styles.dateDisplay}>
                  {formatDateThaiShort(endDateValue)}
                </span>
              </button>

              {activeDatePicker === "end" && renderDatePopover("end")}
            </div>
          </div>

          <label className={styles.fieldGroup}>
            <span className={styles.fieldLabel}>ผลัด</span>
            <select
              value={shiftValue}
              onChange={(event) =>
                setShiftValue(event.target.value as ShiftValue)
              }
              className={styles.select}
              disabled={!hasRequiredReportScope}
            >
              <option value="all">ทั้งหมด</option>
              <option value="day">ผลัดกลางวัน</option>
              <option value="night">ผลัดกลางคืน</option>
            </select>
          </label>

          <label className={`${styles.fieldGroup} ${styles.keywordGroup}`}>
            <span className={styles.fieldLabel}>
              ค้นหารหัสสัญญา / จุดรักษาการณ์
            </span>
            <div className={styles.control}>
              <input
                value={searchText}
                onChange={(event) => {
                  setSearchText(event.target.value);
                  setPatrolRows([]);
                  setExpandedId(null);
                  setEmptyReason("need_filter");
                  setEmptyErrorMessage(null);
                }}
                placeholder="ค้นหารหัสสัญญา / จุดรักษาการณ์..."
                className={styles.input}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    handleSearch();
                  }
                }}
              />

              <span className={styles.searchIcon}>
                <Search size={13} strokeWidth={2.5} />
              </span>
            </div>
          </label>

          <div className={styles.filterActions}>
            <button
              type="button"
              className={styles.searchButton}
              onClick={handleSearch}
              disabled={loading || !hasRequiredReportScope}
            >
              <Search size={15} strokeWidth={2.6} />
              <span>{loading ? "กำลังค้นหา..." : "ค้นหา"}</span>
            </button>

            <button
              type="button"
              className={styles.clearButton}
              onClick={handleClear}
              disabled={loading}
            >
              <RefreshCcw size={15} strokeWidth={2.6} />
              <span>ล้างค่า</span>
            </button>
          </div>
        </section>

        <section className={styles.desktopSection} aria-label="รายการรายงาน">
          <div className={styles.reportCard}>
            <div className={styles.reportCardHeader}>
              <h2 className={styles.sectionTitle}>รายการรายงาน</h2>

              <button
                type="button"
                className={`${styles.exportPdfButton} ${styles.reportExportPdfButton}`}
                onClick={() => void handleExportPdf()}
                disabled={loading || exportingPdf || filteredRows.length === 0}
                title="ดาวน์โหลดรายงาน PDF"
                aria-label="ดาวน์โหลดรายงาน PDF"
              >
                <BsFileEarmarkPdf size={18} aria-hidden="true" />
                <span>{exportButtonText}</span>
              </button>
            </div>

            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>ลำดับ</th>
                    <th>รหัสสัญญา</th>
                    <th>ชื่อจุดรักษาการณ์</th>
                    <th>ผลัด</th>
                    <th>สถานะ</th>
                    <th hidden={HIDE_CONTRACT_COLUMNS}>วันที่เริ่มสัญญา</th>
                    <th hidden={HIDE_CONTRACT_COLUMNS}>แจ้งเตือน</th>
                    <th hidden={HIDE_CONTRACT_COLUMNS}>ตามสัญญา</th>
                    <th>ตารางแผนงาน</th>
                    <th>วันเวลาเข้า</th>
                    <th>วันเวลาออก</th>
                    <th>ผู้ดำเนินการ</th>
                    <th>รายละเอียดการติดต่อ</th>
                    <th>หมายเหตุ</th>
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={14}>กำลังโหลดข้อมูล...</td>
                    </tr>
                  ) : filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={14} className={styles.emptyTableCell}>
                        <EmptyReportState title={emptyTitle} hint={emptyHint} />
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row, index) => {
                      const status = getDisplayStatus(row);
                      const reservedBy = getReservedBy(row);
                      const isReservedPending =
                        status === "pending" && reservedBy !== null;
                      const checkInImageUrl = getCheckInImageUrl(row);
                      const checkOutImageUrl = getCheckOutImageUrl(row);
                      const contractText = getContractCodeText(
                        row.contractCode,
                      );
                      const checkInDateTimeText = getCheckInDateTimeText(row);
                      const checkOutDateTimeText = getCheckOutDateTimeText(row);

                      return (
                        <tr
                          key={makeReactKey(
                            "desktop-row",
                            row.id,
                            row.contractCode,
                            row.locationId ?? row.location_id,
                            index,
                          )}
                        >
                          <td>{index + 1}</td>
                          <td>{contractText}</td>
                          <td className={styles.textLeft}>{row.siteName}</td>
                          <td>{row.shiftLabel || "-"}</td>
                          <td>
                            <span
                              className={`${styles.statusBadge} ${getStatusClass(
                                row,
                                status,
                              )} ${
                                isReservedPending ? styles.statusReserved : ""
                              }`}
                            >
                              {isReservedPending && reservedBy ? (
                                <span className={styles.statusTextGroup}>
                                  <span>
                                    {getReportStatusLabel(row, status)}
                                  </span>
                                  <span className={styles.reservedByText}>
                                    โดยผู้จอง: {reservedBy}
                                  </span>
                                </span>
                              ) : (
                                getReportStatusLabel(row, status)
                              )}
                            </span>
                          </td>

                          <td hidden={HIDE_CONTRACT_COLUMNS}>
                            {getEffectiveFromText(row)}
                          </td>

                          <td
                            hidden={HIDE_CONTRACT_COLUMNS}
                            className={`${styles.notificationTableCell} ${getNotificationRowClass(
                              row,
                            )}`}
                          >
                            {getNotificationText(row)}
                          </td>

                          <td
                            hidden={HIDE_CONTRACT_COLUMNS}
                            className={styles.textLeft}
                          >
                            {getScheduleText(row)}
                          </td>

                          <td>{formatReportDateText(row.dateText)}</td>

                          <td>
                            <ReportTimePhotoCell
                              time={checkInDateTimeText}
                              imageUrl={checkInImageUrl}
                              imageTitle={`${contractText} - ${row.siteName} | รูปเวลาเข้า ${checkInDateTimeText}`}
                              onPreview={handleOpenImagePreview}
                            />
                          </td>

                          <td>
                            <ReportTimePhotoCell
                              time={checkOutDateTimeText}
                              imageUrl={checkOutImageUrl}
                              imageTitle={`${contractText} - ${row.siteName} | รูปเวลาออก ${checkOutDateTimeText}`}
                              onPreview={handleOpenImagePreview}
                            />
                          </td>

                          <td>{getOperatorText(row)}</td>
                          <td className={styles.textLeft}>
                            {getContactDetail(row)}
                          </td>
                          <td className={styles.textLeft}>
                            {getCallNote(row)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className={styles.desktopFooter}>
              <span>{reportCountText}</span>

              <div className={styles.pagination}>
                <button type="button" disabled>
                  ก่อนหน้า
                </button>
                <button type="button" className={styles.activePage}>
                  1
                </button>
                <button type="button" disabled>
                  ถัดไป
                </button>
              </div>
            </div>
          </div>
        </section>

        <section
          className={styles.mobileSection}
          aria-label="รายการรายงานมือถือ"
        >
          <div className={styles.mobileListHeader}>
            <h2 className={styles.mobileSectionTitle}>รายการรายงาน</h2>

            <button
              type="button"
              className={`${styles.exportPdfButton} ${styles.mobileExportPdfButton}`}
              onClick={() => void handleExportPdf()}
              disabled={loading || exportingPdf || filteredRows.length === 0}
              title="ดาวน์โหลดรายงาน PDF"
              aria-label="ดาวน์โหลดรายงาน PDF"
            >
              <BsFileEarmarkPdf size={18} aria-hidden="true" />
              <span>{exportButtonText}</span>
            </button>
          </div>

          <div className={styles.mobileList}>
            {loading ? (
              <p className={styles.mobileFooter}>กำลังโหลดข้อมูล...</p>
            ) : filteredRows.length === 0 ? (
              <EmptyReportState title={emptyTitle} hint={emptyHint} />
            ) : (
              filteredRows.map((row, index) => {
                const isExpanded = expandedId === row.id;
                const status = getDisplayStatus(row);
                const reservedBy = getReservedBy(row);
                const isReservedPending =
                  status === "pending" && reservedBy !== null;
                const checkInImageUrl = getCheckInImageUrl(row);
                const checkOutImageUrl = getCheckOutImageUrl(row);
                const contractText = getContractCodeText(row.contractCode);
                const checkInDateTimeText = getCheckInDateTimeText(row);
                const checkOutDateTimeText = getCheckOutDateTimeText(row);

                return (
                  <article
                    key={makeReactKey(
                      "mobile-row",
                      row.id,
                      row.contractCode,
                      row.locationId ?? row.location_id,
                      index,
                    )}
                    className={`${styles.mobileCard} ${
                      isExpanded ? styles.mobileCardExpanded : ""
                    }`}
                  >
                    <button
                      type="button"
                      className={styles.mobileCardButton}
                      onClick={() => setExpandedId(isExpanded ? null : row.id)}
                      aria-expanded={isExpanded}
                    >
                      <StatusIcon
                        status={status}
                        isReservedPending={isReservedPending}
                        reportPlanMode={row.reportPlanMode}
                      />

                      <div className={styles.mobileMain}>
                        <div className={styles.mobileContractRow}>
                          <span className={styles.mobileNo}>{index + 1}</span>

                          <span className={styles.mobileCode}>
                            {contractText}
                          </span>
                        </div>

                        <strong className={styles.mobileSiteName}>
                          {row.siteName}
                        </strong>
                      </div>

                      <span
                        className={`${styles.mobileStatusBadge} ${getStatusClass(
                          row,
                          status,
                        )} ${isReservedPending ? styles.statusReserved : ""}`}
                      >
                        {isReservedPending && reservedBy ? (
                          <span className={styles.statusTextGroup}>
                            <span>{getReportStatusLabel(row, status)}</span>
                            <span className={styles.reservedByText}>
                              โดยผู้จอง: {reservedBy}
                            </span>
                          </span>
                        ) : row.reportPlanMode === "outside_plan" &&
                          status === "completed" ? (
                          <span className={styles.statusTextGroup}>
                            <span>เรียบร้อย</span>
                            <span>(ติดตาม/มอบหมาย)</span>
                          </span>
                        ) : (
                          getReportStatusLabel(row, status)
                        )}
                      </span>

                      <span className={styles.chevron}>
                        {isExpanded ? (
                          <ChevronUp size={18} strokeWidth={2.8} />
                        ) : (
                          <ChevronRight size={18} strokeWidth={2.8} />
                        )}
                      </span>
                    </button>

                    {isExpanded && (
                      <div className={styles.mobileDetail}>
                        <div className={styles.detailRow}>
                          <span>ชื่อจุดรักษาการณ์</span>
                          <strong>{row.siteName}</strong>
                        </div>

                        <div className={styles.detailRow}>
                          <span>ผลัด</span>
                          <strong>{row.shiftLabel || "-"}</strong>
                        </div>

                        <div className={styles.detailRow}>
                          <span>สถานะ</span>
                          <strong>
                            {getReportStatusLabel(row, status)}
                            {isReservedPending && reservedBy
                              ? ` โดยผู้จอง: ${reservedBy}`
                              : ""}
                          </strong>
                        </div>

                        {!HIDE_CONTRACT_COLUMNS && (
                          <>
                            <div className={styles.detailRow}>
                              <span>วันที่เริ่มสัญญา</span>
                              <strong>{getEffectiveFromText(row)}</strong>
                            </div>

                            <div
                              className={`${styles.detailRow} ${styles.notificationDetailRow} ${getNotificationRowClass(
                                row,
                              )}`}
                            >
                              <span>แจ้งเตือน</span>
                              <strong>{getNotificationText(row)}</strong>
                            </div>

                            <div className={styles.detailRow}>
                              <span>ตามสัญญา</span>
                              <strong>{getScheduleText(row)}</strong>
                            </div>
                          </>
                        )}

                        <div className={styles.detailRow}>
                          <span>ตารางแผนงาน</span>
                          <strong>{formatReportDateText(row.dateText)}</strong>
                        </div>

                        <div className={styles.detailRow}>
                          <span>วันเวลาเข้า</span>

                          <ReportTimePhotoCell
                            time={checkInDateTimeText}
                            imageUrl={checkInImageUrl}
                            imageTitle={`${contractText} - ${row.siteName} | รูปเวลาเข้า ${checkInDateTimeText}`}
                            align="right"
                            onPreview={handleOpenImagePreview}
                          />
                        </div>

                        <div className={styles.detailRow}>
                          <span>วันเวลาออก</span>

                          <ReportTimePhotoCell
                            time={checkOutDateTimeText}
                            imageUrl={checkOutImageUrl}
                            imageTitle={`${contractText} - ${row.siteName} | รูปเวลาออก ${checkOutDateTimeText}`}
                            align="right"
                            onPreview={handleOpenImagePreview}
                          />
                        </div>

                        <div className={styles.detailRow}>
                          <span>ผู้ดำเนินการ</span>
                          <strong>{getOperatorText(row)}</strong>
                        </div>

                        <div className={styles.detailRow}>
                          <span>รายละเอียดการติดต่อ</span>
                          <strong>{getContactDetail(row)}</strong>
                        </div>

                        <div className={styles.detailRow}>
                          <span>หมายเหตุ</span>
                          <strong>{getCallNote(row)}</strong>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })
            )}
          </div>

          <p className={styles.mobileFooter}>{reportCountText}</p>

          <div className="guts-fv-bottom">
            <BackButton onClick={onBack} className="guts-fv-backBtn" />
          </div>
        </section>

        <PdfExportErrorModal
          message={exportErrorMessage}
          onClose={handleCloseExportErrorModal}
        />

        <ReportImagePreviewModal
          previewImage={previewImage}
          onClose={handleCloseImagePreview}
        />
      </div>
    </main>
  );
}