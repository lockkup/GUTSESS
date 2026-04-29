export type EmbeddingStatus = "not_uploaded" | "pending" | "ready" | "failed";

export type FaceProfile = {
  face_profile_id: number;
  employee_code: string;
  reference_image: string;
  reference_image_url: string | null;
  embedding_status: EmbeddingStatus;
  has_embedding: boolean;
  is_active: boolean;
  mark_flag: number;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string | null;
};

export type ListFaceProfilesParams = {
  skip?: number;
  limit?: number;
  employee_code?: string;
  is_active?: boolean;
  include_deleted?: boolean;
};

export type CreateFaceProfilePayload = {
  employee_code: string;
  is_active: boolean;
  created_by: string;
  reference_image_file: File;
  face_embedding: string;
};

export type UpdateFaceProfilePayload = {
  employee_code?: string;
  is_active?: boolean;
  updated_by: string;
  reference_image_file?: File;
  face_embedding?: string;
};