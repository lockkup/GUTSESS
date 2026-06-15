// src/components/CheckpointMapModal/index.tsx
import { useEffect, useMemo } from "react";
import { X } from "lucide-react";

import styles from "./CheckpointMapModal.module.css";

export type CheckpointMapLocation = {
  contractCode: string;
  locationName: string;
  latitude: number | string | null;
  longitude: number | string | null;
  radiusMeter?: number | string | null;
  graceMeter?: number | string | null;

  /**
   * หมายเหตุ / รายละเอียดเพิ่มเติมจาก site_location.location_detail
   */
  locationDetail?: string | null;
};

type CheckpointMapModalProps = {
  open: boolean;
  location: CheckpointMapLocation | null;
  loading?: boolean;
  errorMessage?: string | null;
  onClose: () => void;
};

function toFiniteNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatNumber(value: number, fractionDigits = 6): string {
  return value.toFixed(fractionDigits);
}

export default function CheckpointMapModal({
  open,
  location,
  loading = false,
  errorMessage = null,
  onClose,
}: CheckpointMapModalProps) {
  const lat = useMemo(() => toFiniteNumber(location?.latitude), [location]);
  const lng = useMemo(() => toFiniteNumber(location?.longitude), [location]);

  const radiusMeter = useMemo(
    () => toFiniteNumber(location?.radiusMeter) ?? 0,
    [location],
  );

  const graceMeter = useMemo(
    () => toFiniteNumber(location?.graceMeter) ?? 0,
    [location],
  );

  const totalRadiusMeter = radiusMeter + graceMeter;
  const hasValidCoordinate = lat !== null && lng !== null;

  const unitName = location
    ? `${location.contractCode}-${location.locationName}`
    : "-";

  const locationDetail = location?.locationDetail?.trim() || "-";

  const mapEmbedUrl = hasValidCoordinate
    ? `https://maps.google.com/maps?q=${lat},${lng}&z=18&output=embed`
    : "";

  const googleMapUrl = hasValidCoordinate
    ? `https://www.google.com/maps?q=${lat},${lng}`
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
      aria-label="พิกัดเข้าตรวจหน่วยงาน"
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

        <h2 className={styles.title}>พิกัดเข้าตรวจหน่วยงาน</h2>

        <p className={styles.unitName}>{unitName}</p>

        <p className={styles.description}>
          ระบบกำหนดพิกัดนี้ไว้สำหรับการกดเข้า/ออกงาน กรุณาอยู่ภายในรัศมีที่กำหนดก่อนทำรายการ
        </p>

        <div className={styles.infoBox}>
          {loading ? (
            <p className={styles.infoText}>กำลังโหลดพิกัด...</p>
          ) : errorMessage ? (
            <p className={styles.errorText}>{errorMessage}</p>
          ) : hasValidCoordinate ? (
            <>
              <p className={styles.infoText}>
                <span className={styles.infoLabel}>พิกัด:</span>{" "}
                {formatNumber(lat)}, {formatNumber(lng)}
              </p>

              <p className={styles.infoText}>
                <span className={styles.infoLabel}>รัศมีที่อนุญาต:</span>{" "}
                {totalRadiusMeter > 0 ? `${totalRadiusMeter} เมตร` : "-"}
              </p>

              <p className={styles.infoText}>
                <span className={styles.infoLabel}>หมายเหตุ:</span>{" "}
                {locationDetail}
              </p>
            </>
          ) : (
            <p className={styles.errorText}>ไม่พบพิกัดของหน่วยงานนี้</p>
          )}
        </div>

        <div className={styles.mapBox}>
          {hasValidCoordinate && !loading && !errorMessage ? (
            <iframe
              title={`แผนที่ ${unitName}`}
              className={styles.mapFrame}
              src={mapEmbedUrl}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          ) : (
            <div className={styles.mapPlaceholder}>
              {loading ? "กำลังโหลดแผนที่..." : "ไม่สามารถแสดงแผนที่ได้"}
            </div>
          )}
        </div>

        <a
          className={`${styles.primaryButton} ${
            !hasValidCoordinate || loading || errorMessage
              ? styles.disabledLink
              : ""
          }`}
          href={googleMapUrl}
          target="_blank"
          rel="noreferrer"
          aria-disabled={!hasValidCoordinate || loading || !!errorMessage}
          onClick={(event) => {
            if (!hasValidCoordinate || loading || errorMessage) {
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