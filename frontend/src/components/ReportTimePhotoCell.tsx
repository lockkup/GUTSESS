import "./ReportTimePhotoCell.css";

type ReportTimePhotoCellProps = {
  time?: string | null;
  imageUrl?: string | null;
  imageTitle: string;
  align?: "center" | "right";
  onPreview: (imageUrl: string, title: string) => void;
};

export default function ReportTimePhotoCell({
  time,
  imageUrl,
  imageTitle,
  align = "center",
  onPreview,
}: ReportTimePhotoCellProps) {
  const timeText = String(time ?? "").trim() || "-";
  const hasImage = Boolean(imageUrl);

  return (
    <div
      className={`report-time-photo-cell ${
        align === "right" ? "report-time-photo-cell--right" : ""
      }`}
    >
      <span className="report-time-photo-cell__time">{timeText}</span>

      {hasImage && imageUrl ? (
        <button
          type="button"
          className="report-time-photo-cell__thumb-button"
          onClick={() => onPreview(imageUrl, imageTitle)}
          title="กดเพื่อดูรูปภาพ"
          aria-label={imageTitle}
        >
          <img src={imageUrl} alt={imageTitle} />
        </button>
      ) : (
        <span className="report-time-photo-cell__no-image">ไม่มีรูป</span>
      )}
    </div>
  );
}