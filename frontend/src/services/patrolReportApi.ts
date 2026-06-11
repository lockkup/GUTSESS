// src/services/patrolReportApi.ts

import api from "@/lib/api";

export type PatrolStatus = "completed" | "in_progress" | "pending";
export type ReportPlanMode = "planned" | "outside_plan";

export type PatrolNotificationLevel =
  | "none"
  | "green"
  | "yellow"
  | "orange"
  | "red";

export type PatrolReportRow = {
  id: number;

  contractCode: string;
  siteName: string;
  status: PatrolStatus;

  // ใช้สำหรับตัวกรองรายงาน
  departmentId: number | null;
  department_id: number | null;

  divisionId: number | null;
  division_id: number | null;

  routeId: number | null;
  route_id: number | null;

  locationId: number | null;
  location_id: number | null;

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

  // รูปภาพเวลาเข้า / เวลาออก
  // ระยะสั้นรองรับ URL, path และ data:image/jpeg;base64,...
  // ระยะยาวแนะนำให้ backend ส่งเป็น path/URL แทน base64
  checkInImageUrl: string | null;
  check_in_image_url: string | null;
  checkinImageUrl: string | null;
  checkin_image_url: string | null;
  checkInPicture: string | null;
  check_in_picture: string | null;
  firstInPicture: string | null;
  first_in_picture: string | null;

  // ชื่อ column จริงจาก time_record / view รายงาน
  imagesCheckin1: string | null;
  imagesCheckin2: string | null;
  imagesCheckin3: string | null;
  images_checkin_1: string | null;
  images_checkin_2: string | null;
  images_checkin_3: string | null;

  checkOutImageUrl: string | null;
  check_out_image_url: string | null;
  checkoutImageUrl: string | null;
  checkout_image_url: string | null;
  checkOutPicture: string | null;
  check_out_picture: string | null;
  lastOutPicture: string | null;
  last_out_picture: string | null;

  // ชื่อ column จริงจาก time_record / view รายงาน
  imagesCheckout1: string | null;
  imagesCheckout2: string | null;
  imagesCheckout3: string | null;
  images_checkout_1: string | null;
  images_checkout_2: string | null;
  images_checkout_3: string | null;

  operatorName: string | null;

  employeeCode: string | null;
  employee_code: string | null;

  positionName: string | null;
  position_name: string | null;
};

export type PatrolDepartmentOption = {
  departmentId: number;
  departmentName: string;
};

export type PatrolDivisionOption = {
  divisionId: number;
  divisionName: string;
  departmentId: number | null;
};

export type PatrolRouteOption = {
  routeId: number;
  routeName: string;
  departmentId: number | null;
  divisionId: number | null;
};

export type PatrolLocationOption = {
  locationId: number;
  contractCode: string;
  locationName: string;
  routeId: number | null;
  departmentId: number | null;
  divisionId: number | null;
};

export type PatrolEmployeeOption = {
  employeeCode: string;
  employeeName: string | null;
  positionName: string | null;
};

export type PatrolReportFilterOptions = {
  departments: PatrolDepartmentOption[];
  divisions: PatrolDivisionOption[];
  routes: PatrolRouteOption[];
  locations: PatrolLocationOption[];
  employees: PatrolEmployeeOption[];
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

  // รูปภาพเวลาเข้า
  checkInImageUrl?: string | null;
  check_in_image_url?: string | null;
  checkinImageUrl?: string | null;
  checkin_image_url?: string | null;
  checkInPicture?: string | null;
  check_in_picture?: string | null;
  checkinPicture?: string | null;
  checkin_picture?: string | null;
  firstInPicture?: string | null;
  first_in_picture?: string | null;

  // ชื่อ column จริงจาก time_record / view รายงาน
  imagesCheckin1?: string | null;
  imagesCheckin2?: string | null;
  imagesCheckin3?: string | null;
  images_checkin_1?: string | null;
  images_checkin_2?: string | null;
  images_checkin_3?: string | null;

  // รูปภาพเวลาออก
  checkOutImageUrl?: string | null;
  check_out_image_url?: string | null;
  checkoutImageUrl?: string | null;
  checkout_image_url?: string | null;
  checkOutPicture?: string | null;
  check_out_picture?: string | null;
  checkoutPicture?: string | null;
  checkout_picture?: string | null;
  lastOutPicture?: string | null;
  last_out_picture?: string | null;

  // ชื่อ column จริงจาก time_record / view รายงาน
  imagesCheckout1?: string | null;
  imagesCheckout2?: string | null;
  imagesCheckout3?: string | null;
  images_checkout_1?: string | null;
  images_checkout_2?: string | null;
  images_checkout_3?: string | null;

  operatorName?: string | null;
  operator_name?: string | null;

  employeeCode?: string | null;
  employee_code?: string | null;

  positionName?: string | null;
  position_name?: string | null;
};

type PatrolReportFilterOptionsApiResponse = {
  departments?: PatrolDepartmentOption[] | null;
  divisions?: PatrolDivisionOption[] | null;
  routes?: PatrolRouteOption[] | null;
  locations?: PatrolLocationOption[] | null;
  employees?: PatrolEmployeeOption[] | null;
};

export type GetPatrolReportParams = {
  // คง workday ไว้รองรับ backend เดิม
  workday: string;

  // แยกตามแผน / นอกแผน
  planMode?: ReportPlanMode;
  plan_mode?: ReportPlanMode;

  // รองรับ backend ใหม่แบบช่วงวันที่
  workdayStart?: string;
  workdayEnd?: string;
  startDate?: string;
  endDate?: string;

  // ไม่บังคับแล้ว เพื่อให้เลือกผลัด = ทั้งหมด ได้
  shiftId?: number;

  // ไม่บังคับ เพื่อให้ค่าเริ่มต้น ภาค/เขต ว่างได้
  departmentId?: number;
  divisionId?: number;

  // ตัวกรองใหม่
  routeId?: number;
  locationId?: number;
  employeeCode?: string;

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
    level === "green" ||
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

  const departmentId = toNumberOrNull(
    row.departmentId ?? row.department_id,
  );

  const divisionId = toNumberOrNull(row.divisionId ?? row.division_id);

  const routeId = toNumberOrNull(row.routeId ?? row.route_id);

  const locationId = toNumberOrNull(row.locationId ?? row.location_id);

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

  const imagesCheckin1 = toNullableText(
    row.imagesCheckin1 ?? row.images_checkin_1,
  );
  const imagesCheckin2 = toNullableText(
    row.imagesCheckin2 ?? row.images_checkin_2,
  );
  const imagesCheckin3 = toNullableText(
    row.imagesCheckin3 ?? row.images_checkin_3,
  );

  const imagesCheckout1 = toNullableText(
    row.imagesCheckout1 ?? row.images_checkout_1,
  );
  const imagesCheckout2 = toNullableText(
    row.imagesCheckout2 ?? row.images_checkout_2,
  );
  const imagesCheckout3 = toNullableText(
    row.imagesCheckout3 ?? row.images_checkout_3,
  );

  const checkInImageUrl = toNullableText(
    imagesCheckin1 ??
      imagesCheckin2 ??
      imagesCheckin3 ??
      row.checkInImageUrl ??
      row.check_in_image_url ??
      row.checkinImageUrl ??
      row.checkin_image_url ??
      row.checkInPicture ??
      row.check_in_picture ??
      row.checkinPicture ??
      row.checkin_picture ??
      row.firstInPicture ??
      row.first_in_picture,
  );

  const checkOutImageUrl = toNullableText(
    imagesCheckout1 ??
      imagesCheckout2 ??
      imagesCheckout3 ??
      row.checkOutImageUrl ??
      row.check_out_image_url ??
      row.checkoutImageUrl ??
      row.checkout_image_url ??
      row.checkOutPicture ??
      row.check_out_picture ??
      row.checkoutPicture ??
      row.checkout_picture ??
      row.lastOutPicture ??
      row.last_out_picture,
  );

  const operatorName = toNullableText(row.operatorName ?? row.operator_name);

  const employeeCode = toNullableText(row.employeeCode ?? row.employee_code);

  const positionName = toNullableText(row.positionName ?? row.position_name);

  return {
    id: toNumber(row.id, index + 1),

    contractCode,
    siteName,
    status,

    departmentId,
    department_id: departmentId,

    divisionId,
    division_id: divisionId,

    routeId,
    route_id: routeId,

    locationId,
    location_id: locationId,

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

    checkInImageUrl,
    check_in_image_url: checkInImageUrl,
    checkinImageUrl: checkInImageUrl,
    checkin_image_url: checkInImageUrl,
    checkInPicture: checkInImageUrl,
    check_in_picture: checkInImageUrl,
    firstInPicture: checkInImageUrl,
    first_in_picture: checkInImageUrl,

    imagesCheckin1,
    imagesCheckin2,
    imagesCheckin3,
    images_checkin_1: imagesCheckin1,
    images_checkin_2: imagesCheckin2,
    images_checkin_3: imagesCheckin3,

    checkOutImageUrl,
    check_out_image_url: checkOutImageUrl,
    checkoutImageUrl: checkOutImageUrl,
    checkout_image_url: checkOutImageUrl,
    checkOutPicture: checkOutImageUrl,
    check_out_picture: checkOutImageUrl,
    lastOutPicture: checkOutImageUrl,
    last_out_picture: checkOutImageUrl,

    imagesCheckout1,
    imagesCheckout2,
    imagesCheckout3,
    images_checkout_1: imagesCheckout1,
    images_checkout_2: imagesCheckout2,
    images_checkout_3: imagesCheckout3,

    operatorName,

    employeeCode,
    employee_code: employeeCode,

    positionName,
    position_name: positionName,
  };
}

function normalizeFilterOptions(
  options: PatrolReportFilterOptionsApiResponse,
): PatrolReportFilterOptions {
  return {
    departments: Array.isArray(options.departments) ? options.departments : [],
    divisions: Array.isArray(options.divisions) ? options.divisions : [],
    routes: Array.isArray(options.routes) ? options.routes : [],
    locations: Array.isArray(options.locations) ? options.locations : [],
    employees: Array.isArray(options.employees) ? options.employees : [],
  };
}

export async function getPatrolReportFilterOptions() {
  const options = await api.get<PatrolReportFilterOptionsApiResponse>(
    "/api/reports/patrol/filter-options",
  );

  return normalizeFilterOptions(options);
}

export async function getPatrolReport({
  workday,
  planMode,
  plan_mode,
  workdayStart,
  workdayEnd,
  startDate,
  endDate,
  departmentId,
  divisionId,
  shiftId,
  routeId,
  locationId,
  employeeCode,
  status,
  keyword,
}: GetPatrolReportParams) {
  const params: Record<string, string | number> = {
    workday,
  };

  const selectedPlanMode = planMode ?? plan_mode;

  if (selectedPlanMode) {
    params.plan_mode = selectedPlanMode;
  }

  if (workdayStart?.trim()) {
    params.workday_start = workdayStart.trim();
  }

  if (workdayEnd?.trim()) {
    params.workday_end = workdayEnd.trim();
  }

  if (startDate?.trim()) {
    params.start_date = startDate.trim();
  }

  if (endDate?.trim()) {
    params.end_date = endDate.trim();
  }

  if (shiftId !== undefined) {
    params.shift_id = shiftId;
  }

  if (departmentId !== undefined) {
    params.department_id = departmentId;
  }

  if (divisionId !== undefined) {
    params.division_id = divisionId;
  }

  if (routeId !== undefined) {
    params.route_id = routeId;
  }

  if (locationId !== undefined) {
    params.location_id = locationId;
  }

  if (employeeCode?.trim()) {
    params.employee_code = employeeCode.trim();
  }

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