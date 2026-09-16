import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";

import Header from "@/layout/Header";
import BackButton from "@/components/BackButton";
import { workReportService } from "@/services/workReport.service";
import type {
  WorkReportItemTypeResponse,
  WorkReportPurposeResponse,
} from "@/types/workReport";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faImage,
  faPlus,
  faTrashCan,
} from "@fortawesome/free-solid-svg-icons";

import WorkItemModal from "@/components/WorkItemModal";
import type { WorkItemModalValue } from "@/components/WorkItemModal";
import styles from "./WorkAssignment.module.css";

export type VisitPurpose = string;

export type SaveMode = "stay" | "checkout";

export type WorkItem = {
  id: string;
  workItemTypeId: number | null;
  workItemCode: string;
  workItemDetail: string;
  requireDetail: boolean;
  title: string;
  imageName: string;
  imageDataUrl: string;
};

export type WorkAssignmentPayload = {
  purposeId: number;
  purpose: VisitPurpose;
  purposeLabel: string;
  workItems: WorkItem[];
  additionalNote: string;
};

type Props = {
  empCode: string;
  displayName?: string;

  unitCode?: string | null;
  unitName?: string | null;
  checkin?: string | null;
  checkout?: string | null;

  initialWorkItems?: Array<{
    id?: string;
    workItemTypeId?: number | null;
    workItemCode?: string;
    workItemDetail?: string;
    requireDetail?: boolean;
    title: string;
    imageName?: string;
    imageDataUrl?: string;
  }>;

  busy?: boolean;
  onBack: () => void;
  onSave: (
    payload: WorkAssignmentPayload,
    mode: SaveMode,
  ) => Promise<void> | void;
};

const DEFAULT_WORK_ITEMS: WorkItem[] = [];

function createWorkItemId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("อ่านไฟล์รูปภาพไม่สำเร็จ"));
    reader.readAsDataURL(file);
  });
}

function formatThaiDateTime(value?: string | null) {
  const cleanValue = value?.trim();

  if (!cleanValue) return "-";

  const localDateTimeMatch = cleanValue.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?$/,
  );
  const date = localDateTimeMatch
    ? new Date(
        `${localDateTimeMatch[1]}-${localDateTimeMatch[2]}-${localDateTimeMatch[3]}` +
          `T${localDateTimeMatch[4]}:${localDateTimeMatch[5]}:${localDateTimeMatch[6] ?? "00"}+07:00`,
      )
    : new Date(cleanValue);

  if (Number.isNaN(date.getTime())) return cleanValue;

  const formatted = new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Bangkok",
  })
    .format(date)
    .replace(",", "");

  return `${formatted} น.`;
}

export default function WorkAssignment({
  empCode,
  displayName,
  unitCode = null,
  unitName = null,
  checkin = null,
  checkout = null,
  initialWorkItems,
  busy = false,
  onBack,
  onSave,
}: Props) {
  const preparedInitialItems = useMemo<WorkItem[]>(() => {
    if (!initialWorkItems?.length) {
      return DEFAULT_WORK_ITEMS;
    }

    return initialWorkItems.map((item) => ({
      id: item.id ?? createWorkItemId(),
      workItemTypeId: item.workItemTypeId ?? null,
      workItemCode: item.workItemCode ?? "",
      workItemDetail: item.workItemDetail ?? "",
      requireDetail: item.requireDetail ?? false,
      title: item.title.trim(),
      imageName: item.imageName ?? "",
      imageDataUrl: item.imageDataUrl ?? "",
    }));
  }, [initialWorkItems]);

  const [purposeOptions, setPurposeOptions] = useState<
    WorkReportPurposeResponse[]
  >([]);
  const [workItemTypeOptions, setWorkItemTypeOptions] = useState<
    WorkReportItemTypeResponse[]
  >([]);
  const [purposeId, setPurposeId] = useState<number | null>(null);
  const [workItems, setWorkItems] = useState<WorkItem[]>(preparedInitialItems);
  const additionalNote = "";
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [masterDataLoading, setMasterDataLoading] = useState(true);
  const [masterDataError, setMasterDataError] = useState("");
  const [internalBusy, setInternalBusy] = useState(false);
  const [error, setError] = useState("");

  const isBusy = busy || internalBusy;
  const unitDisplay = [unitCode, unitName]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(" - ");

  useEffect(() => {
    let active = true;

    async function loadMasterData() {
      setMasterDataLoading(true);
      setMasterDataError("");

      try {
        const [purposeData, workItemTypeData] = await Promise.all([
          workReportService.getWorkReportPurposes(),
          workReportService.getWorkReportItemTypes(),
        ]);

        if (!Array.isArray(purposeData) || !Array.isArray(workItemTypeData)) {
          throw new Error("รูปแบบข้อมูลรายการจากระบบไม่ถูกต้อง");
        }

        const activePurposes = purposeData
          .filter((item) => item.is_active)
          .sort((a, b) => a.display_order - b.display_order);
        const activeWorkItemTypes = workItemTypeData
          .filter((item) => item.is_active)
          .sort((a, b) => a.display_order - b.display_order);

        if (!active) return;

        setPurposeOptions(activePurposes);
        setWorkItemTypeOptions(activeWorkItemTypes);
        setPurposeId((current) => {
          if (
            current !== null &&
            activePurposes.some((item) => item.purpose_id === current)
          ) {
            return current;
          }

          return activePurposes[0]?.purpose_id ?? null;
        });
      } catch (loadError) {
        if (!active) return;

        setPurposeOptions([]);
        setWorkItemTypeOptions([]);
        setPurposeId(null);
        setMasterDataError(
          loadError instanceof Error
            ? loadError.message
            : "โหลดข้อมูลรายการจากระบบไม่สำเร็จ",
        );
      } finally {
        if (active) {
          setMasterDataLoading(false);
        }
      }
    }

    void loadMasterData();

    return () => {
      active = false;
    };
  }, []);

  function openAddModal() {
    setError("");
    setAddModalOpen(true);
  }

  function closeAddModal() {
    if (isBusy) return;

    setAddModalOpen(false);
  }

  function saveWorkItemFromModal(item: WorkItemModalValue) {
    setPurposeId(item.purposeId);
    setWorkItems((current) => [
      ...current,
      {
        id: createWorkItemId(),
        workItemTypeId: item.workItemTypeId,
        workItemCode: item.workItemCode,
        workItemDetail: item.workItemDetail,
        requireDetail: item.requireDetail,
        title: item.title,
        imageName: item.imageName,
        imageDataUrl: item.imageDataUrl,
      },
    ]);
    setAddModalOpen(false);
    setError("");
  }

  function removeWorkItem(id: string) {
    setWorkItems((current) => current.filter((item) => item.id !== id));
    setError("");
  }

  async function handleImageChange(
    id: string,
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];

    event.target.value = "";

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("กรุณาเลือกไฟล์รูปภาพเท่านั้น");
      return;
    }

    setError("");

    try {
      const imageDataUrl = await readFileAsDataUrl(file);

      setWorkItems((current) =>
        current.map((item) =>
          item.id === id
            ? {
                ...item,
                imageName: file.name,
                imageDataUrl,
              }
            : item,
        ),
      );
    } catch (readError) {
      setError(
        readError instanceof Error
          ? readError.message
          : "อ่านไฟล์รูปภาพไม่สำเร็จ",
      );
    }
  }

  async function handleSave(mode: SaveMode) {
    if (isBusy || masterDataLoading) return;

    const purposeOption = purposeOptions.find(
      (option) => option.purpose_id === purposeId,
    );

    if (!purposeOption) {
      setError("กรุณาเลือกวัตถุประสงค์การเข้าหน่วยงาน");
      return;
    }

    setInternalBusy(true);
    setError("");

    try {
      await onSave(
        {
          purposeId: purposeOption.purpose_id,
          purpose: purposeOption.purpose_code,
          purposeLabel: purposeOption.purpose_name,
          workItems,
          additionalNote: additionalNote.trim(),
        },
        mode,
      );
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "บันทึกข้อมูลไม่สำเร็จ กรุณาลองใหม่",
      );
    } finally {
      setInternalBusy(false);
    }
  }

  return (
    <>
      <main className="guts-bg">
        <div className="guts-home">
          <section
            className={`guts-home-card ${styles.pageCard}`}
            aria-label="บันทึกการเข้าหน่วยงาน"
          >
            <Header empCode={empCode} displayName={displayName} />

            <h2 className={styles.pageTitle}>
              หน้าจอ – บันทึกรายงาน (ติดตาม/มอบหมาย)
            </h2>

            {unitDisplay ? (
              <div className={styles.unitStatus}>
                <div className={styles.unitName}>{unitDisplay}</div>
                <div>
                  เวลาเข้า : {formatThaiDateTime(checkin)} เวลาออก :{" "}
                  {formatThaiDateTime(checkout)}
                </div>
              </div>
            ) : null}

            <div className={styles.formCard} style={{ borderRadius: 0 }}>
              <section className={styles.formSection}>
                <h3
                  className={styles.sectionTitle}
                  style={{ borderRadius: 0 }}
                >
                  ขั้นตอนที่ 1. กดเพิ่มบันทึกรายงาน
                </h3>

                <button
                  type="button"
                  className={styles.addButton}
                  onClick={openAddModal}
                  disabled={
                    isBusy ||
                    masterDataLoading ||
                    purposeOptions.length === 0 ||
                    workItemTypeOptions.length === 0
                  }
                >
                  <FontAwesomeIcon icon={faPlus} />
                  กดเพิ่มข้อมูล
                </button>

                <div
                  className={styles.workItemList}
                  style={{ borderRadius: 0 }}
                >
                  {workItems.length > 0 ? (
                    workItems.map((item, index) => (
                      <div className={styles.workItemRow} key={item.id}>
                        <div className={styles.workItemNumber}>
                          2.{index + 1}
                        </div>

                        <div className={styles.workItemTitle}>{item.title}</div>

                        <div
                          className={styles.imagePreview}
                          title={item.imageName || "ยังไม่ได้เลือกรูปภาพ"}
                        >
                          {item.imageDataUrl ? (
                            <img
                              src={item.imageDataUrl}
                              alt={`ภาพประกอบ ${item.title}`}
                            />
                          ) : (
                            <FontAwesomeIcon icon={faImage} />
                          )}
                        </div>

                        <label className={styles.imagePicker}>
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={(event) =>
                              void handleImageChange(item.id, event)
                            }
                            disabled={isBusy}
                          />
                          {item.imageDataUrl ? "เปลี่ยนรูปภาพ" : "เลือกรูปภาพ"}
                        </label>

                        <button
                          type="button"
                          className={styles.deleteButton}
                          onClick={() => removeWorkItem(item.id)}
                          disabled={isBusy}
                          aria-label={`ลบรายการ ${item.title}`}
                        >
                          <FontAwesomeIcon icon={faTrashCan} />
                          <span>ลบ</span>
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className={styles.emptyItems}>
                      ยังไม่มีรายการที่ดำเนินการ
                    </div>
                  )}
                </div>
              </section>

              {masterDataError ? (
                <div className={styles.errorMessage} role="alert">
                  {masterDataError}
                </div>
              ) : null}

              {error ? (
                <div className={styles.errorMessage} role="alert">
                  {error}
                </div>
              ) : null}

              <div className={styles.actionArea}>
                <button
                  type="button"
                  className={styles.saveStayButton}
                  onClick={() => void handleSave("stay")}
                  disabled={isBusy || masterDataLoading || purposeId === null}
                >
                  {isBusy ? "กำลังบันทึก..." : "บันทึกแต่ยังไม่ออกงาน"}
                </button>

                <button
                  type="button"
                  className={styles.saveCheckoutButton}
                  onClick={() => void handleSave("checkout")}
                  disabled={isBusy || masterDataLoading || purposeId === null}
                >
                  {isBusy ? "กำลังบันทึก..." : "บันทึกและออกงาน"}
                </button>

                <div className={styles.backButtonWrap}>
                  <BackButton
                    onClick={onBack}
                    disabled={isBusy}
                    className={styles.backButton}
                  />
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      {addModalOpen ? (
        <WorkItemModal
          itemNumber={workItems.length + 1}
          purposeOptions={purposeOptions}
          workItemTypeOptions={workItemTypeOptions}
          initialPurposeId={purposeId}
          busy={isBusy}
          onClose={closeAddModal}
          onSave={saveWorkItemFromModal}
        />
      ) : null}
    </>
  );
}