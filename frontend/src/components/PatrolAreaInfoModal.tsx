import { useEffect, useMemo } from "react";
import { X } from "lucide-react";

import styles from "./PatrolAreaInfoModal.module.css";

export type PatrolAreaInfoModalLocation = {
  locationId?: number | string | null;
  contractCode: string;
  locationName: string;
  latitude: number | string | null;
  longitude: number | string | null;
  radiusMeter?: number | string | null;
  graceMeter?: number | string | null;

  /**
   * รายละเอียดเพิ่มเติมจาก site_location.location_detail
   */
  locationDetail?: string | null;

  /**
   * เก็บไว้รองรับข้อมูลเดิมจากหน้า PatrolAreaInfo
   * แต่ยังไม่แสดงใน Modal นี้
   */
  updatedAt?: string | null;
};

type PatrolAreaInfoModalProps = {
  open: boolean;
  location: PatrolAreaInfoModalLocation | null;
  loading?: boolean;
  errorMessage?: string | null;
  onClose: () => void;
};

function toFiniteNumber(
  value: number | string | null | undefined,
): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function formatNumber(value: number, fractionDigits = 6): string {
  return value.toFixed(fractionDigits);
}

export default function PatrolAreaInfoModal({
  open,
  location,
  loading = false,
  errorMessage = null,
  onClose,
}: PatrolAreaInfoModalProps) {
  const latitude = useMemo(
    () => toFiniteNumber(location?.latitude),
    [location],
  );

  const longitude = useMemo(
    () => toFiniteNumber(location?.longitude),
    [location],
  );

  const radiusMeter = useMemo(
    () => toFiniteNumber(location?.radiusMeter) ?? 0,
    [location],
  );

  const graceMeter = useMemo(
    () => toFiniteNumber(location?.graceMeter) ?? 0,
    [location],
  );

  const totalRadiusMeter = radiusMeter + graceMeter;

  const hasValidCoordinate =
    latitude !== null && longitude !== null;

  const unitName = location
    ? `${location.contractCode}-${location.locationName}`
    : "-";

  const locationDetail =
    location?.locationDetail?.trim() || "-";

  const mapEmbedUrl = hasValidCoordinate
    ? `https://maps.google.com/maps?q=${latitude},${longitude}&z=18&output=embed`
    : "";

  const googleMapsUrl = hasValidCoordinate
    ? `https://www.google.com/maps?q=${latitude},${longitude}`
    : "#";

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    const originalOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label="ข้อมูลพิกัดหน่วยงาน"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className={styles.modal}>
        <button
          type="button"
          className={styles.closeIconButton}
          aria-label="ปิด"
          onClick={onClose}
        >
          <X size={22} strokeWidth={3} />
        </button>

        <h2 className={styles.title}>ข้อมูลหน่วยงาน</h2>

        <p className={styles.unitName}>{unitName}</p>

        <p className={styles.description}>
          แสดงพิกัด รัศมีที่กำหนด และรายละเอียดสถานที่ของหน่วยงาน
        </p>

        <div className={styles.infoBox}>
          {loading ? (
            <p className={styles.infoText}>
              กำลังโหลดข้อมูลพิกัด...
            </p>
          ) : errorMessage ? (
            <p className={styles.errorText}>
              {errorMessage}
            </p>
          ) : hasValidCoordinate ? (
            <>
              <p className={styles.infoText}>
                <span className={styles.infoLabel}>
                  พิกัด:
                </span>{" "}
                {formatNumber(latitude)},{" "}
                {formatNumber(longitude)}
              </p>

              <p className={styles.infoText}>
                <span className={styles.infoLabel}>
                  รัศมีที่อนุญาต:
                </span>{" "}
                {totalRadiusMeter > 0
                  ? `${totalRadiusMeter} เมตร`
                  : "-"}
              </p>

              <p className={styles.infoText}>
                <span className={styles.infoLabel}>
                  รายละเอียดสถานที่:
                </span>{" "}
                {locationDetail}
              </p>
            </>
          ) : (
            <p className={styles.errorText}>
              ไม่พบพิกัดของหน่วยงานนี้
            </p>
          )}
        </div>

        <div className={styles.mapBox}>
          {hasValidCoordinate &&
          !loading &&
          !errorMessage ? (
            <iframe
              title={`แผนที่ ${unitName}`}
              className={styles.mapFrame}
              src={mapEmbedUrl}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          ) : (
            <div className={styles.mapPlaceholder}>
              {loading
                ? "กำลังโหลดแผนที่..."
                : "ไม่สามารถแสดงแผนที่ได้"}
            </div>
          )}
        </div>

        <a
          className={`${styles.primaryButton} ${
            !hasValidCoordinate || loading || errorMessage
              ? styles.disabledLink
              : ""
          }`}
          href={googleMapsUrl}
          target="_blank"
          rel="noreferrer"
          aria-disabled={
            !hasValidCoordinate ||
            loading ||
            !!errorMessage
          }
          onClick={(event) => {
            if (
              !hasValidCoordinate ||
              loading ||
              errorMessage
            ) {
              event.preventDefault();
            }
          }}
        >
          เปิดใน Google Maps
        </a>

        <button
          type="button"
          className={styles.secondaryButton}
          onClick={onClose}
        >
          ปิด
        </button>
      </div>
    </div>
  );
}