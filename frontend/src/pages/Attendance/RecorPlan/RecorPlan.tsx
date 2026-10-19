import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import Header from "@/layout/Header";
import PlanSiteModal from "@/components/RecorPlan/PlanSiteModal";
import type { PlanSiteModalValue } from "@/components/RecorPlan/PlanSiteModal";
import PlanDetailModal from "@/components/RecorPlan/PlanDetailModal";
import PlanSiteDetailModal from "@/components/RecorPlan/PlanSiteDetailModal";
import type { PlanDetailModalValue } from "@/components/RecorPlan/PlanDetailModal";
import styles from "./RecorPlan.module.css";

type SectionNo = "2" | "3" | "4" | "5" | "6";
type DetailNo = "appearance" | "staffing";
type GroupNo = SectionNo | DetailNo;
type SectionId = "1" | SectionNo;
type ReportRow = {
  id: string;
  text: string;
  // ข้อมูลจาก PlanDetailModal — ยังคง text เพื่อรองรับข้อมูลรายการเดิม
  detail?: string;
  staffName?: string;
  namePrefix?: string;
  position?: string;
  imageDataUrl?: string | null;
};

type EditorState =
  | { kind: "item"; sectionNo: SectionNo; rowId: string | null }
  | { kind: "detail"; detailType: DetailNo; siteId: string; rowId: string | null };
type SiteDetails = Record<DetailNo, ReportRow[]>;
type HeadcountRow = { position: string; total: number; absent: number };

export type OnPlanReportDraft = {
  headcounts: HeadcountRow[];
  headcountNote: string;
  sections: Record<SectionNo, ReportRow[]>;
  siteDetails: Record<string, SiteDetails>;
};

type Props = {
  empCode: string;
  displayName?: string;
  unitCode?: string | null;
  unitName?: string | null;
  routeLabel?: string | null;
  initialData?: OnPlanReportDraft;
  onBack: () => void;
  onSave?: (draft: OnPlanReportDraft) => void | Promise<void>;
  onSaveAndCheckout?: (draft: OnPlanReportDraft) => void | Promise<void>;
};

const SAMPLE_DATA: OnPlanReportDraft = {
  // ข้อมูลตัวอย่างจากภาพอ้างอิง ใช้เพื่อออกแบบ UI เท่านั้น
  headcounts: [
    { position: "หัวหน้าหน่วย", total: 1, absent: 0 },
    { position: "รปภ.", total: 10, absent: 1 },
  ],
  headcountNote: "ติดต่อไม่ได้ 1 คน",
  sections: {
    "2": [
      { id: "site-1", text: "ป้อมหน้า" },
      { id: "site-2", text: "ลานจอด A" },
      { id: "site-3", text: "ลานจอด B" },
    ],
    "3": [{ id: "s3-1", text: "ไม่เขียนรายงาน" }],
    "4": [
      { id: "s4-1", text: "ไม่แลกบัตรผู้มาติดต่อ" },
      { id: "s4-2", text: "ไม่ตรวจท้ายรถยนต์ ขาออก" },
    ],
    "5": [
      { id: "s5-1", text: "วิทยุเปิดไม่ติด 1 เครื่อง" },
      { id: "s5-2", text: "ระบบแลกบัตรเปิดไม่ติด 1" },
    ],
    "6": [],
  },
  siteDetails: {
    "site-1": {
      appearance: [
        { id: "a1", text: "ผมยาว" },
        { id: "a2", text: "กางเกงผิดระเบียบ" },
      ],
      staffing: [{ id: "st1", text: "รปภ. ชาย – สมชาย" }],
    },
  },
};

const HEADINGS: Record<SectionNo, string> = {
  "2": "2. การตรวจจุดรักษาการณ์ประจำวัน",
  "3": "3. ตรวจสอบสมุดรายงาน (ระบุสิ่งผิดปกติ)",
  "4": "4. การปฏิบัติหน้าที่ตามข้อปฏิบัติ (ระบุสิ่งที่ผิดปกติ)",
  "5": "5. ทรัพย์สินส่วนราชการของบริษัทฯ (ชำรุด ไม่พร้อมใช้งาน)",
  "6": "6. วิธี (สิ่งที่ให้คำแนะนำและปรับปรุง)",
};

function nextRowId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

function Arrow({ open }: { open: boolean }) {
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

type HeadcountNumberInputProps = {
  value: number;
  label: string;
  disabled: boolean;
  invalid?: boolean;
  onChange: (value: number) => void;
};

// เก็บข้อความระหว่างพิมพ์ไว้ก่อน เพื่อให้ลบเลขเดิมแล้วกรอกเลขใหม่ได้บนมือถือ
function HeadcountNumberInput({
  value,
  label,
  disabled,
  invalid = false,
  onChange,
}: HeadcountNumberInputProps) {
  const displayedValue = String(value);
  const [inputValue, setInputValue] = useState(displayedValue);

  useEffect(() => {
    setInputValue(displayedValue);
  }, [displayedValue]);

  function commitValue() {
    const next = inputValue === "" ? 0 : Number(inputValue);
    const validNumber = Number.isSafeInteger(next) && next >= 0 ? next : value;
    setInputValue(String(validNumber));
    if (validNumber !== value) onChange(validNumber);
  }

  return (
    <input
      className={styles.headcountInput}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      value={inputValue}
      disabled={disabled}
      aria-label={label}
      aria-invalid={invalid}
      onChange={(event) => {
        const next = event.target.value;
        if (/^\d{0,6}$/.test(next)) setInputValue(next);
      }}
      onBlur={commitValue}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
    />
  );
}

export default function WorkRecordReportPlan({
  empCode,
  displayName,
  unitCode,
  unitName,
  routeLabel,
  initialData,
  onBack,
  onSave,
  onSaveAndCheckout,
}: Props) {
  const [draft, setDraft] = useState<OnPlanReportDraft>(() => {
    const source = structuredClone(initialData ?? SAMPLE_DATA);
    // ใช้ข้อมูลข้อความครั้งก่อนเป็นต้นแบบได้ แต่รูปต้องถ่ายใหม่ในครั้งนี้
    // จึงไม่เติมภาพจาก initialData หรือรายงานเก่าเข้าหน้าฟอร์มอัตโนมัติ
    const siteDetails = Object.fromEntries(
      Object.entries(source.siteDetails).map(([siteId, details]) => [
        siteId,
        {
          appearance: details.appearance.map((row) => ({ ...row, imageDataUrl: null })),
          staffing: details.staffing.map((row) => ({ ...row, imageDataUrl: null })),
        },
      ]),
    );
    // รองรับ initialData ที่สร้างไว้ก่อนมีหัวข้อ 6 โดยไม่เติมข้อความตัวอย่าง
    return {
      ...source,
      siteDetails,
      sections: { ...source.sections, "6": source.sections["6"] ?? [] },
    };
  });
  const [openSections, setOpenSections] = useState<Record<SectionId, boolean>>({
    "1": true,
    "2": true,
    "3": false,
    "4": false,
    "5": false,
    "6": false,
  });
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const siteIndex = draft.sections["2"].findIndex((row) => row.id === selectedSiteId);
  const selectedSite = siteIndex >= 0 ? draft.sections["2"][siteIndex] : null;
  const unitDisplay = [unitCode, unitName].filter(Boolean).join(" - ");

  function toggle(section: SectionId) {
    setOpenSections((current) => ({ ...current, [section]: !current[section] }));
  }

  function updateHeadcount(index: number, field: "total" | "absent", value: number) {
    setDraft((current) => ({
      ...current,
      headcounts: current.headcounts.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [field]: value } : row,
      ),
    }));
    setMessage("");
  }

  function openEditor(group: GroupNo, rowId: string | null = null) {
    // ข้อ 2: กด "แก้ไข" ของจุดตรวจที่มีอยู่ ต้องเปิด Modal รายละเอียด 2.x.1
    // ส่วน "+ กดเพิ่มข้อมูล" (rowId === null) ยังใช้ PlanSiteModal เหมือนเดิม
    if (group === "2" && rowId !== null) {
      setSelectedSiteId(rowId);
      setMessage("");
      return;
    }

    if (group === "appearance" || group === "staffing") {
      if (!selectedSiteId) return;
      setEditor({ kind: "detail", detailType: group, siteId: selectedSiteId, rowId });
    } else {
      setEditor({ kind: "item", sectionNo: group, rowId });
    }
  }

  function updateRows(group: GroupNo, transform: (rows: ReportRow[]) => ReportRow[]) {
    setDraft((current) => {
      if (group === "appearance" || group === "staffing") {
        if (!selectedSiteId) return current;
        const details = current.siteDetails[selectedSiteId] ?? { appearance: [], staffing: [] };
        return {
          ...current,
          siteDetails: {
            ...current.siteDetails,
            [selectedSiteId]: { ...details, [group]: transform(details[group]) },
          },
        };
      }
      return {
        ...current,
        sections: { ...current.sections, [group]: transform(current.sections[group]) },
      };
    });
  }

  function saveItemFromModal(value: string) {
    if (!editor || editor.kind !== "item") return;

    updateRows(editor.sectionNo, (rows) =>
      editor.rowId
        ? rows.map((row) => (row.id === editor.rowId ? { ...row, text: value } : row))
        : [...rows, { id: nextRowId(), text: value }],
    );
    setEditor(null);
    setMessage("");
  }

  // หัวข้อ 2: เพิ่ม/แก้ไขจุดรักษาการณ์ พร้อมหมายเหตุและรูปที่ถ่ายในรอบนี้
  function saveSiteFromModal(value: PlanSiteModalValue) {
    if (!editor || editor.kind !== "item" || editor.sectionNo !== "2") return;
    updateRows("2", (rows) =>
      editor.rowId
        ? rows.map((row) => row.id === editor.rowId
          ? { ...row, text: value.text, detail: value.detail, imageDataUrl: value.imageDataUrl }
          : row)
        : [...rows, { id: nextRowId(), text: value.text, detail: value.detail, imageDataUrl: value.imageDataUrl }],
    );
    setEditor(null);
    setMessage("");
  }

  function saveDetailFromModal(value: PlanDetailModalValue) {
    if (!editor || editor.kind !== "detail") return;
    const { siteId, detailType, rowId } = editor;
    const text = detailType === "staffing"
      ? [[value.namePrefix, value.staffName].filter(Boolean).join(" "), value.position]
          .filter(Boolean).join(" - ") +
        (value.detail ? ` (${value.detail})` : "")
      : value.detail;

    setDraft((current) => {
      const details = current.siteDetails[siteId] ?? { appearance: [], staffing: [] };
      const rows = details[detailType];
      const nextRows = rowId
        ? rows.map((row) =>
            row.id === rowId
              ? {
                  ...row,
                  text,
                  detail: value.detail,
                  staffName: value.staffName,
                  namePrefix: value.namePrefix ?? "",
                  position: value.position,
                  // หากไม่ได้ถ่ายรูปใหม่ขณะแก้ไข ให้คงรูปใน draft เดิม
                  imageDataUrl: value.imageDataUrl ?? row.imageDataUrl ?? null,
                }
              : row,
          )
        : [
            ...rows,
            {
              id: nextRowId(),
              text,
              detail: value.detail,
              staffName: value.staffName,
              namePrefix: value.namePrefix ?? "",
              position: value.position,
              imageDataUrl: value.imageDataUrl,
            },
          ];

      return {
        ...current,
        siteDetails: {
          ...current.siteDetails,
          [siteId]: { ...details, [detailType]: nextRows },
        },
      };
    });
    setEditor(null);
    setMessage("");
  }

  function removeRow(group: GroupNo, rowId: string) {
    updateRows(group, (rows) => rows.filter((row) => row.id !== rowId));
    setMessage("");
    if (group === "2") {
      setDraft((current) => {
        const nextDetails = { ...current.siteDetails };
        delete nextDetails[rowId];
        return { ...current, siteDetails: nextDetails };
      });
    }
  }

  function renderRows(group: GroupNo, rows: ReportRow[]) {
    return (
      <>
        <button className={styles.addRow} type="button" onClick={() => openEditor(group)}>
          + กดเพิ่มข้อมูล
        </button>
        <table className={styles.detailTable}>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.id}>
                <td className={styles.rowNumber}>
                  {group === "appearance" || group === "staffing"
                    ? index + 1
                    : `${group}.${index + 1}`}
                </td>
                <td>
                  {group === "2" ? (
                    <>
                      <button
                        type="button"
                        className={styles.siteLink}
                        onClick={() => { setSelectedSiteId(row.id); setMessage(""); }}
                      >
                        {row.text}
                      </button>
                      {row.detail && <div className={styles.staffingSummary}>{row.detail}</div>}
                      {row.imageDataUrl && (
                        <img
                          className={styles.staffingThumbnail}
                          src={row.imageDataUrl}
                          alt={`รูปถ่ายจุดรักษาการณ์ ${row.text}`}
                        />
                      )}
                    </>
                  ) : (
                    row.text
                  )}
                </td>
                <td className={styles.actionCell}>
                  <button className={styles.editLink} type="button" onClick={() => openEditor(group, row.id)}>
                    แก้ไข
                  </button>
                </td>
                <td className={styles.actionCell}>
                  <button className={styles.deleteLink} type="button" onClick={() => removeRow(group, row.id)}>
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

  function renderSection(id: SectionId, heading: string, content: ReactNode, color: "blue" | "red" | "yellow" = "blue") {
    return (
      <section className={styles.section} key={id}>
        <button
          className={`${styles.sectionHeader} ${color === "red" ? styles.redHeader : color === "yellow" ? styles.yellowHeader : ""}`}
          type="button"
          aria-expanded={openSections[id]}
          onClick={() => toggle(id)}
        >
          <span>{heading}</span>
          <Arrow open={openSections[id]} />
        </button>
        {openSections[id] && <div className={styles.sectionBody}>{content}</div>}
      </section>
    );
  }

  async function save(kind: "save" | "checkout") {
    const invalidRow = draft.headcounts.find((row) => row.absent > row.total);
    if (invalidRow) {
      setOpenSections((current) => ({ ...current, "1": true }));
      setMessage(`จำนวนขาดของตำแหน่ง ${invalidRow.position} ต้องไม่มากกว่าจำนวนรวม`);
      return;
    }

    const callback = kind === "save" ? onSave : onSaveAndCheckout;
    if (!callback) {
      setMessage("ต้นแบบ UI: ยังไม่ได้เชื่อมต่อการบันทึกหรือการลงเวลาออกงานกับ Backend");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      await callback(draft);
      setMessage("บันทึกข้อมูลสำเร็จ");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "บันทึกข้อมูลไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="guts-bg">
      <div className="guts-home">
        <section className={`guts-home-card ${styles.pageCard}`} aria-label="บันทึกรายงานตามแผน">
          {/* ใช้ Header เดิมของ GUTS-ESS Phase 2 เท่านั้น */}
          <Header empCode={empCode} displayName={displayName} />
          <h2 className={styles.pageTitle}>หน้าจอ - บันทึกรายงาน (ตามแผน)</h2>
          {(unitDisplay || routeLabel) && (
            <div className={styles.unitStatus}>
              {unitDisplay && <div>{unitDisplay}</div>}
              {routeLabel && <div>{routeLabel}</div>}
            </div>
          )}

          <div className={styles.formCard}>
            {renderSection(
              "1",
              "1. ยอดรวมกำลังพล",
              <>
                <table className={styles.headcountTable}>
                  <thead>
                    <tr><th>ลำดับ</th><th>ตำแหน่ง</th><th>รวม</th><th className={styles.absentHeader}>ขาด</th><th>หน่วย</th></tr>
                  </thead>
                  <tbody>
                    {draft.headcounts.map((row, index) => (
                      <tr key={`${row.position}-${index}`}>
                        <td>1.{index + 1}</td>
                        <td>{row.position}</td>
                        <td>
                          <HeadcountNumberInput
                            value={row.total}
                            label={`จำนวนรวม ${row.position}`}
                            disabled={busy}
                            onChange={(value) => updateHeadcount(index, "total", value)}
                          />
                        </td>
                        <td className={row.absent > 0 ? styles.absentValue : ""}>
                          <HeadcountNumberInput
                            value={row.absent}
                            label={`จำนวนขาด ${row.position}`}
                            disabled={busy}
                            invalid={row.absent > row.total}
                            onChange={(value) => updateHeadcount(index, "absent", value)}
                          />
                        </td>
                        <td>คน</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {draft.headcounts.some((row) => row.absent > row.total) && (
                  <p className={styles.headcountError} role="alert">
                    จำนวนขาดต้องไม่มากกว่าจำนวนรวม
                  </p>
                )}
                {draft.headcountNote && (
                  <div className={styles.note}>หมายเหตุ: <strong>{draft.headcountNote}</strong></div>
                )}
              </>,
            )}
            {(["2", "3", "4", "5", "6"] as const).map((section) =>
              renderSection(
                section,
                HEADINGS[section],
                renderRows(section, draft.sections[section]),
                section === "6" ? "yellow" : section === "2" ? "blue" : "red",
              ),
            )}
          </div>

          {message && !selectedSite && <div className={styles.status} role="status">{message}</div>}

          <footer className={styles.footer}>
            <button type="button" className={styles.primaryButton} disabled={busy} onClick={() => void save("save")}>
              บันทึกรายงาน
            </button>
            <button type="button" className={styles.checkoutButton} disabled={busy} onClick={() => void save("checkout")}>
              บันทึกและออกงาน
            </button>
            <button
              type="button"
              className={styles.backButton}
              disabled={busy}
              onClick={onBack}
            >
              ย้อนกลับ
            </button>
          </footer>
        </section>
      </div>

      {selectedSite && (
        <PlanSiteDetailModal
          open
          siteName={selectedSite.text}
          siteNumber={siteIndex + 1}
          staffingRows={draft.siteDetails[selectedSite.id]?.staffing ?? []}
          appearanceRows={draft.siteDetails[selectedSite.id]?.appearance ?? []}
          busy={busy}
          childModalOpen={editor !== null}
          message={message}
          onClose={() => setSelectedSiteId(null)}
          onAdd={(detailType) => openEditor(detailType)}
          onEdit={(detailType, rowId) => openEditor(detailType, rowId)}
          onDelete={(detailType, rowId) => removeRow(detailType, rowId)}
          onPhotoCaptured={(rowId, imageDataUrl) => {
            setDraft((current) => {
              const siteDetails = current.siteDetails[selectedSite.id];
              if (!siteDetails?.staffing.some((row) => row.id === rowId)) return current;
              return {
                ...current,
                siteDetails: {
                  ...current.siteDetails,
                  [selectedSite.id]: {
                    ...siteDetails,
                    staffing: siteDetails.staffing.map((row) =>
                      row.id === rowId ? { ...row, imageDataUrl } : row,
                    ),
                  },
                },
              };
            });
          }}
        />
      )}

      {editor?.kind === "item" && (() => {
        const rows = draft.sections[editor.sectionNo];
        const rowIndex = rows.findIndex((row) => row.id === editor.rowId);
        const currentRow = rowIndex >= 0 ? rows[rowIndex] : null;
        const itemNumber = `${editor.sectionNo}.${rowIndex >= 0 ? rowIndex + 1 : rows.length + 1}`;

        // ข้อ 2 ใช้ Modal เฉพาะจุดรักษาการณ์ มีรูปถ่ายและข้อมูลย่อ
        if (editor.sectionNo === "2") {
          return (
            <PlanSiteModal
              open
              itemNumber={itemNumber}
              editing={editor.rowId !== null}
              initialValue={{
                text: currentRow?.text ?? "",
                detail: currentRow?.detail ?? "",
                imageDataUrl: currentRow?.imageDataUrl ?? null,
              }}
              disabled={busy}
              onClose={() => setEditor(null)}
              onSave={saveSiteFromModal}
            />
          );
        }

        // ข้อ 3–6 ใช้ฟอร์มรายละเอียดแบบเดียวกับหน้าจอที่ 3
        // ใช้โหมด note จึงไม่มีฟิลด์กำลังพลหรือรูปภาพ
        return (
          <PlanDetailModal
            open
            detailType="note"
            sectionTitle={HEADINGS[editor.sectionNo]}
            headerColor={editor.sectionNo === "6" ? "yellow" : "red"}
            itemNumber={itemNumber}
            editing={editor.rowId !== null}
            initialValue={{ detail: currentRow?.text ?? "" }}
            disabled={busy}
            onClose={() => setEditor(null)}
            onSave={(value) => saveItemFromModal(value.detail)}
          />
        );
      })()}

      {editor?.kind === "detail" && (() => {
        const rows = draft.siteDetails[editor.siteId]?.[editor.detailType] ?? [];
        const rowIndex = rows.findIndex((row) => row.id === editor.rowId);
        const currentRow = rowIndex >= 0 ? rows[rowIndex] : null;
        const siteNumber = draft.sections["2"].findIndex((row) => row.id === editor.siteId) + 1;
        const siteName = draft.sections["2"].find((row) => row.id === editor.siteId)?.text ?? "";

        return (
          <PlanDetailModal
            open
            detailType={editor.detailType}
            siteName={siteName}
            itemNumber={`2.${siteNumber}.1.${rowIndex >= 0 ? rowIndex + 1 : rows.length + 1}`}
            sectionTitle={editor.detailType === "appearance"
              ? "การแต่งกาย (ไม่ถูกระเบียบที่กำหนด)"
              : "กำลังพลประจำจุดรักษาการณ์"}
            editing={editor.rowId !== null}
            initialValue={{
              detail: currentRow?.detail ?? (editor.detailType === "appearance" ? currentRow?.text ?? "" : ""),
              staffName: currentRow?.staffName ?? (editor.detailType === "staffing" ? currentRow?.text ?? "" : ""),
              namePrefix: currentRow?.namePrefix ?? "",
              position: currentRow?.position ?? "",
            }}
            disabled={busy}
            maxLength={250}
            onClose={() => setEditor(null)}
            onSave={saveDetailFromModal}
          />
        );
      })()}

    </main>
  );
}
