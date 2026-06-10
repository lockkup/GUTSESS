import { useEffect, useState } from "react";

import styles from "./CheckpointCallModal.module.css";

export type CallStatus = 1 | 2 | 3;

export type CheckpointCallModalSavePayload = {
  contactDetail: string;
  callNote: string;
  callStatus: CallStatus;
};

type Props = {
  isOpen: boolean;
  unitName: string;

  // ยังเก็บไว้เพื่อไม่ให้ไฟล์แม่ที่ส่ง prop plan เข้ามา error
  // แต่ใน Modal นี้ไม่แสดงแล้ว และไม่ส่งตอนบันทึก
  plan?: string;

  shiftText: string;
  contactDetail: string;
  callNote: string;
  callStatus: CallStatus;
  onChangeContactDetail: (value: string) => void;
  onChangeCallNote: (value: string) => void;
  onChangeCallStatus: (value: CallStatus) => void;
  onClose: () => void;
  onSave: (payload: CheckpointCallModalSavePayload) => void;
};

function formatShiftText(value?: string | null): string {
  const text = (value ?? "").trim();

  if (!text) return "-";
  if (text === "ผลัดกลางวัน") return "กลางวัน";
  if (text === "ผลัดกลางคืน") return "กลางคืน";

  return text.replace(/^ผลัด/, "").trim() || "-";
}

export default function CheckpointCallModal({
  isOpen,
  unitName,
  shiftText,
  contactDetail,
  callNote,
  callStatus,
  onChangeContactDetail,
  onChangeCallNote,
  onChangeCallStatus,
  onClose,
  onSave,
}: Props) {
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (isOpen) {
      setFormError("");
    }
  }, [isOpen, unitName]);

  if (!isOpen) return null;

  const displayShiftText = formatShiftText(shiftText);

  const handleClose = () => {
    setFormError("");
    onClose();
  };

  const handleChangeContactDetail = (value: string) => {
    if (formError) {
      setFormError("");
    }

    onChangeContactDetail(value);
  };

  const handleChangeCallNote = (value: string) => {
    if (formError) {
      setFormError("");
    }

    onChangeCallNote(value);
  };

  const handleSave = () => {
    const cleanContactDetail = contactDetail.trim();
    const cleanCallNote = callNote.trim();

    if (!cleanContactDetail && !cleanCallNote) {
      setFormError("โปรดระบุข้อมูลผู้มาติดต่อ หรือรายละเอียดการโทร");
      return;
    }

    setFormError("");

    onSave({
      contactDetail: cleanContactDetail,
      callNote: cleanCallNote,
      callStatus,
    });
  };

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <section
        className={styles.card}
        role="dialog"
        aria-modal="true"
        aria-label="บันทึกรายละเอียดการโทร"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.header}>
          <h3 className={styles.title}>บันทึกรายละเอียดการโทร</h3>

          <button
            type="button"
            className={styles.closeBtn}
            onClick={handleClose}
            aria-label="ปิดหน้าต่างบันทึกการโทร"
          >
            ×
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.summaryBox}>
            <div>
              <span>หน่วยงาน:</span> {unitName || "-"}
            </div>

            <div>
              <span>ผลัด:</span> {displayShiftText}
            </div>
          </div>

          {formError && (
            <div
              role="alert"
              style={{
                margin: "0 0 12px",
                padding: "10px 12px",
                borderRadius: "12px",
                background: "#fff1f2",
                border: "1px solid #fecaca",
                color: "#b91c1c",
                fontSize: "14px",
                fontWeight: 800,
                lineHeight: 1.4,
              }}
            >
              {formError}
            </div>
          )}

          <label className={styles.label} htmlFor="checkpoint-contact-detail">
            ข้อมูลผู้ติดต่อ
          </label>

          <textarea
            id="checkpoint-contact-detail"
            className={styles.contactTextarea}
            value={contactDetail}
            onChange={(event) =>
              handleChangeContactDetail(event.target.value)
            }
            placeholder="กรอกข้อมูลผู้ติดต่อ เช่น ชื่อผู้ติดต่อ เบอร์โทร"
            rows={5}
          />

          <label className={styles.label} htmlFor="checkpoint-call-note">
            รายละเอียดการโทร
          </label>

          <textarea
            id="checkpoint-call-note"
            className={styles.textarea}
            value={callNote}
            onChange={(event) => handleChangeCallNote(event.target.value)}
            placeholder="กรอกรายละเอียดการโทร"
            rows={5}
          />

          <div className={styles.statusGroup}>
            <label className={styles.statusItem}>
              <input
                type="radio"
                name="checkpoint-call-status"
                checked={callStatus === 1}
                onChange={() => onChangeCallStatus(1)}
              />
              <span className={styles.statusNormal}>
                ปกติ (ไม่ต้องเข้าหน้างาน)
              </span>
            </label>

            <label className={styles.statusItem}>
              <input
                type="radio"
                name="checkpoint-call-status"
                checked={callStatus === 2}
                onChange={() => onChangeCallStatus(2)}
              />
              <span className={styles.statusWarning}>
                ผิดปกติ (ไม่ต้องเข้าหน้างาน)
              </span>
            </label>

            <label className={styles.statusItem}>
              <input
                type="radio"
                name="checkpoint-call-status"
                checked={callStatus === 3}
                onChange={() => onChangeCallStatus(3)}
              />
              <span className={styles.statusDanger}>
                ผิดปกติ (ต้องเข้าหน้างาน)
              </span>
            </label>
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={handleClose}
            >
              ยกเลิก
            </button>

            <button
              type="button"
              className={styles.saveBtn}
              onClick={handleSave}
            >
              บันทึก
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}