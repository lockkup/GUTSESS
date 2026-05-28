// src/services/checkpointAssignmentService.ts

import api from "@/lib/api";
import type {
  CheckpointDailyRow,
  ShiftType,
} from "@/types/checkpointAssignment";

type GetDailyCheckpointAssignmentsParams = {
  workDate: string;

  /**
   * day = ผลัดกลางวัน
   * night = ผลัดกลางคืน
   * ถ้าไม่ส่ง จะดึงทุกผลัดตามที่ backend รองรับ
   */
  shiftType?: ShiftType | null;
};

export function getDailyCheckpointAssignments({
  workDate,
  shiftType,
}: GetDailyCheckpointAssignmentsParams) {
  return api.get<CheckpointDailyRow[]>("/api/checkpoint-assignments/daily", {
    work_date: workDate,
    shift_type: shiftType ?? undefined,
    is_active: true,
    include_deleted: false,
  });
}