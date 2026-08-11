// src/pages/Attendance/WorkAssignment/components/WorkItemModal.tsx

import { useEffect, useState } from "react";
import type { ChangeEvent } from "react";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faImage } from "@fortawesome/free-solid-svg-icons";

import styles from "./WorkItemModal.module.css";

type WorkItemOptionValue =
  | "documents"
  | "meeting"
  | "follow_up"
  | "onsite_training"
  | "shift_handover"
  | "drug_test"
  | "simulation"
  | "other";

export type WorkItemModalValue = {
  title: string;
  imageName: string;
  imageDataUrl: string;
};

type Props = {
  itemNumber: number;
  busy?: boolean;
  onClose: () => void;
  onSave: (item: WorkItemModalValue) => void;
};

/**
 * รายการใน Dropdown ของส่วนที่ 2
 * สามารถเพิ่มหรือแก้ไขรายการได้จาก Array นี้
 */
const WORK_ITEM_OPTIONS: Array<{
  value: WorkItemOptionValue;
  label: string;
}> = [
  {
    value: "documents",
    label: "รับ-ส่งเอกสาร",
  },
  {
    value: "meeting",
    label: "เข้าร่วมประชุม",
  },
  {
    value: "follow_up",
    label: "ติดตามงาน",
  },
  {
    value: "onsite_training",
    label: "พัฒนาอบรมหน้างาน",
  },
  {
    value: "shift_handover",
    label: "รวมแถวเปลี่ยนผลัด",
  },
  {
    value: "drug_test",
    label: "ตรวจสารเสพติด",
  },
  {
    value: "simulation",
    label: "จำลองสถานการณ์",
  },
  {
    value: "other",
    label: "อื่น ๆ",
  },
];

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("อ่านไฟล์รูปภาพไม่สำเร็จ"));
    reader.readAsDataURL(file);
  });
}

export default function WorkItemModal({
  itemNumber,
  busy = false,
  onClose,
  onSave,
}: Props) {
  const [selectedWorkItemType, setSelectedWorkItemType] = useState<
    WorkItemOptionValue | ""
  >("");
  const [otherDetail, setOtherDetail] = useState("");
  const [imageName, setImageName] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) {
        onClose();
      }
    }

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleEscape);
    };
  }, [busy, onClose]);

  async function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    event.target.value = "";

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("กรุณาเลือกไฟล์รูปภาพเท่านั้น");
      return;
    }

    setError("");

    try {
      const nextImageDataUrl = await readFileAsDataUrl(file);

      setImageName(file.name);
      setImageDataUrl(nextImageDataUrl);
    } catch (readError) {
      setError(
        readError instanceof Error
          ? readError.message
          : "อ่านไฟล์รูปภาพไม่สำเร็จ",
      );
    }
  }

  function handleSave() {
    if (!selectedWorkItemType) {
      setError("กรุณาเลือกสิ่งที่ดำเนินการเรียบร้อยแล้ว");
      return;
    }

    const selectedOption = WORK_ITEM_OPTIONS.find(
      (option) => option.value === selectedWorkItemType,
    );

    if (!selectedOption) {
      setError("ไม่พบรายการที่เลือก กรุณาลองใหม่");
      return;
    }

    const cleanOtherDetail = otherDetail.trim();

    if (selectedWorkItemType === "other" && !cleanOtherDetail) {
      setError("กรุณาระบุรายละเอียด");
      return;
    }

    const title =
      selectedWorkItemType === "other"
        ? `${selectedOption.label} - ${cleanOtherDetail}`
        : selectedOption.label;

    onSave({
      title,
      imageName,
      imageDataUrl,
    });
  }

  return (
    <div
      className={styles.modalOverlay}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) {
          onClose();
        }
      }}
    >
      <section
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="work-assignment-modal-title"
      >
        <h2 className={styles.modalHeader} id="work-assignment-modal-title">
          เพิ่มข้อมูลสิ่งที่ดำเนินการเรียบร้อย
        </h2>

        <div className={styles.modalSectionTitle}>
          <span>2.</span>
          <span>สิ่งที่ดำเนินการเรียบร้อย</span>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.modalItemRow}>
            <div className={styles.modalItemNumber}>2.{itemNumber}</div>

            <div className={styles.modalField}>
              <label className={styles.modalLabel} htmlFor="work-item-type">
                โปรดเลือก <span aria-hidden="true">*</span>
              </label>

              <select
                id="work-item-type"
                className={styles.modalSelect}
                value={selectedWorkItemType}
                onChange={(event) => {
                  const nextValue = event.target.value as
                    WorkItemOptionValue | "";

                  setSelectedWorkItemType(nextValue);

                  if (nextValue !== "other") {
                    setOtherDetail("");
                  }

                  setError("");
                }}
                disabled={busy}
                autoFocus
              >
                <option value="">-- โปรดเลือก --</option>
                {WORK_ITEM_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedWorkItemType === "other" ? (
            <div className={styles.modalField}>
              <label
                className={styles.modalLabel}
                htmlFor="work-item-other-detail"
              >
                รายละเอียด <span aria-hidden="true">*</span>
              </label>
              <textarea
                id="work-item-other-detail"
                className={styles.modalDetailInput}
                value={otherDetail}
                onChange={(event) => {
                  setOtherDetail(event.target.value);
                  setError("");
                }}
                placeholder="กรุณาระบุรายละเอียด"
                maxLength={250}
                disabled={busy}
              />
              <div className={styles.modalCharacterCount}>
                {otherDetail.length}/250
              </div>
            </div>
          ) : null}

          <div className={styles.modalField}>
            <div className={styles.modalLabel}>รูปภาพ (ไม่บังคับ)</div>

            <div className={styles.modalImagePreview}>
              {imageDataUrl ? (
                <img src={imageDataUrl} alt="ภาพประกอบรายการใหม่" />
              ) : (
                <div className={styles.modalImagePlaceholder}>
                  <FontAwesomeIcon icon={faImage} />
                  <span>ยังไม่ได้เลือกรูปภาพ</span>
                </div>
              )}
            </div>

            <label className={styles.modalImagePicker}>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(event) => void handleImageChange(event)}
                disabled={busy}
              />
              <FontAwesomeIcon icon={faImage} />
              {imageDataUrl ? "เปลี่ยนรูปภาพ" : "เลือกรูปภาพ"}
            </label>

            {imageName ? (
              <div className={styles.modalImageName}>{imageName}</div>
            ) : null}
          </div>

          {error ? (
            <div className={styles.modalError} role="alert">
              {error}
            </div>
          ) : null}
        </div>

        <div className={styles.modalActions}>
          <button
            type="button"
            className={styles.modalCloseButton}
            onClick={onClose}
            disabled={busy}
          >
            ปิดหน้าจอ
          </button>

          <button
            type="button"
            className={styles.modalSaveButton}
            onClick={handleSave}
            disabled={
              busy ||
              !selectedWorkItemType ||
              (selectedWorkItemType === "other" && !otherDetail.trim())
            }
          >
            บันทึก
          </button>
        </div>
      </section>
    </div>
  );
}