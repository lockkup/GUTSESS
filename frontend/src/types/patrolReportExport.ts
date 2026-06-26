// frontend/src/types/patrolReportExport.ts

export type PatrolReportExportJobStatus =
| "queued"
| "processing"
| "completed"
| "failed"
| "cancelled"
| "expired";

export type PatrolReportExportType = "patrol_report";

export type PatrolReportExportPlanMode =
| "planned"
| "outside_plan";

export type PatrolReportExportShiftType =
| "all"
| "day"
| "night";

export type PatrolReportExportStatus =
| "all"
| "completed"
| "completed_call"
| "in_progress"
| "pending";

/**

* Filter ที่ส่งให้ Backend เพื่อสร้างรายงาน PDF
*
* ใช้ camelCase ใน Frontend
* patrolReportExportApi.ts จะแปลงเป็น snake_case ก่อนส่ง API
  */
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

keyword: string;
};

/**

* Payload สำหรับ POST /patrol-report-exports/
  */
  export type PatrolReportExportCreatePayload = {
  filters: PatrolReportExportFilter;

// true = รวมรูปเวลาเข้า / ออก ใน PDF
includeImages: boolean;

// รหัสพนักงานของผู้ใช้งานที่ Login อยู่จริง
requestedBy: string;
};

/**

* Payload สำหรับ cancel / retry / delete
  */
  export type PatrolReportExportActionPayload = {
  updatedBy: string;
  };

/**

* Response ของ Job ที่ Backend ส่งกลับมา
*
* patrolReportExportApi.ts จะแปลงจาก snake_case
* เป็น camelCase ก่อนคืนค่าให้ Component
  */
  export type PatrolReportExportJobResponse = {
  reportExportJobId: number;

reportType: PatrolReportExportType;

// Filter ณ เวลาที่ผู้ใช้กดสร้างรายงาน
filtersJson: Record<string, unknown>;

includeImages: boolean;

jobStatus: PatrolReportExportJobStatus;

progressCurrent: number;
progressTotal: number;
progressPercent: number;

// true เมื่อ PDF สร้างเสร็จและดาวน์โหลดได้
downloadReady: boolean;

// Relative path บน Server
fileRelativePath: string | null;

// ชื่อไฟล์สำหรับ Browser ดาวน์โหลด
downloadFilename: string | null;

fileSizeBytes: number | null;

// แสดงเมื่อ job_status = failed
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

/**

* Parameters สำหรับหน้า History ในอนาคต
* GET /patrol-report-exports/
  */
  export type GetPatrolReportExportJobsParams = {
  skip?: number;
  limit?: number;

requestedBy?: string;

jobStatus?: PatrolReportExportJobStatus;

includeDeleted?: boolean;
};
