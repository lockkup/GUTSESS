// src/types/workReport.ts

export type WorkReportStatus = "active" | "cancelled";

export type WorkReportPurposeResponse = {
  purpose_id: number;
  purpose_code: string;
  purpose_name: string;
  display_order: number;
  is_active: boolean;
  mark_flag: boolean;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string | null;
};

export type WorkReportPurposeSelectionInput = {
  purpose_id: number;
  purpose_detail?: string | null;
};

export type WorkReportPurposeSelectionResponse = {
  work_report_purpose_selection_id: number;
  work_report_id: number;
  purpose_id: number;
  purpose_detail: string | null;
  is_active: boolean;
  active_purpose_id: number | null;
  mark_flag: boolean;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string | null;
};

export type WorkReportItemTypeResponse = {
  work_item_type_id: number;
  work_item_code: string;
  work_item_name: string;
  require_detail: boolean;
  display_order: number;
  is_active: boolean;
  mark_flag: boolean;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string | null;
};

export type WorkReportCreate = {
  time_record_id: number;
  purpose_selections: WorkReportPurposeSelectionInput[];
  additional_note?: string | null;
  client_first_name?: string | null;
  client_last_name?: string | null;
  client_position?: string | null;
  signature_path?: string | null;
};

export type WorkReportUpdate = {
  purpose_selections?: WorkReportPurposeSelectionInput[] | null;
  additional_note?: string | null;
  client_first_name?: string | null;
  client_last_name?: string | null;
  client_position?: string | null;
  signature_path?: string | null;
  updated_by: string;
};

export type WorkReportAction = {
  updated_by: string;
};

export type WorkReportResponse = {
  work_report_id: number;
  time_record_id: number;
  document_no: string | null;
  report_status: WorkReportStatus;
  purpose_selections: WorkReportPurposeSelectionResponse[];
  additional_note: string | null;
  client_first_name: string | null;
  client_last_name: string | null;
  client_position: string | null;
  signature_path: string | null;
  signature_datetime: string | null;
  is_active: boolean;
  mark_flag: boolean;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string | null;
};

export type WorkReportItemCreate = {
  work_report_id: number;
  work_item_type_id: number;
  sequence_no: number;
  work_item_other?: string | null;
  work_item_detail?: string | null;
  is_active?: boolean;
  created_by: string;
};

export type WorkReportItemUpdate = {
  work_item_type_id?: number | null;
  sequence_no?: number | null;
  work_item_other?: string | null;
  work_item_detail?: string | null;
  is_active?: boolean | null;
  updated_by: string;
};

export type WorkReportItemResponse = {
  work_report_item_id: number;
  work_report_id: number;
  work_item_type_id: number;
  sequence_no: number;
  work_item_other: string | null;
  work_item_detail: string | null;
  is_active: boolean;
  active_sequence_no: number | null;
  mark_flag: boolean;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string | null;
};

export type WorkReportDetailCreate = {
  work_report_id: number;
  section_no: number;
  sequence_no: number;
  detail: string;
  is_active?: boolean;
  created_by: string;
};

export type WorkReportDetailUpdate = {
  section_no?: number | null;
  sequence_no?: number | null;
  detail?: string | null;
  is_active?: boolean | null;
  updated_by: string;
};

export type WorkReportDetailAction = {
  updated_by: string;
};

export type WorkReportDetailResponse = {
  work_report_detail_id: number;
  work_report_id: number;
  section_no: number;
  sequence_no: number;
  detail: string;
  is_active: boolean;
  mark_flag: boolean;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string | null;
};

export type WorkReportPurposeListParams = {
  skip?: number;
  limit?: number;
  purpose_code?: string;
  purpose_name?: string;
  is_active?: boolean;
  include_deleted?: boolean;
};

export type WorkReportItemTypeListParams = {
  skip?: number;
  limit?: number;
  work_item_code?: string;
  work_item_name?: string;
  require_detail?: boolean;
  is_active?: boolean;
  include_deleted?: boolean;
};

export type WorkReportListParams = {
  skip?: number;
  limit?: number;
  time_record_id?: number;
  purpose_id?: number;
  is_active?: boolean;
  include_deleted?: boolean;
};

export type WorkReportItemListParams = {
  skip?: number;
  limit?: number;
  work_report_id?: number;
  work_item_type_id?: number;
  is_active?: boolean;
  include_deleted?: boolean;
};

export type WorkReportDetailListParams = {
  skip?: number;
  limit?: number;
  work_report_id?: number;
  section_no?: number;
  is_active?: boolean;
  include_deleted?: boolean;
};

export type WorkReportItemAction = {
  updated_by: string;
};
