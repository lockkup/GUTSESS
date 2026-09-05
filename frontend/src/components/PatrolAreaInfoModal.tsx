import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin, X } from "lucide-react";

import styles from "./PatrolAreaInfoModal.module.css";

export type PatrolAreaInfoUpdateContext = {
  locationId: number;
  departmentId: number;
  divisionId: number;
  routeId: number;
};

export type PatrolAreaInfoModalLocation = {
  locationId?: number | string | null;
  departmentId?: number | string | null;
  divisionId?: number | string | null;
  routeId?: number | string | null;

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

export type PatrolAreaInfoUpdateSetting = {
  departmentId: number;
  divisionId: number;
  routeId: number;
  allowLocationUpdate: boolean;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  isActive: boolean;
  markFlag: boolean;
};

export type PatrolAreaInfoRadiusMeter = 50 | 70 | 100;

export type PatrolAreaInfoUpdatePayload = PatrolAreaInfoUpdateContext & {
  latitude: number;
  longitude: number;
  accuracyMeter: number;
  radiusMeter: PatrolAreaInfoRadiusMeter;
};

type PatrolAreaInfoModalProps = {
  open: boolean;
  location: PatrolAreaInfoModalLocation | null;
  loading?: boolean;
  errorMessage?: string | null;

  /**
   * ถ้ามี Setting ที่อนุญาต และ context ของหน่วยงานครบ
   * Modal จะแสดงส่วนแก้ไขพิกัด/รัศมี
   */
  updateSetting?: PatrolAreaInfoUpdateSetting | null;
  permissionLoading?: boolean;

  /**
   * Parent เป็นผู้เรียก API บันทึกจริง
   * throw Error กลับมาเมื่อบันทึกไม่สำเร็จ
   */
  onUpdate?: (payload: PatrolAreaInfoUpdatePayload) => Promise<void>;

  onClose: () => void;
};

const RADIUS_OPTIONS: readonly PatrolAreaInfoRadiusMeter[] = [50, 70, 100];

function toFiniteNumber(
  value: number | string | null | undefined,
): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function toPositiveInteger(
  value: number | string | null | undefined,
): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);

  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function formatNumber(value: number, fractionDigits = 6): string {
  return value.toFixed(fractionDigits);
}

function isRadiusOption(value: number): value is PatrolAreaInfoRadiusMeter {
  return RADIUS_OPTIONS.some((option) => option === value);
}

function parseDateOnly(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
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

  const getPart = (type: string) =>
    parts.find((item) => item.type === type)?.value ?? "";

  return `${getPart("year")}-${getPart("month")}-${getPart("day")}`;
}

function formatThaiDate(value: string): string {
  const date = parseDateOnly(value);

  if (!date) {
    return "";
  }

  return new Intl.DateTimeFormat("th-TH-u-ca-buddhist-nu-latn", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function getUpdateContext(
  location: PatrolAreaInfoModalLocation | null,
): PatrolAreaInfoUpdateContext | null {
  if (!location) {
    return null;
  }

  const locationId = toPositiveInteger(location.locationId);
  const departmentId = toPositiveInteger(location.departmentId);
  const divisionId = toPositiveInteger(location.divisionId);
  const routeId = toPositiveInteger(location.routeId);

  if (
    locationId === null ||
    departmentId === null ||
    divisionId === null ||
    routeId === null
  ) {
    return null;
  }

  return {
    locationId,
    departmentId,
    divisionId,
    routeId,
  };
}

function isSettingAllowed(
  setting: PatrolAreaInfoUpdateSetting | null,
  context: PatrolAreaInfoUpdateContext | null,
  today: string,
): boolean {
  if (!setting || !context) {
    return false;
  }

  if (
    setting.departmentId !== context.departmentId ||
    setting.divisionId !== context.divisionId ||
    setting.routeId !== context.routeId ||
    setting.allowLocationUpdate !== true ||
    setting.isActive !== true ||
    setting.markFlag !== false
  ) {
    return false;
  }

  const { effectiveFrom, effectiveTo } = setting;

  if (
    effectiveFrom !== null &&
    (typeof effectiveFrom !== "string" || !parseDateOnly(effectiveFrom))
  ) {
    return false;
  }

  if (
    effectiveTo !== null &&
    (typeof effectiveTo !== "string" || !parseDateOnly(effectiveTo))
  ) {
    return false;
  }

  if (
    effectiveFrom !== null &&
    effectiveTo !== null &&
    effectiveFrom > effectiveTo
  ) {
    return false;
  }

  return (
    (effectiveFrom === null || today >= effectiveFrom) &&
    (effectiveTo === null || today <= effectiveTo)
  );
}

function getPermissionPeriodText(
  setting: PatrolAreaInfoUpdateSetting | null,
): string {
  if (!setting) {
    return "";
  }

  const { effectiveFrom, effectiveTo } = setting;

  if (effectiveFrom && effectiveTo) {
    return `อนุญาตให้แก้ไขพิกัดตั้งแต่วันที่ ${formatThaiDate(
      effectiveFrom,
    )} ถึงวันที่ ${formatThaiDate(effectiveTo)}`;
  }

  if (effectiveFrom) {
    return `อนุญาตให้แก้ไขพิกัดตั้งแต่วันที่ ${formatThaiDate(
      effectiveFrom,
    )}`;
  }

  if (effectiveTo) {
    return `อนุญาตให้แก้ไขพิกัดถึงวันที่ ${formatThaiDate(effectiveTo)}`;
  }

  return "";
}

function readCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!window.isSecureContext) {
      reject(
        new Error(
          "กรุณาเปิดผ่าน HTTPS หรือ localhost เพื่ออ่านพิกัดปัจจุบัน",
        ),
      );
      return;
    }

    if (!navigator.geolocation) {
      reject(
        new Error("อุปกรณ์หรือเบราว์เซอร์นี้ไม่รองรับการอ่านพิกัด"),
      );
      return;
    }

    navigator.geolocation.getCurrentPosition(
      resolve,
      (error) => {
        const message =
          error.code === 1
            ? "กรุณาอนุญาตให้เข้าถึงตำแหน่ง แล้วลองใหม่อีกครั้ง"
            : error.code === 2
              ? "ไม่สามารถอ่านพิกัดได้ กรุณาเปิดบริการตำแหน่งแล้วลองใหม่"
              : error.code === 3
                ? "อ่านพิกัดนานเกินกำหนด กรุณาลองใหม่อีกครั้ง"
                : "ไม่สามารถอ่านพิกัดปัจจุบันได้";

        reject(new Error(message));
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 15000,
      },
    );
  });
}

export default function PatrolAreaInfoModal({
  open,
  location,
  loading = false,
  errorMessage = null,
  updateSetting = null,
  permissionLoading = false,
  onUpdate,
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

  const context = useMemo(
    () => getUpdateContext(location),
    [location],
  );

  const contextKey = JSON.stringify([
    context?.locationId,
    context?.departmentId,
    context?.divisionId,
    context?.routeId,
    location?.contractCode,
    location?.locationName,
  ]);

  const [today, setToday] = useState(getBangkokDate);
  const [selectedRadius, setSelectedRadius] =
    useState<PatrolAreaInfoRadiusMeter>(50);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] =
    useState<string | null>(null);

  const operationRef = useRef(0);
  const busyRef = useRef(false);

  const showEditMode =
    !loading &&
    !errorMessage &&
    !permissionLoading &&
    isSettingAllowed(updateSetting, context, today);

  const permissionPeriodText = showEditMode
    ? getPermissionPeriodText(updateSetting)
    : "";

  const mapEmbedUrl = hasValidCoordinate
    ? `https://maps.google.com/maps?q=${latitude},${longitude}&z=18&output=embed`
    : "";

  const googleMapsUrl = hasValidCoordinate
    ? `https://www.google.com/maps?q=${latitude},${longitude}`
    : "#";

  useEffect(() => {
    if (!open) {
      return;
    }

    setToday(getBangkokDate());

    const timer = window.setInterval(() => {
      setToday(getBangkokDate());
    }, 30_000);

    return () => {
      window.clearInterval(timer);
    };
  }, [open]);

  useEffect(() => {
    setSelectedRadius(
      isRadiusOption(radiusMeter) ? radiusMeter : 50,
    );
  }, [open, contextKey, radiusMeter]);

  useEffect(() => {
    operationRef.current += 1;
    busyRef.current = false;
    setIsUpdating(false);
    setUpdateError(null);

    return () => {
      operationRef.current += 1;
    };
  }, [
    open,
    contextKey,
    showEditMode,
    updateSetting?.effectiveFrom,
    updateSetting?.effectiveTo,
  ]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busyRef.current) {
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

  async function handleUpdate() {
    if (
      !open ||
      busyRef.current ||
      !onUpdate ||
      !context ||
      !showEditMode
    ) {
      return;
    }

    setUpdateError(null);

    const currentDate = getBangkokDate();
    setToday(currentDate);

    if (!isSettingAllowed(updateSetting, context, currentDate)) {
      setUpdateError("อยู่นอกช่วงวันที่อนุญาตให้แก้ไขข้อมูล");
      return;
    }

    const operation = ++operationRef.current;
    const isCurrentOperation = () =>
      operationRef.current === operation;

    busyRef.current = true;
    setIsUpdating(true);

    try {
      const targetContext = { ...context };
      const radiusToSave = selectedRadius;

      const position = await readCurrentPosition();

      if (!isCurrentOperation()) {
        return;
      }

      const {
        latitude: currentLatitude,
        longitude: currentLongitude,
        accuracy,
      } = position.coords;

      if (
        !Number.isFinite(currentLatitude) ||
        Math.abs(currentLatitude) > 90 ||
        !Number.isFinite(currentLongitude) ||
        Math.abs(currentLongitude) > 180 ||
        !Number.isFinite(accuracy) ||
        accuracy < 0
      ) {
        throw new Error(
          "พิกัดที่อ่านได้ไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง",
        );
      }

      const payload: PatrolAreaInfoUpdatePayload = {
        ...targetContext,
        latitude: currentLatitude,
        longitude: currentLongitude,
        accuracyMeter: accuracy,
        radiusMeter: radiusToSave,
      };

      if (
        !isSettingAllowed(
          updateSetting,
          context,
          getBangkokDate(),
        )
      ) {
        setToday(getBangkokDate());
        throw new Error(
          "สิ้นสุดช่วงวันที่อนุญาตให้แก้ไขข้อมูลแล้ว",
        );
      }

      /**
       * Parent เป็นผู้ตรวจ context ซ้ำและเรียก Backend API
       * Backend ต้องตรวจ Setting ซ้ำก่อน UPDATE site_location
       */
      await onUpdate(payload);
    } catch (error) {
      if (isCurrentOperation()) {
        setUpdateError(
          error instanceof Error
            ? error.message
            : "ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่",
        );
      }
    } finally {
      if (isCurrentOperation()) {
        busyRef.current = false;
        setIsUpdating(false);
      }
    }
  }

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
        if (
          event.target === event.currentTarget &&
          !busyRef.current
        ) {
          onClose();
        }
      }}
    >
      <div className={styles.modal}>
        <button
          type="button"
          className={styles.closeIconButton}
          aria-label="ปิด"
          disabled={isUpdating}
          onClick={() => {
            if (!busyRef.current) {
              onClose();
            }
          }}
        >
          <X size={22} strokeWidth={3} />
        </button>

        <h2 className={styles.title}>ข้อมูลหน่วยงาน</h2>

        <p className={styles.unitName}>{unitName}</p>

        {showEditMode ? (
          <>
            <p className={styles.updateDescription}>
              กรุณาเลือกข้อมูลเพื่อแก้ไขพิกัด
              <br />
              เฉพาะเส้นทางใหม่ ที่อนุญาตเท่านั้น
            </p>

            {permissionPeriodText && (
              <p className={styles.updatePeriod} tabIndex={0}>
                {permissionPeriodText}
              </p>
            )}
          </>
        ) : (
          <p className={styles.description}>
            แสดงพิกัด รัศมีที่กำหนด และรายละเอียดสถานที่ของหน่วยงาน
          </p>
        )}

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
                  หมายเหตุ:
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

        {showEditMode && (
          <div
            className={styles.updateControls}
            aria-busy={isUpdating}
          >
            <label className={styles.radiusRow}>
              <span className={styles.radiusLabel}>
                แก้ไขระยะรัศมี :
              </span>

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
                  <option key={value} value={value}>
                    {value} เมตร
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              className={styles.updateButton}
              disabled={isUpdating || !onUpdate}
              onClick={handleUpdate}
            >
              <MapPin
                className={styles.updateButtonIcon}
                aria-hidden="true"
              />

              <span className={styles.updateButtonText}>
                <span>
                  {isUpdating
                    ? "กำลังอ่านพิกัดและบันทึก..."
                    : "กดแก้ไขพิกัด"}
                </span>
                <span className={styles.updateButtonHint}>
                  (ท่านต้องอยู่พิกัดจริงเท่านั้น)
                </span>
              </span>
            </button>
          </div>
        )}

        {updateError && (
          <p
            className={styles.updateError}
            role="alert"
          >
            {updateError}
          </p>
        )}

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
          disabled={isUpdating}
          onClick={() => {
            if (!busyRef.current) {
              onClose();
            }
          }}
        >
          ปิด
        </button>
      </div>
    </div>
  );
}