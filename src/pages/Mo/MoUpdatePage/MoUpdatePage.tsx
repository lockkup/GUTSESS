// src/pages/Home.tsx
import { useState, useEffect } from "react";
import {
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  Save,
  Trash2,
} from "lucide-react";
import ConfirmDeleteDialog from "../../../components/Mo/ConfirmDeleteDialog";
import styles from "./MoUpdatePage.module.css";

type Props = {
  onCancel?: () => void;
  item?: any;
};

export default function MoUpdatePage(props: Props) {
  console.log(props)
  const [date] = useState(() => new Date().toLocaleDateString("th-TH"));
  const [region, setRegion] = useState("");
  // ลา
  const [sickLeave, setSickLeave] = useState("");
  const [personalLeave, setPersonalLeave] = useState("");
  const [otherLeaveType, setOtherLeaveType] = useState("");

  // กำลังพล
  const [absentCount, setAbsentCount] = useState("");
  const [onDutyCount, setOnDutyCount] = useState("");
  const [workHours, setWorkHours] = useState("18");
  // breakdown for การควงกะ
  const [workShiftOpen, setWorkShiftOpen] = useState(true);
  const [shift18, setShift18] = useState("");
  const [shift24, setShift24] = useState("");
  const [shift36, setShift36] = useState("");
  // collapse state for "กำลังพล" box
  const [personnelOpen, setPersonnelOpen] = useState(true);
  // ผิดข้อปฏิบัติ / การตักเตือน
  const [disciplineType, setDisciplineType] = useState("");
  const [disciplineNote, setDisciplineNote] = useState("");
  // collapse + numeric counts for ผิดข้อปฏิบัติ UI
  const [disciplineOpen, setDisciplineOpen] = useState(true);
  const [sleepCount, setSleepCount] = useState("");
  const [phoneCount, setPhoneCount] = useState("");
  const [badgeCount, setBadgeCount] = useState("");
  // เครื่องแต่งกาย
  const [uniformIssue, setUniformIssue] = useState("");
  const [uniformNote, setUniformNote] = useState("");
  // เครื่องแต่งกาย - counts
  const [hatCount, setHatCount] = useState("");
  const [shirtCount, setShirtCount] = useState("");
  const [pantsCount, setPantsCount] = useState("");
  const [shoesCount, setShoesCount] = useState("");
  // collapse state for เครื่องแต่งกาย
  const [uniformOpen, setUniformOpen] = useState(true);
  // อื่น ๆ
  const [otherEvent, setOtherEvent] = useState<"พบผู้งาน" | "อบรม" | "">("");
  const [otherNote, setOtherNote] = useState("");
  // "อื่น ๆ" detailed rows
  const [foundCount, setFoundCount] = useState("");
  const [foundNote, setFoundNote] = useState("");
  const [trainCount, setTrainCount] = useState("");
  const [trainNote, setTrainNote] = useState("");

  // new: collapse state for "ลา" card
  const [leaveOpen, setLeaveOpen] = useState(true);

  // show the small action icons (Save/Delete) instead of the bottom full actions
  // Note: `true` means the *form actions* (bottom) are visible — keep icons hidden on open
  const [showActionIcons, setShowActionIcons] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  useEffect(() => {
    const it = props.item;
    if (!it) return;

    // populate fields from the incoming case record
    setRegion(it.location ?? "");

    setSickLeave(it.leave_sick_count != null ? String(it.leave_sick_count) : "");
    setPersonalLeave(it.leave_business_count != null ? String(it.leave_business_count) : "");
    setOtherLeaveType(it.leave_other_count != null ? String(it.leave_other_count) : "");

    setAbsentCount(it.absent_count != null ? String(it.absent_count) : "");
    setOnDutyCount(it.on_duty_count != null ? String(it.on_duty_count) : "");
    setWorkHours(it.work_hours != null ? String(it.work_hours) : workHours);

    setShift18(it.shift_18_count != null ? String(it.shift_18_count) : "");
    setShift24(it.shift_24_count != null ? String(it.shift_24_count) : "");
    setShift36(it.shift_36_count != null ? String(it.shift_36_count) : "");

    setSleepCount(it.rule_sleep_count != null ? String(it.rule_sleep_count) : "");
    setPhoneCount(it.rule_phone_count != null ? String(it.rule_phone_count) : "");
    setBadgeCount(it.rule_no_card_count != null ? String(it.rule_no_card_count) : "");
    setDisciplineNote(it.warning ?? "");

    setUniformIssue(it.uniform_issue ?? "");
    setUniformNote(it.uniform_note ?? "");

    setHatCount(it.wear_hat_count != null ? String(it.wear_hat_count) : "");
    setShirtCount(it.wear_shirt_count != null ? String(it.wear_shirt_count) : "");
    setPantsCount(it.wear_pants_count != null ? String(it.wear_pants_count) : "");
    setShoesCount(it.wear_shoes_count != null ? String(it.wear_shoes_count) : "");

    setFoundCount(it.other_job_count != null ? String(it.other_job_count) : "");
    setFoundNote(it.other_job ?? "");
    setTrainCount(it.other_training_count != null ? String(it.other_training_count) : "");
    setTrainNote(it.other_training ?? "");
  }, [props.item]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      date,
      sickLeave,
      personalLeave,
      otherLeaveType,
      absentCount,
      onDutyCount,
      workHours,
      disciplineType,
      disciplineNote,
      uniformIssue,
      uniformNote,
      hatCount,
      shirtCount,
      pantsCount,
      shoesCount,
      otherEvent,
      otherNote,
      foundCount,
      foundNote,
      trainCount,
      trainNote,
    };
    console.log("MO submit", payload);
    // hide the inline icons after submit and show the bottom actions state
    setShowActionIcons(true);
    alert("บันทึกรายงาน (ตัวอย่าง) - ดู console.log");
  }

  // show modal first, perform delete only if confirmed
  function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setShowConfirmDelete(true);
  }

  function confirmDelete() {
    setShowConfirmDelete(false);
    // TODO: replace with real delete API call
    alert("ลบรายการแล้ว (ตัวอย่าง)");
    if (props.onCancel) return props.onCancel();
    return window.history.back();
  }

  function cancelDelete() {
    setShowConfirmDelete(false);
  }

  return (
    <>
      <div className={styles["gut-detail-btns-box"]} aria-hidden>
        <button
          type="button"
          className={styles["gut-back-icon"]}
          onClick={() => {
            if (props.onCancel) return props.onCancel();
            return window.history.back();
          }}
          aria-label="Back"
        >
          <ArrowLeft size={18} />
        </button>

        {!showActionIcons ? (
          <div className={styles["guts-action-icons"]} aria-hidden={false}>
            <button
              type="button"
              className={styles["guts-icon-btn"]}
              title="Save"
              aria-label="Save"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowActionIcons((v) => !v);
              }}
            >
              <Save size={18} />
            </button>

            <button
              type="button"
              className={`${styles["guts-icon-btn"]} ${styles["guts-icon-delete"]}`}
              onClick={handleDelete}
              title="Delete"
              aria-label="Delete"
            >
              <Trash2 size={18} />
            </button>
          </div>
        ) : null}
      </div>
      <ConfirmDeleteDialog
        open={showConfirmDelete}
        title="ยืนยันลบรายการนี้?"
        description={"รายการนี้จะถูกลบออกจากระบบ ไม่สามารถกู้คืนได้"}
        onCancel={cancelDelete}
        onConfirm={confirmDelete}
      />
      <form
        className={`${styles["guts-Mo-layout"]} ${showActionIcons ? styles["icons-visible"] : styles["icons-hidden"]}`}
        onSubmit={onSubmit}
      >
        <div className={`${styles["guts-box-title"]} ${styles["box-id"]}`}>#{props.item?.id ?? ""}</div>
        <div className={styles["guts-box"]}>
          <div className={styles["guts-box-title"]}>ภาค</div>
          <div className={[styles["guts-field-row"], styles["full-width"]].join(" ")}>
            <input
              className={styles["guts-input"]}
              value={region}
              disabled={!showActionIcons}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="ระบุภาคที่ปฏิบัติงาน"
            />
          </div>
        </div>

        <div className={[styles["guts-box"], styles["collapsible"]].join(" ")}>
          <div
            className={`${styles["guts-box-title"]} ${styles["collapsible"]}`}
            role="button"
            aria-expanded={leaveOpen}
            onClick={() => setLeaveOpen((v) => !v)}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") setLeaveOpen((v) => !v);
            }}
          >
            ลา
            <button
              type="button"
              className={styles["guts-collapse-toggle"]}
              aria-label={leaveOpen ? "ย่อ ลา" : "ขยาย ลา"}
            >
              {leaveOpen ? (
                <ChevronDown size={18} />
              ) : (
                <ChevronRight size={18} />
              )}
            </button>
          </div>
          <div className={`${styles["guts-box-body"]} ${leaveOpen ? "" : styles["collapsed"]}`}>
            <div className={[styles["guts-field-row"], styles["two-col"]].join(" ")}>
              <label className={styles["guts-label"]}>ลาป่วย</label>
              <div className={styles["guts-input-group"]}>
                <input
                  className={`${styles["guts-input"]} ${styles["small"]}`}
                  type="number"
                  min={0}
                  step={1}
                  value={sickLeave}
                  disabled={!showActionIcons}
                  onChange={(e) =>
                    setSickLeave(e.target.value.replace(/\D/g, ""))
                  }
                  onWheel={(e) => e.currentTarget.blur()}
                  placeholder="0"
                  inputMode="numeric"
                  pattern="[0-9]*"
                />
                <span className={styles["guts-suffix"]}>คน</span>
              </div>
            </div>

            <div className={[styles["guts-field-row"], styles["two-col"]].join(" ")}>
              <label className={styles["guts-label"]}>ลากิจ</label>
              <div className={styles["guts-input-group"]}>
                <input
                  className={`${styles["guts-input"]} ${styles["small"]}`}
                  type="number"
                  min={0}
                  step={1}
                  value={personalLeave}
                  disabled={!showActionIcons}
                  onChange={(e) =>
                    setPersonalLeave(e.target.value.replace(/\D/g, ""))
                  }
                  onWheel={(e) => e.currentTarget.blur()}
                  placeholder="0"
                  inputMode="numeric"
                  pattern="[0-9]*"
                />
                <span className={styles["guts-suffix"]}>คน</span>
              </div>
            </div>

            <div className={[styles["guts-field-row"], styles["two-col"]].join(" ")}>
              <label className={styles["guts-label"]}>ลาอื่น ๆ</label>
              <div className={styles["guts-input-group"]}>
                <input
                  className={`${styles["guts-input"]} ${styles["small"]}`}
                  type="number"
                  min={0}
                  step={1}
                  value={otherLeaveType}
                  disabled={!showActionIcons}
                  onChange={(e) =>
                    setOtherLeaveType(e.target.value.replace(/\D/g, ""))
                  }
                  onWheel={(e) => e.currentTarget.blur()}
                  placeholder="0"
                  inputMode="numeric"
                  pattern="[0-9]*"
                />
                <span className={styles["guts-suffix"]}>คน</span>
              </div>
            </div>
          </div>
        </div>

        <div className={[styles["guts-box"], styles["collapsible"]].join(" ")}>
          <div
            className={styles["guts-box-title"]}
            role="button"
            aria-expanded={personnelOpen}
            onClick={() => setPersonnelOpen((v) => !v)}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ")
                setPersonnelOpen((v) => !v);
            }}
          >
            กำลังพล
            <button
              type="button"
              className={styles["guts-collapse-toggle"]}
              aria-label={personnelOpen ? "ย่อ กำลังพล" : "ขยาย กำลังพล"}
            >
              {personnelOpen ? (
                <ChevronDown size={18} />
              ) : (
                <ChevronRight size={18} />
              )}
            </button>
          </div>

          <div className={`${styles["guts-box-body"]} ${personnelOpen ? "" : styles["collapsed"]}`}>
            <div className={[styles["guts-field-row"], styles["two-col"]].join(" ")}>
              <label className={styles["guts-label"]}>ขาดงาน</label>
              <div className={styles["guts-input-group"]}>
                <input
                  className={`${styles["guts-input"]} ${styles["small"]}`}
                  type="number"
                  min={0}
                  step={1}
                  value={absentCount}
                  disabled={!showActionIcons}
                  onChange={(e) =>
                    setAbsentCount(e.target.value.replace(/\D/g, ""))
                  }
                  onWheel={(e) => e.currentTarget.blur()}
                  placeholder="0"
                  inputMode="numeric"
                />
                <span className={styles["guts-suffix"]}>คน</span>
              </div>
            </div>

            <div className={styles["guts-subbox"]}>
              <div
                className={styles["guts-subbox-title"]}
                role="button"
                tabIndex={0}
                aria-expanded={workShiftOpen}
                onClick={() => setWorkShiftOpen((v) => !v)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ")
                    setWorkShiftOpen((v) => !v);
                }}
              >
                <label className={styles["guts-label"]}>การควงกะ</label>
                <div className={styles["guts-subbox-toggle"]} aria-hidden>
                  {workShiftOpen ? (
                    <ChevronDown size={18} />
                  ) : (
                    <ChevronRight size={18} />
                  )}
                </div>
              </div>

              <div
                className={`${styles["guts-subbox-body"]} ${workShiftOpen ? "" : styles["collapsed"]}`}
              >
                <div className={[styles["guts-field-row"], styles["two-col"]].join(" ")}>
                  <label className={styles["guts-label"]}>จัด 18 ชั่วโมง</label>
                  <div className={styles["guts-input-group"]}>
                    <input
                      className={`${styles["guts-input"]} ${styles["small"]}`}
                      type="number"
                      min={0}
                      step={1}
                      value={shift18}
                      disabled={!showActionIcons}
                      onChange={(e) =>
                        setShift18(e.target.value.replace(/\D/g, ""))
                      }
                      onWheel={(e) => e.currentTarget.blur()}
                      placeholder="0"
                      inputMode="numeric"
                    />
                    <span className={styles["guts-suffix"]}>คน</span>
                  </div>
                </div>

                <div className={[styles["guts-field-row"], styles["two-col"]].join(" ")}>
                  <label className={styles["guts-label"]}>จัด 24 ชั่วโมง</label>
                  <div className={styles["guts-input-group"]}>
                    <input
                      className={`${styles["guts-input"]} ${styles["small"]}`}
                      type="number"
                      min={0}
                      step={1}
                      value={shift24}
                      disabled={!showActionIcons}
                      onChange={(e) =>
                        setShift24(e.target.value.replace(/\D/g, ""))
                      }
                      onWheel={(e) => e.currentTarget.blur()}
                      placeholder="0"
                      inputMode="numeric"
                    />
                    <span className={styles["guts-suffix"]}>คน</span>
                  </div>
                </div>

                <div className={[styles["guts-field-row"], styles["two-col"]].join(" ")}>
                  <label className={styles["guts-label"]}>จัด 36 ชั่วโมง</label>
                  <div className={styles["guts-input-group"]}>
                    <input
                      className={`${styles["guts-input"]} ${styles["small"]}`}
                      type="number"
                      min={0}
                      step={1}
                      value={shift36}
                      disabled={!showActionIcons}
                      onChange={(e) =>
                        setShift36(e.target.value.replace(/\D/g, ""))
                      }
                      onWheel={(e) => e.currentTarget.blur()}
                      placeholder="0"
                      inputMode="numeric"
                    />
                    <span className={styles["guts-suffix"]}>คน</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={[styles["guts-box"], styles["collapsible"]].join(" ")}>
          <div
            className={styles["guts-box-title"]}
            role="button"
            aria-expanded={disciplineOpen}
            onClick={() => setDisciplineOpen((v) => !v)}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ")
                setDisciplineOpen((v) => !v);
            }}
          >
            ผิดข้อปฏิบัติ / การตักเตือน
            <button
              type="button"
              className={styles["guts-collapse-toggle"]}
              aria-label={
                disciplineOpen ? "ย่อ ผิดข้อปฏิบัติ" : "ขยาย ผิดข้อปฏิบัติ"
              }
            >
              {disciplineOpen ? (
                <ChevronDown size={18} />
              ) : (
                <ChevronRight size={18} />
              )}
            </button>
          </div>

          <div className={`${styles["guts-box-body"]} ${disciplineOpen ? "" : styles["collapsed"]}`}>
            <div className={[styles["guts-field-row"], styles["two-col"]].join(" ")}>
              <label className={styles["guts-label"]}>หลับเวร</label>
              <div className={styles["guts-input-group"]}>
                <input
                  className={`${styles["guts-input"]} ${styles["small"]}`}
                  type="number"
                  min={0}
                  step={1}
                  value={sleepCount}
                  disabled={!showActionIcons}
                  onChange={(e) =>
                    setSleepCount(e.target.value.replace(/\D/g, ""))
                  }
                  onWheel={(e) => e.currentTarget.blur()}
                  placeholder="0"
                  inputMode="numeric"
                />
                <span className={styles["guts-suffix"]}>คน</span>
              </div>
            </div>

            <div className={[styles["guts-field-row"], styles["two-col"]].join(" ")}>
              <label className={styles["guts-label"]}>เล่นโทรศัพท์</label>
              <div className={styles["guts-input-group"]}>
                <input
                  className={`${styles["guts-input"]} ${styles["small"]}`}
                  type="number"
                  min={0}
                  step={1}
                  value={phoneCount}
                  disabled={!showActionIcons}
                  onChange={(e) =>
                    setPhoneCount(e.target.value.replace(/\D/g, ""))
                  }
                  onWheel={(e) => e.currentTarget.blur()}
                  placeholder="0"
                  inputMode="numeric"
                />
                <span className={styles["guts-suffix"]}>คน</span>
              </div>
            </div>

            <div className={[styles["guts-field-row"], styles["two-col"]].join(" ")}>
              <label className={styles["guts-label"]}>ไม่แขวนบัตร</label>
              <div className={styles["guts-input-group"]}>
                <input
                  className={`${styles["guts-input"]} ${styles["small"]}`}
                  type="number"
                  min={0}
                  step={1}
                  value={badgeCount}
                  disabled={!showActionIcons}
                  onChange={(e) =>
                    setBadgeCount(e.target.value.replace(/\D/g, ""))
                  }
                  onWheel={(e) => e.currentTarget.blur()}
                  placeholder="0"
                  inputMode="numeric"
                />
                <span className={styles["guts-suffix"]}>คน</span>
              </div>
            </div>
            <div className={styles["guts-field-row"]}>
              <label className={[styles["guts-label"], styles["section-label"]].join(" ")}>การตักเตือน</label>
            </div>

            <div className={[styles["guts-field-row"], styles["full-width"]].join(" ")}>
              <textarea
                className={styles["guts-input-full"]}
                rows={2}
                value={disciplineNote}
                disabled={!showActionIcons}
                onChange={(e) => setDisciplineNote(e.target.value)}
                placeholder="บันทึกการตักเตือน (สาเหตุ/คำสั่ง/ผู้รับผิดชอบ)"
              />
            </div>
          </div>
        </div>

        <div className={[styles["guts-box"], styles["collapsible"]].join(" ")}>
          <div
            className={styles["guts-box-title"]}
            role="button"
            aria-expanded={uniformOpen}
            onClick={() => setUniformOpen((v) => !v)}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") setUniformOpen((v) => !v);
            }}
          >
            เครื่องแต่งกาย
            <button
              type="button"
              className={styles["guts-collapse-toggle"]}
              aria-label={
                uniformOpen ? "ย่อ เครื่องแต่งกาย" : "ขยาย เครื่องแต่งกาย"
              }
            >
              {uniformOpen ? (
                <ChevronDown size={18} />
              ) : (
                <ChevronRight size={18} />
              )}
            </button>
          </div>

          <div className={`${styles["guts-box-body"]} ${uniformOpen ? "" : styles["collapsed"]}`}>
            <div className={[styles["guts-field-row"], styles["two-col"]].join(" ")}>
              <label className={styles["guts-label"]}>หมวก เก่า:</label>
              <div className={styles["guts-input-group"]}>
                <input
                  className={`${styles["guts-input"]} ${styles["small"]}`}
                  type="number"
                  min={0}
                  step={1}
                  value={hatCount}
                  disabled={!showActionIcons}
                  onChange={(e) =>
                    setHatCount(e.target.value.replace(/\D/g, ""))
                  }
                  onWheel={(e) => e.currentTarget.blur()}
                  placeholder="0"
                  inputMode="numeric"
                />
                <span className={styles["guts-suffix"]}>คน</span>
              </div>
            </div>

            <div className={[styles["guts-field-row"], styles["two-col"]].join(" ")}>
              <label className={styles["guts-label"]}>เสื้อ เก่า:</label>
              <div className={styles["guts-input-group"]}>
                <input
                  className={`${styles["guts-input"]} ${styles["small"]}`}
                  type="number"
                  min={0}
                  step={1}
                  value={shirtCount}
                  disabled={!showActionIcons}
                  onChange={(e) =>
                    setShirtCount(e.target.value.replace(/\D/g, ""))
                  }
                  onWheel={(e) => e.currentTarget.blur()}
                  placeholder="0"
                  inputMode="numeric"
                />
                <span className={styles["guts-suffix"]}>คน</span>
              </div>
            </div>

            <div className={[styles["guts-field-row"], styles["two-col"]].join(" ")}>
              <label className={styles["guts-label"]}>กางเกง เก่า:</label>
              <div className={styles["guts-input-group"]}>
                <input
                  className={`${styles["guts-input"]} ${styles["small"]}`}
                  type="number"
                  min={0}
                  step={1}
                  value={pantsCount}
                  disabled={!showActionIcons}
                  onChange={(e) =>
                    setPantsCount(e.target.value.replace(/\D/g, ""))
                  }
                  onWheel={(e) => e.currentTarget.blur()}
                  placeholder="0"
                  inputMode="numeric"
                />
                <span className={styles["guts-suffix"]}>คน</span>
              </div>
            </div>

            <div className={[styles["guts-field-row"], styles["two-col"]].join(" ")}>
              <label className={styles["guts-label"]}>รองเท้า เก่า:</label>
              <div className={styles["guts-input-group"]}>
                <input
                  className={`${styles["guts-input"]} ${styles["small"]}`}
                  type="number"
                  min={0}
                  step={1}
                  value={shoesCount}
                  disabled={!showActionIcons}
                  onChange={(e) =>
                    setShoesCount(e.target.value.replace(/\D/g, ""))
                  }
                  onWheel={(e) => e.currentTarget.blur()}
                  placeholder="0"
                  inputMode="numeric"
                />
                <span className={styles["guts-suffix"]}>คน</span>
              </div>
            </div>
          </div>
        </div>

        <div className={styles["guts-box"]}>
          <div className={styles["guts-box-title"]}>อื่น ๆ</div>
          <div className={[styles["guts-field-row"], styles["two-col"]].join(" ")}>
            <label className={styles["guts-label"]}>พบผู้ว่างจ้าง:</label>
            <div className={styles["guts-input-group"]}>
              <input
                className={`${styles["guts-input"]} ${styles["small"]}`}
                type="number"
                min={0}
                step={1}
                value={foundCount}
                disabled={!showActionIcons}
                onChange={(e) =>
                  setFoundCount(e.target.value.replace(/\D/g, ""))
                }
                onWheel={(e) => e.currentTarget.blur()}
                placeholder="0"
                inputMode="numeric"
              />
              <span className={styles["guts-suffix"]}>จุด</span>
            </div>
          </div>

          <div className={styles["guts-detail-box"]}>
            <textarea
              className={`${styles["guts-input-full"]} ${styles["guts-detail-textarea"]}`}
              rows={2}
              value={foundNote}
              disabled={!showActionIcons}
              onChange={(e) => setFoundNote(e.target.value)}
              placeholder="รายละเอียด/เวลา/ผู้เกี่ยวข้อง"
            />
          </div>

          <div className={[styles["guts-field-row"], styles["two-col"]].join(" ")} style={{ marginTop: 8 }}>
            <label className={styles["guts-label"]}>อบรม:</label>
            <div className={styles["guts-input-group"]}>
              <input
                className={`${styles["guts-input"]} ${styles["small"]}`}
                type="number"
                min={0}
                step={1}
                value={trainCount}
                disabled={!showActionIcons}
                onChange={(e) =>
                  setTrainCount(e.target.value.replace(/\D/g, ""))
                }
                onWheel={(e) => e.currentTarget.blur()}
                placeholder="0"
                inputMode="numeric"
              />
              <span className={styles["guts-suffix"]}>จุด:</span>
            </div>
          </div>

          <div className={styles["guts-detail-box"]}>
            <textarea
              className={`${styles["guts-input-full"]} ${styles["guts-detail-textarea"]}`}
              rows={2}
              value={trainNote}
              disabled={!showActionIcons}
              onChange={(e) => setTrainNote(e.target.value)}
              placeholder="รายละเอียด/เวลา/ผู้เกี่ยวข้อง"
            />
          </div>
          <div className={[styles["guts-field-row"], styles["two-col"]].join(" ")} style={{ marginTop: 8 }}>
            <label className={styles["guts-label"]}>เพิ่มเติม:</label>
          </div>

          <div className={styles["guts-detail-box"]}>
            <textarea
              className={`${styles["guts-input-full"]} ${styles["guts-detail-textarea"]}`}
              rows={2}
              value={trainNote}
              disabled={!showActionIcons}
              onChange={(e) => setTrainNote(e.target.value)}
              placeholder="รายละเอียด/เวลา/ผู้เกี่ยวข้อง"
            />
          </div>
        </div>

        <div className={styles["guts-Mo-actions"]} style={{ gridColumn: "1 / 2" }}>
          {showActionIcons && (
            <>
              <button
                type="button"
                className={`${styles["guts-btn"]} ${styles["guts-cancel-btn"]}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowActionIcons((v) => !v);
                }}
              >
                Cancel
              </button>

              <button type="submit" className={`${styles["guts-btn"]} ${styles["guts-submit-btn"]}`}>
                Update
              </button>
            </>
          )}
        </div>
      </form>
    </>
  );
}

// also provide a named export for easier re-exports/imports
export { MoUpdatePage };
