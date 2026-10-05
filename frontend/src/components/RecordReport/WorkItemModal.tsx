import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faImage, faXmark } from "@fortawesome/free-solid-svg-icons";

import type {
  WorkReportItemTypeResponse,
  WorkReportPurposeResponse,
} from "@/types/workReport";

import styles from "./WorkItemModal.module.css";

const MAX_IMAGES = 3;

type SelectedImage = {
  id?: number;
  name: string;
  dataUrl: string;
  isExisting: boolean;
};

export type WorkItemModalValue = {
  purposeId: number;
  purposeCode: string;
  purposeLabel: string;
  workItemTypeId: number;
  workItemCode: string;
  workItemOther: string;
  workItemDetail: string;
  requireDetail: boolean;
  title: string;

  imageName: string;
  imageDataUrl: string;

  imageNames?: string[];
  imageDataUrls?: string[];

  /**
   * ตำแหน่งตรงกับ imageNames / imageDataUrls
   * - number = รูปเดิมที่มีอยู่ในฐานข้อมูล
   * - null = รูปใหม่ที่ผู้ใช้เพิ่งเลือก
   */
  imageIds?: Array<number | null>;

  /**
   * image_id ของรูปเดิมที่ผู้ใช้ลบหรือเปลี่ยนออก
   * ให้ parent/backend ลบจริงตอนกดบันทึกเท่านั้น
   */
  deletedImageIds?: number[];

  /**
   * รูปเดิมที่ยังคงใช้งานอยู่
   */
  existingImageIds?: number[];

  /**
   * เฉพาะรูปใหม่ เพื่อให้ parent ไม่ต้อง upload รูปเดิมซ้ำ
   */
  newImageNames?: string[];
  newImageDataUrls?: string[];
};

export type WorkItemModalInitialValue = {
  purposeId?: number | null;
  workItemTypeId: number;
  workItemOther?: string;
  workItemDetail: string;

  imageName: string;
  imageDataUrl: string;

  imageNames?: string[];
  imageDataUrls?: string[];

  /**
   * ต้องเรียงตำแหน่งให้ตรงกับ imageNames / imageDataUrls
   */
  imageIds?: Array<number | null>;
};

type Props = {
  itemNumber: number;
  purposeOptions: WorkReportPurposeResponse[];
  workItemTypeOptions: WorkReportItemTypeResponse[];
  initialPurposeId?: number | null;
  initialValue?: WorkItemModalInitialValue | null;
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
  initialValue = null,
  busy = false,
  onClose,
  onSave,
}: Props) {
  const [selectedPurposeId, setSelectedPurposeId] = useState<number | null>(
    initialValue?.purposeId ??
      initialPurposeId ??
      purposeOptions[0]?.purpose_id ??
      null,
  );

  const [selectedWorkItemTypeId, setSelectedWorkItemTypeId] = useState<
    number | ""
  >(initialValue?.workItemTypeId ?? "");

  const [workItemOther, setWorkItemOther] = useState(
    initialValue?.workItemOther ?? "",
  );

  const [workItemDetail, setWorkItemDetail] = useState(
    initialValue?.workItemDetail ?? "",
  );

  const [images, setImages] = useState<SelectedImage[]>(() => {
    const dataUrls =
      initialValue?.imageDataUrls?.length
        ? initialValue.imageDataUrls
        : initialValue?.imageDataUrl
          ? [initialValue.imageDataUrl]
          : [];

    const names =
      initialValue?.imageNames?.length
        ? initialValue.imageNames
        : initialValue?.imageName
          ? [initialValue.imageName]
          : [];

    const ids = initialValue?.imageIds ?? [];

    return dataUrls.slice(0, MAX_IMAGES).map((dataUrl, index) => ({
      id: ids[index] ?? undefined,
      name: names[index] ?? `image-${index + 1}`,
      dataUrl,
      isExisting: true,
    }));
  });

  const [deletedImageIds, setDeletedImageIds] = useState<number[]>([]);
  const [error, setError] = useState("");

  const selectedWorkItemOption = useMemo(() => {
    if (selectedWorkItemTypeId === "") return undefined;

    return workItemTypeOptions.find(
      (option) => option.work_item_type_id === selectedWorkItemTypeId,
    );
  }, [selectedWorkItemTypeId, workItemTypeOptions]);

  useEffect(() => {
    setSelectedPurposeId((current) => {
      if (
        current !== null &&
        purposeOptions.some((option) => option.purpose_id === current)
      ) {
        return current;
      }

      if (
        initialValue?.purposeId !== null &&
        initialValue?.purposeId !== undefined &&
        purposeOptions.some(
          (option) => option.purpose_id === initialValue.purposeId,
        )
      ) {
        return initialValue.purposeId;
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
  }, [initialPurposeId, initialValue?.purposeId, purposeOptions]);

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

  function markDeletedImageId(imageId?: number) {
    if (imageId === undefined) return;

    setDeletedImageIds((current) => {
      if (current.includes(imageId)) {
        return current;
      }

      return [...current, imageId];
    });
  }

  async function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (files.length === 0) return;

    const imageFiles = files.filter((file) => file.type.startsWith("image/"));

    if (imageFiles.length !== files.length) {
      setError("กรุณาเลือกไฟล์รูปภาพเท่านั้น");
      return;
    }

    const availableSlots = MAX_IMAGES - images.length;

    if (availableSlots <= 0) {
      setError(`แนบรูปภาพได้สูงสุด ${MAX_IMAGES} รูป`);
      return;
    }

    const filesToRead = imageFiles.slice(0, availableSlots);

    try {
      setError("");

      const nextImages = await Promise.all(
        filesToRead.map(async (file) => ({
          name: file.name,
          dataUrl: await readFileAsDataUrl(file),
          isExisting: false,
        })),
      );

      setImages((current) => [...current, ...nextImages].slice(0, MAX_IMAGES));

      if (imageFiles.length > availableSlots) {
        setError(`แนบรูปภาพได้สูงสุด ${MAX_IMAGES} รูป`);
      }
    } catch (readError) {
      setError(
        readError instanceof Error
          ? readError.message
          : "อ่านไฟล์รูปภาพไม่สำเร็จ",
      );
    }
  }

  async function handleReplaceImage(
    index: number,
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("กรุณาเลือกไฟล์รูปภาพเท่านั้น");
      return;
    }

    const currentImage = images[index];

    if (!currentImage) {
      return;
    }

    try {
      setError("");

      const dataUrl = await readFileAsDataUrl(file);

      if (currentImage.isExisting) {
        markDeletedImageId(currentImage.id);
      }

      setImages((current) =>
        current.map((image, imageIndex) =>
          imageIndex === index
            ? {
                name: file.name,
                dataUrl,
                isExisting: false,
              }
            : image,
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

  function handleRemoveImage(index: number) {
    const currentImage = images[index];

    if (!currentImage) {
      return;
    }

    if (currentImage.isExisting) {
      markDeletedImageId(currentImage.id);
    }

    setImages((current) =>
      current.filter((_, imageIndex) => imageIndex !== index),
    );

    setError("");
  }

  function handleWorkItemTypeChange(value: string) {
    const nextId = value === "" ? "" : Number(value);

    setSelectedWorkItemTypeId(nextId);
    if (
      !workItemTypeOptions.some(
        (option) =>
          option.work_item_type_id === nextId &&
          option.work_item_code === "other",
      )
    ) {
      setWorkItemOther("");
    }
    setError("");
  }

  function handleSave() {
    const selectedPurpose = purposeOptions.find(
      (option) => option.purpose_id === selectedPurposeId,
    );

    if (!selectedPurpose) {
      setError("ไม่พบข้อมูลวัตถุประสงค์การเข้าหน่วยงาน");
      return;
    }

    if (selectedWorkItemTypeId === "") {
      setError("กรุณาเลือกสิ่งที่ดำเนินการเรียบร้อย");
      return;
    }

    const selectedOption = workItemTypeOptions.find(
      (option) => option.work_item_type_id === selectedWorkItemTypeId,
    );

    if (!selectedOption) {
      setError("ไม่พบรายการที่เลือก กรุณาลองใหม่");
      return;
    }

    const cleanWorkItemOther =
      selectedOption.work_item_code === "other" ? workItemOther.trim() : "";

    if (selectedOption.work_item_code === "other" && !cleanWorkItemOther) {
      setError("กรุณาระบุรายการอื่น ๆ");
      return;
    }

    const cleanWorkItemDetail = workItemDetail.trim();

    if (selectedOption.require_detail && !cleanWorkItemDetail) {
      setError("กรุณาระบุรายละเอียด");
      return;
    }

    const title = cleanWorkItemOther
      ? `อื่น ๆ: ${cleanWorkItemOther}`
      : selectedOption.work_item_name;

    const firstImage = images[0];

    const existingImages = images.filter(
      (image) => image.isExisting && image.id !== undefined,
    );

    const newImages = images.filter((image) => !image.isExisting);

    onSave({
      purposeId: selectedPurpose.purpose_id,
      purposeCode: selectedPurpose.purpose_code,
      purposeLabel: selectedPurpose.purpose_name,
      workItemTypeId: selectedOption.work_item_type_id,
      workItemCode: selectedOption.work_item_code,
      workItemOther: cleanWorkItemOther,
      workItemDetail: cleanWorkItemDetail,
      requireDetail: selectedOption.require_detail,
      title,

      imageName: firstImage?.name ?? "",
      imageDataUrl: firstImage?.dataUrl ?? "",

      imageNames: images.map((image) => image.name),
      imageDataUrls: images.map((image) => image.dataUrl),
      imageIds: images.map((image) => image.id ?? null),

      deletedImageIds,
      existingImageIds: existingImages.map((image) => image.id!),

      newImageNames: newImages.map((image) => image.name),
      newImageDataUrls: newImages.map((image) => image.dataUrl),
    });
  }

  const canSave =
    !busy &&
    selectedPurposeId !== null &&
    selectedWorkItemTypeId !== "" &&
    (selectedWorkItemOption?.work_item_code !== "other" ||
      Boolean(workItemOther.trim())) &&
    (!selectedWorkItemOption?.require_detail || Boolean(workItemDetail.trim()));

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
        aria-labelledby="work-item-modal-title"
      >
        <header className={styles.modalHeader}>
          <h2 id="work-item-modal-title">
            ข้อ 2. สิ่งที่ดำเนินการเรียบร้อย
          </h2>

          <button
            type="button"
            className={styles.closeIconButton}
            aria-label="ปิด"
            onClick={onClose}
            disabled={busy}
          >
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </header>

        <div className={styles.modalBody}>
          <div className={styles.itemField}>
            <label className={styles.itemLabel} htmlFor="work-item-type">
              2.{itemNumber} โปรดเลือก
              <span className={styles.requiredMark} aria-hidden="true">
                *
              </span>
            </label>

            <select
              id="work-item-type"
              className={styles.modalSelect}
              value={selectedWorkItemTypeId}
              onChange={(event) =>
                handleWorkItemTypeChange(event.target.value)
              }
              disabled={busy}
            >
              <option value="">--โปรดเลือก--</option>

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

          {selectedWorkItemOption?.work_item_code === "other" ? (
            <div className={styles.itemField}>
              <label className={styles.itemLabel} htmlFor="work-item-other">
                โปรดระบุรายการ
                <span className={styles.requiredMark} aria-hidden="true">
                  *
                </span>
              </label>

              <input
                id="work-item-other"
                type="text"
                className={styles.modalSelect}
                value={workItemOther}
                onChange={(event) => {
                  setWorkItemOther(event.target.value);
                  setError("");
                }}
                placeholder="ระบุสิ่งที่ดำเนินการ"
                maxLength={150}
                required
                disabled={busy}
              />
            </div>
          ) : null}

          <div className={styles.detailField}>
            <label
              className={styles.detailLabel}
              htmlFor="work-item-other-detail"
            >
              รายละเอียด
              {selectedWorkItemOption?.require_detail ? (
                <span className={styles.requiredMark} aria-hidden="true">
                  *
                </span>
              ) : null}
            </label>

            <textarea
              id="work-item-other-detail"
              className={styles.detailInput}
              value={workItemDetail}
              onChange={(event) => {
                setWorkItemDetail(event.target.value);
                setError("");
              }}
              placeholder="กรอกรายละเอียดเพิ่มเติม"
              maxLength={500}
              disabled={busy}
            />

            <div className={styles.characterCount}>
              {workItemDetail.length}/500
            </div>
          </div>

          <div className={styles.imageGrid} aria-label="รูปภาพประกอบ">
            {Array.from({ length: MAX_IMAGES }).map((_, index) => {
              const image = images[index];
              const replaceInputId = `work-item-replace-image-${itemNumber}-${index}`;

              return (
                <div className={styles.imageSlot} key={index}>
                  {image ? (
                    <>
                      <img
                        src={image.dataUrl}
                        alt={`รูปภาพประกอบ ${index + 1}`}
                      />

                      <div className={styles.imageActions}>
                        <input
                          id={replaceInputId}
                          type="file"
                          accept="image/*"
                          hidden
                          onChange={(event) =>
                            void handleReplaceImage(index, event)
                          }
                          disabled={busy}
                        />

                        <label
                          htmlFor={replaceInputId}
                          className={styles.replaceImageButton}
                          aria-disabled={busy}
                        >
                          เปลี่ยน
                        </label>

                        <button
                          type="button"
                          className={styles.removeImageButton}
                          onClick={() => handleRemoveImage(index)}
                          disabled={busy}
                          aria-label={`ลบรูปภาพ ${index + 1}`}
                        >
                          <FontAwesomeIcon icon={faXmark} />
                        </button>
                      </div>
                    </>
                  ) : (
                    <span>รูปภาพ</span>
                  )}
                </div>
              );
            })}
          </div>

          <label
            className={`${styles.imagePickerButton} ${
              images.length >= MAX_IMAGES ? styles.imagePickerDisabled : ""
            }`}
          >
            <input
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              onChange={(event) => void handleImageChange(event)}
              disabled={busy || images.length >= MAX_IMAGES}
            />

            <FontAwesomeIcon icon={faImage} />
            <span>แนบรูปภาพ</span>
          </label>

          {images.length > 0 ? (
            <div className={styles.imageCount}>
              แนบแล้ว {images.length}/{MAX_IMAGES} รูป
            </div>
          ) : null}

          {error ? (
            <div className={styles.modalError} role="alert">
              {error}
            </div>
          ) : null}
        </div>

        <footer className={styles.modalActions}>
          <button
            type="button"
            className={styles.cancelButton}
            onClick={onClose}
            disabled={busy}
          >
            ยกเลิก
          </button>

          <button
            type="button"
            className={styles.saveButton}
            onClick={handleSave}
            disabled={!canSave}
          >
            {busy ? "กำลังบันทึก..." : "เพิ่มข้อมูล"}
          </button>
        </footer>
      </section>
    </div>
  );
}
