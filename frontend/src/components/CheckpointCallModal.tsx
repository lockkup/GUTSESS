import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import styles from "./CheckpointCallModal.module.css";

export type CallStatus = 1 | 2 | 3;

const MAX_IMAGES = 3;

const ALLOWED_IMAGE_TYPES = new Set<string>([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export type CheckpointCallModalSavePayload = {
  contactDetail: string;
  callNote: string;
  callStatus: CallStatus;

  // รูปใหม่ / รูปที่ใช้แทนรูปเดิมเท่านั้น
  images: File[];

  // เรียงตามตำแหน่งรูปปัจจุบัน
  // number = รูปเดิมที่ยังคงอยู่
  // null = รูปใหม่ / รูปที่ใช้แทนรูปเดิม
  imageIds: Array<number | null>;

  // รูปเดิมที่ผู้ใช้ลบหรือเปลี่ยนออก
  deletedImageIds: number[];
};

export type CheckpointCallModalInitialImage = {
  time_record_image_id: number;
  image_path: string;
  sequence_no: number;
};

type ExistingPreviewImage = {
  kind: "existing";
  imageId: number;
  previewUrl: string;
};

type NewPreviewImage = {
  kind: "new";
  file: File;
  previewUrl: string;
};

type PreviewImage = ExistingPreviewImage | NewPreviewImage;

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
  initialImages?: CheckpointCallModalInitialImage[];
  onChangeContactDetail: (value: string) => void;
  onChangeCallNote: (value: string) => void;
  onChangeCallStatus: (value: CallStatus) => void;
  onClose: () => void;
  onSave: (payload: CheckpointCallModalSavePayload) => void | Promise<void>;
};

function formatShiftText(value?: string | null): string {
  const text = (value ?? "").trim();
  if (!text) return "-";
  if (text === "ผลัดกลางวัน") return "กลางวัน";
  if (text === "ผลัดกลางคืน") return "กลางคืน";
  return text.replace(/^ผลัด/, "").trim() || "-";
}

function buildUploadImageUrl(imagePath: string): string {
  const cleanPath = imagePath.trim();

  if (!cleanPath) {
    return "";
  }

  if (/^https?:\/\//i.test(cleanPath)) {
    return cleanPath;
  }

  const normalizedPath = cleanPath.startsWith("/")
    ? cleanPath
    : `/${cleanPath}`;

  const apiBaseUrl = String(
    import.meta.env.VITE_API_BASE_URL ?? "",
  )
    .trim()
    .replace(/\/+$/, "");

  if (!apiBaseUrl) {
    return normalizedPath;
  }

  try {
    const apiUrl = new URL(
      apiBaseUrl,
      window.location.origin,
    );

    return `${apiUrl.origin}${normalizedPath}`;
  } catch {
    return normalizedPath;
  }
}

function revokePreviewUrl(image: PreviewImage): void {
  if (image.kind === "new") {
    URL.revokeObjectURL(image.previewUrl);
  }
}

export default function CheckpointCallModal({
  isOpen,
  unitName,
  shiftText,
  contactDetail,
  callNote,
  callStatus,
  initialImages = [],
  onChangeContactDetail,
  onChangeCallNote,
  onChangeCallStatus,
  onClose,
  onSave,
}: Props) {
  const [formError, setFormError] = useState("");
  const [images, setImages] = useState<PreviewImage[]>([]);
  const [deletedImageIds, setDeletedImageIds] = useState<number[]>([]);

  // เก็บ index ของรูปที่ต้องการเปลี่ยน
  const [replaceImageIndex, setReplaceImageIndex] = useState<number | null>(
    null
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setFormError("");
    setReplaceImageIndex(null);
    setDeletedImageIds([]);

    setImages((currentImages) => {
      currentImages.forEach(revokePreviewUrl);

      return [...initialImages]
        .filter((image) => image.image_path.trim())
        .sort((a, b) => a.sequence_no - b.sequence_no)
        .slice(0, MAX_IMAGES)
        .map((image) => ({
          kind: "existing" as const,
          imageId: image.time_record_image_id,
          previewUrl: buildUploadImageUrl(image.image_path),
        }));
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [initialImages, isOpen, unitName]);

  if (!isOpen) return null;

  const displayShiftText = formatShiftText(shiftText);

  const clearImages = () => {
    setImages((currentImages) => {
      currentImages.forEach(revokePreviewUrl);
      return [];
    });
    setReplaceImageIndex(null);
    setDeletedImageIds([]);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClose = () => {
    setFormError("");
    clearImages();
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

  const addDeletedImageId = (imageId: number) => {
    setDeletedImageIds((currentIds) => {
      if (currentIds.includes(imageId)) {
        return currentIds;
      }

      return [...currentIds, imageId];
    });
  };

  // ======================================================
  // แนบรูปใหม่
  // ======================================================

  const handleOpenFilePicker = () => {
    if (images.length >= MAX_IMAGES) {
      setFormError(`สามารถแนบรูปภาพได้สูงสุด ${MAX_IMAGES} รูป`);
      return;
    }
    setReplaceImageIndex(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  // ======================================================
  // เปลี่ยนรูปเดิม
  // ======================================================

  const handleReplaceImage = (index: number) => {
    setFormError("");
    setReplaceImageIndex(index);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  // ======================================================
  // เมื่อเลือกรูป
  // ======================================================

  const handleImageChange = (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    if (selectedFiles.length === 0) {
      return;
    }
    const imageFiles = selectedFiles.filter((file) =>
      ALLOWED_IMAGE_TYPES.has(file.type.toLowerCase())
    );
    if (imageFiles.length !== selectedFiles.length) {
      setFormError("กรุณาเลือกไฟล์รูปภาพเท่านั้น");
      event.target.value = "";
      setReplaceImageIndex(null);
      return;
    }
    // ====================================================
    // กรณีกดปุ่ม "เปลี่ยน"
    // ====================================================
    if (replaceImageIndex !== null) {
      const newFile = imageFiles[0];
      if (!newFile) {
        event.target.value = "";
        setReplaceImageIndex(null);
        return;
      }
      const newPreviewImage: NewPreviewImage = {
        kind: "new",
        file: newFile,
        previewUrl: URL.createObjectURL(newFile),
      };
      const oldImage = images[replaceImageIndex];

      if (oldImage?.kind === "existing") {
        addDeletedImageId(oldImage.imageId);
      } else if (oldImage?.kind === "new") {
        revokePreviewUrl(oldImage);
      }

      setImages((currentImages) => {
        const updatedImages = [...currentImages];
        updatedImages[replaceImageIndex] = newPreviewImage;
        return updatedImages;
      });
      setFormError("");
      setReplaceImageIndex(null);
      event.target.value = "";
      return;
    }
    // ====================================================
    // กรณีแนบรูปใหม่
    // ====================================================
    const remainingCount = MAX_IMAGES - images.length;
    if (remainingCount <= 0) {
      setFormError(`สามารถแนบรูปภาพได้สูงสุด ${MAX_IMAGES} รูป`);
      event.target.value = "";
      return;
    }
    const filesToAdd = imageFiles.slice(0, remainingCount);
    const newImages: NewPreviewImage[] = filesToAdd.map((file) => ({
      kind: "new",
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    setImages((currentImages) => [
      ...currentImages,
      ...newImages,
    ]);
    if (imageFiles.length > remainingCount) {
      setFormError(`สามารถแนบรูปภาพได้สูงสุด ${MAX_IMAGES} รูป`);
    } else {
      setFormError("");
    }
    event.target.value = "";
  };

  // ======================================================
  // ลบรูป
  // ======================================================

  const handleRemoveImage = (index: number) => {
    const targetImage = images[index];

    if (targetImage?.kind === "existing") {
      addDeletedImageId(targetImage.imageId);
    } else if (targetImage?.kind === "new") {
      revokePreviewUrl(targetImage);
    }

    setImages((currentImages) =>
      currentImages.filter(
        (_, imageIndex) => imageIndex !== index,
      ),
    );

    setReplaceImageIndex(null);
    setFormError("");
  };

  const handleSave = async () => {
    const cleanContactDetail = contactDetail.trim();
    const cleanCallNote = callNote.trim();

    if (!cleanContactDetail && !cleanCallNote) {
      setFormError(
        "โปรดระบุข้อมูลผู้มาติดต่อ หรือรายละเอียดการโทร",
      );
      return;
    }

    const imageIds = images.map((image) =>
      image.kind === "existing"
        ? image.imageId
        : null,
    );

    const newImages = images
      .filter(
        (image): image is NewPreviewImage =>
          image.kind === "new",
      )
      .map((image) => image.file);

    setFormError("");

    await onSave({
      contactDetail: cleanContactDetail,
      callNote: cleanCallNote,
      callStatus,
      images: newImages,
      imageIds,
      deletedImageIds,
    });
  };

  return (
    <div
      className={styles.overlay}
      onClick={handleClose}
    >
      <section
        className={styles.card}
        role="dialog"
        aria-modal="true"
        aria-label="บันทึกรายละเอียดการโทร"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.header}>
          <h3 className={styles.title}>
            บันทึกรายละเอียดการโทร
          </h3>
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
          <label
            className={styles.label}
            htmlFor="checkpoint-contact-detail"
          >
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
          <label
            className={styles.label}
            htmlFor="checkpoint-call-note"
          >
            รายละเอียดการโทร
          </label>
          <textarea
            id="checkpoint-call-note"
            className={styles.textarea}
            value={callNote}
            onChange={(event) =>
              handleChangeCallNote(event.target.value)
            }
            placeholder="กรอกรายละเอียดการโทร"
            rows={5}
          />
          {/* ======================================================
              รูปภาพแนบ
              ====================================================== */}
          <div className={styles.imageSection}>
            <div className={styles.imagePreviewGrid}>
              {Array.from({ length: MAX_IMAGES }, (_, index) => index).map(
                (index) => {
                  const image = images[index];

                  return (
                    <div
                    key={index}
                    className={styles.imagePreviewBox}
                  >
                    {image ? (
                      <>
                        <div className={styles.imageThumbArea}>
                          <img
                            src={image.previewUrl}
                            alt={`รูปภาพที่แนบ ${index + 1}`}
                            className={styles.imagePreview}
                          />
                          <button
                            type="button"
                            className={styles.removeImageBtn}
                            onClick={() =>
                              handleRemoveImage(index)
                            }
                            aria-label={`ลบรูปภาพที่ ${index + 1}`}
                          >
                            ×
                          </button>
                        </div>
                        <button
                          type="button"
                          className={styles.changeImageBtn}
                          onClick={() =>
                            handleReplaceImage(index)
                          }
                        >
                          เปลี่ยน
                        </button>
                      </>
                    ) : (
                      <span
                        className={styles.imagePlaceholder}
                      >
                        รูปภาพ
                      </span>
                    )}
                    </div>
                  );
                },
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className={styles.hiddenFileInput}
              onChange={handleImageChange}
            />
            <button
              type="button"
              className={styles.attachImageBtn}
              onClick={handleOpenFilePicker}
              disabled={images.length >= MAX_IMAGES}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M4 5.5C4 4.67 4.67 4 5.5 4H18.5C19.33 4 20 4.67 20 5.5V18.5C20 19.33 19.33 20 18.5 20H5.5C4.67 20 4 19.33 4 18.5V5.5Z"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <circle
                  cx="9"
                  cy="9"
                  r="2"
                  fill="currentColor"
                />
                <path
                  d="M5 17L9 13L12 16L15 12L20 17"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>แนบรูปภาพ</span>
            </button>
          </div>
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
