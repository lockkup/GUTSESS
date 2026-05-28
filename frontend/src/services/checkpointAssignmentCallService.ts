import api from "@/lib/api";

export type CreateCheckpointAssignmentCallPayload = {
  assignment_id: number;
  contact_detail: string;
  call_status: number;
  call_note?: string | null;
  created_by: string;
};

export type CheckpointAssignmentCallResponse = {
  assignment_call_id: number;
  assignment_id: number;
  call_datetime: string;
  contact_detail: string;
  call_status: number;
  call_note: string | null;
  is_active: boolean;
  mark_flag: boolean;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string | null;
};

const BASE_PATH = "/api/checkpoint-assignment-calls";

export function createCheckpointAssignmentCall(
  payload: CreateCheckpointAssignmentCallPayload,
): Promise<CheckpointAssignmentCallResponse> {
  return api.post<CheckpointAssignmentCallResponse>(`${BASE_PATH}/`, payload);
}