import { useEffect } from "react";

import "./ReportImagePreviewModal.css";

export type PreviewImageState = {
  url: string;
  title: string;
};

type ReportImagePreviewModalProps = {
  previewImage: PreviewImageState | null;
  onClose: () => void;
};

export default function ReportImagePreviewModal({
  previewImage,
  onClose,
}: ReportImagePreviewModalProps) {
  useEffect(() => {
    if (!previewImage) {
      return undefined;
    }

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEsc);

    return () => {
      document.removeEventListener("keydown", handleEsc);
    };
  }, [previewImage, onClose]);

  if (!previewImage) {
    return null;
  }

  return (
    <div
      className="report-image-preview-overlay"
      role="presentation"
      onMouseDown={onClose}
    >
      <div
        className="report-image-preview-modal"
        role="dialog"
        aria-modal="true"
        aria-label={previewImage.title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="report-image-preview-header">
          <strong>{previewImage.title}</strong>

          <button
            type="button"
            className="report-image-preview-close-button"
            onClick={onClose}
            aria-label="ปิดรูปภาพ"
          >
            ×
          </button>
        </div>

        <div className="report-image-preview-body">
          <img src={previewImage.url} alt={previewImage.title} />
        </div>
      </div>
    </div>
  );
}