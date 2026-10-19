import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import { createPortal } from "react-dom";
import CameraModal from "@/components/CameraModal";
import styles from "./PlanSiteDetailModal.module.css";

/** ข้อมูลที่หน้ารายงานส่งมาเพื่อแสดงใน Modal รายละเอียดของข้อ 2 */
export type PlanSiteDetailRow = {
  id: string;
  text: string;
  detail?: string;
  staffName?: string;
  namePrefix?: string;
  position?: string;
  imageDataUrl?: string | null;
};

type DetailGroup = "staffing" | "appearance";

export type PlanSiteDetailModalProps = {
  open: boolean;
  siteName: string;
  siteNumber: number;
  staffingRows: PlanSiteDetailRow[];
  appearanceRows: PlanSiteDetailRow[];
  busy?: boolean;
  /** หยุด Escape / การดัก Tab ของ Modal ชั้นนอกขณะเปิด Modal เพิ่มหรือแก้ไข */
  childModalOpen?: boolean;
  message?: string;
  onClose: () => void;
  onAdd: (group: DetailGroup) => void;
  onEdit: (group: DetailGroup, rowId: string) => void;
  onDelete: (group: DetailGroup, rowId: string) => void;
  /** ถ่ายรูปใหม่ให้กำลังพลในแถวที่เลือก โดยไม่เปิดฟอร์มแก้ไขข้อมูล */
  onPhotoCaptured: (rowId: string, imageDataUrl: string) => void;
};

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`${styles.chevron} ${open ? "" : styles.chevronClosed}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 9L12 15L18 9" />
    </svg>
  );
}

/** หน้าต่างรายละเอียดจุดรักษาการณ์ 2.x.1 — แยก UI / CSS จาก RecorPlan */
export default function PlanSiteDetailModal({
  open,
  siteName,
  siteNumber,
  staffingRows,
  appearanceRows,
  busy = false,
  childModalOpen = false,
  message = "",
  onClose,
  onAdd,
  onEdit,
  onDelete,
  onPhotoCaptured,
}: PlanSiteDetailModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const headingId = useId();
  const [photoRowId, setPhotoRowId] = useState<string | null>(null);
  const [openGroups, setOpenGroups] = useState<Record<DetailGroup, boolean>>({
    staffing: true,
    appearance: true,
  });

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();

    return () => {
      document.body.style.overflow = oldOverflow;
      previousFocusRef.current?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open || busy || childModalOpen || photoRowId !== null) return;
    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, busy, childModalOpen, photoRowId, onClose]);

  if (!open) return null;

  const siteLabel = `2.${siteNumber}`;

  function toggle(group: DetailGroup) {
    setOpenGroups((current) => ({ ...current, [group]: !current[group] }));
  }

  function handleFocusTrap(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab" || childModalOpen || photoRowId !== null) return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (!focusable?.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function renderGroup(group: DetailGroup, heading: string, content: ReactNode) {
    return (
      <section className={styles.section}>
        <button
          type="button"
          className={`${styles.sectionHeader} ${group === "appearance" ? styles.redHeader : ""}`}
          aria-expanded={openGroups[group]}
          onClick={() => toggle(group)}
        >
          <span>{heading}</span>
          <Chevron open={openGroups[group]} />
        </button>
        {openGroups[group] && <div className={styles.sectionBody}>{content}</div>}
      </section>
    );
  }

  function renderAppearance() {
    return (
      <>
        <button type="button" className={styles.addRow} onClick={() => onAdd("appearance")}>
          + กดเพิ่มข้อมูล
        </button>
        <table className={styles.detailTable}>
          <tbody>
            {appearanceRows.map((row, index) => (
              <tr key={row.id}>
                <td className={styles.rowNumber}>{index + 1}</td>
                <td>{row.text}</td>
                <td className={styles.actionCell}>
                  <button type="button" className={styles.editLink} onClick={() => onEdit("appearance", row.id)}>
                    แก้ไข
                  </button>
                </td>
                <td className={styles.actionCell}>
                  <button type="button" className={styles.deleteLink} onClick={() => onDelete("appearance", row.id)}>
                    ลบ
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </>
    );
  }

  function renderStaffing() {
    return (
      <>
        <button type="button" className={styles.addRow} onClick={() => onAdd("staffing")}>
          + กดเพิ่มข้อมูล
        </button>
        <table className={`${styles.detailTable} ${styles.staffingTable}`}>
          <colgroup>
            <col className={styles.staffingNumberColumn} />
            <col className={styles.staffingInfoColumn} />
            <col className={styles.staffingPreviewColumn} />
            <col className={styles.staffingAttachColumn} />
            <col className={styles.staffingEditColumn} />
            <col className={styles.staffingDeleteColumn} />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">ลำดับ</th>
              <th scope="col">ข้อมูลกำลังพล</th>
              <th scope="colgroup" colSpan={2}>รูปภาพ</th>
              <th scope="colgroup" colSpan={2}>ดำเนินการ</th>
            </tr>
          </thead>
          <tbody>
            {staffingRows.map((row, index) => {
              const staffName = [row.namePrefix, row.staffName || row.text]
                .filter(Boolean)
                .join(" ");
              return (
                <tr key={row.id}>
                  <td className={styles.rowNumber}>{index + 1}</td>
                  <td className={styles.staffingPerson}>
                    <div className={styles.staffingName}>{staffName || "-"}</div>
                    {row.position && (
                      <div className={styles.staffingPosition}>ตำแหน่ง: {row.position}</div>
                    )}
                    {row.detail && <div className={styles.staffingSummary}>{row.detail}</div>}
                  </td>
                  <td className={styles.staffingPhotoCell}>
                    {row.imageDataUrl ? (
                      <img
                        className={styles.staffingThumbnail}
                        src={row.imageDataUrl}
                        alt={`รูปถ่ายของ ${staffName || "พนักงาน"}`}
                      />
                    ) : (
                      <span className={styles.noPhoto} aria-label="ยังไม่มีรูปภาพ">-</span>
                    )}
                  </td>
                  <td className={styles.staffingAttachCell}>
                    <button
                      type="button"
                      className={styles.photoLink}
                      disabled={busy || childModalOpen}
                      onClick={() => setPhotoRowId(row.id)}
                      aria-label={`${row.imageDataUrl ? "ถ่ายรูปใหม่" : "แนบรูป"}ของ ${staffName || "พนักงาน"}`}
                    >
                      {row.imageDataUrl ? "ถ่ายใหม่" : "แนบรูป"}
                    </button>
                  </td>
                  <td className={styles.actionCell}>
                    <button type="button" className={styles.editLink} onClick={() => onEdit("staffing", row.id)}>
                      แก้ไข
                    </button>
                  </td>
                  <td className={styles.actionCell}>
                    <button type="button" className={styles.deleteLink} onClick={() => onDelete("staffing", row.id)}>
                      ลบ
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className={styles.photoNote}>
          รูปภาพต้องถ่ายใหม่ด้วยกล้องใน Modal เท่านั้น ไม่ดึงรูปจากรายงานครั้งก่อน
        </p>
      </>
    );
  }

  return (
    <>
      {photoRowId === null && createPortal(
    <div
      className={styles.siteModalBackdrop}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy && !childModalOpen) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className={styles.siteModalDialog}
        role="dialog"
        aria-modal={!childModalOpen}
        aria-hidden={childModalOpen || undefined}
        aria-labelledby={headingId}
        tabIndex={-1}
        onKeyDown={handleFocusTrap}
      >
        <header className={styles.siteModalHeader}>
          <h3 id={headingId} className={styles.siteModalTitle}>{siteLabel} {siteName}</h3>
          <button
            type="button"
            className={styles.siteModalClose}
            aria-label="ปิดรายละเอียดจุดรักษาการณ์"
            disabled={busy || childModalOpen}
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <div className={styles.siteModalBody}>
          <div className={styles.formCard}>
            {renderGroup("staffing", `${siteLabel}.1 กำลังพล จุดรักษาการณ์ - ${siteName}`, renderStaffing())}
            {renderGroup("appearance", `${siteLabel}.1 การแต่งกาย (ไม่ถูกระเบียบที่กำหนด)`, renderAppearance())}
          </div>
          {message && <div className={styles.status} role="status">{message}</div>}
        </div>
        <footer className={styles.siteModalFooter}>
          <button type="button" className={styles.backButton} disabled={busy || childModalOpen} onClick={onClose}>
            ย้อนกลับ
          </button>
        </footer>
      </div>
    </div>,
    document.body,
      )}
      <CameraModal
        open={photoRowId !== null}
        onClose={() => setPhotoRowId(null)}
        onCaptured={(dataUrl) => {
          if (photoRowId !== null) {
            onPhotoCaptured(photoRowId, dataUrl);
          }
          setPhotoRowId(null);
        }}
      />
    </>
  );
}
