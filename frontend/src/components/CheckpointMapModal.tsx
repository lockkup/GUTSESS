// src/components/CheckpointMapModal/index.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin, X } from "lucide-react";

import styles from "./CheckpointMapModal.module.css";

export type CheckpointMapUpdateContext = {
  locationId: number;
  departmentId: number;
  divisionId: number;
  routeId: number;
};

export type CheckpointMapLocation = {
  contractCode: string;
  locationName: string;
  latitude: number | string | null;
  longitude: number | string | null;
  radiusMeter?: number | string | null;
  graceMeter?: number | string | null;

  /** หมายเหตุ / รายละเอียดเพิ่มเติมจาก site_location.location_detail */
  locationDetail?: string | null;

  /** รหัสจริงของหน่วยงานและเส้นทางที่เลือก รับมาพร้อมข้อมูลพิกัด */
  updateContext?: CheckpointMapUpdateContext | null;
};

/**
 * Service แปลงชื่อฟิลด์จาก API เป็น camelCase และส่ง boolean จริงเข้ามา
 * Backend ต้องตรวจสิทธิ์ของพนักงานและขอบเขตหน่วยงานก่อนคืน Setting นี้
 * วันที่ใช้ YYYY-MM-DD; null หมายถึงไม่จำกัดวันเริ่ม/สิ้นสุดด้านนั้น
 */
export type CheckpointMapUpdateSetting = {
  departmentId: number;
  divisionId: number;
  routeId: number;
  /** อนุญาตทั้งการแก้พิกัดจาก GPS และระยะรัศมี */
  allowLocationUpdate: boolean;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  isActive: boolean;
  markFlag: boolean;
};

export type CheckpointRadiusMeter = 50 | 70 | 100;

/** ข้อมูลสำหรับ callback ภายใน Frontend; Service เป็นผู้แปลงเป็น request ของ API */
export type CheckpointMapUpdatePayload = CheckpointMapUpdateContext & {
  latitude: number;
  longitude: number;
  accuracyMeter: number;
  /** รัศมีหลักที่เลือก ไม่รวม graceMeter */
  radiusMeter: CheckpointRadiusMeter;
};

type CheckpointMapModalProps = {
  open: boolean;
  location: CheckpointMapLocation | null;
  loading?: boolean;
  errorMessage?: string | null;
  updateSetting?: CheckpointMapUpdateSetting | null;
  permissionLoading?: boolean;
  /** บันทึกผ่าน API และโหลดข้อมูลหน่วยงานใหม่; throw เมื่อบันทึกไม่สำเร็จ */
  onUpdate?: (payload: CheckpointMapUpdatePayload) => Promise<void>;
  onClose: () => void;
};

const RADIUS_OPTIONS: readonly CheckpointRadiusMeter[] = [50, 70, 100];

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

function isRadiusOption(value: number): value is CheckpointRadiusMeter {
  return RADIUS_OPTIONS.some((option) => option === value);
}

function parseDateOnly(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
    ? date
    : null;
}

function getBangkokDate(): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    calendar: "gregory",
    numberingSystem: "latn",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function formatThaiDate(value: string): string {
  const date = parseDateOnly(value);
  if (!date) return "";

  return new Intl.DateTimeFormat("th-TH-u-ca-buddhist-nu-latn", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function isSettingAllowed(
  setting: CheckpointMapUpdateSetting | null,
  context: CheckpointMapUpdateContext | null,
  today: string,
): boolean {
  if (!setting || !context) return false;
  if (
    !Object.values(context).every((id) => Number.isSafeInteger(id) && id > 0) ||
    setting.departmentId !== context.departmentId ||
    setting.divisionId !== context.divisionId ||
    setting.routeId !== context.routeId ||
    setting.allowLocationUpdate !== true ||
    setting.isActive !== true ||
    setting.markFlag !== false
  ) {
    return false;
  }

  const { effectiveFrom: from, effectiveTo: to } = setting;
  if (from !== null && (typeof from !== "string" || !parseDateOnly(from))) return false;
  if (to !== null && (typeof to !== "string" || !parseDateOnly(to))) return false;
  if (from !== null && to !== null && from > to) return false;

  return (from === null || today >= from) && (to === null || today <= to);
}

function getPermissionPeriodText(setting: CheckpointMapUpdateSetting | null): string {
  if (!setting) return "";
  const { effectiveFrom: from, effectiveTo: to } = setting;

  if (from && to) {
    return `อนุญาตให้แก้ไขพิกัดตั้งแต่วันที่ ${formatThaiDate(from)} ถึงวันที่ ${formatThaiDate(to)}`;
  }
  if (from) return `อนุญาตให้แก้ไขพิกัดตั้งแต่วันที่ ${formatThaiDate(from)}`;
  if (to) return `อนุญาตให้แก้ไขพิกัดถึงวันที่ ${formatThaiDate(to)}`;
  return "";
}

function readCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!window.isSecureContext) {
      reject(new Error("กรุณาเปิดผ่าน HTTPS หรือ localhost เพื่ออ่านพิกัดปัจจุบัน"));
      return;
    }
    if (!navigator.geolocation) {
      reject(new Error("อุปกรณ์หรือเบราว์เซอร์นี้ไม่รองรับการอ่านพิกัด"));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, (error) => {
      const message = error.code === 1
        ? "กรุณาอนุญาตให้เข้าถึงตำแหน่ง แล้วลองใหม่อีกครั้ง"
        : error.code === 2
          ? "ไม่สามารถอ่านพิกัดได้ กรุณาเปิดบริการตำแหน่งแล้วลองใหม่"
          : error.code === 3
            ? "อ่านพิกัดนานเกินกำหนด กรุณาลองใหม่อีกครั้ง"
            : "ไม่สามารถอ่านพิกัดปัจจุบันได้";
      reject(new Error(message));
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
  });
}

export default function CheckpointMapModal({
  open,
  location,
  loading = false,
  errorMessage = null,
  updateSetting = null,
  permissionLoading = false,
  onUpdate,
  onClose,
}: CheckpointMapModalProps) {
  const lat = useMemo(() => toFiniteNumber(location?.latitude), [location]);
  const lng = useMemo(() => toFiniteNumber(location?.longitude), [location]);
  const radiusMeter = useMemo(() => toFiniteNumber(location?.radiusMeter) ?? 0, [location]);
  const graceMeter = useMemo(() => toFiniteNumber(location?.graceMeter) ?? 0, [location]);
  const totalRadiusMeter = radiusMeter + graceMeter;
  const hasValidCoordinate = lat !== null && lng !== null;
  const unitName = location ? `${location.contractCode}-${location.locationName}` : "-";
  const locationDetail = location?.locationDetail?.trim() || "-";

  const context = location?.updateContext ?? null;
  const contextKey = JSON.stringify([
    context?.locationId, context?.departmentId, context?.divisionId, context?.routeId,
    location?.contractCode, location?.locationName,
  ]);
  const [today, setToday] = useState(getBangkokDate);
  const [selectedRadius, setSelectedRadius] = useState<CheckpointRadiusMeter>(50);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const operationRef = useRef(0);
  const busyRef = useRef(false);

  const showEditMode = !loading && !errorMessage && !permissionLoading &&
    isSettingAllowed(updateSetting, context, today);
  const permissionPeriodText = showEditMode ? getPermissionPeriodText(updateSetting) : "";

  const mapEmbedUrl = hasValidCoordinate
    ? `https://maps.google.com/maps?q=${lat},${lng}&z=18&output=embed`
    : "";
  const googleMapUrl = hasValidCoordinate
    ? `https://www.google.com/maps?q=${lat},${lng}`
    : "#";

  useEffect(() => {
    if (!open) return;
    setToday(getBangkokDate());
    const timer = window.setInterval(() => setToday(getBangkokDate()), 30_000);
    return () => window.clearInterval(timer);
  }, [open]);

  useEffect(() => {
    setSelectedRadius(isRadiusOption(radiusMeter) ? radiusMeter : 50);
  }, [open, contextKey, radiusMeter]);

  useEffect(() => {
    operationRef.current += 1;
    busyRef.current = false;
    setIsUpdating(false);
    setUpdateError(null);
    // ไม่ใช้ผล GPS ของหน้าต่าง/หน่วยงานเดิม เมื่อปิดหรือเปลี่ยนสิทธิ์ระหว่างรอ
    return () => { operationRef.current += 1; };
  }, [
    open, contextKey, showEditMode,
    updateSetting?.effectiveFrom, updateSetting?.effectiveTo,
  ]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busyRef.current) onClose();
    };
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  async function handleUpdate() {
    if (
      !open || busyRef.current || !onUpdate || !context || !showEditMode
    ) return;

    setUpdateError(null);
    const currentDate = getBangkokDate();
    setToday(currentDate);
    if (!isSettingAllowed(updateSetting, context, currentDate)) {
      setUpdateError("อยู่นอกช่วงวันที่อนุญาตให้แก้ไขข้อมูล");
      return;
    }

    const operation = ++operationRef.current;
    const isCurrentOperation = () => operationRef.current === operation;
    busyRef.current = true;
    setIsUpdating(true);

    try {
      // เก็บเป้าหมายและรัศมีไว้ก่อนรอ GPS เพื่อบันทึกให้หน่วยงานที่เลือกเท่านั้น
      const targetContext = { ...context };
      const radiusToSave = selectedRadius;
      const position = await readCurrentPosition();
      if (!isCurrentOperation()) return;
      const { latitude, longitude, accuracy } = position.coords;
      if (
        !Number.isFinite(latitude) || Math.abs(latitude) > 90 ||
        !Number.isFinite(longitude) || Math.abs(longitude) > 180 ||
        !Number.isFinite(accuracy) || accuracy < 0
      ) {
        throw new Error("พิกัดที่อ่านได้ไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง");
      }

      const payload: CheckpointMapUpdatePayload = {
        ...targetContext,
        latitude,
        longitude,
        accuracyMeter: accuracy,
        radiusMeter: radiusToSave,
      };

      if (!isSettingAllowed(updateSetting, context, getBangkokDate())) {
        setToday(getBangkokDate());
        throw new Error("สิ้นสุดช่วงวันที่อนุญาตให้แก้ไขข้อมูลแล้ว");
      }

      // Backend ต้องตรวจสิทธิ์/ช่วงวันที่ซ้ำก่อนบันทึกข้อมูลจริง
      await onUpdate(payload);
    } catch (error) {
      if (isCurrentOperation()) {
        setUpdateError(error instanceof Error ? error.message : "ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่");
      }
    } finally {
      if (isCurrentOperation()) {
        busyRef.current = false;
        setIsUpdating(false);
      }
    }
  }

  if (!open) return null;

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label="พิกัดเข้าตรวจหน่วยงาน"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busyRef.current) onClose();
      }}
    >
      <div className={styles.modal}>
        <button
          type="button"
          className={styles.closeIconButton}
          aria-label="ปิด"
          disabled={isUpdating}
          onClick={() => { if (!busyRef.current) onClose(); }}
        >
          <X size={22} strokeWidth={3} />
        </button>

        <h2 className={styles.title}>พิกัดเข้าตรวจหน่วยงาน</h2>
        <p className={styles.unitName}>{unitName}</p>

        {showEditMode ? (
          <>
            <p className={styles.updateDescription}>
              กรุณาเลือกข้อมูลเพื่อแก้ไขพิกัด<br />
              เฉพาะเส้นทางใหม่ ที่อนุญาตเท่านั้น
            </p>
            {permissionPeriodText && (
              <p className={styles.updatePeriod} tabIndex={0}>{permissionPeriodText}</p>
            )}
          </>
        ) : (
          <p className={styles.description}>
            ระบบกำหนดพิกัดนี้ไว้สำหรับการกดเข้า/ออกงาน กรุณาอยู่ภายในรัศมีที่กำหนดก่อนทำรายการ
          </p>
        )}

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

        {showEditMode && (
          <div className={styles.updateControls} aria-busy={isUpdating}>
            <label className={styles.radiusRow}>
              <span className={styles.radiusLabel}>แก้ไขระยะรัศมี :</span>
              <select
                className={styles.radiusSelect}
                value={selectedRadius}
                disabled={isUpdating || !onUpdate}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  if (isRadiusOption(value)) {
                    setSelectedRadius(value);
                    setUpdateError(null);
                  }
                }}
              >
                {RADIUS_OPTIONS.map((value) => (
                  <option key={value} value={value}>{value} เมตร</option>
                ))}
              </select>
            </label>

            <button
              type="button"
              className={styles.updateButton}
              disabled={isUpdating || !onUpdate}
              onClick={handleUpdate}
            >
              <MapPin className={styles.updateButtonIcon} size={30} aria-hidden="true" />
              <span className={styles.updateButtonText}>
                <span>{isUpdating ? "กำลังอ่านพิกัดและบันทึก..." : "กดแก้ไขพิกัด"}</span>
                <span className={styles.updateButtonHint}>(ท่านต้องอยู่พิกัดจริงเท่านั้น)</span>
              </span>
            </button>
          </div>
        )}

        {updateError && <p className={styles.updateError} role="alert">{updateError}</p>}
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
            !hasValidCoordinate || loading || errorMessage ? styles.disabledLink : ""
          }`}
          href={googleMapUrl}
          target="_blank"
          rel="noreferrer"
          aria-disabled={!hasValidCoordinate || loading || !!errorMessage}
          onClick={(event) => {
            if (!hasValidCoordinate || loading || errorMessage) event.preventDefault();
          }}
        >
          เปิดใน Google Maps
        </a>

        <button
          type="button"
          className={styles.secondaryButton}
          disabled={isUpdating}
          onClick={() => { if (!busyRef.current) onClose(); }}
        >
          ปิด
        </button>
      </div>
    </div>
  );
}