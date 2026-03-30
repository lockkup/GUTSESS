import styles from "./InfoModel.module.css";
import { CheckCircle2, CircleAlert } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  variant?: "success" | "error";
  title?: string;
  description?: string;
};

export default function InfoModel({
  open,
  onClose,
  variant = "success",
  title,
  description,
}: Props) {
  if (!open) return null;

  const isError = variant === "error";
  const resolvedTitle = title ?? (isError ? "เกิดข้อผิดพลาด" : "บันทึกข้อมูลสำเร็จ!");
  const resolvedDescription =
    description ??
    (isError
      ? "ไม่สามารถดำเนินการได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง"
      : "ระบบได้ทำการบันทึกข้อมูลของคุณเรียบร้อยแล้ว");

  return (
    <div className={styles["dialog-overlay"]} role="dialog" aria-modal="true">
      <div
        className={[
          styles["dialog-card"],
          isError ? styles["error-card"] : styles["success-card"],
        ].join(" ")}
      >
        <div
          className={[
            styles["dialog-icon"],
            isError ? styles["error-icon"] : styles["success-icon"],
          ].join(" ")}
        >
          {isError ? (
            <CircleAlert size={36} strokeWidth={2.5} />
          ) : (
            <CheckCircle2 size={36} strokeWidth={2.5} />
          )}
        </div>
        <div
          className={[
            styles["dialog-title"],
            isError ? styles["error-title"] : styles["success-title"],
          ].join(" ")}
        >
          {resolvedTitle}
        </div>
        {resolvedDescription && (
          <div className={styles["dialog-desc"]}>{resolvedDescription}</div>
        )}

        <div className={styles["dialog-actions"]}>
          <button
            type="button"
            className={[
              styles.btn,
              isError ? styles["error-btn"] : styles["success-btn"],
            ].join(" ")}
            onClick={onClose}
          >
            ตกลง
          </button>
        </div>
      </div>
    </div>
  );
}

export { InfoModel };
