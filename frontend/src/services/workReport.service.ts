// src/services/workReport.service.ts

import { api } from "../lib/api";
import type {
  WorkReportCreate,
  WorkReportItemAction,
  WorkReportItemCreate,
  WorkReportItemListParams,
  WorkReportItemResponse,
  WorkReportItemTypeListParams,
  WorkReportItemTypeResponse,
  WorkReportItemUpdate,
  WorkReportListParams,
  WorkReportPurposeListParams,
  WorkReportPurposeResponse,
  WorkReportResponse,
  WorkReportUpdate,
} from "../types/workReport";

const PURPOSE_BASE_PATH = "/work-report-purposes";
const ITEM_TYPE_BASE_PATH = "/work-report-item-types";
const WORK_REPORT_BASE_PATH = "/work-reports";
const WORK_REPORT_ITEM_BASE_PATH = "/work-report-items";

export const workReportService = {
  /**
   * Master Data: วัตถุประสงค์การเข้าหน่วยงาน
   * GET /api/work-report-purposes/
   */
  getWorkReportPurposes(
    params: WorkReportPurposeListParams = {
      is_active: true,
      include_deleted: false,
    },
  ) {
    return api.get<WorkReportPurposeResponse[]>(
      `${PURPOSE_BASE_PATH}/`,
      params,
    );
  },

  /**
   * Master Data: ประเภทสิ่งที่ดำเนินการ
   * GET /api/work-report-item-types/
   */
  getWorkReportItemTypes(
    params: WorkReportItemTypeListParams = {
      is_active: true,
      include_deleted: false,
    },
  ) {
    return api.get<WorkReportItemTypeResponse[]>(
      `${ITEM_TYPE_BASE_PATH}/`,
      params,
    );
  },

  /**
   * สร้างรายงานประจำ time_record
   * POST /api/work-reports/
   */
  createWorkReport(payload: WorkReportCreate) {
    return api.post<WorkReportResponse>(
      `${WORK_REPORT_BASE_PATH}/`,
      payload,
    );
  },

  /**
   * ค้นหารายงานด้วย time_record_id
   * GET /api/work-reports/time-record/{time_record_id}
   */
  getWorkReportByTimeRecordId(timeRecordId: number) {
    return api.get<WorkReportResponse>(
      `${WORK_REPORT_BASE_PATH}/time-record/${timeRecordId}`,
    );
  },

  getWorkReportById(workReportId: number) {
    return api.get<WorkReportResponse>(
      `${WORK_REPORT_BASE_PATH}/${workReportId}`,
    );
  },

  getWorkReports(params?: WorkReportListParams) {
    return api.get<WorkReportResponse[]>(
      `${WORK_REPORT_BASE_PATH}/`,
      params,
    );
  },

  updateWorkReport(workReportId: number, payload: WorkReportUpdate) {
    return api.patch<WorkReportResponse>(
      `${WORK_REPORT_BASE_PATH}/${workReportId}`,
      payload,
    );
  },

  /**
   * สร้างรายการสิ่งที่ดำเนินการ
   * POST /api/work-report-items/
   */
  createWorkReportItem(payload: WorkReportItemCreate) {
    return api.post<WorkReportItemResponse>(
      `${WORK_REPORT_ITEM_BASE_PATH}/`,
      payload,
    );
  },

  getWorkReportItems(params?: WorkReportItemListParams) {
    return api.get<WorkReportItemResponse[]>(
      `${WORK_REPORT_ITEM_BASE_PATH}/`,
      params,
    );
  },

  getWorkReportItemById(workReportItemId: number) {
    return api.get<WorkReportItemResponse>(
      `${WORK_REPORT_ITEM_BASE_PATH}/${workReportItemId}`,
    );
  },

  updateWorkReportItem(
    workReportItemId: number,
    payload: WorkReportItemUpdate,
  ) {
    return api.patch<WorkReportItemResponse>(
      `${WORK_REPORT_ITEM_BASE_PATH}/${workReportItemId}`,
      payload,
    );
  },

  deactivateWorkReportItem(
    workReportItemId: number,
    payload: WorkReportItemAction,
  ) {
    return api.patch<WorkReportItemResponse>(
      `${WORK_REPORT_ITEM_BASE_PATH}/${workReportItemId}/deactivate`,
      payload,
    );
  },
};
