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

const BASE_PATH = "/checkpoint-assignment-calls";

export function createCheckpointAssignmentCall(
  payload: CreateCheckpointAssignmentCallPayload,
): Promise<CheckpointAssignmentCallResponse> {
  return api.post<CheckpointAssignmentCallResponse>(`${BASE_PATH}/`, payload);
}

/**
 * ดึงข้อมูลการโทรล่าสุดของ Assignment
 *
 * Backend เรียง call_datetime DESC และ assignment_call_id DESC
 * จึงใช้ limit = 1 เพื่อเอารายการล่าสุด
 */
export async function getLatestCheckpointAssignmentCall(
  assignmentId: number,
): Promise<CheckpointAssignmentCallResponse | null> {
  if (!Number.isInteger(assignmentId) || assignmentId <= 0) {
    return null;
  }

  const data = await api.get<CheckpointAssignmentCallResponse[]>(
    `${BASE_PATH}/`,
    {
      assignment_id: assignmentId,
      is_active: true,
      include_deleted: false,
      skip: 0,
      limit: 1,
    },
  );

  return data[0] ?? null;
}