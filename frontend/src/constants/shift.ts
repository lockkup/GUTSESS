import type { ShiftFormValues } from "../types/shift";

export const SHIFT_DEFAULT_VALUES: ShiftFormValues = {
  shift_name_th: "",
  shift_name_en: "",
  start_time: "",
  end_time: "",
  crosses_midnight: false,
  break_minutes: 0,
  work_minutes: 0,
  grace_in_minutes: 0,
  grace_out_minutes: 0,
  checkin_open_before_minutes: 0,
  checkin_open_after_minutes: 0,
  checkout_open_before_minutes: 0,
  checkout_open_after_minutes: 0,
  effective_from: "",
  effective_to: "",
  is_active: true,
};

export const SHIFT_STATUS_OPTIONS = [
  { value: "all", label: "สถานะทั้งหมด" },
  { value: "active", label: "ใช้งาน" },
  { value: "inactive", label: "ไม่ใช้งาน" },
] as const;