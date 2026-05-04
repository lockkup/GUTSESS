import api from "../lib/api";

export type FaceProfile = {
  face_profile_id: number;
  employee_code: string;
  reference_image: string;
  reference_image_url: string | null;
  embedding_status: "not_uploaded" | "pending" | "ready" | "failed";
  has_embedding: boolean;
  is_active: boolean;
  mark_flag: number;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string | null;
};

export type ListParams = {
  skip?: number;
  limit?: number;
  is_active?: boolean;
  include_deleted?: boolean;
};

export type CreatePayload = {
  employee_code: string;
  is_active: boolean;
  created_by: string;
  reference_image_file: File;
  face_embedding: string;
};

export type UpdatePayload = {
  is_active?: boolean;
  updated_by: string;
  reference_image_file?: File;
  face_embedding?: string;
};

const BASE_PATH = "/api/face-profiles";

export async function listFaceProfiles(params: ListParams = {}) {
  return api.get<FaceProfile[]>(BASE_PATH, params);
}

export async function createFaceProfile(payload: CreatePayload) {
  const formData = new FormData();
  formData.append("employee_code", payload.employee_code.trim());
  formData.append("is_active", String(payload.is_active));
  formData.append("created_by", payload.created_by.trim());
  formData.append("reference_image", payload.reference_image_file);
  formData.append("face_embedding", payload.face_embedding);

  return api.post<FaceProfile>(BASE_PATH, formData);
}

export async function updateFaceProfile(
  faceProfileId: number,
  payload: UpdatePayload,
) {
  const formData = new FormData();
  formData.append("updated_by", payload.updated_by.trim());

  if (payload.is_active !== undefined) {
    formData.append("is_active", String(payload.is_active));
  }

  if (payload.reference_image_file) {
    formData.append("reference_image", payload.reference_image_file);
  }

  if (payload.face_embedding) {
    formData.append("face_embedding", payload.face_embedding);
  }

  return api.patch<FaceProfile>(`${BASE_PATH}/${faceProfileId}`, formData);
}

export async function deleteFaceProfile(
  faceProfileId: number,
  updatedBy: string,
) {
  return api.delete<FaceProfile>(
    `${BASE_PATH}/${faceProfileId}?updated_by=${encodeURIComponent(
      updatedBy.trim(),
    )}`,
  );
}

export async function activateFaceProfile(
  faceProfileId: number,
  updatedBy: string,
) {
  return api.patch<FaceProfile>(
    `${BASE_PATH}/${faceProfileId}/activate?updated_by=${encodeURIComponent(
      updatedBy.trim(),
    )}`,
  );
}

export async function deactivateFaceProfile(
  faceProfileId: number,
  updatedBy: string,
) {
  return api.patch<FaceProfile>(
    `${BASE_PATH}/${faceProfileId}/deactivate?updated_by=${encodeURIComponent(
      updatedBy.trim(),
    )}`,
  );
}