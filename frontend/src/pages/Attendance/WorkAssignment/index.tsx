// src/pages/Attendance/WorkAssignment/index.tsx

import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";

import Header from "@/layout/Header";
import BackButton from "@/components/BackButton";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCheck,
  faImage,
  faPlus,
  faTrashCan,
} from "@fortawesome/free-solid-svg-icons";

import styles from "./WorkAssignment.module.css";

export type VisitPurpose = "normal_plan" | "meet_client" | "other_assignment";

export type SaveMode = "stay" | "checkout";

export type WorkItem = {
  id: string;
  title: string;
  imageName: string;
  imageDataUrl: string;
};

type WorkItemOptionValue =
  | "documents"
  | "meeting"
  | "follow_up"
  | "onsite_training"
  | "shift_handover"
  | "drug_test"
  | "simulation"
  | "other";

export type WorkAssignmentPayload = {
  purpose: VisitPurpose;
  purposeLabel: string;
  workItems: WorkItem[];
  additionalNote: string;
};

type Props = {
  empCode: string;
  displayName?: string;

  unitCode?: string | null;
  unitName?: string | null;

  initialWorkItems?: Array<{
    id?: string;
    title: string;
    imageName?: string;
    imageDataUrl?: string;
  }>;

  busy?: boolean;
  onBack: () => void;
  onSave: (
    payload: WorkAssignmentPayload,
    mode: SaveMode,
  ) => Promise<void> | void;
};

const PURPOSE_OPTIONS: Array<{
  value: VisitPurpose;
  label: string;
}> = [
  {
    value: "normal_plan",
    label: "ผู้ปฏิบัติงานตามแผนปกติ",
  },
  {
    value: "meet_client",
    label: "เข้าพบผู้ว่าจ้าง",
  },
  {
    value: "other_assignment",
    label: "ได้รับมอบหมายงานอื่น ๆ",
  },
];

/**
 * รายการใน Dropdown ของส่วนที่ 2
 * สามารถเพิ่มรายการใหม่ใน Array นี้ได้ภายหลัง
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

const DEFAULT_WORK_ITEMS: WorkItem[] = [];

function createWorkItemId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("อ่านไฟล์รูปภาพไม่สำเร็จ"));
    reader.readAsDataURL(file);
  });
}

export default function WorkAssignment({
  empCode,
  displayName,
  unitCode = null,
  unitName = null,
  initialWorkItems,
  busy = false,
  onBack,
  onSave,
}: Props) {
  const preparedInitialItems = useMemo<WorkItem[]>(() => {
    if (!initialWorkItems?.length) {
      return DEFAULT_WORK_ITEMS;
    }

    return initialWorkItems.map((item) => ({
      id: item.id ?? createWorkItemId(),
      title: item.title.trim(),
      imageName: item.imageName ?? "",
      imageDataUrl: item.imageDataUrl ?? "",
    }));
  }, [initialWorkItems]);

  const [purpose, setPurpose] = useState<VisitPurpose>("normal_plan");
  const [workItems, setWorkItems] = useState<WorkItem[]>(preparedInitialItems);
  const [additionalNote, setAdditionalNote] = useState("");

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [selectedWorkItemType, setSelectedWorkItemType] = useState<
    WorkItemOptionValue | ""
  >("");
  const [otherDetail, setOtherDetail] = useState("");
  const [modalImageName, setModalImageName] = useState("");
  const [modalImageDataUrl, setModalImageDataUrl] = useState("");
  const [modalError, setModalError] = useState("");

  const [internalBusy, setInternalBusy] = useState(false);
  const [error, setError] = useState("");

  const isBusy = busy || internalBusy;
  const unitDisplay = [unitCode, unitName]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(" - ");

  useEffect(() => {
    if (!addModalOpen) return;

    const previousOverflow = document.body.style.overflow;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !isBusy) {
        closeAddModal();
      }
    }

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleEscape);
    };
  }, [addModalOpen, isBusy]);

  function resetAddModalForm() {
    setSelectedWorkItemType("");
    setOtherDetail("");
    setModalImageName("");
    setModalImageDataUrl("");
    setModalError("");
  }

  function openAddModal() {
    resetAddModalForm();
    setError("");
    setAddModalOpen(true);
  }

  function closeAddModal() {
    if (isBusy) return;

    setAddModalOpen(false);
    resetAddModalForm();
  }

  async function handleModalImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    event.target.value = "";

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setModalError("กรุณาเลือกไฟล์รูปภาพเท่านั้น");
      return;
    }

    setModalError("");

    try {
      const imageDataUrl = await readFileAsDataUrl(file);

      setModalImageName(file.name);
      setModalImageDataUrl(imageDataUrl);
    } catch (readError) {
      setModalError(
        readError instanceof Error
          ? readError.message
          : "อ่านไฟล์รูปภาพไม่สำเร็จ",
      );
    }
  }

  function saveWorkItemFromModal() {
    if (!selectedWorkItemType) {
      setModalError("กรุณาเลือกสิ่งที่ดำเนินการเรียบร้อยแล้ว");
      return;
    }

    const selectedOption = WORK_ITEM_OPTIONS.find(
      (option) => option.value === selectedWorkItemType,
    );

    if (!selectedOption) {
      setModalError("ไม่พบรายการที่เลือก กรุณาลองใหม่");
      return;
    }

    const cleanOtherDetail = otherDetail.trim();

    if (selectedWorkItemType === "other" && !cleanOtherDetail) {
      setModalError("กรุณาระบุรายละเอียด");
      return;
    }

    const title =
      selectedWorkItemType === "other"
        ? `${selectedOption.label} - ${cleanOtherDetail}`
        : selectedOption.label;

    setWorkItems((current) => [
      ...current,
      {
        id: createWorkItemId(),
        title,
        imageName: modalImageName,
        imageDataUrl: modalImageDataUrl,
      },
    ]);

    setAddModalOpen(false);
    resetAddModalForm();
    setError("");
  }

  function removeWorkItem(id: string) {
    setWorkItems((current) => current.filter((item) => item.id !== id));
    setError("");
  }

  async function handleImageChange(
    id: string,
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];

    event.target.value = "";

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("กรุณาเลือกไฟล์รูปภาพเท่านั้น");
      return;
    }

    setError("");

    try {
      const imageDataUrl = await readFileAsDataUrl(file);

      setWorkItems((current) =>
        current.map((item) =>
          item.id === id
            ? {
                ...item,
                imageName: file.name,
                imageDataUrl,
              }
            : item,
        ),
      );
    } catch (readError) {
      setError(
        readError instanceof Error
          ? readError.message
          : "อ่านไฟล์รูปภาพไม่สำเร็จ",
      );
    }
  }

  async function handleSave(mode: SaveMode) {
    if (isBusy) return;

    const purposeOption = PURPOSE_OPTIONS.find(
      (option) => option.value === purpose,
    );

    if (!purposeOption) return;

    setInternalBusy(true);
    setError("");

    try {
      await onSave(
        {
          purpose,
          purposeLabel: purposeOption.label,
          workItems,
          additionalNote: additionalNote.trim(),
        },
        mode,
      );
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "บันทึกข้อมูลไม่สำเร็จ กรุณาลองใหม่",
      );
    } finally {
      setInternalBusy(false);
    }
  }

  return (
    <>
      <main className="guts-bg">
        <div className="guts-home">
          <section
            className={`guts-home-card ${styles.pageCard}`}
            aria-label="บันทึกการเข้าหน่วยงาน"
          >
            <Header empCode={empCode} displayName={displayName} />

            <h2 className={styles.pageTitle}>หน้าจอ - บันทึกการเข้าหน่วยงาน</h2>

            {unitDisplay ? (
              <div className={styles.unitStatus}>
                <div>ขณะนี้ท่านอยู่ในหน่วยงาน</div>
                <div className={styles.unitName}>{unitDisplay}</div>
              </div>
            ) : null}

            <div className={styles.formCard}>
              <section className={styles.formSection}>
                <h3 className={styles.sectionTitle}>
                  ส่วนที่ 1 : วัตถุประสงค์การเข้าหน่วยงาน
                </h3>

                <div
                  className={styles.purposeList}
                  role="radiogroup"
                  aria-label="วัตถุประสงค์การเข้าหน่วยงาน"
                >
                  {PURPOSE_OPTIONS.map((option) => {
                    const selected = purpose === option.value;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        className={`${styles.purposeOption} ${
                          selected ? styles.purposeOptionSelected : ""
                        }`}
                        onClick={() => setPurpose(option.value)}
                        disabled={isBusy}
                      >
                        <span className={styles.radioMark} aria-hidden="true">
                          {selected ? <FontAwesomeIcon icon={faCheck} /> : null}
                        </span>
                        <span>{option.label}</span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className={styles.formSection}>
                <h3 className={styles.sectionTitle}>
                  ส่วนที่ 2 : สิ่งที่ดำเนินการเรียบร้อยแล้ว
                </h3>

                <button
                  type="button"
                  className={styles.addButton}
                  onClick={openAddModal}
                  disabled={isBusy}
                >
                  <FontAwesomeIcon icon={faPlus} />
                  กดเพิ่มข้อมูล
                </button>

                <div className={styles.workItemList}>
                  {workItems.length > 0 ? (
                    workItems.map((item, index) => (
                      <div className={styles.workItemRow} key={item.id}>
                        <div className={styles.workItemNumber}>
                          2.{index + 1}
                        </div>

                        <div className={styles.workItemTitle}>{item.title}</div>

                        <div
                          className={styles.imagePreview}
                          title={item.imageName || "ยังไม่ได้เลือกรูปภาพ"}
                        >
                          {item.imageDataUrl ? (
                            <img
                              src={item.imageDataUrl}
                              alt={`ภาพประกอบ ${item.title}`}
                            />
                          ) : (
                            <FontAwesomeIcon icon={faImage} />
                          )}
                        </div>

                        <label className={styles.imagePicker}>
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={(event) =>
                              void handleImageChange(item.id, event)
                            }
                            disabled={isBusy}
                          />
                          {item.imageDataUrl ? "เปลี่ยนรูปภาพ" : "เลือกรูปภาพ"}
                        </label>

                        <button
                          type="button"
                          className={styles.deleteButton}
                          onClick={() => removeWorkItem(item.id)}
                          disabled={isBusy}
                          aria-label={`ลบรายการ ${item.title}`}
                        >
                          <FontAwesomeIcon icon={faTrashCan} />
                          <span>ลบ</span>
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className={styles.emptyItems}>
                      ยังไม่มีรายการที่ดำเนินการ
                    </div>
                  )}
                </div>
              </section>

              <section className={styles.formSection}>
                <h3 className={styles.sectionTitle}>
                  ส่วนที่ 3 : กรุณาระบุข้อมูลเพิ่มเติม
                </h3>

                <div className={styles.noteWrap}>
                  <textarea
                    className={styles.noteInput}
                    value={additionalNote}
                    onChange={(event) => setAdditionalNote(event.target.value)}
                    placeholder="กรุณาระบุข้อมูลเพิ่มเติม"
                    maxLength={500}
                    disabled={isBusy}
                  />
                  <div className={styles.characterCount}>
                    {additionalNote.length}/500
                  </div>
                </div>
              </section>

              {error ? (
                <div className={styles.errorMessage} role="alert">
                  {error}
                </div>
              ) : null}

              <div className={styles.actionArea}>
                <button
                  type="button"
                  className={styles.saveStayButton}
                  onClick={() => void handleSave("stay")}
                  disabled={isBusy}
                >
                  {isBusy ? "กำลังบันทึก..." : "บันทึกแต่ยังไม่ออกงาน"}
                </button>

                <button
                  type="button"
                  className={styles.saveCheckoutButton}
                  onClick={() => void handleSave("checkout")}
                  disabled={isBusy}
                >
                  {isBusy ? "กำลังบันทึก..." : "บันทึกและออกงาน"}
                </button>

                <div className={styles.backButtonWrap}>
                  <BackButton
                    onClick={onBack}
                    disabled={isBusy}
                    className={styles.backButton}
                  />
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      {addModalOpen ? (
        <div
          className={styles.modalOverlay}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeAddModal();
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
                <div className={styles.modalItemNumber}>
                  2.{workItems.length + 1}
                </div>

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

                      setModalError("");
                    }}
                    disabled={isBusy}
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
                      setModalError("");
                    }}
                    placeholder="กรุณาระบุรายละเอียด"
                    maxLength={250}
                    disabled={isBusy}
                  />
                  <div className={styles.modalCharacterCount}>
                    {otherDetail.length}/250
                  </div>
                </div>
              ) : null}

              <div className={styles.modalField}>
                <div className={styles.modalLabel}>รูปภาพ (ไม่บังคับ)</div>

                <div className={styles.modalImagePreview}>
                  {modalImageDataUrl ? (
                    <img src={modalImageDataUrl} alt="ภาพประกอบรายการใหม่" />
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
                    onChange={(event) => void handleModalImageChange(event)}
                    disabled={isBusy}
                  />
                  <FontAwesomeIcon icon={faImage} />
                  {modalImageDataUrl ? "เปลี่ยนรูปภาพ" : "เลือกรูปภาพ"}
                </label>

                {modalImageName ? (
                  <div className={styles.modalImageName}>{modalImageName}</div>
                ) : null}
              </div>

              {modalError ? (
                <div className={styles.modalError} role="alert">
                  {modalError}
                </div>
              ) : null}
            </div>

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.modalCloseButton}
                onClick={closeAddModal}
                disabled={isBusy}
              >
                ปิดหน้าจอ
              </button>

              <button
                type="button"
                className={styles.modalSaveButton}
                onClick={saveWorkItemFromModal}
                disabled={
                  isBusy ||
                  !selectedWorkItemType ||
                  (selectedWorkItemType === "other" && !otherDetail.trim())
                }
              >
                บันทึก
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}