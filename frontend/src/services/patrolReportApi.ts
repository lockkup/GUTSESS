// src/services/patrolReportApi.ts

import api from "@/lib/api";

export type PatrolStatus = "completed" | "in_progress" | "pending";
export type PatrolNotificationLevel = "none" | "yellow" | "orange" | "red";

export type PatrolReportRow = {
  id: number;

  contractCode: string;
  siteName: string;
  status: PatrolStatus;

  // effective_from จาก backend / vw_checkin_report
  effectiveFrom: string | null;
  effective_from: string | null;

  // by_contract = รอบตรวจตามสัญญาจ้าง เช่น 3, 5, 7, 15, 30 วัน
  byContract: number | null;
  by_contract: number | null;

  // plan_day = รอบที่เรากำหนดให้สายตรวจ
  planDay: number | null;
  plan_day: number | null;

  // คำนวณจาก Backend
  lastInspectionDate: string | null;
  last_inspection_date: string | null;

  daysWithoutInspection: number | null;
  days_without_inspection: number | null;

  notificationLevel: PatrolNotificationLevel;
  notification_level: PatrolNotificationLevel;

  notificationText: string | null;
  notification_text: string | null;

  shiftLabel: string;
  dateText: string;

  contactDetail: string | null;
  contact_detail: string | null;

  callStatus: number | null;
  call_status: number | null;

  callNote: string | null;
  call_note: string | null;

  scheduleText: string;
  checkInTime: string | null;
  checkOutTime: string | null;

  operatorName: string | null;

  employeeCode: string | null;
  employee_code: string | null;

  positionName: string | null;
  position_name: string | null;
};

type PatrolReportApiRow = {
  id?: number | string | null;

  contractCode?: string | null;
  contract_code?: string | null;

  siteName?: string | null;
  site_name?: string | null;
  location_name?: string | null;

  status?: string | null;
  assignmentStatus?: string | null;
  assignment_status?: string | null;

  effectiveFrom?: string | null;
  effective_from?: string | null;

  byContract?: number | string | null;
  by_contract?: number | string | null;

  planDay?: number | string | null;
  plan_day?: number | string | null;

  lastInspectionDate?: string | null;
  last_inspection_date?: string | null;

  daysWithoutInspection?: number | string | null;
  days_without_inspection?: number | string | null;

  notificationLevel?: string | null;
  notification_level?: string | null;

  notificationText?: string | null;
  notification_text?: string | null;

  shiftLabel?: string | null;
  shift_label?: string | null;
  shift_name_th?: string | null;

  dateText?: string | null;
  date_text?: string | null;
  work_date?: string | null;

  contactDetail?: string | null;
  contact_detail?: string | null;

  callStatus?: number | string | null;
  call_status?: number | string | null;

  callNote?: string | null;
  call_note?: string | null;

  scheduleText?: string | null;
  schedule_text?: string | null;

  checkInTime?: string | null;
  check_in_time?: string | null;
  started_at?: string | null;

  checkOutTime?: string | null;
  check_out_time?: string | null;
  completed_at?: string | null;

  operatorName?: string | null;
  operator_name?: string | null;

  employeeCode?: string | null;
  employee_code?: string | null;

  positionName?: string | null;
  position_name?: string | null;
};

export type GetPatrolReportParams = {
  workday: string;
  departmentId: number;
  divisionId: number;
  shiftId: number;
  status?: "all" | PatrolStatus;
  keyword?: string;
};

function toText(value: unknown, fallback = "-") {
  if (value === null || value === undefined) return fallback;

  const text = String(value).trim();
  return text.length > 0 ? text : fallback;
}

function toNullableText(value: unknown) {
  if (value === null || value === undefined) return null;

  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function toNumber(value: unknown, fallback: number) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function toNumberOrNull(value: unknown) {
  if (value === null || value === undefined) return null;

  const text = String(value).trim();
  if (!text) return null;

  const numberValue = Number(text);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function normalizeStatus(value: unknown): PatrolStatus {
  const status = String(value ?? "").trim();

  if (
    status === "completed" ||
    status === "in_progress" ||
    status === "pending"
  ) {
    return status;
  }

  return "pending";
}

function normalizeNotificationLevel(value: unknown): PatrolNotificationLevel {
  const level = String(value ?? "").trim();

  if (
    level === "yellow" ||
    level === "orange" ||
    level === "red" ||
    level === "none"
  ) {
    return level;
  }

  return "none";
}

function formatTime(value: unknown) {
  const text = toNullableText(value);

  if (!text) return null;

  // กรณี backend ส่งเป็น HH:mm หรือ HH:mm:ss
  const timeMatch = text.match(/^(\d{2}):(\d{2})(?::\d{2})?$/);
  if (timeMatch) {
    return `${timeMatch[1]}:${timeMatch[2]}`;
  }

  // กรณี backend ส่งเป็น datetime เช่น 2026-05-25T15:09:00
  const dateTimeMatch = text.match(/[T\s](\d{2}):(\d{2})(?::\d{2})?/);
  if (dateTimeMatch) {
    return `${dateTimeMatch[1]}:${dateTimeMatch[2]}`;
  }

  return text;
}

function mapPatrolReportRow(
  row: PatrolReportApiRow,
  index: number,
): PatrolReportRow {
  const contractCode = toText(row.contractCode ?? row.contract_code, "-");

  const siteName = toText(
    row.siteName ?? row.site_name ?? row.location_name,
    "-",
  );

  const status = normalizeStatus(
    row.status ?? row.assignmentStatus ?? row.assignment_status,
  );

  const effectiveFrom = toNullableText(
    row.effectiveFrom ?? row.effective_from,
  );

  const byContract = toNumberOrNull(row.byContract ?? row.by_contract);

  const planDay = toNumberOrNull(row.planDay ?? row.plan_day);

  const lastInspectionDate = toNullableText(
    row.lastInspectionDate ?? row.last_inspection_date,
  );

  const daysWithoutInspection = toNumberOrNull(
    row.daysWithoutInspection ?? row.days_without_inspection,
  );

  const notificationLevel = normalizeNotificationLevel(
    row.notificationLevel ?? row.notification_level,
  );

  const notificationText = toNullableText(
    row.notificationText ?? row.notification_text,
  );

  const shiftLabel = toText(
    row.shiftLabel ?? row.shift_label ?? row.shift_name_th,
    "-",
  );

  const dateText = toText(row.dateText ?? row.date_text ?? row.work_date, "-");

  const contactDetail = toNullableText(
    row.contactDetail ?? row.contact_detail,
  );

  const callStatus = toNumberOrNull(row.callStatus ?? row.call_status);

  const callNote = toNullableText(row.callNote ?? row.call_note);

  const scheduleText = toText(row.scheduleText ?? row.schedule_text, "-");

  const checkInTime = formatTime(
    row.checkInTime ?? row.check_in_time ?? row.started_at,
  );

  const checkOutTime = formatTime(
    row.checkOutTime ?? row.check_out_time ?? row.completed_at,
  );

  const operatorName = toNullableText(row.operatorName ?? row.operator_name);

  const employeeCode = toNullableText(row.employeeCode ?? row.employee_code);

  const positionName = toNullableText(row.positionName ?? row.position_name);

  return {
    id: toNumber(row.id, index + 1),

    contractCode,
    siteName,
    status,

    effectiveFrom,
    effective_from: effectiveFrom,

    byContract,
    by_contract: byContract,

    planDay,
    plan_day: planDay,

    lastInspectionDate,
    last_inspection_date: lastInspectionDate,

    daysWithoutInspection,
    days_without_inspection: daysWithoutInspection,

    notificationLevel,
    notification_level: notificationLevel,

    notificationText,
    notification_text: notificationText,

    shiftLabel,
    dateText,

    contactDetail,
    contact_detail: contactDetail,

    callStatus,
    call_status: callStatus,

    callNote,
    call_note: callNote,

    scheduleText,
    checkInTime,
    checkOutTime,

    operatorName,

    employeeCode,
    employee_code: employeeCode,

    positionName,
    position_name: positionName,
  };
}

export async function getPatrolReport({
  workday,
  departmentId,
  divisionId,
  shiftId,
  status,
  keyword,
}: GetPatrolReportParams) {
  const params: Record<string, string | number> = {
    workday,
    department_id: departmentId,
    division_id: divisionId,
    shift_id: shiftId,
  };

  if (status && status !== "all") {
    params.status = status;
  }

  if (keyword?.trim()) {
    params.keyword = keyword.trim();
  }

  const rows = await api.get<PatrolReportApiRow[]>(
    "/api/reports/patrol",
    params,
  );

  return rows.map(mapPatrolReportRow);
}