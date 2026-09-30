// src/services/workReport.service.ts

import { api } from "../lib/api";
import type {
  WorkReportAction,
  WorkReportCreate,
  WorkReportDetailAction,
  WorkReportDetailCreate,
  WorkReportDetailListParams,
  WorkReportDetailResponse,
  WorkReportDetailUpdate,
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
const WORK_REPORT_DETAIL_BASE_PATH = "/work-report-details";

export type WorkReportItemImageResponse = {
  time_record_image_id: number;
  time_record_id: number;
  work_report_item_id: number | null;
  image_type: string;
  sequence_no: number;
  image_path: string;
  created_at: string;
  created_by: string;
};

export type SaveWorkReportItemImagesPayload = {
  image_base64_values: string[];
  updated_by: string;

  /**
   * ต้องเรียงตำแหน่งตรงกับ image_base64_values
   * - number = รูปเดิมที่ยังคงอยู่
   * - null = รูปใหม่ / รูปที่แทนรูปเดิม
   */
  image_ids?: Array<number | null>;

  /**
   * รูปเดิมที่ผู้ใช้ลบหรือเปลี่ยนออก
   */
  deleted_image_ids?: number[];
};

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
   * สร้าง work_report เปล่าพร้อม document_no ถ้ายังไม่มี
   * ถ้ามีอยู่แล้วจะคืนรายการเดิม
   *
   * POST /api/work-reports/time-record/{time_record_id}/ensure
   */
  ensureWorkReportByTimeRecordId(timeRecordId: number) {
    return api.post<WorkReportResponse>(
      `${WORK_REPORT_BASE_PATH}/time-record/${timeRecordId}/ensure`,
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
   * ยกเลิกบันทึกรายงานโดยไม่ลบรายละเอียดเดิม
   *
   * Backend จะเปลี่ยน:
   * - is_active = false
   * - mark_flag = false
   * - report_status = "cancelled"
   *
   * PATCH /api/work-reports/{work_report_id}/cancel
   */
  cancelWorkReport(
    workReportId: number,
    payload: WorkReportAction,
  ) {
    return api.patch<WorkReportResponse>(
      `${WORK_REPORT_BASE_PATH}/${workReportId}/cancel`,
      payload,
    );
  },

  /**
   * บันทึกภาพลายเซ็นของรายงาน
   * POST /api/work-reports/{work_report_id}/signature
   */
  saveWorkReportSignature(
    workReportId: number,
    payload: {
      signature_base64: string;
      updated_by: string;
    },
  ) {
    return api.post<WorkReportResponse>(
      `${WORK_REPORT_BASE_PATH}/${workReportId}/signature`,
      payload,
    );
  },

  /**
   * ล้างข้อมูลบันทึกรายงานของ work_report นี้
   *
   * Backend จะ:
   * - ไม่ลบ time_record
   * - คง work_report_id / time_record_id เดิม
   * - ล้าง additional_note
   * - soft delete work_report_item ที่เกี่ยวข้อง
   * - soft delete work_report_detail ที่เกี่ยวข้อง
   *
   * DELETE /api/work-reports/{work_report_id}
   */
  deleteWorkReport(workReportId: number, payload: WorkReportAction) {
    return api.deleteBody<WorkReportResponse>(
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

  /**
   * โหลดรูปของรายการข้อ 2.x
   * GET /api/work-report-items/{work_report_item_id}/images
   */
  getWorkReportItemImages(workReportItemId: number) {
    return api.get<WorkReportItemImageResponse[]>(
      `${WORK_REPORT_ITEM_BASE_PATH}/${workReportItemId}/images`,
    );
  },

  /**
   * บันทึก/แก้ไขรูปของรายการข้อ 2.x
   * รองรับสูงสุด 5 รูป
   *
   * POST /api/work-report-items/{work_report_item_id}/images
   */
  saveWorkReportItemImages(
    workReportItemId: number,
    payload: SaveWorkReportItemImagesPayload,
  ) {
    return api.post<WorkReportItemImageResponse[]>(
      `${WORK_REPORT_ITEM_BASE_PATH}/${workReportItemId}/images`,
      {
        image_base64_values: payload.image_base64_values,
        image_ids: payload.image_ids,
        deleted_image_ids: payload.deleted_image_ids,
        updated_by: payload.updated_by,
      },
    );
  },

  /**
   * ลบรายการสิ่งที่ดำเนินการแบบ soft delete
   * DELETE /api/work-report-items/{work_report_item_id}
   */
  deleteWorkReportItem(
    workReportItemId: number,
    payload: WorkReportItemAction,
  ) {
    return api.deleteBody<WorkReportItemResponse>(
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

  /**
   * ============================================================
   * Work report detail
   * ข้อ 3 และข้อ 4
   * ============================================================
   */

  /**
   * สร้างรายละเอียดข้อ 3.x / 4.x
   * POST /api/work-report-details/
   */
  createWorkReportDetail(payload: WorkReportDetailCreate) {
    return api.post<WorkReportDetailResponse>(
      `${WORK_REPORT_DETAIL_BASE_PATH}/`,
      payload,
    );
  },

  /**
   * โหลดรายละเอียดข้อ 3 / 4
   * GET /api/work-report-details/
   */
  getWorkReportDetails(params?: WorkReportDetailListParams) {
    return api.get<WorkReportDetailResponse[]>(
      `${WORK_REPORT_DETAIL_BASE_PATH}/`,
      params,
    );
  },

  /**
   * โหลดรายละเอียดตาม ID
   * GET /api/work-report-details/{work_report_detail_id}
   */
  getWorkReportDetailById(workReportDetailId: number) {
    return api.get<WorkReportDetailResponse>(
      `${WORK_REPORT_DETAIL_BASE_PATH}/${workReportDetailId}`,
    );
  },

  /**
   * แก้ไขรายละเอียดข้อ 3.x / 4.x
   * PATCH /api/work-report-details/{work_report_detail_id}
   */
  updateWorkReportDetail(
    workReportDetailId: number,
    payload: WorkReportDetailUpdate,
  ) {
    return api.patch<WorkReportDetailResponse>(
      `${WORK_REPORT_DETAIL_BASE_PATH}/${workReportDetailId}`,
      payload,
    );
  },

  /**
   * ลบรายละเอียดแบบ soft delete
   * DELETE /api/work-report-details/{work_report_detail_id}
   */
  deleteWorkReportDetail(
    workReportDetailId: number,
    payload: WorkReportDetailAction,
  ) {
    return api.deleteBody<WorkReportDetailResponse>(
      `${WORK_REPORT_DETAIL_BASE_PATH}/${workReportDetailId}`,
      payload,
    );
  },

  deactivateWorkReportDetail(
    workReportDetailId: number,
    payload: WorkReportDetailAction,
  ) {
    return api.patch<WorkReportDetailResponse>(
      `${WORK_REPORT_DETAIL_BASE_PATH}/${workReportDetailId}/deactivate`,
      payload,
    );
  },

  activateWorkReportDetail(
    workReportDetailId: number,
    payload: WorkReportDetailAction,
  ) {
    return api.patch<WorkReportDetailResponse>(
      `${WORK_REPORT_DETAIL_BASE_PATH}/${workReportDetailId}/activate`,
      payload,
    );
  },
};
