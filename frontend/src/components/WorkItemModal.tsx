import { useEffect, useState } from "react";
import type { ChangeEvent } from "react";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faImage } from "@fortawesome/free-solid-svg-icons";

import type {
  WorkReportItemTypeResponse,
  WorkReportPurposeResponse,
} from "@/types/workReport";

import styles from "./WorkItemModal.module.css";

export type WorkItemModalValue = {
  purposeId: number;
  purposeCode: string;
  purposeLabel: string;
  workItemTypeId: number;
  workItemCode: string;
  workItemDetail: string;
  requireDetail: boolean;
  title: string;
  imageName: string;
  imageDataUrl: string;
};

type Props = {
  itemNumber: number;
  purposeOptions: WorkReportPurposeResponse[];
  workItemTypeOptions: WorkReportItemTypeResponse[];
  initialPurposeId?: number | null;
  busy?: boolean;
  onClose: () => void;
  onSave: (item: WorkItemModalValue) => void;
};

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
  purposeOptions,
  workItemTypeOptions,
  initialPurposeId = null,
  busy = false,
  onClose,
  onSave,
}: Props) {
  const [selectedPurposeId, setSelectedPurposeId] = useState<number | null>(
    initialPurposeId ?? purposeOptions[0]?.purpose_id ?? null,
  );
  const [selectedWorkItemTypeId, setSelectedWorkItemTypeId] = useState<
    number | ""
  >("");
  const [workItemDetail, setWorkItemDetail] = useState("");
  const [imageName, setImageName] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState("");
  const [error, setError] = useState("");

  const selectedWorkItemOption =
    selectedWorkItemTypeId === ""
      ? undefined
      : workItemTypeOptions.find(
          (option) =>
            option.work_item_type_id === selectedWorkItemTypeId,
        );

  useEffect(() => {
    setSelectedPurposeId((current) => {
      if (
        current !== null &&
        purposeOptions.some((option) => option.purpose_id === current)
      ) {
        return current;
      }

      if (
        initialPurposeId !== null &&
        purposeOptions.some(
          (option) => option.purpose_id === initialPurposeId,
        )
      ) {
        return initialPurposeId;
      }

      return purposeOptions[0]?.purpose_id ?? null;
    });
  }, [initialPurposeId, purposeOptions]);

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
    const selectedPurpose = purposeOptions.find(
      (option) => option.purpose_id === selectedPurposeId,
    );

    if (!selectedPurpose) {
      setError("กรุณาเลือกวัตถุประสงค์การเข้าหน่วยงาน");
      return;
    }

    if (selectedWorkItemTypeId === "") {
      setError("กรุณาเลือกสิ่งที่ดำเนินการเรียบร้อยแล้ว");
      return;
    }

    const selectedOption = workItemTypeOptions.find(
      (option) =>
        option.work_item_type_id === selectedWorkItemTypeId,
    );

    if (!selectedOption) {
      setError("ไม่พบรายการที่เลือก กรุณาลองใหม่");
      return;
    }

    const cleanWorkItemDetail = workItemDetail.trim();

    if (selectedOption.require_detail && !cleanWorkItemDetail) {
      setError("กรุณาระบุรายละเอียด");
      return;
    }

    const title = selectedOption.require_detail
      ? `${selectedOption.work_item_name} - ${cleanWorkItemDetail}`
      : selectedOption.work_item_name;

    onSave({
      purposeId: selectedPurpose.purpose_id,
      purposeCode: selectedPurpose.purpose_code,
      purposeLabel: selectedPurpose.purpose_name,
      workItemTypeId: selectedOption.work_item_type_id,
      workItemCode: selectedOption.work_item_code,
      workItemDetail: cleanWorkItemDetail,
      requireDetail: selectedOption.require_detail,
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

        <section
          className={styles.purposeSection}
          aria-labelledby="work-purpose-title"
        >
          <h3
            className={styles.purposeSectionTitle}
            id="work-purpose-title"
          >
            <span>ส่วนที่ 1 : วัตถุประสงค์การเข้าหน่วยงาน</span>
            <span className={styles.purposeSectionChevron} aria-hidden="true">
              V
            </span>
          </h3>

          {purposeOptions.length > 0 ? (
            <div
              className={styles.purposeList}
              role="radiogroup"
              aria-label="วัตถุประสงค์การเข้าหน่วยงาน"
            >
              {purposeOptions.map((option) => {
                const selected = selectedPurposeId === option.purpose_id;

                return (
                  <button
                    key={option.purpose_id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    className={`${styles.purposeOption} ${
                      selected ? styles.purposeOptionSelected : ""
                    }`}
                    onClick={() => {
                      setSelectedPurposeId(option.purpose_id);
                      setError("");
                    }}
                    disabled={busy}
                  >
                    <span className={styles.purposeMark} aria-hidden="true">
                      {selected ? "/" : ""}
                    </span>
                    <span className={styles.purposeLabel}>
                      {option.purpose_name}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className={styles.purposeEmpty}>
              ไม่พบข้อมูลวัตถุประสงค์การเข้าหน่วยงาน
            </div>
          )}
        </section>

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
                value={selectedWorkItemTypeId}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  const nextId = nextValue === "" ? "" : Number(nextValue);

                  setSelectedWorkItemTypeId(nextId);

                  const nextOption = workItemTypeOptions.find(
                    (option) => option.work_item_type_id === nextId,
                  );

                  if (!nextOption?.require_detail) {
                    setWorkItemDetail("");
                  }

                  setError("");
                }}
                disabled={busy}
              >
                <option value="">-- โปรดเลือก --</option>
                {workItemTypeOptions.map((option) => (
                  <option
                    key={option.work_item_type_id}
                    value={option.work_item_type_id}
                  >
                    {option.work_item_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedWorkItemOption?.require_detail ? (
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
                value={workItemDetail}
                onChange={(event) => {
                  setWorkItemDetail(event.target.value);
                  setError("");
                }}
                placeholder="กรุณาระบุรายละเอียด"
                maxLength={250}
                disabled={busy}
              />
              <div className={styles.modalCharacterCount}>
                {workItemDetail.length}/250
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
              selectedPurposeId === null ||
              selectedWorkItemTypeId === "" ||
              (Boolean(selectedWorkItemOption?.require_detail) &&
                !workItemDetail.trim())
            }
          >
            บันทึก
          </button>
        </div>
      </section>
    </div>
  );
}