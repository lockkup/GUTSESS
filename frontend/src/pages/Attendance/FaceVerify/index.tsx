// src/pages/Attendance/FaceVerify/index.tsx

import { useEffect, useRef, useState } from "react";

import Header from "@/layout/Header";
import BackButton from "@/components/BackButton";
import CameraModal from "@/components/CameraModal";
import SuccessModal from "@/components/SuccessModal";
import CheckInOutModal from "@/components/CheckInOutModal";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCamera,
  faImage,
  faRotateLeft,
} from "@fortawesome/free-solid-svg-icons";

import styles from "./FaceVerify.module.css";

type PunchType = "in" | "out";
type Step = "capture" | "confirm";
type ProcessStatus = "idle" | "allowed" | "error";

export type LocationCoords = {
  latitude: number;
  longitude: number;
  accuracy: number;

  assignmentId?: number | null;
  unitName?: string | null;
};

type Props = {
  empCode: string;
  displayName?: string;

  assignmentId?: number | null;
  unitName?: string | null;
  passedLocation?: LocationCoords | null;

  punchType: PunchType;
  onBack: () => void;

  /**
   * เก็บ prop นี้ไว้ก่อน เผื่ออนาคตต้องเปิดใช้การตรวจใบหน้า
   * ตอนนี้ไฟล์นี้ยังไม่เรียกใช้งาน
   */
  onVerifyFace: (embedding: number[]) => Promise<void>;

  onConfirm: (
    photoDataUrl: string,
    punchType: PunchType,
    embedding: number[],
    location: LocationCoords,
  ) => Promise<void>;

  onGoCheckInOut: () => void;
  onGoCheckpoint?: () => void;
};

function isPendingCheckinMessage(message: string) {
  return (
    message.includes("มีการลงเวลาเข้างานค้างไว้แล้วในระบบ") ||
    message.includes("ลงเวลาเข้างานค้างไว้แล้วในระบบ")
  );
}

function isValidLocation(location?: LocationCoords | null) {
  return (
    Boolean(location) &&
    Number.isFinite(location?.latitude) &&
    Number.isFinite(location?.longitude)
  );
}

export default function FaceVerify({
  empCode,
  displayName,
  assignmentId = null,
  unitName = null,
  passedLocation = null,
  punchType,
  onBack,
  onConfirm,
  onGoCheckInOut,
  onGoCheckpoint,
}: Props) {
  const [step, setStep] = useState<Step>("capture");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [photo, setPhoto] = useState("");

  const [camOpen, setCamOpen] = useState(false);

  const [processStatus, setProcessStatus] =
    useState<ProcessStatus>("idle");
  const [processHint, setProcessHint] = useState("");

  const [successOpen, setSuccessOpen] = useState(false);
  const [checkInOutModalOpen, setCheckInOutModalOpen] = useState(false);

  const saveReqRef = useRef(0);

  const hasSelectedAssignment = Boolean(assignmentId);
  const hasPassedLocation = isValidLocation(passedLocation);
  const isCheckpointMode = Boolean(assignmentId);

  useEffect(() => {
    saveReqRef.current++;

    setPhoto("");
    setErr("");
    setStep("capture");

    setProcessStatus("idle");
    setProcessHint("");

    setCamOpen(false);
    setSuccessOpen(false);
    setBusy(false);

    setCheckInOutModalOpen(false);
  }, [punchType, assignmentId]);

  function getConfirmedLocation(): LocationCoords | null {
    if (!assignmentId || !hasPassedLocation || !passedLocation) {
      return null;
    }

    return {
      latitude: passedLocation.latitude,
      longitude: passedLocation.longitude,
      accuracy: Math.round(passedLocation.accuracy ?? 0),
      assignmentId,
      unitName,
    };
  }

  async function saveAndShowSuccess(
    photoDataUrl: string,
    location: LocationCoords,
  ) {
    const saveId = ++saveReqRef.current;

    setErr("");

    try {
      /**
       * ตอนนี้ไม่ตรวจใบหน้า
       * จึงส่ง embedding เป็น [] ไปก่อน
       * App.tsx ใช้ _embedding อยู่แล้ว จึงไม่กระทบ flow บันทึกเวลา
       */
      await onConfirm(photoDataUrl, punchType, [], location);

      if (saveId !== saveReqRef.current) return;

      setSuccessOpen(true);
    } catch (error) {
      console.error("saveAndShowSuccess error:", error);

      if (saveId !== saveReqRef.current) return;

      const message =
        error instanceof Error
          ? error.message
          : "บันทึกเวลาไม่สำเร็จ กรุณาลองใหม่";

      if (isPendingCheckinMessage(message)) {
        setProcessStatus("idle");
        setProcessHint("");
        setErr("");
        setCheckInOutModalOpen(true);

        return;
      }

      setProcessStatus("error");
      setProcessHint("");
      setErr(message);
    }
  }

  async function processCapturedImage(dataUrl: string) {
    setCheckInOutModalOpen(false);

    setPhoto(dataUrl);
    setStep("confirm");

    setErr("");
    setProcessStatus("allowed");
    setProcessHint("กำลังบันทึกข้อมูล...");

    const confirmedLocation = getConfirmedLocation();

    if (!confirmedLocation) {
      setProcessStatus("error");
      setProcessHint("");
      setErr(
        "ไม่พบข้อมูลพิกัดที่ผ่านการตรวจสอบ กรุณากลับไปเลือกจุดจากตารางงานสายตรวจก่อน",
      );
      return;
    }

    await saveAndShowSuccess(dataUrl, confirmedLocation);
  }

  async function onPickFile(file?: File | null) {
    if (!file) return;

    if (!assignmentId) {
      setErr(
        "ไม่พบ assignment_id ของจุดรักษาการณ์ กรุณาเลือกจุดจากตารางงานสายตรวจก่อน",
      );
      return;
    }

    if (!hasPassedLocation) {
      setErr(
        "ไม่พบข้อมูลพิกัดที่ผ่านการตรวจสอบ กรุณากลับไปเลือกจุดจากตารางงานสายตรวจก่อน",
      );
      return;
    }

    setErr("");
    setBusy(true);

    try {
      const reader = new FileReader();

      const dataUrl: string = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("อ่านไฟล์ไม่สำเร็จ"));
        reader.readAsDataURL(file);
      });

      await processCapturedImage(dataUrl);
    } catch {
      setErr("อัปโหลดรูปไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setBusy(false);
    }
  }

  async function retrySaveWithPassedLocation() {
    if (!photo) {
      setErr("กรุณาถ่ายรูปใหม่เพื่อบันทึกเวลา");
      return;
    }

    const confirmedLocation = getConfirmedLocation();

    if (!confirmedLocation) {
      setErr(
        "ไม่พบข้อมูลพิกัดที่ผ่านการตรวจสอบ กรุณากลับไปเลือกจุดจากตารางงานสายตรวจก่อน",
      );
      return;
    }

    setBusy(true);
    setErr("");
    setProcessStatus("allowed");
    setProcessHint("กำลังบันทึกข้อมูล...");

    try {
      await saveAndShowSuccess(photo, confirmedLocation);
    } finally {
      setBusy(false);
    }
  }

  function retake() {
    saveReqRef.current++;

    setSuccessOpen(false);
    setCheckInOutModalOpen(false);

    setPhoto("");
    setErr("");
    setStep("capture");

    setProcessStatus("idle");
    setProcessHint("");

    setCamOpen(false);
  }

  function handleSuccessOk() {
    setSuccessOpen(false);

    if (isCheckpointMode && onGoCheckpoint) {
      onGoCheckpoint();
      return;
    }

    onGoCheckInOut();
  }

  const title = "กรุณาถ่ายภาพเพื่อบันทึกเวลางานสายตรวจ";

  const canOpenCamera =
    !busy &&
    step === "capture" &&
    hasSelectedAssignment &&
    hasPassedLocation;

  const shouldShowRetrySaveButton =
    processStatus === "error" && Boolean(err) && Boolean(photo);

  const shouldShowSavingButton =
    processStatus === "allowed" && busy && !err;

  const shouldShowRetakeButton =
    step === "confirm" && !busy && !successOpen;

  return (
    <main className="guts-bg">
      <div className="guts-home">
        <section className="guts-home-card" aria-label="Checkpoint Photo">
          <Header empCode={empCode} displayName={displayName} />

          <h2 className={styles.attTitle}>หน้าจอ - ลงเวลางานสายตรวจ</h2>

          {unitName ? (
            <div className={styles.unitNameText}>หน่วยงาน: {unitName}</div>
          ) : null}

          <div className={`guts-fv-card ${styles.fvCard}`}>
            <div className={styles.fvTitle}>{title}</div>

            {!assignmentId ? (
              <div className={styles.fvError}>
                ไม่พบจุดรักษาการณ์ที่เลือก
                กรุณากลับไปเลือกจากตารางงานสายตรวจก่อน
              </div>
            ) : null}

            {assignmentId && !hasPassedLocation ? (
              <div className={styles.fvError}>
                ไม่พบข้อมูลพิกัดที่ผ่านการตรวจสอบ
                กรุณากลับไปเลือกจุดจากตารางงานสายตรวจก่อน
              </div>
            ) : null}

            <div
              className={`guts-fv-frame ${styles.fvFrame}`}
              aria-label="กรอบแสดงรูปบันทึกเวลา"
            >
              {photo ? (
                <img
                  className={`guts-fv-img ${styles.fvImg}`}
                  src={photo}
                  alt="รูปบันทึกเวลา"
                />
              ) : (
                <div className={styles.fvEmpty}>
                  <div className={styles.fvEmptyIcon} aria-hidden="true">
                    <FontAwesomeIcon icon={faImage} />
                  </div>
                  <div className={styles.fvEmptyText}>ยังไม่มีภาพถ่าย</div>
                </div>
              )}

              <input
                className={`guts-fv-file ${styles.fvFile}`}
                type="file"
                accept="image/*"
                capture="user"
                disabled={!canOpenCamera}
                onChange={(e) => void onPickFile(e.target.files?.[0])}
              />
            </div>

            {err ? (
              <div className={`guts-fv-error ${styles.fvError}`}>{err}</div>
            ) : null}

            {step === "confirm" && processStatus === "allowed" && busy ? (
              <div className={styles.fvLocHint}>
                {processHint || "กำลังบันทึก..."}
              </div>
            ) : null}

            {step === "capture" ? (
              <button
                type="button"
                className={`guts-fv-primary ${styles.fvPrimary}`}
                onClick={() => setCamOpen(true)}
                disabled={!canOpenCamera}
                style={{
                  background: !canOpenCamera
                    ? "linear-gradient(90deg, #6c757d, #5a6268)"
                    : "linear-gradient(90deg, #024B76, #013a5a)",
                  opacity: !canOpenCamera ? 0.65 : 1,
                  cursor: !canOpenCamera ? "not-allowed" : "pointer",
                  transition: "all 0.25s ease",
                }}
              >
                <FontAwesomeIcon
                  icon={faCamera}
                  className={styles.fvPrimaryIcon}
                />
                {!assignmentId
                  ? "กรุณาเลือกจุดจากตาราง"
                  : !hasPassedLocation
                    ? "กรุณาตรวจพิกัดจากตารางก่อน"
                    : "ถ่ายภาพและบันทึก"}
              </button>
            ) : (
              <>
                {shouldShowRetrySaveButton ? (
                  <button
                    type="button"
                    className={`guts-fv-primary ${styles.fvPrimary}`}
                    onClick={() => void retrySaveWithPassedLocation()}
                    disabled={busy}
                  >
                    ลองบันทึกอีกครั้ง
                  </button>
                ) : shouldShowSavingButton ? (
                  <button
                    type="button"
                    className={`guts-fv-primary ${styles.fvPrimary}`}
                    disabled
                    style={{ opacity: 0.7, cursor: "not-allowed" }}
                  >
                    รอระบบบันทึก...
                  </button>
                ) : null}

                {shouldShowRetakeButton ? (
                  <button
                    type="button"
                    className={`guts-fv-secondary ${styles.fvSecondary}`}
                    onClick={retake}
                    disabled={busy}
                  >
                    <FontAwesomeIcon icon={faRotateLeft} />
                    ถ่ายใหม่
                  </button>
                ) : null}
              </>
            )}

            <div className={`guts-fv-bottom ${styles.fvBottom}`}>
              <BackButton
                onClick={onBack}
                disabled={busy}
                className={`guts-fv-backBtn ${styles.fvBackBtn}`}
              />
            </div>
          </div>
        </section>
      </div>

      <CameraModal
        open={camOpen}
        onClose={() => setCamOpen(false)}
        onCaptured={async (dataUrl) => {
          if (!assignmentId) {
            setErr(
              "ไม่พบ assignment_id ของจุดรักษาการณ์ กรุณาเลือกจุดจากตารางงานสายตรวจก่อน",
            );
            return;
          }

          if (!hasPassedLocation) {
            setErr(
              "ไม่พบข้อมูลพิกัดที่ผ่านการตรวจสอบ กรุณากลับไปเลือกจุดจากตารางงานสายตรวจก่อน",
            );
            return;
          }

          setCamOpen(false);
          setBusy(true);
          setErr("");

          try {
            await processCapturedImage(dataUrl);
          } finally {
            setBusy(false);
          }
        }}
      />

      <CheckInOutModal
        open={checkInOutModalOpen}
        onClose={() => setCheckInOutModalOpen(false)}
      />

      <SuccessModal
        open={successOpen}
        title="สำเร็จ"
        message={
          punchType === "in"
            ? "บันทึกเวลาเข้างานเรียบร้อย"
            : "บันทึกเวลาออกงานเรียบร้อย"
        }
        okText="ตกลง"
        onOk={handleSuccessOk}
      />
    </main>
  );
}