export type FaceVerifyRequest = {
  employee_code: string;
  face_embedding: number[];
};

export type FaceVerifyResponse = {
  is_match: boolean;
  message: string;
  distance: number;
  threshold: number;
};