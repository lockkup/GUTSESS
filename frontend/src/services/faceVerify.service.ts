import { api } from "../lib/api";
import type {
  FaceVerifyRequest,
  FaceVerifyResponse,
} from "../types/faceVerify";

const BASE_PATH = "/api/face-profiles";

export const faceVerifyService = {
  verify(payload: FaceVerifyRequest) {
    return api.post<FaceVerifyResponse>(`${BASE_PATH}/verify`, payload);
  },
};