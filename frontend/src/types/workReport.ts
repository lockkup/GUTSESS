// src/types/workReport.ts

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
  purpose_id: number;
  additional_note?: string | null;
  is_active?: boolean;
  created_by: string;
};

export type WorkReportUpdate = {
  purpose_id?: number | null;
  additional_note?: string | null;
  is_active?: boolean | null;
  updated_by: string;
};

export type WorkReportResponse = {
  work_report_id: number;
  time_record_id: number;
  purpose_id: number;
  additional_note: string | null;
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
  work_item_detail?: string | null;
  is_active?: boolean;
  created_by: string;
};

export type WorkReportItemUpdate = {
  work_item_type_id?: number | null;
  sequence_no?: number | null;
  work_item_detail?: string | null;
  is_active?: boolean | null;
  updated_by: string;
};

export type WorkReportItemResponse = {
  work_report_item_id: number;
  work_report_id: number;
  work_item_type_id: number;
  sequence_no: number;
  work_item_detail: string | null;
  is_active: boolean;
  active_sequence_no: number | null;
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

export type WorkReportItemAction = {
  updated_by: string;
};