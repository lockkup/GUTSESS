import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";

export type ShiftFormValues = {
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
  effective_to: string | null;
  is_active: boolean;
};

type ShiftFormModalProps = {
  isOpen: boolean;
  mode: "create" | "edit";
  initialValues?: Partial<ShiftFormValues>;
  onClose: () => void;
  onSubmit: (values: ShiftFormValues) => void;
};

function getTodayDateString() {
  const today = new Date();
  const timezoneOffset = today.getTimezoneOffset() * 60000;
  return new Date(today.getTime() - timezoneOffset).toISOString().slice(0, 10);
}

function normalizeDateInput(value?: string | null) {
  if (!value) return "";
  return value.slice(0, 10);
}

function getDefaultValues(): ShiftFormValues {
  return {
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
    effective_from: getTodayDateString(),
    effective_to: null,
    is_active: true,
  };
}

function isValidTimeFormat(value: string) {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
}

function toMinutes(timeValue: string) {
  if (!isValidTimeFormat(timeValue)) return 0;

  const [hour, minute] = timeValue.split(":").map(Number);
  return hour * 60 + minute;
}

function normalizeTimeInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 4);

  if (digits.length === 0) return "";
  if (digits.length <= 2) return digits;

  if (digits.length === 3) {
    const firstTwoDigitsAsHour = Number(digits.slice(0, 2));

    if (firstTwoDigitsAsHour <= 23) {
      return `${digits.slice(0, 2)}:${digits.slice(2)}`;
    }

    return `0${digits.slice(0, 1)}:${digits.slice(1)}`;
  }

  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function finalizeTimeInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 4);

  if (digits.length === 0) return "";

  let hour = 0;
  let minute = 0;

  if (digits.length <= 2) {
    hour = Number(digits);
    minute = 0;
  } else if (digits.length === 3) {
    const firstTwoDigitsAsHour = Number(digits.slice(0, 2));

    if (firstTwoDigitsAsHour <= 23) {
      hour = firstTwoDigitsAsHour;
      minute = Number(digits.slice(2).padEnd(2, "0"));
    } else {
      hour = Number(digits.slice(0, 1));
      minute = Number(digits.slice(1));
    }
  } else {
    hour = Number(digits.slice(0, 2));
    minute = Number(digits.slice(2));
  }

  hour = Math.min(Math.max(hour, 0), 23);
  minute = Math.min(Math.max(minute, 0), 59);

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function normalizeInitialValues(
  initialValues?: Partial<ShiftFormValues>,
): ShiftFormValues {
  const defaultValues = getDefaultValues();

  return {
    ...defaultValues,
    ...initialValues,
    start_time: initialValues?.start_time
      ? finalizeTimeInput(initialValues.start_time)
      : defaultValues.start_time,
    end_time: initialValues?.end_time
      ? finalizeTimeInput(initialValues.end_time)
      : defaultValues.end_time,
    effective_from:
      normalizeDateInput(initialValues?.effective_from) || getTodayDateString(),
    effective_to: normalizeDateInput(initialValues?.effective_to) || null,
  };
}

function calculateWorkMinutes(
  values: Pick<
    ShiftFormValues,
    "start_time" | "end_time" | "crosses_midnight" | "break_minutes"
  >,
) {
  if (!isValidTimeFormat(values.start_time) || !isValidTimeFormat(values.end_time)) {
    return 0;
  }

  const start = toMinutes(values.start_time);
  const end = toMinutes(values.end_time);

  const diff = values.crosses_midnight ? 24 * 60 - start + end : end - start;

  const total = diff - Number(values.break_minutes || 0);
  return total > 0 ? total : 0;
}

function formatDurationThai(minutes: number) {
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hrs} ชั่วโมง ${mins} นาที`;
}

export default function ShiftFormModal({
  isOpen,
  mode,
  initialValues,
  onClose,
  onSubmit,
}: ShiftFormModalProps) {
  const [form, setForm] = useState<ShiftFormValues>(() => getDefaultValues());

  useEffect(() => {
    if (!isOpen) return;

    setForm(normalizeInitialValues(initialValues));
  }, [initialValues, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const workMinutes = calculateWorkMinutes({
      start_time: form.start_time,
      end_time: form.end_time,
      crosses_midnight: form.crosses_midnight,
      break_minutes: form.break_minutes,
    });

    setForm((prev) =>
      prev.work_minutes === workMinutes
        ? prev
        : {
            ...prev,
            work_minutes: workMinutes,
          },
    );
  }, [
    form.start_time,
    form.end_time,
    form.crosses_midnight,
    form.break_minutes,
    isOpen,
  ]);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  const modalTitle = useMemo(
    () => (mode === "create" ? "เพิ่มกะงาน" : "แก้ไขกะงาน"),
    [mode],
  );

  const handleTextChange = (
    key: keyof ShiftFormValues,
    value: string | boolean | number | null,
  ) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleNumberChange = (key: keyof ShiftFormValues, value: string) => {
    setForm((prev) => ({
      ...prev,
      [key]: value === "" ? 0 : Number(value),
    }));
  };

  const handleTimeChange = (key: "start_time" | "end_time", value: string) => {
    setForm((prev) => ({
      ...prev,
      [key]: normalizeTimeInput(value),
    }));
  };

  const handleTimeBlur = (key: "start_time" | "end_time") => {
    setForm((prev) => ({
      ...prev,
      [key]: finalizeTimeInput(prev[key]),
    }));
  };

  const handleReset = () => {
    setForm(normalizeInitialValues(initialValues));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedForm: ShiftFormValues = {
      ...form,
      start_time: finalizeTimeInput(form.start_time),
      end_time: finalizeTimeInput(form.end_time),
      effective_from: normalizeDateInput(form.effective_from) || getTodayDateString(),
      effective_to: normalizeDateInput(form.effective_to) || null,
    };

    setForm(normalizedForm);

    if (!normalizedForm.shift_name_th.trim()) {
      window.alert("กรุณากรอกชื่อกะ (ไทย)");
      return;
    }

    if (!normalizedForm.shift_name_en.trim()) {
      window.alert("กรุณากรอกชื่อกะ (อังกฤษ)");
      return;
    }

    if (!normalizedForm.start_time || !normalizedForm.end_time) {
      window.alert("กรุณากรอกเวลาเริ่มงานและเวลาสิ้นสุดงาน");
      return;
    }

    if (
      !isValidTimeFormat(normalizedForm.start_time) ||
      !isValidTimeFormat(normalizedForm.end_time)
    ) {
      window.alert("กรุณากรอกเวลาเป็นรูปแบบ 24 ชั่วโมง HH:mm เช่น 08:00 หรือ 20:00");
      return;
    }

    if (
      !normalizedForm.crosses_midnight &&
      toMinutes(normalizedForm.end_time) <= toMinutes(normalizedForm.start_time)
    ) {
      window.alert(
        "เวลาสิ้นสุดงานต้องมากกว่าเวลาเริ่มงาน ถ้าเป็นกะข้ามวันให้เปิดสวิตช์กะข้ามวัน",
      );
      return;
    }

    if (!normalizedForm.effective_from) {
      window.alert("กรุณาเลือกวันที่เริ่มใช้");
      return;
    }

    if (
      normalizedForm.effective_to &&
      normalizedForm.effective_to < normalizedForm.effective_from
    ) {
      window.alert("วันที่สิ้นสุดต้องไม่น้อยกว่าวันที่เริ่มใช้");
      return;
    }

    onSubmit({
      ...normalizedForm,
      work_minutes: calculateWorkMinutes({
        start_time: normalizedForm.start_time,
        end_time: normalizedForm.end_time,
        crosses_midnight: normalizedForm.crosses_midnight,
        break_minutes: normalizedForm.break_minutes,
      }),
    });
  };

  if (!isOpen) return null;

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          <h2 style={titleStyle}>{modalTitle}</h2>
          <button type="button" style={closeButtonStyle} onClick={onClose}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} style={formStyle}>
          <div style={contentStyle}>
            <section style={sectionStyle}>
              <h3 style={sectionTitleStyle}>ข้อมูลพื้นฐาน</h3>

              <div style={grid2Style}>
                <div style={fieldStyle}>
                  <label style={labelStyle}>ชื่อกะ (ไทย)</label>
                  <input
                    style={inputStyle}
                    type="text"
                    placeholder="ชื่อกะ (ไทย)"
                    value={form.shift_name_th}
                    onChange={(e) => handleTextChange("shift_name_th", e.target.value)}
                  />
                </div>

                <div style={fieldStyle}>
                  <label style={labelStyle}>ชื่อกะ (อังกฤษ)</label>
                  <input
                    style={inputStyle}
                    type="text"
                    placeholder="ชื่อกะ (อังกฤษ)"
                    value={form.shift_name_en}
                    onChange={(e) => handleTextChange("shift_name_en", e.target.value)}
                  />
                </div>
              </div>

              <div style={grid2Style}>
                <div style={switchFieldStyle}>
                  <span style={labelStyle}>สถานะใช้งาน</span>
                  <label style={toggleStyle}>
                    <input
                      style={hiddenSwitchInputStyle}
                      type="checkbox"
                      checked={form.is_active}
                      onChange={(e) => handleTextChange("is_active", e.target.checked)}
                    />
                    <span style={sliderStyle(form.is_active)}>
                      <span style={sliderKnobStyle(form.is_active)} />
                    </span>
                  </label>
                </div>

                <div style={switchFieldStyle}>
                  <span style={labelStyle}>กะข้ามวัน</span>
                  <label style={toggleStyle}>
                    <input
                      style={hiddenSwitchInputStyle}
                      type="checkbox"
                      checked={form.crosses_midnight}
                      onChange={(e) =>
                        handleTextChange("crosses_midnight", e.target.checked)
                      }
                    />
                    <span style={sliderStyle(form.crosses_midnight)}>
                      <span style={sliderKnobStyle(form.crosses_midnight)} />
                    </span>
                  </label>
                </div>
              </div>
            </section>

            <section style={sectionStyle}>
              <h3 style={sectionTitleStyle}>เวลาทำงาน</h3>

              <div style={grid2Style}>
                <div style={fieldStyle}>
                  <label style={labelStyle}>เวลาเริ่มงาน</label>
                  <input
                    style={timeInputStyle}
                    type="text"
                    inputMode="numeric"
                    placeholder="เช่น 08:00"
                    maxLength={5}
                    value={form.start_time}
                    onChange={(e) => handleTimeChange("start_time", e.target.value)}
                    onBlur={() => handleTimeBlur("start_time")}
                  />
                </div>

                <div style={fieldStyle}>
                  <label style={labelStyle}>เวลาสิ้นสุดงาน</label>
                  <input
                    style={timeInputStyle}
                    type="text"
                    inputMode="numeric"
                    placeholder="เช่น 17:00"
                    maxLength={5}
                    value={form.end_time}
                    onChange={(e) => handleTimeChange("end_time", e.target.value)}
                    onBlur={() => handleTimeBlur("end_time")}
                  />
                </div>
              </div>

              <div style={grid2Style}>
                <div style={fieldStyle}>
                  <label style={labelStyle}>เวลาพัก (นาที)</label>
                  <input
                    style={inputStyle}
                    type="number"
                    min={0}
                    placeholder="0"
                    value={form.break_minutes}
                    onChange={(e) => handleNumberChange("break_minutes", e.target.value)}
                  />
                </div>

                <div style={fieldStyle}>
                  <label style={labelStyle}>เวลางานรวม</label>
                  <input
                    style={readOnlyInputStyle}
                    type="text"
                    value={formatDurationThai(form.work_minutes)}
                    readOnly
                  />
                </div>
              </div>
            </section>

            <section style={sectionStyle}>
              <h3 style={sectionTitleStyle}>กติกาการลงเวลา</h3>

              <div style={grid2Style}>
                <div style={fieldStyle}>
                  <label style={labelStyle}>ผ่อนผันเวลาเข้างาน (นาที)</label>
                  <input
                    style={inputStyle}
                    type="number"
                    min={0}
                    placeholder="0"
                    value={form.grace_in_minutes}
                    onChange={(e) =>
                      handleNumberChange("grace_in_minutes", e.target.value)
                    }
                  />
                </div>

                <div style={fieldStyle}>
                  <label style={labelStyle}>ผ่อนผันเวลาออกงาน (นาที)</label>
                  <input
                    style={inputStyle}
                    type="number"
                    min={0}
                    placeholder="0"
                    value={form.grace_out_minutes}
                    onChange={(e) =>
                      handleNumberChange("grace_out_minutes", e.target.value)
                    }
                  />
                </div>
              </div>

              <div style={grid2Style}>
                <div style={fieldStyle}>
                  <label style={labelStyle}>เปิดเช็กอินก่อนเวลา (นาที)</label>
                  <input
                    style={inputStyle}
                    type="number"
                    min={0}
                    placeholder="0"
                    value={form.checkin_open_before_minutes}
                    onChange={(e) =>
                      handleNumberChange("checkin_open_before_minutes", e.target.value)
                    }
                  />
                </div>

                <div style={fieldStyle}>
                  <label style={labelStyle}>เปิดเช็กอินหลังเวลา (นาที)</label>
                  <input
                    style={inputStyle}
                    type="number"
                    min={0}
                    placeholder="0"
                    value={form.checkin_open_after_minutes}
                    onChange={(e) =>
                      handleNumberChange("checkin_open_after_minutes", e.target.value)
                    }
                  />
                </div>
              </div>

              <div style={grid2Style}>
                <div style={fieldStyle}>
                  <label style={labelStyle}>เปิดเช็กเอาต์ก่อนเวลา (นาที)</label>
                  <input
                    style={inputStyle}
                    type="number"
                    min={0}
                    placeholder="0"
                    value={form.checkout_open_before_minutes}
                    onChange={(e) =>
                      handleNumberChange("checkout_open_before_minutes", e.target.value)
                    }
                  />
                </div>

                <div style={fieldStyle}>
                  <label style={labelStyle}>เปิดเช็กเอาต์หลังเวลา (นาที)</label>
                  <input
                    style={inputStyle}
                    type="number"
                    min={0}
                    placeholder="0"
                    value={form.checkout_open_after_minutes}
                    onChange={(e) =>
                      handleNumberChange("checkout_open_after_minutes", e.target.value)
                    }
                  />
                </div>
              </div>
            </section>

            <section style={sectionStyle}>
              <h3 style={sectionTitleStyle}>วันที่มีผล</h3>

              <div style={grid2Style}>
                <div style={fieldStyle}>
                  <label style={labelStyle}>วันที่เริ่มใช้</label>
                  <input
                    style={inputStyle}
                    type="date"
                    value={form.effective_from}
                    onChange={(e) => handleTextChange("effective_from", e.target.value)}
                  />
                </div>

                <div style={fieldStyle}>
                  <label style={labelStyle}>วันที่สิ้นสุด</label>
                  <input
                    style={inputStyle}
                    type="date"
                    value={form.effective_to ?? ""}
                    onChange={(e) =>
                      handleTextChange("effective_to", e.target.value || null)
                    }
                  />
                </div>
              </div>
            </section>
          </div>

          <div style={footerStyle}>
            <button type="submit" style={saveButtonStyle}>
              บันทึก
            </button>
            <button type="button" style={resetButtonStyle} onClick={handleReset}>
              ล้างข้อมูล
            </button>
            <button type="button" style={cancelButtonStyle} onClick={onClose}>
              ยกเลิก
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const overlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.28)",
  backdropFilter: "blur(4px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px",
  zIndex: 1000,
};

const modalStyle: CSSProperties = {
  width: "100%",
  maxWidth: "980px",
  maxHeight: "90vh",
  background: "#ffffff",
  borderRadius: "24px",
  boxShadow: "0 24px 64px rgba(16, 24, 40, 0.18)",
  overflow: "hidden",
  border: "1px solid #e4e7ec",
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "20px 24px",
  borderBottom: "1px solid #eaecf0",
  background: "#ffffff",
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: "32px",
  fontWeight: 800,
  color: "#101828",
};

const closeButtonStyle: CSSProperties = {
  width: "40px",
  height: "40px",
  border: "none",
  borderRadius: "10px",
  background: "#f2f4f7",
  color: "#344054",
  fontSize: "28px",
  cursor: "pointer",
};

const formStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  maxHeight: "calc(90vh - 81px)",
};

const contentStyle: CSSProperties = {
  padding: "24px",
  overflowY: "auto",
  display: "flex",
  flexDirection: "column",
  gap: "20px",
};

const sectionStyle: CSSProperties = {
  border: "1px solid #eaecf0",
  borderRadius: "18px",
  padding: "18px",
  background: "#fcfcfd",
};

const sectionTitleStyle: CSSProperties = {
  margin: "0 0 16px",
  fontSize: "24px",
  fontWeight: 800,
  color: "#101828",
};

const grid2Style: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "16px",
  marginBottom: "16px",
};

const fieldStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
};

const labelStyle: CSSProperties = {
  fontSize: "16px",
  fontWeight: 700,
  color: "#344054",
};

const inputStyle: CSSProperties = {
  width: "100%",
  height: "46px",
  border: "1px solid #d0d5dd",
  borderRadius: "12px",
  padding: "0 14px",
  outline: "none",
  fontSize: "16px",
  color: "#101828",
  background: "#ffffff",
  boxSizing: "border-box",
};

const timeInputStyle: CSSProperties = {
  ...inputStyle,
  fontVariantNumeric: "tabular-nums",
  letterSpacing: "0.04em",
};

const readOnlyInputStyle: CSSProperties = {
  ...inputStyle,
  background: "#f2f4f7",
  color: "#475467",
};

const switchFieldStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  minHeight: "46px",
  padding: "0 4px 0 0",
};

const toggleStyle: CSSProperties = {
  position: "relative",
  width: "54px",
  height: "30px",
  display: "inline-flex",
  cursor: "pointer",
};

const hiddenSwitchInputStyle: CSSProperties = {
  opacity: 0,
  width: 0,
  height: 0,
  position: "absolute",
};

const sliderStyle = (checked: boolean): CSSProperties => ({
  position: "absolute",
  inset: 0,
  background: checked ? "#2563eb" : "#d0d5dd",
  borderRadius: "999px",
  transition: "0.2s ease",
  boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.03)",
});

const sliderKnobStyle = (checked: boolean): CSSProperties => ({
  position: "absolute",
  left: checked ? "28px" : "4px",
  top: "4px",
  width: "22px",
  height: "22px",
  background: "#ffffff",
  borderRadius: "50%",
  transition: "0.2s ease",
  boxShadow: "0 2px 8px rgba(16, 24, 40, 0.16)",
});

const footerStyle: CSSProperties = {
  display: "flex",
  gap: "12px",
  justifyContent: "flex-start",
  padding: "18px 24px 24px",
  borderTop: "1px solid #eaecf0",
  background: "#ffffff",
};

const saveButtonStyle: CSSProperties = {
  height: "46px",
  padding: "0 18px",
  borderRadius: "12px",
  border: "1px solid #2563eb",
  background: "#2563eb",
  color: "#ffffff",
  fontSize: "16px",
  fontWeight: 800,
  cursor: "pointer",
};

const resetButtonStyle: CSSProperties = {
  height: "46px",
  padding: "0 18px",
  borderRadius: "12px",
  border: "1px solid #d0d5dd",
  background: "#ffffff",
  color: "#344054",
  fontSize: "16px",
  fontWeight: 700,
  cursor: "pointer",
};

const cancelButtonStyle: CSSProperties = {
  height: "46px",
  padding: "0 18px",
  borderRadius: "12px",
  border: "1px solid #fda29b",
  background: "#fff5f5",
  color: "#b42318",
  fontSize: "16px",
  fontWeight: 800,
  cursor: "pointer",
};