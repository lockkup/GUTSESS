import { useEffect, useState } from "react";

import styles from "./WorkReportModal.module.css";

export type WorkReportModalItem = {
  id: string | number;
  title: string;
};

export type WorkReportSignature = {
  fullName: string;
  position: string;
  imageDataUrl?: string;
};

type SectionKey =
  | "section1"
  | "section2"
  | "summary"
  | "section3"
  | "section4"
  | "section5";

type OpenSections = Record<SectionKey, boolean>;

type Props = {
  unitName?: string;
  routeLabel?: string;
  employeeCode?: string;
  employeeName?: string;
  employeePosition?: string;

  workItems?: WorkReportModalItem[];
  signature?: WorkReportSignature | null;

  busy?: boolean;

  onClose: () => void;
  onSave?: () => void;

  onAddWorkItem?: () => void;
  onEditWorkItem?: (item: WorkReportModalItem) => void;
  onDeleteWorkItem?: (item: WorkReportModalItem) => void;

  onSign?: () => void;
  onEditSignature?: () => void;
};

const THAI_MONTHS = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
];

const THAI_DAYS = [
  "อาทิตย์",
  "จันทร์",
  "อังคาร",
  "พุธ",
  "พฤหัสบดี",
  "ศุกร์",
  "เสาร์",
];

function formatThaiDateTime(date: Date) {
  return `วันที่ ${THAI_DAYS[date.getDay()]} ที่ ${date.getDate()} ${
    THAI_MONTHS[date.getMonth()]
  } ${date.getFullYear() + 543} เวลาขณะนี้ ${String(
    date.getHours(),
  ).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export default function WorkReportModal({
  unitName = "ชื่อหน่วยงาน",
  routeLabel = "ภาค 9 เขต9.1 เส้นทาง1",
  employeeCode = "632070",
  employeeName = "สุพจน์ หมดอก",
  employeePosition = "สายตรวจและประสานงาน",
  workItems = [],
  signature = null,
  busy = false,
  onClose,
  onSave,
  onAddWorkItem,
  onEditWorkItem,
  onDeleteWorkItem,
  onSign,
  onEditSignature,
}: Props) {
  const [dateTimeText, setDateTimeText] = useState(() =>
    formatThaiDateTime(new Date()),
  );

  const [openSections, setOpenSections] = useState<OpenSections>({
    section1: true,
    section2: true,
    summary: false,
    section3: true,
    section4: true,
    section5: false,
  });

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) {
        onClose();
      }
    }

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleEscape);

    const timer = window.setInterval(() => {
      setDateTimeText(formatThaiDateTime(new Date()));
    }, 30_000);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleEscape);
      window.clearInterval(timer);
    };
  }, [busy, onClose]);

  function toggleSection(section: SectionKey) {
    setOpenSections((current) => ({
      ...current,
      [section]: !current[section],
    }));
  }

  const nextWorkItemNumber = workItems.length + 1;

  return (
    <div
      className={styles.modalOverlay}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) {
          onClose();
        }
      }}
    >
      <section
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="work-report-modal-title"
      >
        <div className={styles.modalScroll}>
          <header className={styles.reportHeader}>
            <div className={styles.logoWrap}>
              <div className={styles.logoText}>◉ GUTS</div>
              <h1 className={styles.reportTitle} id="work-report-modal-title">
                บันทึกรายงาน
              </h1>
            </div>

            <div className={styles.metaBlock}>
              <div>{unitName}</div>
              <div>{routeLabel}</div>
              <div>{dateTimeText}</div>
              <div>
                ผู้ปฏิบัติ/ผู้บันทึก {employeeCode} - {employeeName}
              </div>
              <div>ตำแหน่ง {employeePosition}</div>
            </div>
          </header>

          <section className={styles.section}>
            <button
              type="button"
              className={styles.sectionHeader}
              onClick={() => toggleSection("section1")}
            >
              <span>ข้อ 1. บันทึกรายงาน</span>
              <span
                className={`${styles.chevron} ${
                  openSections.section1 ? "" : styles.chevronClosed
                }`}
                aria-hidden="true"
              />
            </button>

            {openSections.section1 ? (
              <div className={styles.sectionBody}>
                <label className={styles.checkRow}>
                  <input type="checkbox" disabled={busy} />
                  <span>ผู้ปฏิบัติงานตามแผนปกติ</span>
                </label>

                <label className={styles.checkRow}>
                  <input type="checkbox" disabled={busy} />
                  <span>เข้าพบผู้ว่าจ้าง</span>
                </label>

                <label className={styles.checkRow}>
                  <input type="checkbox" disabled={busy} />
                  <span>ได้รับมอบหมายงานอื่น ๆ</span>
                </label>

                <div className={styles.signatureBlock}>
                  <div className={styles.signatureTopRow}>
                    <span>ลงชื่อ</span>

                    <button
                      type="button"
                      className={styles.signatureArea}
                      onClick={onSign}
                      disabled={busy || !onSign}
                    >
                      {signature?.imageDataUrl ? (
                        <img
                          src={signature.imageDataUrl}
                          alt="ลายเซ็นผู้ว่าจ้างหรือตัวแทน"
                        />
                      ) : (
                        <span>กดปุ่มเพื่อเซ็นชื่อ</span>
                      )}
                    </button>

                    <span>ผู้ว่าจ้าง/ตัวแทน</span>
                  </div>

                  <div className={styles.signatureNameRow}>
                    <span>(</span>

                    <div className={styles.signatureNameValue}>
                      {signature?.fullName ?? ""}
                    </div>

                    <button
                      type="button"
                      className={styles.editSignatureButton}
                      onClick={onEditSignature}
                      disabled={busy || !onEditSignature}
                    >
                      กดปุ่มเพื่อแก้ไข
                    </button>
                  </div>

                  <div className={styles.positionRow}>
                    <span>ตำแหน่งงาน</span>
                    <span className={styles.positionValue}>
                      {signature?.position ?? ""}
                    </span>
                  </div>
                </div>
              </div>
            ) : null}
          </section>

          <section className={styles.section}>
            <button
              type="button"
              className={styles.sectionHeader}
              onClick={() => toggleSection("section2")}
            >
              <span>ข้อ 2. สิ่งที่ดำเนินการเรียบร้อย</span>
              <span
                className={`${styles.chevron} ${
                  openSections.section2 ? "" : styles.chevronClosed
                }`}
                aria-hidden="true"
              />
            </button>

            {openSections.section2 ? (
              <div className={styles.sectionBody}>
                {workItems.map((item, index) => (
                  <div className={styles.workItemRow} key={item.id}>
                    <div className={styles.workItemNumber}>2.{index + 1}</div>

                    <div className={styles.workItemTitle}>{item.title}</div>

                    <div className={styles.workItemActions}>
                      <button
                        type="button"
                        onClick={() => onEditWorkItem?.(item)}
                        disabled={busy || !onEditWorkItem}
                      >
                        แก้ไข
                      </button>

                      <button
                        type="button"
                        onClick={() => onDeleteWorkItem?.(item)}
                        disabled={busy || !onDeleteWorkItem}
                      >
                        ลบ
                      </button>
                    </div>
                  </div>
                ))}

                <div className={styles.tableRow}>
                  <div className={styles.tableNumber}>
                    2.{nextWorkItemNumber}
                  </div>

                  <button
                    type="button"
                    className={styles.tableAddButton}
                    onClick={onAddWorkItem}
                    disabled={busy || !onAddWorkItem}
                  >
                    +กดเพิ่มข้อมูล
                  </button>
                </div>
              </div>
            ) : null}
          </section>

          <section className={styles.section}>
            <button
              type="button"
              className={`${styles.sectionHeader} ${styles.summaryHeader}`}
              onClick={() => toggleSection("summary")}
            >
              <span>สรุปผลดำเนินการของบริษัทฯ</span>
              <span
                className={`${styles.chevron} ${
                  openSections.summary ? "" : styles.chevronClosed
                }`}
                aria-hidden="true"
              />
            </button>

            {openSections.summary ? (
              <div className={styles.sectionBody}>
                <section className={styles.innerSection}>
                  <button
                    type="button"
                    className={styles.innerSectionHeader}
                    onClick={() => toggleSection("section3")}
                  >
                    <span>
                      ข้อ 3. ข้อบกพร่อง/ตำหนิ ที่สามารถแก้ไขได้ทันที
                    </span>
                    <span
                      className={`${styles.chevron} ${
                        openSections.section3 ? "" : styles.chevronClosed
                      }`}
                      aria-hidden="true"
                    />
                  </button>

                  {openSections.section3 ? (
                    <div className={styles.sectionBody}>
                      <div className={styles.tableRow}>
                        <div className={styles.tableNumber}>3.1</div>
                        <div className={styles.tableText}>
                          รปภ. ชุดเก่า ทำการแจ้งให้ปรับปรุงแล้ว
                        </div>
                      </div>

                      <div className={styles.tableRow}>
                        <div className={styles.tableNumber}>3.2</div>
                        <button
                          type="button"
                          className={styles.tableAddButton}
                          disabled={busy}
                        >
                          +กดเพิ่มข้อมูล
                        </button>
                      </div>
                    </div>
                  ) : null}
                </section>

                <section className={styles.innerSection}>
                  <button
                    type="button"
                    className={styles.innerSectionHeader}
                    onClick={() => toggleSection("section4")}
                  >
                    <span>
                      ข้อ 4. ไม่สามารถแก้ไขได้ทันที (นำเสนอ/ดำเนินการต่อ)
                    </span>
                    <span
                      className={`${styles.chevron} ${
                        openSections.section4 ? "" : styles.chevronClosed
                      }`}
                      aria-hidden="true"
                    />
                  </button>

                  {openSections.section4 ? (
                    <div className={styles.sectionBody}>
                      <div className={styles.tableRow}>
                        <div className={styles.tableNumber}>4.1</div>
                        <div className={styles.tableText}>
                          ขาดกำลังพลทดแทน
                        </div>
                      </div>

                      <div className={styles.tableRow}>
                        <div className={styles.tableNumber}>4.2</div>
                        <button
                          type="button"
                          className={styles.tableAddButton}
                          disabled={busy}
                        >
                          +กดเพิ่มข้อมูล
                        </button>
                      </div>
                    </div>
                  ) : null}
                </section>
              </div>
            ) : null}
          </section>

          <section className={styles.section}>
            <button
              type="button"
              className={styles.sectionHeader}
              onClick={() => toggleSection("section5")}
            >
              <span>ข้อ 5. ปัญหาทรัพย์สินเสียหาย/สูญหาย</span>
              <span
                className={`${styles.chevron} ${
                  openSections.section5 ? "" : styles.chevronClosed
                }`}
                aria-hidden="true"
              />
            </button>

            {openSections.section5 ? (
              <div className={styles.sectionBody}>
                <div className={styles.section5Text}>
                  ข้อ 5. ปัญหาทรัพย์สินเสียหาย/สูญหาย/ปัญหาที่ต้องการแก้ไขอย่างต่อเนื่อง
                  หรือเกี่ยวข้องกับส่วนอื่น ให้สรุปข้อมูลโดยย่อ
                </div>
              </div>
            ) : null}
          </section>
        </div>

        <footer className={styles.footerBar}>
          <button
            type="button"
            className={styles.cancelButton}
            onClick={onClose}
            disabled={busy}
          >
            ยกเลิก
          </button>

          <button
            type="button"
            className={styles.saveButton}
            onClick={onSave}
            disabled={busy || !onSave}
          >
            {busy ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </footer>
      </section>
    </div>
  );
}