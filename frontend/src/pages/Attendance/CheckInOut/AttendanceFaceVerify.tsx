// src/pages/Attendance/CheckInOut/AttendanceFaceVerify.tsx

import { useEffect, useRef, useState } from "react";
import * as faceapi from "face-api.js";

import Header from "@/layout/Header";
import BackButton from "@/components/BackButton";
import OutOfAreaModal from "@/components/OutOfAreaModal";
import CameraModal from "@/components/CameraModal";
import SuccessModal from "@/components/SuccessModal";
import FaceNotFoundModal from "@/components/FaceNotFoundModal";
import CheckInOutModal from "@/components/CheckInOutModal";

import {
  getAttendanceLocationSetting,
  type AttendanceLocationSetting,
} from "@/services/appSetting.service";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCamera,
  faImage,
  faRotateLeft,
} from "@fortawesome/free-solid-svg-icons";

import styles from "./AttendanceFaceVerify.module.css";

type PunchType = "in" | "out";
type Step = "capture" | "confirm";

export type AttendanceLocationCoords = {
  latitude: number;
  longitude: number;
  accuracy: number;
};

type Props = {
  empCode: string;
  displayName?: string;

  /**
   * ข้อมูลแนวสายตรวจที่ส่งมาจาก Home ผ่าน App.tsx
   * หากไม่มีข้อมูล จะแสดงเป็น "-"
   */
  fieldName?: string | null;
  divisionName?: string | null;
  routeName?: string | null;

  punchType: PunchType;
  onBack: () => void;

  /**
   * เก็บไว้ก่อน เผื่ออนาคตเปิดใช้ตรวจใบหน้า
   * ตอนนี้จะไม่ถูกเรียก ถ้า setting.enable_face_verify = false
   */
  onVerifyFace: (embedding: number[]) => Promise<void>;

  onConfirm: (
    photoDataUrl: string,
    punchType: PunchType,
    embedding: number[],
    location: AttendanceLocationCoords,
  ) => Promise<void>;

  onGoCheckInOut: () => void;
};

type LocStatus =
  | "idle"
  | "checking"
  | "allowed"
  | "outside"
  | "blocked"
  | "unavailable"
  | "error";

/**
 * เปิด log ตลอด เพื่อให้เห็นใน Production Build / Caddy / Cloudflare Tunnel
 * ถ้าไม่ต้องการ log ตอนใช้งานจริง ค่อยเปลี่ยนกลับไปครอบ import.meta.env.DEV ได้
 *
 * หมายเหตุ:
 * - ห้าม log photoDataUrl/base64 เต็ม ๆ เพราะข้อมูลยาวมากและเป็นข้อมูลภาพพนักงาน
 * - ให้ log แค่ hasPhoto / photoLength แทน
 */
function logDev(message: string, payload?: unknown) {
  console.log(message, payload);
}

function logDevError(message: string, error: unknown) {
  console.error(message, error);
}

function getBestPositionAsync(opts: {
  desiredAccuracyM: number;
  watchWindowMs: number;
  hardTimeoutMs: number;
}) {
  const { desiredAccuracyM, watchWindowMs, hardTimeoutMs } = opts;

  return new Promise<GeolocationPosition>(async (resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("unavailable"));
      return;
    }

    try {
      const perm = await (navigator as any).permissions?.query?.({
        name: "geolocation",
      });

      if (perm?.state === "denied") {
        reject({ code: 1 });
        return;
      }
    } catch {
      // ignore
    }

    let best: GeolocationPosition | null = null;
    let done = false;

    let watchId: number | null = null;
    let tWindow: ReturnType<typeof setTimeout> | null = null;
    let tHard: ReturnType<typeof setTimeout> | null = null;

    const finish = (ok: boolean, payload?: unknown) => {
      if (done) return;

      done = true;

      if (watchId != null) navigator.geolocation.clearWatch(watchId);
      if (tWindow) clearTimeout(tWindow);
      if (tHard) clearTimeout(tHard);

      if (ok) {
        resolve(payload as GeolocationPosition);
      } else {
        reject(payload);
      }
    };

    tHard = setTimeout(() => {
      if (best) finish(true, best);
      else finish(false, new Error("timeout"));
    }, hardTimeoutMs);

    tWindow = setTimeout(() => {
      if (best) finish(true, best);
      else finish(false, new Error("timeout"));
    }, watchWindowMs);

    const onPos = (pos: GeolocationPosition) => {
      const acc = Number.isFinite(pos.coords.accuracy)
        ? pos.coords.accuracy
        : Number.POSITIVE_INFINITY;

      const bestAcc =
        best && Number.isFinite(best.coords.accuracy)
          ? best.coords.accuracy
          : Number.POSITIVE_INFINITY;

      if (!best || acc < bestAcc) {
        best = pos;
      }

      if (acc <= desiredAccuracyM) {
        finish(true, pos);
      }
    };

    const onErr = (err: GeolocationPositionError) => {
      if (best) finish(true, best);
      else finish(false, err);
    };

    watchId = navigator.geolocation.watchPosition(onPos, onErr, {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: hardTimeoutMs,
    });
  });
}

function isPendingCheckinMessage(message: string) {
  return (
    message.includes("มีการลงเวลาเข้างานค้างไว้แล้วในระบบ") ||
    message.includes("ลงเวลาเข้างานค้างไว้แล้วในระบบ")
  );
}

function isOutOfAreaMessage(message: string) {
  const text = message.toLowerCase();

  return (
    message.includes("นอกพื้นที่") ||
    message.includes("ไม่อยู่ในพื้นที่") ||
    message.includes("อยู่นอกพื้นที่") ||
    message.includes("ไม่อยู่ในรัศมี") ||
    text.includes("outside") ||
    text.includes("out of area") ||
    text.includes("not in radius")
  );
}

export default function AttendanceFaceVerify({
  empCode,
  displayName,
  fieldName,
  divisionName,
  routeName,
  punchType,
  onBack,
  onVerifyFace,
  onConfirm,
  onGoCheckInOut,
}: Props) {
  const [step, setStep] = useState<Step>("capture");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [photo, setPhoto] = useState("");

  const [camOpen, setCamOpen] = useState(false);

  const [locStatus, setLocStatus] = useState<LocStatus>("idle");
  const [locHint, setLocHint] = useState("");
  const [outModalOpen, setOutModalOpen] = useState(false);

  const [locFix, setLocFix] = useState<{
    lat: number;
    lng: number;
    accuracy: number;
    ts: number;
  } | null>(null);

  const [successOpen, setSuccessOpen] = useState(false);
  const [faceNotFoundOpen, setFaceNotFoundOpen] = useState(false);
  const [verifyErrorOpen, setVerifyErrorOpen] = useState(false);
  const [faceVerifyFailed, setFaceVerifyFailed] = useState(false);
  const [checkInOutModalOpen, setCheckInOutModalOpen] = useState(false);

  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [faceEmbedding, setFaceEmbedding] = useState<number[] | null>(null);
  const [faceVerified, setFaceVerified] = useState(false);

  const [setting, setSetting] = useState<AttendanceLocationSetting | null>(
    null,
  );
  const [settingLoading, setSettingLoading] = useState(true);

  const locReqRef = useRef(0);
  const saveReqRef = useRef(0);

  /**
   * กันยิงบันทึกซ้ำจากการกดเร็ว / retry ซ้ำ
   * ใช้ ref เพราะเปลี่ยนค่าทันที ไม่ต้องรอ React setState
   */
  const savingRef = useRef(false);

  const enableFaceVerify = setting?.enable_face_verify === true;

  useEffect(() => {
    let cancelled = false;

    async function loadSetting() {
      setSettingLoading(true);

      logDev("[AttendanceFaceVerify] LOAD LOCATION SETTING START", {
        empCode,
        punchType,
      });

      try {
        const data = await getAttendanceLocationSetting();

        logDev("[AttendanceFaceVerify] LOCATION SETTING LOADED", {
          empCode,
          punchType,
          setting: data,
        });

        if (!cancelled) {
          setSetting(data);
          setErr("");
        }
      } catch (error) {
        logDevError("[AttendanceFaceVerify] LOAD LOCATION SETTING ERROR", {
          empCode,
          punchType,
          error,
        });

        if (!cancelled) {
          setSetting(null);
          setErr("โหลดค่าตรวจสอบตำแหน่งไม่สำเร็จ");
        }
      } finally {
        if (!cancelled) {
          setSettingLoading(false);
        }
      }
    }

    void loadSetting();

    return () => {
      cancelled = true;
    };
  }, [empCode, punchType]);

  useEffect(() => {
    if (settingLoading || !setting) return;

    logDev("[AttendanceFaceVerify] FACE VERIFY CONFIG", {
      empCode,
      punchType,
      enableFaceVerify,
      setting,
    });

    if (!enableFaceVerify) {
      logDev("[AttendanceFaceVerify] FACE VERIFY DISABLED", {
        empCode,
        punchType,
      });

      setModelsLoaded(true);
      return;
    }

    let cancelled = false;

    const loadModels = async () => {
      setModelsLoaded(false);

      logDev("[AttendanceFaceVerify] LOAD FACE MODELS START", {
        empCode,
        punchType,
      });

      try {
        const MODEL_URL = "/models";

        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);

        logDev("[AttendanceFaceVerify] LOAD FACE MODELS SUCCESS", {
          empCode,
          punchType,
        });

        if (!cancelled) {
          setModelsLoaded(true);
        }
      } catch (error) {
        logDevError("[AttendanceFaceVerify] LOAD FACE MODELS ERROR", {
          empCode,
          punchType,
          error,
        });

        if (!cancelled) {
          setErr("โหลดโมเดลตรวจจับใบหน้าไม่สำเร็จ");
          setModelsLoaded(false);
        }
      }
    };

    void loadModels();

    return () => {
      cancelled = true;
    };
  }, [settingLoading, setting, enableFaceVerify, empCode, punchType]);

  useEffect(() => {
    logDev("[AttendanceFaceVerify] RESET PAGE STATE BY PUNCH TYPE", {
      empCode,
      punchType,
    });

    locReqRef.current++;
    saveReqRef.current++;
    savingRef.current = false;

    setPhoto("");
    setErr("");
    setStep("capture");

    setLocStatus("idle");
    setLocHint("");
    setOutModalOpen(false);
    setLocFix(null);

    setCamOpen(false);
    setSuccessOpen(false);
    setBusy(false);

    setFaceEmbedding(null);
    setFaceNotFoundOpen(false);
    setFaceVerified(false);
    setVerifyErrorOpen(false);
    setFaceVerifyFailed(false);
    setCheckInOutModalOpen(false);
  }, [punchType, empCode]);

  async function checkLocationGate(): Promise<{
    ok: boolean;
    status: LocStatus;
    location?: AttendanceLocationCoords;
  }> {
    if (!setting) {
      logDevError("[AttendanceFaceVerify] LOCATION SETTING NOT FOUND", {
        empCode,
        punchType,
        setting,
      });

      setLocStatus("error");
      setLocHint("ยังไม่พบค่าตั้งค่าการตรวจสอบตำแหน่ง");
      setOutModalOpen(true);

      return { ok: false, status: "error" };
    }

    const reqId = ++locReqRef.current;

    setLocStatus("checking");
    setLocHint("กำลังตรวจสอบตำแหน่ง GPS...");

    logDev("[AttendanceFaceVerify] CHECK LOCATION START", {
      empCode,
      punchType,
      reqId,
      geoSetting: setting.geo,
    });

    try {
      const pos = await getBestPositionAsync({
        desiredAccuracyM: setting.geo.desiredAccuracyM,
        watchWindowMs: setting.geo.watchWindowMs,
        hardTimeoutMs: setting.geo.hardTimeoutMs,
      });

      if (reqId !== locReqRef.current) {
        logDev("[AttendanceFaceVerify] CHECK LOCATION IGNORED OLD REQUEST", {
          empCode,
          punchType,
          reqId,
          currentReqId: locReqRef.current,
        });

        return { ok: false, status: "error" };
      }

      const { latitude, longitude, accuracy } = pos.coords;

      logDev("[AttendanceFaceVerify] GPS POSITION RESULT", {
        empCode,
        punchType,
        reqId,
        latitude,
        longitude,
        accuracy,
      });

      const currentAccuracy = Number.isFinite(accuracy)
        ? accuracy
        : Number.POSITIVE_INFINITY;

      const roundedAccuracy = Number.isFinite(currentAccuracy)
        ? Math.round(currentAccuracy)
        : 999999;

      if (currentAccuracy > setting.geo.maxAccuracyM) {
        const message = `สัญญาณ GPS ยังไม่แม่นยำ ค่าความคลาดเคลื่อนประมาณ ${roundedAccuracy} เมตร ระบบอนุญาตไม่เกิน ${setting.geo.maxAccuracyM} เมตร กรุณาไปที่โล่งหรือเปิด Wi-Fi แล้วตรวจสอบตำแหน่งอีกครั้ง`;

        logDevError("[AttendanceFaceVerify] GPS ACCURACY TOO HIGH", {
          empCode,
          punchType,
          reqId,
          message,
          currentAccuracy,
          roundedAccuracy,
          maxAccuracyM: setting.geo.maxAccuracyM,
          geoSetting: setting.geo,
          latitude,
          longitude,
        });

        setLocStatus("error");
        setLocHint(message);
        setOutModalOpen(true);

        return { ok: false, status: "error" };
      }

      const location: AttendanceLocationCoords = {
        latitude,
        longitude,
        accuracy: roundedAccuracy,
      };

      setLocFix({
        lat: latitude,
        lng: longitude,
        accuracy: roundedAccuracy,
        ts: Date.now(),
      });

      setLocStatus("allowed");
      setLocHint("");
      setOutModalOpen(false);

      logDev("[AttendanceFaceVerify] LOCATION ALLOWED", {
        empCode,
        punchType,
        reqId,
        location,
      });

      return {
        ok: true,
        status: "allowed",
        location,
      };
    } catch (e: any) {
      if (reqId !== locReqRef.current) {
        logDev(
          "[AttendanceFaceVerify] CHECK LOCATION ERROR IGNORED OLD REQUEST",
          {
            empCode,
            punchType,
            reqId,
            currentReqId: locReqRef.current,
            error: e,
          },
        );

        return { ok: false, status: "error" };
      }

      logDevError("[AttendanceFaceVerify] CHECK LOCATION ERROR", {
        empCode,
        punchType,
        reqId,
        error: e,
        code: e?.code,
        message: e?.message,
      });

      if (e?.code === 1) {
        setLocStatus("blocked");
        setLocHint(
          "ไม่อนุญาตให้เข้าถึงตำแหน่ง กรุณาเปิด Location และอนุญาตสิทธิ์ตำแหน่ง",
        );
        setOutModalOpen(true);

        return { ok: false, status: "blocked" };
      }

      if (String(e?.message).includes("unavailable")) {
        setLocStatus("unavailable");
        setLocHint("อุปกรณ์หรือเบราว์เซอร์ไม่รองรับการอ่านตำแหน่ง");
        setOutModalOpen(true);

        return { ok: false, status: "unavailable" };
      }

      setLocStatus("error");
      setLocHint("อ่านตำแหน่งไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
      setOutModalOpen(true);

      return { ok: false, status: "error" };
    }
  }

  async function extractFaceEmbedding(dataUrl: string): Promise<number[] | null> {
    if (!enableFaceVerify || !modelsLoaded) {
      logDev("[AttendanceFaceVerify] SKIP EXTRACT FACE EMBEDDING", {
        empCode,
        punchType,
        enableFaceVerify,
        modelsLoaded,
      });

      return null;
    }

    logDev("[AttendanceFaceVerify] EXTRACT FACE EMBEDDING START", {
      empCode,
      punchType,
      hasPhoto: Boolean(dataUrl),
      photoLength: dataUrl.length,
    });

    return new Promise((resolve) => {
      const img = new Image();
      img.src = dataUrl;

      img.onload = async () => {
        try {
          const result = await faceapi
            .detectSingleFace(
              img,
              new faceapi.TinyFaceDetectorOptions({
                inputSize: 320,
                scoreThreshold: 0.5,
              }),
            )
            .withFaceLandmarks()
            .withFaceDescriptor();

          if (!result) {
            logDev("[AttendanceFaceVerify] FACE NOT FOUND", {
              empCode,
              punchType,
            });

            resolve(null);
            return;
          }

          const embedding = Array.from(result.descriptor);

          logDev("[AttendanceFaceVerify] EXTRACT FACE EMBEDDING SUCCESS", {
            empCode,
            punchType,
            embeddingLength: embedding.length,
          });

          resolve(embedding);
        } catch (error) {
          logDevError("[AttendanceFaceVerify] EXTRACT FACE EMBEDDING ERROR", {
            empCode,
            punchType,
            error,
          });

          resolve(null);
        }
      };

      img.onerror = () => {
        logDevError("[AttendanceFaceVerify] IMAGE LOAD ERROR", {
          empCode,
          punchType,
        });

        resolve(null);
      };
    });
  }

  async function saveAndShowSuccess(
    photoDataUrl: string,
    embeddingToSave: number[],
    location: AttendanceLocationCoords,
  ) {
    if (savingRef.current) {
      logDev("[AttendanceFaceVerify] SAVE TIME RECORD SKIPPED DUPLICATE", {
        empCode,
        punchType,
      });

      return;
    }

    savingRef.current = true;

    const saveId = ++saveReqRef.current;

    setBusy(true);
    setErr("");
    setLocStatus("allowed");
    setLocHint("กำลังบันทึก...");

    logDev("[AttendanceFaceVerify] SAVE TIME RECORD START", {
      empCode,
      punchType,
      saveId,
      location,
      hasPhoto: Boolean(photoDataUrl),
      photoLength: photoDataUrl.length,
      embeddingLength: embeddingToSave.length,
    });

    try {
      await onConfirm(photoDataUrl, punchType, embeddingToSave, location);

      logDev("[AttendanceFaceVerify] SAVE TIME RECORD SUCCESS", {
        empCode,
        punchType,
        saveId,
      });

      if (saveId !== saveReqRef.current) {
        logDev("[AttendanceFaceVerify] SAVE SUCCESS IGNORED OLD REQUEST", {
          empCode,
          punchType,
          saveId,
          currentSaveId: saveReqRef.current,
        });

        return;
      }

      setSuccessOpen(true);
    } catch (error) {
      logDevError("[AttendanceFaceVerify] SAVE TIME RECORD ERROR", {
        empCode,
        punchType,
        saveId,
        location,
        error,
      });

      if (saveId !== saveReqRef.current) {
        logDev("[AttendanceFaceVerify] SAVE ERROR IGNORED OLD REQUEST", {
          empCode,
          punchType,
          saveId,
          currentSaveId: saveReqRef.current,
        });

        return;
      }

      const message =
        error instanceof Error
          ? error.message
          : "บันทึกเวลาไม่สำเร็จ กรุณาลองใหม่";

      if (isPendingCheckinMessage(message)) {
        logDev("[AttendanceFaceVerify] PENDING CHECKIN MESSAGE DETECTED", {
          empCode,
          punchType,
          saveId,
          message,
        });

        setLocStatus("idle");
        setLocHint("");
        setErr("");
        setCheckInOutModalOpen(true);

        return;
      }

      if (isOutOfAreaMessage(message)) {
        logDevError("[AttendanceFaceVerify] OUT OF AREA MESSAGE DETECTED", {
          empCode,
          punchType,
          saveId,
          message,
        });

        setLocStatus("outside");
        setLocHint(message);
        setOutModalOpen(true);
        setErr("");

        return;
      }

      setLocStatus("allowed");
      setLocHint("");
      setErr(message);
    } finally {
      if (saveId === saveReqRef.current) {
        savingRef.current = false;
        setBusy(false);

        logDev("[AttendanceFaceVerify] SAVE TIME RECORD FINISH", {
          empCode,
          punchType,
          saveId,
        });
      }
    }
  }

  async function verifyFaceAndContinue(dataUrl: string, embedding: number[]) {
    setLocStatus("checking");
    setLocHint("กำลังตรวจสอบใบหน้ากับข้อมูลในระบบ...");

    logDev("[AttendanceFaceVerify] VERIFY FACE START", {
      empCode,
      punchType,
      embeddingLength: embedding.length,
    });

    try {
      await onVerifyFace(embedding);

      logDev("[AttendanceFaceVerify] VERIFY FACE SUCCESS", {
        empCode,
        punchType,
      });

      setFaceVerified(true);
      setFaceVerifyFailed(false);

      setLocHint("ยืนยันใบหน้าสำเร็จ กำลังตรวจสอบตำแหน่ง...");

      const res = await checkLocationGate();

      logDev("[AttendanceFaceVerify] LOCATION RESULT AFTER FACE VERIFY", {
        empCode,
        punchType,
        result: res,
      });

      if (res.ok && res.location) {
        await saveAndShowSuccess(dataUrl, embedding, res.location);
      }
    } catch (error) {
      logDevError("[AttendanceFaceVerify] VERIFY FACE ERROR", {
        empCode,
        punchType,
        error,
      });

      setFaceVerified(false);
      setFaceVerifyFailed(true);

      setLocStatus("idle");
      setLocHint("");
      setErr("");
      setVerifyErrorOpen(true);
    }
  }

  async function processCapturedImage(dataUrl: string) {
    logDev("[AttendanceFaceVerify] PROCESS CAPTURED IMAGE START", {
      empCode,
      punchType,
      hasPhoto: Boolean(dataUrl),
      photoLength: dataUrl.length,
      enableFaceVerify,
      modelsLoaded,
    });

    if (!setting) {
      logDevError("[AttendanceFaceVerify] PROCESS IMAGE WITHOUT SETTING", {
        empCode,
        punchType,
        setting,
      });

      setErr("โหลดค่าตรวจสอบตำแหน่งไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
      return;
    }

    setFaceNotFoundOpen(false);
    setVerifyErrorOpen(false);
    setFaceVerifyFailed(false);
    setCheckInOutModalOpen(false);

    setPhoto(dataUrl);
    setStep("confirm");

    setFaceEmbedding(null);
    setFaceVerified(false);

    setErr("");
    setLocFix(null);
    setOutModalOpen(false);

    if (!enableFaceVerify) {
      const emptyEmbedding: number[] = [];

      logDev("[AttendanceFaceVerify] FACE VERIFY DISABLED - GO LOCATION CHECK", {
        empCode,
        punchType,
      });

      setFaceEmbedding(emptyEmbedding);
      setFaceVerified(true);
      setFaceVerifyFailed(false);

      setLocHint("กำลังตรวจสอบตำแหน่ง GPS...");
      setLocStatus("checking");

      const res = await checkLocationGate();

      logDev("[AttendanceFaceVerify] LOCATION RESULT WITHOUT FACE VERIFY", {
        empCode,
        punchType,
        result: res,
      });

      if (res.ok && res.location) {
        await saveAndShowSuccess(dataUrl, emptyEmbedding, res.location);
      }

      return;
    }

    setLocHint("กำลังประมวลผลใบหน้า...");
    setLocStatus("checking");

    const embedding = await extractFaceEmbedding(dataUrl);

    if (!embedding) {
      logDev("[AttendanceFaceVerify] PROCESS IMAGE FACE NOT FOUND", {
        empCode,
        punchType,
      });

      setLocStatus("idle");
      setLocHint("");
      setFaceEmbedding(null);
      setFaceNotFoundOpen(true);

      return;
    }

    setFaceEmbedding(embedding);
    await verifyFaceAndContinue(dataUrl, embedding);
  }

  async function onPickFile(file?: File | null) {
    if (!file) {
      logDev("[AttendanceFaceVerify] PICK FILE SKIPPED NO FILE", {
        empCode,
        punchType,
      });

      return;
    }

    logDev("[AttendanceFaceVerify] PICK FILE START", {
      empCode,
      punchType,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      enableFaceVerify,
      modelsLoaded,
      settingLoading,
      hasSetting: Boolean(setting),
      busy,
      saving: savingRef.current,
    });

    if (enableFaceVerify && !modelsLoaded) {
      logDev("[AttendanceFaceVerify] PICK FILE BLOCKED MODELS NOT LOADED", {
        empCode,
        punchType,
      });

      setErr("ระบบ AI ยังโหลดไม่เสร็จ กรุณารอสักครู่");
      return;
    }

    if (settingLoading || !setting) {
      logDev("[AttendanceFaceVerify] PICK FILE BLOCKED SETTING LOADING", {
        empCode,
        punchType,
        settingLoading,
        hasSetting: Boolean(setting),
      });

      setErr("ระบบกำลังโหลดค่าตรวจสอบตำแหน่ง กรุณารอสักครู่");
      return;
    }

    if (busy || savingRef.current) {
      logDev("[AttendanceFaceVerify] PICK FILE BLOCKED BUSY", {
        empCode,
        punchType,
        busy,
        saving: savingRef.current,
      });

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

      logDev("[AttendanceFaceVerify] PICK FILE READ SUCCESS", {
        empCode,
        punchType,
        photoLength: dataUrl.length,
      });

      await processCapturedImage(dataUrl);
    } catch (error) {
      logDevError("[AttendanceFaceVerify] PICK FILE ERROR", {
        empCode,
        punchType,
        error,
      });

      setErr("อัปโหลดรูปไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      if (!savingRef.current) {
        setBusy(false);
      }
    }
  }

  async function recheckAndAutoConfirm() {
    if (busy || savingRef.current) {
      logDev("[AttendanceFaceVerify] RECHECK BLOCKED BUSY", {
        empCode,
        punchType,
        busy,
        saving: savingRef.current,
      });

      return;
    }

    if (!photo) {
      logDev("[AttendanceFaceVerify] RECHECK BLOCKED NO PHOTO", {
        empCode,
        punchType,
      });

      setErr("กรุณาถ่ายรูปใหม่เพื่อบันทึกเวลา");
      return;
    }

    if (enableFaceVerify && (!faceEmbedding || !faceVerified)) {
      logDev("[AttendanceFaceVerify] RECHECK BLOCKED FACE NOT VERIFIED", {
        empCode,
        punchType,
        hasFaceEmbedding: Boolean(faceEmbedding),
        faceVerified,
      });

      setErr("กรุณาถ่ายใหม่เพื่อยืนยันตัวตน");
      return;
    }

    if (!setting) {
      logDevError("[AttendanceFaceVerify] RECHECK BLOCKED SETTING NOT FOUND", {
        empCode,
        punchType,
        setting,
      });

      setErr("โหลดค่าตรวจสอบตำแหน่งไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
      return;
    }

    logDev("[AttendanceFaceVerify] RECHECK START", {
      empCode,
      punchType,
    });

    setBusy(true);
    setErr("");

    setLocFix(null);
    setLocHint("");
    setOutModalOpen(false);
    setLocStatus("idle");

    try {
      const res = await checkLocationGate();

      logDev("[AttendanceFaceVerify] RECHECK LOCATION RESULT", {
        empCode,
        punchType,
        result: res,
      });

      if (res.ok && res.location) {
        await saveAndShowSuccess(
          photo,
          enableFaceVerify ? faceEmbedding ?? [] : [],
          res.location,
        );
      }
    } finally {
      if (!savingRef.current) {
        setBusy(false);
      }
    }
  }

  function retrySaveWithLastLocation() {
    if (busy || savingRef.current) {
      logDev("[AttendanceFaceVerify] RETRY SAVE BLOCKED BUSY", {
        empCode,
        punchType,
        busy,
        saving: savingRef.current,
      });

      return;
    }

    if (!photo || !locFix) {
      logDev("[AttendanceFaceVerify] RETRY SAVE BLOCKED NO PHOTO OR LOCATION", {
        empCode,
        punchType,
        hasPhoto: Boolean(photo),
        hasLocFix: Boolean(locFix),
      });

      return;
    }

    if (enableFaceVerify && (!faceEmbedding || !faceVerified)) {
      logDev("[AttendanceFaceVerify] RETRY SAVE BLOCKED FACE NOT VERIFIED", {
        empCode,
        punchType,
        hasFaceEmbedding: Boolean(faceEmbedding),
        faceVerified,
      });

      setErr("กรุณาถ่ายใหม่เพื่อยืนยันตัวตน");
      return;
    }

    logDev("[AttendanceFaceVerify] RETRY SAVE WITH LAST LOCATION", {
      empCode,
      punchType,
      locFix,
    });

    void saveAndShowSuccess(
      photo,
      enableFaceVerify ? faceEmbedding ?? [] : [],
      {
        latitude: locFix.lat,
        longitude: locFix.lng,
        accuracy: locFix.accuracy,
      },
    );
  }

  function retake() {
    if (busy || savingRef.current) {
      logDev("[AttendanceFaceVerify] RETAKE BLOCKED BUSY", {
        empCode,
        punchType,
        busy,
        saving: savingRef.current,
      });

      return;
    }

    logDev("[AttendanceFaceVerify] RETAKE", {
      empCode,
      punchType,
    });

    locReqRef.current++;
    saveReqRef.current++;
    savingRef.current = false;

    setSuccessOpen(false);
    setFaceNotFoundOpen(false);
    setVerifyErrorOpen(false);
    setFaceVerifyFailed(false);
    setCheckInOutModalOpen(false);

    setPhoto("");
    setErr("");
    setStep("capture");

    setLocStatus("idle");
    setLocHint("");
    setOutModalOpen(false);
    setLocFix(null);

    setCamOpen(false);

    setFaceEmbedding(null);
    setFaceVerified(false);
  }

  function handleSuccessOk() {
    logDev("[AttendanceFaceVerify] SUCCESS OK", {
      empCode,
      punchType,
    });

    setSuccessOpen(false);
    onGoCheckInOut();
  }

  const title = enableFaceVerify
    ? "กรุณาถ่ายภาพใบหน้าเพื่อยืนยันตัวตน"
    : "กรุณาถ่ายภาพเพื่อบันทึกเวลา";

  const canOpenCamera =
    !!setting &&
    !settingLoading &&
    !busy &&
    !savingRef.current &&
    step === "capture" &&
    (!enableFaceVerify || modelsLoaded);

  const shouldShowRecheckButton =
    (enableFaceVerify ? faceVerified : true) &&
    !outModalOpen &&
    ["outside", "blocked", "unavailable", "error"].includes(locStatus);

  /**
   * ซ่อนปุ่ม "ถ่ายใหม่" เมื่อปิดระบบตรวจใบหน้า
   *
   * เหตุผล:
   * - ตอนนี้ enable_face_verify = false
   * - รูปภาพใช้ประกอบการบันทึกเวลาเท่านั้น
   * - ถ้า GPS ไม่ผ่าน ให้ผู้ใช้กด "ตรวจสอบตำแหน่งอีกครั้ง" แทน
   *
   * ถ้าอนาคตเปิดตรวจใบหน้าอีกครั้ง:
   * - จะแสดงปุ่มถ่ายใหม่เฉพาะกรณียืนยันใบหน้าไม่ผ่าน
   */
  const shouldShowRetakeButton = enableFaceVerify
    ? faceVerifyFailed && !verifyErrorOpen
    : false;

  const isNavigationLocked =
    busy || savingRef.current || locStatus === "checking";

  function handleBackClick() {
    if (isNavigationLocked) {
      logDev("[AttendanceFaceVerify] BACK BLOCKED", {
        empCode,
        punchType,
        busy,
        saving: savingRef.current,
        locStatus,
      });

      return;
    }

    logDev("[AttendanceFaceVerify] BACK", {
      empCode,
      punchType,
    });

    onBack();
  }

  return (
    <main className="guts-bg">
      <div className="guts-home">
        <section className="guts-home-card" aria-label="Attendance Face Verify">
          <Header empCode={empCode} displayName={displayName} />

          <h2 className={styles.attTitle}>หน้าจอ - ลงเวลาเข้า-ออกงาน</h2>

          <div className={styles.routeInfo} aria-label="ข้อมูลแนวสายตรวจ">
            <span>{fieldName?.trim() || "-"}</span>
            <span>{divisionName?.trim() || "-"}</span>
            <span>{routeName?.trim() || "-"}</span>
          </div>

          <div className={styles.unitNameText}>
            ระบบจะตรวจสอบพื้นที่จากตำแหน่ง GPS
          </div>

          <div className={`guts-fv-card ${styles.fvCard}`}>
            <div className={styles.fvTitle}>{title}</div>

            {settingLoading ? (
              <div className={styles.fvLocHint}>
                กำลังโหลดค่าตรวจสอบตำแหน่ง...
              </div>
            ) : null}

            {enableFaceVerify && !modelsLoaded ? (
              <div className={styles.fvLocHint}>
                กำลังโหลดระบบตรวจจับใบหน้า...
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
                  alt={
                    enableFaceVerify ? "รูปยืนยันตัวตน" : "รูปบันทึกเวลา"
                  }
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

            {step === "confirm" &&
            (locStatus === "checking" || (locStatus === "allowed" && busy)) ? (
              <div className={styles.fvLocHint}>
                {locStatus === "checking"
                  ? locHint || "กำลังตรวจสอบข้อมูล..."
                  : locHint || "กำลังบันทึก..."}
              </div>
            ) : null}

            {step === "capture" ? (
              <button
                type="button"
                className={`guts-fv-primary ${styles.fvPrimary}`}
                onClick={() => {
                  logDev("[AttendanceFaceVerify] OPEN CAMERA", {
                    empCode,
                    punchType,
                  });

                  setCamOpen(true);
                }}
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
                {settingLoading
                  ? "กำลังโหลดค่าระบบ..."
                  : !modelsLoaded
                    ? "กำลังโหลด AI..."
                    : enableFaceVerify
                      ? "ถ่ายภาพและยืนยัน"
                      : "ถ่ายภาพและบันทึก"}
              </button>
            ) : (
              <>
                {shouldShowRecheckButton ? (
                  <button
                    type="button"
                    className={`guts-fv-primary ${styles.fvPrimary}`}
                    onClick={() => void recheckAndAutoConfirm()}
                    disabled={busy || savingRef.current}
                  >
                    ตรวจสอบตำแหน่งอีกครั้ง
                  </button>
                ) : locStatus === "allowed" && err ? (
                  <button
                    type="button"
                    className={`guts-fv-primary ${styles.fvPrimary}`}
                    onClick={retrySaveWithLastLocation}
                    disabled={busy || savingRef.current || !locFix}
                  >
                    ลองบันทึกอีกครั้ง
                  </button>
                ) : locStatus === "allowed" && busy ? (
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
                    disabled={busy || savingRef.current}
                  >
                    <FontAwesomeIcon icon={faRotateLeft} />
                    ถ่ายใหม่
                  </button>
                ) : null}
              </>
            )}

            <div className={`guts-fv-bottom ${styles.fvBottom}`}>
              <BackButton
                onClick={handleBackClick}
                disabled={isNavigationLocked}
                className={`guts-fv-backBtn ${styles.fvBackBtn}`}
              />
            </div>
          </div>
        </section>
      </div>

      <CameraModal
        open={camOpen}
        onClose={() => {
          if (busy || savingRef.current) {
            logDev("[AttendanceFaceVerify] CLOSE CAMERA BLOCKED BUSY", {
              empCode,
              punchType,
              busy,
              saving: savingRef.current,
            });

            return;
          }

          logDev("[AttendanceFaceVerify] CLOSE CAMERA", {
            empCode,
            punchType,
          });

          setCamOpen(false);
        }}
        onCaptured={async (dataUrl) => {
          logDev("[AttendanceFaceVerify] CAMERA CAPTURED", {
            empCode,
            punchType,
            hasPhoto: Boolean(dataUrl),
            photoLength: dataUrl.length,
            enableFaceVerify,
            modelsLoaded,
            settingLoading,
            hasSetting: Boolean(setting),
            busy,
            saving: savingRef.current,
          });

          if (enableFaceVerify && !modelsLoaded) {
            logDev(
              "[AttendanceFaceVerify] CAMERA CAPTURE BLOCKED MODELS NOT LOADED",
              {
                empCode,
                punchType,
              },
            );

            setErr("ระบบ AI ยังโหลดไม่เสร็จ กรุณารอสักครู่");
            return;
          }

          if (settingLoading || !setting) {
            logDev(
              "[AttendanceFaceVerify] CAMERA CAPTURE BLOCKED SETTING LOADING",
              {
                empCode,
                punchType,
                settingLoading,
                hasSetting: Boolean(setting),
              },
            );

            setErr("ระบบกำลังโหลดค่าตรวจสอบตำแหน่ง กรุณารอสักครู่");
            return;
          }

          if (busy || savingRef.current) {
            logDev("[AttendanceFaceVerify] CAMERA CAPTURE BLOCKED BUSY", {
              empCode,
              punchType,
              busy,
              saving: savingRef.current,
            });

            return;
          }

          setCamOpen(false);
          setBusy(true);
          setErr("");

          try {
            await processCapturedImage(dataUrl);
          } finally {
            if (!savingRef.current) {
              setBusy(false);
            }
          }
        }}
      />

      <OutOfAreaModal
        open={outModalOpen}
        locHint={locHint}
        onClose={() => {
          logDev("[AttendanceFaceVerify] OUT OF AREA MODAL CLOSE", {
            empCode,
            punchType,
            locStatus,
            locHint,
          });

          setOutModalOpen(false);
        }}
      />

      <FaceNotFoundModal
        open={faceNotFoundOpen}
        title="ไม่พบใบหน้าในรูปภาพ"
        message="กรุณาถ่ายใหม่ให้เห็นใบหน้าชัดเจน"
        onClose={() => {
          logDev("[AttendanceFaceVerify] FACE NOT FOUND MODAL CLOSE", {
            empCode,
            punchType,
          });

          setFaceNotFoundOpen(false);
        }}
      />

      <FaceNotFoundModal
        open={verifyErrorOpen}
        title="ใบหน้าไม่ตรงกับข้อมูลพนักงาน"
        message="กรุณาถ่ายใหม่ หรือตรวจสอบข้อมูลพนักงานในระบบ"
        onClose={() => {
          logDev("[AttendanceFaceVerify] VERIFY ERROR MODAL CLOSE", {
            empCode,
            punchType,
          });

          setVerifyErrorOpen(false);
        }}
      />

      <CheckInOutModal
        open={checkInOutModalOpen}
        onClose={() => {
          logDev("[AttendanceFaceVerify] CHECK IN OUT MODAL CLOSE", {
            empCode,
            punchType,
          });

          setCheckInOutModalOpen(false);
        }}
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