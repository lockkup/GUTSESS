// frontend/src/services/patrolReportExportApi.ts

import api, { API_BASE_URL } from "@/lib/api";

export type PatrolReportExportJobStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled"
  | "expired";

export type PatrolReportExportType = "patrol_report";
export type PatrolReportExportPlanMode = "planned" | "outside_plan";
export type PatrolReportExportShiftType = "all" | "day" | "night";
export type PatrolReportExportStatus =
  | "all"
  | "completed"
  | "completed_call"
  | "in_progress"
  | "pending";

export type PatrolReportExportReservationStatus =
  | "all"
  | "reserved"
  | "unreserved";

export type PatrolReportExportFilter = {
  workdayStart: string;
  workdayEnd: string;
  departmentId: number;
  divisionId: number;
  routeId?: number;
  locationId?: number;
  employeeCode?: string;
  planMode: PatrolReportExportPlanMode;
  shiftType: PatrolReportExportShiftType;
  status: PatrolReportExportStatus;

  /**
   * ใช้ร่วมกับ status="pending" เพื่อแยกสถานะการจอง
   *
   * all        = ไม่กรองข้อมูลการจอง
   * reserved   = เฉพาะรายการที่มีผู้จอง
   * unreserved = เฉพาะรายการที่ยังไม่มีผู้จอง
   *
   * ไม่ใช่ assignment_status ใหม่ในฐานข้อมูล
   */
  reservationStatus?: PatrolReportExportReservationStatus;

  keyword: string;
};

export type PatrolReportExportCreatePayload = {
  filters: PatrolReportExportFilter;
  includeImages: boolean;
  requestedBy: string;
};

export type PatrolReportExportJobResponse = {
  reportExportJobId: number;
  reportType: PatrolReportExportType;
  filtersJson: Record<string, unknown>;
  includeImages: boolean;

  jobStatus: PatrolReportExportJobStatus;

  progressCurrent: number;
  progressTotal: number;
  progressPercent: number;

  downloadReady: boolean;
  fileRelativePath: string | null;
  downloadFilename: string | null;
  fileSizeBytes: number | null;

  errorMessage: string | null;

  startedAt: string | null;
  completedAt: string | null;
  expiresAt: string | null;

  requestedBy: string;
  updatedBy: string | null;
  markFlag: boolean;

  createdAt: string;
  updatedAt: string;
};

type PatrolReportExportJobApiResponse = {
  report_export_job_id: number;
  report_type: PatrolReportExportType;
  filters_json: Record<string, unknown>;
  include_images: boolean;

  job_status: PatrolReportExportJobStatus;

  progress_current: number;
  progress_total: number;
  progress_percent?: number;

  download_ready?: boolean;
  file_relative_path?: string | null;
  download_filename?: string | null;
  file_size_bytes?: number | null;

  error_message?: string | null;

  started_at?: string | null;
  completed_at?: string | null;
  expires_at?: string | null;

  requested_by: string;
  updated_by?: string | null;
  mark_flag: boolean;

  created_at: string;
  updated_at: string;
};

const PATROL_REPORT_EXPORT_BASE = "/patrol-report-exports";

function toNumber(value: unknown, fallback = 0) {
  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function toNullableText(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  const text = String(value).trim();

  return text || null;
}

function calculateProgressPercent(
  jobStatus: PatrolReportExportJobStatus,
  progressCurrent: number,
  progressTotal: number,
) {
  if (jobStatus === "completed") {
    return 100;
  }

  if (progressTotal <= 0) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(100, Math.floor((progressCurrent / progressTotal) * 100)),
  );
}

function mapJobResponse(
  response: PatrolReportExportJobApiResponse,
): PatrolReportExportJobResponse {
  const progressCurrent = Math.max(0, toNumber(response.progress_current));
  const progressTotal = Math.max(0, toNumber(response.progress_total));

  const backendProgressPercent = toNumber(
    response.progress_percent,
    Number.NaN,
  );

  const progressPercent = Number.isFinite(backendProgressPercent)
    ? Math.max(0, Math.min(100, backendProgressPercent))
    : calculateProgressPercent(
        response.job_status,
        progressCurrent,
        progressTotal,
      );

  const fileRelativePath = toNullableText(response.file_relative_path);
  const downloadFilename = toNullableText(response.download_filename);

  return {
    reportExportJobId: toNumber(response.report_export_job_id),
    reportType: response.report_type,

    filtersJson:
      response.filters_json &&
      typeof response.filters_json === "object" &&
      !Array.isArray(response.filters_json)
        ? response.filters_json
        : {},

    includeImages: Boolean(response.include_images),

    jobStatus: response.job_status,

    progressCurrent,
    progressTotal,
    progressPercent,

    downloadReady:
      response.download_ready ??
      (response.job_status === "completed" &&
        Boolean(fileRelativePath) &&
        Boolean(downloadFilename)),

    fileRelativePath,
    downloadFilename,

    fileSizeBytes:
      response.file_size_bytes === null ||
      response.file_size_bytes === undefined
        ? null
        : Math.max(0, toNumber(response.file_size_bytes)),

    errorMessage: toNullableText(response.error_message),

    startedAt: toNullableText(response.started_at),
    completedAt: toNullableText(response.completed_at),
    expiresAt: toNullableText(response.expires_at),

    requestedBy: String(response.requested_by ?? "").trim(),
    updatedBy: toNullableText(response.updated_by),

    markFlag: Boolean(response.mark_flag),

    createdAt: String(response.created_at ?? "").trim(),
    updatedAt: String(response.updated_at ?? "").trim(),
  };
}

function toCreateRequestBody(payload: PatrolReportExportCreatePayload) {
  return {
    filters: {
      workday_start: payload.filters.workdayStart,
      workday_end: payload.filters.workdayEnd,

      department_id: payload.filters.departmentId,
      division_id: payload.filters.divisionId,

      route_id: payload.filters.routeId ?? null,
      location_id: payload.filters.locationId ?? null,
      employee_code: payload.filters.employeeCode?.trim() || null,

      plan_mode: payload.filters.planMode,
      shift_type: payload.filters.shiftType,
      status: payload.filters.status,

      /**
       * ใช้ร่วมกับ status="pending"
       *
       * all        = ไม่กรองข้อมูลการจอง
       * reserved   = เฉพาะรายการที่มีผู้จอง
       * unreserved = เฉพาะรายการที่ยังไม่มีผู้จอง
       */
      reservation_status: payload.filters.reservationStatus ?? "all",

      keyword: payload.filters.keyword.trim(),
    },

    include_images: payload.includeImages,
    requested_by: payload.requestedBy.trim(),
  };
}

function getDownloadUrl(reportExportJobId: number) {
  return `${API_BASE_URL}${PATROL_REPORT_EXPORT_BASE}/${reportExportJobId}/download`;
}

function getDownloadFilename(
  response: Response,
  fallbackFilename: string,
) {
  const contentDisposition =
    response.headers.get("content-disposition") ?? "";

  const utf8Filename = contentDisposition.match(
    /filename\*=UTF-8''([^;]+)/i,
  );

  if (utf8Filename?.[1]) {
    try {
      return decodeURIComponent(utf8Filename[1]);
    } catch {
      return utf8Filename[1];
    }
  }

  const basicFilename = contentDisposition.match(
    /filename="?([^";]+)"?/i,
  );

  return basicFilename?.[1] || fallbackFilename;
}

async function readDownloadError(response: Response) {
  const rawText = await response.text();

  if (!rawText) {
    return `ไม่สามารถดาวน์โหลดไฟล์รายงานได้ (${response.status})`;
  }

  try {
    const data = JSON.parse(rawText) as {
      detail?: unknown;
      message?: unknown;
    };

    if (typeof data.detail === "string" && data.detail.trim()) {
      return data.detail;
    }

    if (typeof data.message === "string" && data.message.trim()) {
      return data.message;
    }
  } catch {
    // กรณี response ไม่ใช่ JSON
  }

  return rawText;
}

export async function createPatrolReportExportJob(
  payload: PatrolReportExportCreatePayload,
) {
  const response = await api.post<PatrolReportExportJobApiResponse>(
    `${PATROL_REPORT_EXPORT_BASE}/`,
    toCreateRequestBody(payload),
  );

  return mapJobResponse(response);
}

export async function getPatrolReportExportJob(
  reportExportJobId: number,
) {
  const response = await api.get<PatrolReportExportJobApiResponse>(
    `${PATROL_REPORT_EXPORT_BASE}/${reportExportJobId}`,
  );

  return mapJobResponse(response);
}

export async function downloadPatrolReportExportFile(
  reportExportJobId: number,
  fallbackFilename = "patrol_report.pdf",
) {
  const response = await fetch(getDownloadUrl(reportExportJobId), {
    method: "GET",
    headers: {
      Accept: "application/pdf",
    },
  });

  if (!response.ok) {
    throw new Error(await readDownloadError(response));
  }

  const pdfBlob = await response.blob();

  if (!pdfBlob.size) {
    throw new Error("ไฟล์ PDF ที่ดาวน์โหลดมีขนาด 0 byte");
  }

  const objectUrl = URL.createObjectURL(pdfBlob);
  const anchor = document.createElement("a");

  try {
    anchor.href = objectUrl;
    anchor.download = getDownloadFilename(response, fallbackFilename);
    anchor.style.display = "none";

    document.body.appendChild(anchor);
    anchor.click();
  } finally {
    anchor.remove();

    window.setTimeout(() => {
      URL.revokeObjectURL(objectUrl);
    }, 1000);
  }
}