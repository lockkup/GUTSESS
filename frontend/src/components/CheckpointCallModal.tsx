import styles from "./CheckpointCallModal.module.css";

export type CallStatus = 1 | 2 | 3;

export type CheckpointCallModalSavePayload = {
  unitName: string;
  plan: string;
  shiftText: string;
  contactDetail: string;
  callNote: string;
  callStatus: CallStatus;
};

type Props = {
  isOpen: boolean;
  unitName: string;
  plan: string;
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

export default function CheckpointCallModal({
  isOpen,
  unitName,
  plan,
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
  if (!isOpen) return null;

  const handleSave = () => {
    onSave({
      unitName,
      plan,
      shiftText,
      contactDetail: contactDetail.trim(),
      callNote: callNote.trim(),
      callStatus,
    });
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
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
            onClick={onClose}
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
              <span>แผน:</span> {plan || "-"}
            </div>
            <div>
              <span>ผลัด:</span> {shiftText || "-"}
            </div>
          </div>

          <label className={styles.label} htmlFor="checkpoint-contact-detail">
            ข้อมูลผู้ติดต่อ
          </label>

          <textarea
            id="checkpoint-contact-detail"
            className={styles.contactTextarea}
            value={contactDetail}
            onChange={(event) => onChangeContactDetail(event.target.value)}
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
            onChange={(event) => onChangeCallNote(event.target.value)}
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
              onClick={onClose}
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