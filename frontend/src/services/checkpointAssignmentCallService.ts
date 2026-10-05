import api from "@/lib/api";

export type CheckpointAssignmentCallImage = {
  time_record_image_id: number;
  time_record_id: number | null;
  work_report_item_id: number | null;
  assignment_call_id: number | null;

  image_type:
    | "checkin"
    | "checkout"
    | "work_report"
    | "checkpoint_call";

  image_scope_id: number;

  sequence_no: number;
  image_path: string;

  created_at: string;
  created_by: string;
};

export type CreateCheckpointAssignmentCallPayload = {
  assignment_id: number;
  contact_detail: string;
  call_status: number;
  call_note?: string | null;
  created_by: string;

  // รูปใหม่จากหน้าบันทึกการโทร สูงสุด 3 รูป
  images?: File[];
};

export type UpdateCheckpointAssignmentCallPayload = {
  contact_detail: string;
  call_status: number;
  call_note?: string | null;
  updated_by: string;

  // รูปใหม่ / รูปที่ใช้แทนรูปเดิมเท่านั้น
  images?: File[];

  // ลำดับรูปปัจจุบันของ Modal
  // number = รูปเดิมที่ยังคงอยู่
  // null = ตำแหน่งของรูปใหม่
  image_ids: Array<number | null>;

  // รหัสรูปเดิมที่ผู้ใช้ลบหรือเปลี่ยนออก
  deleted_image_ids: number[];
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

  // รูปที่แนบกับบันทึกการโทร
  images: CheckpointAssignmentCallImage[];
};

const BASE_PATH = "/checkpoint-assignment-calls";
const MAX_IMAGES = 3;

/* ============================================================
   Create
   ============================================================ */

export function createCheckpointAssignmentCall(
  payload: CreateCheckpointAssignmentCallPayload,
): Promise<CheckpointAssignmentCallResponse> {
  const formData = new FormData();

  formData.append(
    "assignment_id",
    String(payload.assignment_id),
  );

  formData.append(
    "contact_detail",
    payload.contact_detail,
  );

  formData.append(
    "call_status",
    String(payload.call_status),
  );

  formData.append(
    "created_by",
    payload.created_by,
  );

  if (
    payload.call_note !== undefined &&
    payload.call_note !== null
  ) {
    formData.append(
      "call_note",
      payload.call_note,
    );
  }

  if (payload.images && payload.images.length > 0) {
    payload.images
      .slice(0, MAX_IMAGES)
      .forEach((file) => {
        formData.append(
          "images",
          file,
        );
      });
  }

  return api.post<CheckpointAssignmentCallResponse>(
    `${BASE_PATH}/`,
    formData,
  );
}

/* ============================================================
   Update
   ============================================================ */

export function updateCheckpointAssignmentCall(
  assignmentCallId: number,
  payload: UpdateCheckpointAssignmentCallPayload,
): Promise<CheckpointAssignmentCallResponse> {
  const formData = new FormData();

  formData.append(
    "contact_detail",
    payload.contact_detail,
  );

  formData.append(
    "call_status",
    String(payload.call_status),
  );

  formData.append(
    "updated_by",
    payload.updated_by,
  );

  if (
    payload.call_note !== undefined &&
    payload.call_note !== null
  ) {
    formData.append(
      "call_note",
      payload.call_note,
    );
  }

  /*
   * ส่งเป็น JSON string เพื่อรักษาลำดับและค่า null
   *
   * ตัวอย่าง:
   * [131, 132, null]
   *
   * Backend ใช้ลำดับนี้กำหนด sequence_no
   * โดย null หมายถึงตำแหน่งที่จะใช้ไฟล์ใหม่
   */
  formData.append(
    "image_ids",
    JSON.stringify(payload.image_ids),
  );

  formData.append(
    "deleted_image_ids",
    JSON.stringify(payload.deleted_image_ids),
  );

  if (payload.images && payload.images.length > 0) {
    payload.images
      .slice(0, MAX_IMAGES)
      .forEach((file) => {
        formData.append(
          "images",
          file,
        );
      });
  }

  return api.patch<CheckpointAssignmentCallResponse>(
    `${BASE_PATH}/${assignmentCallId}`,
    formData,
  );
}

/* ============================================================
   Get latest call
   ============================================================ */

/**
 * ดึงข้อมูลการโทรล่าสุดของ Assignment
 *
 * Backend เรียง call_datetime DESC และ assignment_call_id DESC
 * จึงใช้ limit = 1 เพื่อเอารายการล่าสุด
 */
export async function getLatestCheckpointAssignmentCall(
  assignmentId: number,
): Promise<CheckpointAssignmentCallResponse | null> {
  if (
    !Number.isInteger(assignmentId) ||
    assignmentId <= 0
  ) {
    return null;
  }

  const data = await api.get<
    CheckpointAssignmentCallResponse[]
  >(
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
