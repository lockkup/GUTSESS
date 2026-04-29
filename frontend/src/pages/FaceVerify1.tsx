import { useEffect, useRef, useState } from "react";
import Header from "../layout/Header";
import BackButton from "../components/BackButton";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCamera,
  faCircleCheck,
  faRotateLeft,
} from "@fortawesome/free-solid-svg-icons";
import * as tf from "@tensorflow/tfjs";
import * as cocoSsd from "@tensorflow-models/coco-ssd";

type PunchType = "in" | "out";
type Step = "capture" | "confirm";

interface Props {
  empCode: string;
  displayName?: string;
  punchType: PunchType;
  onBack: () => void;
  onConfirm: (photoDataUrl: string, punchType: PunchType) => void;
  onViewHistory?: () => void;
}

export default function FaceVerify({
  empCode,
  displayName,
  punchType,
  onBack,
  onConfirm,
}: Props) {
  const [step, setStep] = useState<Step>("capture");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [photo, setPhoto] = useState("");
  const [isReady, setIsReady] = useState(false);
  const [isPhotoTaken, setIsPhotoTaken] = useState(false);
  const [faceInCircle, setFaceInCircle] = useState(false);
  const [faceMessage, setFaceMessage] = useState("Loading face detection...");

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const detectFrameRef = useRef<number | null>(null);
  const modelRef = useRef<any>(null);

  // Load TensorFlow COCO-SSD model
  useEffect(() => {
    const loadModel = async () => {
      try {
        await tf.ready();
        const model = await cocoSsd.load();
        modelRef.current = model;
        console.log("✅ TensorFlow COCO-SSD model loaded");
      } catch (e) {
        console.error("❌ Failed to load model:", e);
        setFaceMessage("Face detection unavailable");
      }
    };
    loadModel();
  }, []);

  // Reset on punchType change
  useEffect(() => {
    setPhoto("");
    setErr("");
    setStep("capture");
    setIsReady(false);
    setIsPhotoTaken(false);
    setFaceInCircle(false);
  }, [punchType]);

  // Open Camera
  useEffect(() => {
    if (step !== "capture") return;

    let canceled = false;
    setErr("");

    const startCamera = async () => {
      try {
        setBusy(true);

        if (!navigator.mediaDevices?.getUserMedia) {
          setErr("Device does not support camera. Please upload a photo instead.");
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: false,
        });

        if (canceled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play();
            setIsReady(true);
            startFaceDetection();
          };
        }
      } catch {
        setErr(
          "Unable to open camera. Please allow camera permission or upload a photo instead."
        );
      } finally {
        setBusy(false);
      }
    };

    startCamera();

    return () => {
      canceled = true;
      if (detectFrameRef.current) {
        cancelAnimationFrame(detectFrameRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [step]);

  // Face Detection with TensorFlow
  const startFaceDetection = () => {
    if (!modelRef.current) {
      setFaceMessage("Face detection unavailable");
      setFaceInCircle(true);
      return;
    }

    let lastDetectionTime = 0;
    const DETECTION_INTERVAL = 300;

    const detectFrame = async () => {
      const video = videoRef.current;
      const now = performance.now();

      if (!video || video.readyState !== 4) {
        detectFrameRef.current = requestAnimationFrame(detectFrame);
        return;
      }

      if (now - lastDetectionTime < DETECTION_INTERVAL) {
        detectFrameRef.current = requestAnimationFrame(detectFrame);
        return;
      }

      lastDetectionTime = now;

      try {
        // Detect objects in video
        const predictions = await modelRef.current.detect(video);

        // Filter for person class
        const personDetections = predictions.filter(
          (pred: any) => pred.class === "person"
        );

        if (personDetections.length > 0) {
          const person = personDetections[0];
          const [x, y, width, height] = person.bbox;

          // Check if person/body is in circle
          const frameWidth = video.videoWidth;
          const frameHeight = video.videoHeight;
          const circleCenterX = frameWidth / 2;
          const circleCenterY = frameHeight / 2;
          const circleRadius = Math.min(frameWidth, frameHeight) * 0.1; // Changed from 0.2 to 0.10 (smaller)

          // Person center
          const personCenterX = x + width / 2;
          const personCenterY = y + height / 2;

          // Distance from person center to circle center
          const distance = Math.sqrt(
            Math.pow(personCenterX - circleCenterX, 2) +
              Math.pow(personCenterY - circleCenterY, 2)
          );

          // Check if person is inside circle
          const isInside = distance < circleRadius && person.score > 0.5;

          setFaceInCircle(isInside);

          if (isInside) {
            setFaceMessage(`✅ Face in circle - Ready to capture`);
          } else if (distance > circleRadius) {
            setFaceMessage("⬅️ ➡️ Move closer to center");
          } else {
            setFaceMessage("⬆️ ⬇️ Adjust position");
          }
        } else {
          setFaceInCircle(false);
          setFaceMessage("🔍 No face detected");
        }
      } catch (e) {
        console.warn("Detection error:", e);
      }

      detectFrameRef.current = requestAnimationFrame(detectFrame);
    };

    detectFrame();
  };

  const captureFromVideo = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;

    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, w, h);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);

    setPhoto(dataUrl);
    setIsPhotoTaken(true);
    setStep("confirm");
  };

  const onPickFile = async (file?: File | null) => {
    if (!file) return;

    setErr("");
    setBusy(true);

    try {
      const reader = new FileReader();
      const dataUrl: string = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(file);
      });

      setPhoto(dataUrl);
      setIsPhotoTaken(true);
      setStep("confirm");
    } catch {
      setErr("Upload failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleConfirm = () => {
    if (!photo) return;
    onConfirm(photo, punchType);
  };

  const handleRetake = () => {
    setPhoto("");
    setStep("capture");
    setIsPhotoTaken(false);
    setFaceInCircle(false);
  };

  const title =
    punchType === "in"
      ? "Confirm Identity - Clock In"
      : "Confirm Identity - Clock Out";

  const isCapturing = step === "capture";

  return (
    <main className="guts-bg">
      <div className="guts-home">
        <section className="guts-home-card" aria-label="Face Verify">
          <Header empCode={empCode} displayName={displayName} />

          <h2 className="guts-att-title">Clock In / Out</h2>

          <div className="guts-fv-card">
            <div className="guts-fv-title">{title}</div>

            {/* Camera/Photo Frame */}
            <div className="guts-fv-frame" aria-label="Face capture frame">
              <div className="guts-fv-topIcons" aria-hidden="true" />

              {/* Guide Overlay */}
              <div
                className="guts-fv-circle"
                aria-hidden="true"
                style={{
                  borderColor: isPhotoTaken
                    ? "#00FF00"
                    : faceInCircle
                    ? "#00FF00"
                    : "#fff",
                  transition: "border-color 0.3s ease",
                }}
              />
              <span className="guts-fv-corner tl" aria-hidden="true" />
              <span className="guts-fv-corner tr" aria-hidden="true" />
              <span className="guts-fv-corner bl" aria-hidden="true" />
              <span className="guts-fv-corner br" aria-hidden="true" />

              {isCapturing ? (
                <>
                  <video
                    ref={videoRef}
                    className="guts-fv-video"
                    playsInline
                    muted
                  />

                  {isReady && (
                    <div
                      style={{
                        position: "absolute",
                        bottom: 10,
                        left: "50%",
                        transform: "translateX(-50%)",
                        zIndex: 5,
                        textAlign: "center",
                        background: "rgba(0,0,0,0.7)",
                        color: faceInCircle ? "#00FF00" : "#fff",
                        padding: "8px 16px",
                        borderRadius: "12px",
                        fontSize: "14px",
                        fontWeight: "bold",
                        transition: "color 0.3s ease",
                      }}
                    >
                      {faceMessage}
                    </div>
                  )}

                  {!isReady && (
                    <div
                      style={{
                        position: "absolute",
                        bottom: 10,
                        left: "50%",
                        transform: "translateX(-50%)",
                        zIndex: 5,
                        textAlign: "center",
                        background: "rgba(0,0,0,0.7)",
                        color: "#fff",
                        padding: "8px 16px",
                        borderRadius: "12px",
                        fontSize: "14px",
                        fontWeight: "bold",
                      }}
                    >
                      Opening camera...
                    </div>
                  )}
                </>
              ) : (
                <img
                  className="guts-fv-img"
                  src={photo}
                  alt="Confirmation photo"
                />
              )}

              <input
                className="guts-fv-file"
                type="file"
                accept="image/*"
                capture="user"
                onChange={(e) => onPickFile(e.target.files?.[0])}
              />

              <canvas ref={canvasRef} className="guts-fv-canvas" />
            </div>

            <div className="guts-fv-text">
              {isCapturing
                ? "Position your body inside the circle"
                : "Confirm your photo for verification"}
            </div>

            {err && <div className="guts-fv-error">{err}</div>}

            {/* Main Buttons */}
            {isCapturing ? (
              <button
                type="button"
                className="guts-fv-primary"
                onClick={captureFromVideo}
                disabled={busy || !isReady || !faceInCircle}
                style={{
                  background: faceInCircle
                    ? "linear-gradient(90deg, #1fbf5b, #149a44)"
                    : "linear-gradient(90deg, #6c757d, #5a6268)",
                  opacity: faceInCircle ? 1 : 0.6,
                  transition: "all 0.3s ease",
                  cursor: faceInCircle ? "pointer" : "not-allowed",
                }}
              >
                <FontAwesomeIcon
                  icon={faCamera}
                  className="guts-fv-primaryIcon"
                />
                {faceInCircle ? "Take Photo Now" : "Position Body in Circle"}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="guts-fv-primary guts-fv-primary--green"
                  onClick={handleConfirm}
                  disabled={busy}
                >
                  <FontAwesomeIcon
                    icon={faCircleCheck}
                    className="guts-fv-primaryIcon"
                  />
                  Confirm Identity
                </button>

                <button
                  type="button"
                  className="guts-fv-secondary"
                  onClick={handleRetake}
                  disabled={busy}
                >
                  <FontAwesomeIcon icon={faRotateLeft} />
                  Retake Photo
                </button>
              </>
            )}

            <div className="guts-fv-bottom">
              <BackButton
                onClick={onBack}
                disabled={busy}
                className="guts-fv-backBtn"
              />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}