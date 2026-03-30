// src/pages/Home.tsx
import { useState } from "react";
import { ChevronDown, ChevronRight, ArrowLeft } from "lucide-react";
import styles from "./MoNewPage.module.css";
import { useStore } from "../../../store/store";
import ConfirmCancelDialog from "../../../components/Mo/ConfirmCancelDialog";
import InfoModel from "../../../components/Mo/InfoModel";

type Props = {
  onCancel?: () => void;
  selectedLocation?: string;
  empCode?: string;
};

export default function MoNewPage(props: Props) {
  // ลา
  const [sickLeave, setSickLeave] = useState("");
  const [personalLeave, setPersonalLeave] = useState("");
  const [otherLeaveType, setOtherLeaveType] = useState("");

  // กำลังพล
  const [absentCount, setAbsentCount] = useState("");
  // breakdown for การควงกะ
  const [workShiftOpen, setWorkShiftOpen] = useState(true);
  const [shift18, setShift18] = useState("");
  const [shift24, setShift24] = useState("");
  const [shift36, setShift36] = useState("");
  // collapse state for "กำลังพล" box
  const [personnelOpen, setPersonnelOpen] = useState(true);
  // ผิดข้อปฏิบัติ / การตักเตือน
  const [disciplineNote, setDisciplineNote] = useState("");
  // collapse + numeric counts for ผิดข้อปฏิบัติ UI
  const [disciplineOpen, setDisciplineOpen] = useState(true);
  const [sleepCount, setSleepCount] = useState("");
  const [phoneCount, setPhoneCount] = useState("");
  const [badgeCount, setBadgeCount] = useState("");
  // เครื่องแต่งกาย
  // เครื่องแต่งกาย - counts
  const [hatCount, setHatCount] = useState("");
  const [shirtCount, setShirtCount] = useState("");
  const [pantsCount, setPantsCount] = useState("");
  const [shoesCount, setShoesCount] = useState("");
  // collapse state for เครื่องแต่งกาย
  const [uniformOpen, setUniformOpen] = useState(true);
  // อื่น ๆ
  const [otherNote, setOtherNote] = useState("");
  // "อื่น ๆ" detailed rows
  const [foundCount, setFoundCount] = useState("");
  const [foundNote, setFoundNote] = useState("");
  const [trainCount, setTrainCount] = useState("");
  const [trainNote, setTrainNote] = useState("");

  // new: collapse state for "ลา" card
  const [leaveOpen, setLeaveOpen] = useState(true);

  // confirmation dialog state
  const [showConfirmCancel, setShowConfirmCancel] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const { createReport, sectors } = useStore();

  // helper to check if anything is filled in
  const isDirty = () => {
    return (
      sickLeave !== "" ||
      personalLeave !== "" ||
      otherLeaveType !== "" ||
      absentCount !== "" ||
      shift18 !== "" ||
      shift24 !== "" ||
      shift36 !== "" ||
      disciplineNote !== "" ||
      sleepCount !== "" ||
      phoneCount !== "" ||
      badgeCount !== "" ||
      hatCount !== "" ||
      shirtCount !== "" ||
      pantsCount !== "" ||
      shoesCount !== "" ||
      otherNote !== "" ||
      foundCount !== "" ||
      foundNote !== "" ||
      trainCount !== "" ||
      trainNote !== ""
    );
  };

  const handleCancel = () => {
    if (isDirty()) {
      setShowConfirmCancel(true);
    } else {
      if (props.onCancel) props.onCancel();
      else window.history.back();
    }
  };

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Find sector_id from selectedLocation
    const sector = sectors.find(
      (s) => s.sector_name === props.selectedLocation,
    );
    if (!sector) {
      alert("ไม่พบข้อมูลภาค (Sector) กรุณาลองใหม่อีกครั้ง");
      return;
    }

    const payload = {
      sector_id: sector.sector_id,
      leave_sick_count: Number(sickLeave) || 0,
      leave_business_count: Number(personalLeave) || 0,
      leave_other_count: Number(otherLeaveType) || 0,
      absent_count: Number(absentCount) || 0,
      shift_18_count: Number(shift18) || 0,
      shift_24_count: Number(shift24) || 0,
      shift_36_count: Number(shift36) || 0,
      rule_sleep_count: Number(sleepCount) || 0,
      rule_use_phone_count: Number(phoneCount) || 0,
      rule_no_card_count: Number(badgeCount) || 0,
      wear_hat_count: Number(hatCount) || 0,
      wear_shirt_count: Number(shirtCount) || 0,
      wear_pant_count: Number(pantsCount) || 0,
      wear_shoe_count: Number(shoesCount) || 0,
      warning: disciplineNote,
      other_Job: foundNote,
      other_Job_count: Number(foundCount) || 0,
      other_training: trainNote,
      other_training_count: Number(trainCount) || 0,
      other_extral: otherNote,
      created_by: props.empCode || "ADMIN",
    };

    console.log("MO submit", payload);

    createReport(payload)
      .then(() => {
        setShowSuccess(true);
      })
      .catch((err) => {
        alert(`เกิดข้อผิดพลาดในการบันทึก: ${err}`);
      });
  }

  return (
    <>
      <div className={styles["guts-back-outer"]} aria-hidden>
        <button
          type="button"
          className={styles["guts-back-btn"]}
          onClick={handleCancel}
        >
          <ArrowLeft size={18} />
        </button>
      </div>

      <ConfirmCancelDialog
        open={showConfirmCancel}
        onCancel={() => setShowConfirmCancel(false)}
        onConfirm={() => {
          setShowConfirmCancel(false);
          if (props.onCancel) props.onCancel();
          else window.history.back();
        }}
      />
      
      <InfoModel
        open={showSuccess}
        onClose={() => {
          setShowSuccess(false);
          if (props.onCancel) props.onCancel();
          else window.history.back();
        }}
        variant="success"
        title="บันทึกรายงานสำเร็จ!"
        description="ระบบได้ทำการบันทึกข้อมูลของคุณเรียบร้อยแล้ว"
      />

      <form className={styles["guts-Mo-layout"]} onSubmit={onSubmit}>
        <div className={styles["guts-box"]}>
          <div className={styles["guts-box-title"]}>ภาค</div>
          <div
            className={[styles["guts-field-row"], styles["full-width"]].join(
              " ",
            )}
          >
            <input
              className={styles["guts-input"]}
              type="text"
              value={props.selectedLocation || ""}
              disabled
              placeholder="ไม่มีการเลือก"
            />
          </div>
        </div>

        <div className={[styles["guts-box"], styles["collapsible"]].join(" ")}>
          <div
            className={styles["guts-box-title"]}
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
          <div
            className={[
              styles["guts-box-body"],
              leaveOpen ? "" : styles["collapsed"],
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <div
              className={[styles["guts-field-row"], styles["two-col"]].join(
                " ",
              )}
            >
              <label className={styles["guts-label"]}>ลาป่วย</label>
              <div className={styles["guts-input-group"]}>
                <input
                  className={[styles["guts-input"], styles["small"]].join(" ")}
                  type="number"
                  min={0}
                  step={1}
                  value={sickLeave}
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

            <div
              className={[styles["guts-field-row"], styles["two-col"]].join(
                " ",
              )}
            >
              <label className={styles["guts-label"]}>ลากิจ</label>
              <div className={styles["guts-input-group"]}>
                <input
                  className={[styles["guts-input"], styles["small"]].join(" ")}
                  type="number"
                  min={0}
                  step={1}
                  value={personalLeave}
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

            <div
              className={[styles["guts-field-row"], styles["two-col"]].join(
                " ",
              )}
            >
              <label className={styles["guts-label"]}>ลาอื่น ๆ</label>
              <div className={styles["guts-input-group"]}>
                <input
                  className={[styles["guts-input"], styles["small"]].join(" ")}
                  type="number"
                  min={0}
                  step={1}
                  value={otherLeaveType}
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

          <div
            className={[
              styles["guts-box-body"],
              personnelOpen ? "" : styles["collapsed"],
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <div
              className={[styles["guts-field-row"], styles["two-col"]].join(
                " ",
              )}
            >
              <label className={styles["guts-label"]}>ขาดงาน</label>
              <div className={styles["guts-input-group"]}>
                <input
                  className={[styles["guts-input"], styles["small"]].join(" ")}
                  type="number"
                  min={0}
                  step={1}
                  value={absentCount}
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
                className={[
                  styles["guts-subbox-body"],
                  workShiftOpen ? "" : styles["collapsed"],
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <div
                  className={[styles["guts-field-row"], styles["two-col"]].join(
                    " ",
                  )}
                >
                  <label className={styles["guts-label"]}>จัด 18 ชั่วโมง</label>
                  <div className={styles["guts-input-group"]}>
                    <input
                      className={[styles["guts-input"], styles["small"]].join(
                        " ",
                      )}
                      type="number"
                      min={0}
                      step={1}
                      value={shift18}
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

                <div
                  className={[styles["guts-field-row"], styles["two-col"]].join(
                    " ",
                  )}
                >
                  <label className={styles["guts-label"]}>จัด 24 ชั่วโมง</label>
                  <div className={styles["guts-input-group"]}>
                    <input
                      className={[styles["guts-input"], styles["small"]].join(
                        " ",
                      )}
                      type="number"
                      min={0}
                      step={1}
                      value={shift24}
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

                <div
                  className={[styles["guts-field-row"], styles["two-col"]].join(
                    " ",
                  )}
                >
                  <label className={styles["guts-label"]}>จัด 36 ชั่วโมง</label>
                  <div className={styles["guts-input-group"]}>
                    <input
                      className={[styles["guts-input"], styles["small"]].join(
                        " ",
                      )}
                      type="number"
                      min={0}
                      step={1}
                      value={shift36}
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

          <div
            className={[
              styles["guts-box-body"],
              disciplineOpen ? "" : styles["collapsed"],
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <div
              className={[styles["guts-field-row"], styles["two-col"]].join(
                " ",
              )}
            >
              <label className={styles["guts-label"]}>หลับเวร</label>
              <div className={styles["guts-input-group"]}>
                <input
                  className={[styles["guts-input"], styles["small"]].join(" ")}
                  type="number"
                  min={0}
                  step={1}
                  value={sleepCount}
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

            <div
              className={[styles["guts-field-row"], styles["two-col"]].join(
                " ",
              )}
            >
              <label className={styles["guts-label"]}>เล่นโทรศัพท์</label>
              <div className={styles["guts-input-group"]}>
                <input
                  className={[styles["guts-input"], styles["small"]].join(" ")}
                  type="number"
                  min={0}
                  step={1}
                  value={phoneCount}
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

            <div
              className={[styles["guts-field-row"], styles["two-col"]].join(
                " ",
              )}
            >
              <label className={styles["guts-label"]}>ไม่แขวนบัตร</label>
              <div className={styles["guts-input-group"]}>
                <input
                  className={[styles["guts-input"], styles["small"]].join(" ")}
                  type="number"
                  min={0}
                  step={1}
                  value={badgeCount}
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
              <label
                className={[styles["guts-label"], styles["section-label"]].join(
                  " ",
                )}
              >
                การตักเตือน
              </label>
            </div>

            <div
              className={[styles["guts-field-row"], styles["full-width"]].join(
                " ",
              )}
            >
              <textarea
                className={styles["guts-input-full"]}
                rows={2}
                value={disciplineNote}
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
          <div
            className={[
              styles["guts-box-body"],
              uniformOpen ? "" : styles["collapsed"],
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <div
              className={[styles["guts-field-row"], styles["two-col"]].join(
                " ",
              )}
            >
              <label className={styles["guts-label"]}>หมวก เก่า:</label>
              <div className={styles["guts-input-group"]}>
                <input
                  className={[styles["guts-input"], styles["small"]].join(" ")}
                  type="number"
                  min={0}
                  step={1}
                  value={hatCount}
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
            <div
              className={[styles["guts-field-row"], styles["two-col"]].join(
                " ",
              )}
            >
              <label className={styles["guts-label"]}>เสื้อ เก่า:</label>
              <div className={styles["guts-input-group"]}>
                <input
                  className={[styles["guts-input"], styles["small"]].join(" ")}
                  type="number"
                  min={0}
                  step={1}
                  value={shirtCount}
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
            <div
              className={[styles["guts-field-row"], styles["two-col"]].join(
                " ",
              )}
            >
              <label className={styles["guts-label"]}>กางเกง เก่า:</label>
              <div className={styles["guts-input-group"]}>
                <input
                  className={[styles["guts-input"], styles["small"]].join(" ")}
                  type="number"
                  min={0}
                  step={1}
                  value={pantsCount}
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
            <div
              className={[styles["guts-field-row"], styles["two-col"]].join(
                " ",
              )}
            >
              <label className={styles["guts-label"]}>รองเท้า เก่า:</label>
              <div className={styles["guts-input-group"]}>
                <input
                  className={[styles["guts-input"], styles["small"]].join(" ")}
                  type="number"
                  min={0}
                  step={1}
                  value={shoesCount}
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
          <div
            className={[styles["guts-field-row"], styles["two-col"]].join(" ")}
          >
            <label className={styles["guts-label"]}>พบผู้ว่างจ้าง:</label>
            <div className={styles["guts-input-group"]}>
              <input
                className={[styles["guts-input"], styles["small"]].join(" ")}
                type="number"
                min={0}
                step={1}
                value={foundCount}
                onChange={(e) =>
                  setFoundCount(e.target.value.replace(/\D/g, ""))
                }
                onWheel={(e) => e.currentTarget.blur()}
                placeholder="0"
                inputMode="numeric"
              />
              <span className="guts-suffix">จุด</span>
            </div>
          </div>

          <div className={styles["guts-detail-box"]}>
            <textarea
              className={[
                styles["guts-input-full"],
                styles["guts-detail-textarea"],
              ].join(" ")}
              rows={2}
              value={foundNote}
              onChange={(e) => setFoundNote(e.target.value)}
              placeholder="รายละเอียด/เวลา/ผู้เกี่ยวข้อง"
            />
          </div>

          <div
            className={[styles["guts-field-row"], styles["two-col"]].join(" ")}
            style={{ marginTop: 8 }}
          >
            <label className={styles["guts-label"]}>อบรม:</label>
            <div className={styles["guts-input-group"]}>
              <input
                className={[styles["guts-input"], styles["small"]].join(" ")}
                type="number"
                min={0}
                step={1}
                value={trainCount}
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
              className={[
                styles["guts-input-full"],
                styles["guts-detail-textarea"],
              ].join(" ")}
              rows={2}
              value={trainNote}
              onChange={(e) => setTrainNote(e.target.value)}
              placeholder="รายละเอียด/เวลา/ผู้เกี่ยวข้อง"
            />
          </div>
          <div
            className={[styles["guts-field-row"], styles["two-col"]].join(" ")}
            style={{ marginTop: 8 }}
          >
            <label className={styles["guts-label"]}>เพิ่มเติม:</label>
          </div>

          <div className={styles["guts-detail-box"]}>
            <textarea
              className={[
                styles["guts-input-full"],
                styles["guts-detail-textarea"],
              ].join(" ")}
              rows={2}
              value={otherNote}
              onChange={(e) => setOtherNote(e.target.value)}
              placeholder="รายละเอียด/เวลา/ผู้เกี่ยวข้อง"
            />
          </div>
        </div>

        <div
          className={styles["guts-Mo-actions"]}
          style={{ gridColumn: "1 / -1" }}
        >
          <button
            type="submit"
            className={[styles["guts-btn"], styles["guts-submit-btn"]].join(
              " ",
            )}
          >
            บันทึกรายงาน
          </button>
        </div>
      </form>
    </>
  );
}

// also provide a named export for easier re-exports/imports
export { MoNewPage };
