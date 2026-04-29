export type Shift = {
  shift_id: number;
  shift_name_th: string;
  shift_name_en: string;
  start_time: string;
  end_time: string;
  crosses_midnight: boolean;
  break_minutes: number;
  work_minutes: number;
  grace_in_minutes: number;
  grace_out_minutes: number;
  checkin_open_before_minutes: number;
  checkin_open_after_minutes: number;
  checkout_open_before_minutes: number;
  checkout_open_after_minutes: number;
  effective_from: string;
  effective_to?: string | null;
  is_active: boolean;
  mark_flag: number;
};

export type ShiftFormValues = Omit<Shift, "shift_id" | "mark_flag">;

export type ShiftStatusFilter = "all" | "active" | "inactive" | "deleted";

export type GetShiftsParams = {
  include_deleted?: boolean;
  is_active?: boolean;
  skip?: number;
  limit?: number;
};