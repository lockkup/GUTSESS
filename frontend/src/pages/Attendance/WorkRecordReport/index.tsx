import { useEffect, useMemo, useState } from "react";

import Header from "@/layout/Header";
import SignatureModal from "@/components/RecordReport/SignatureModal";
import type { SignatureModalValue } from "@/components/RecordReport/SignatureModal";
import WorkItemModal from "@/components/RecordReport/WorkItemModal";
import type { WorkItemModalValue } from "@/components/RecordReport/WorkItemModal";
import RecordDetailModal from "@/components/RecordReport/RecordDetailModal";
import UnsavedChangesModal from "@/components/RecordReport/UnsavedChangesModal";
import WorkReportSuccessModal from "@/components/RecordReport/WorkReportSuccessModal";

import { workReportService } from "@/services/workReport.service";
import type {
  WorkReportItemTypeResponse,
  WorkReportPurposeResponse,
  WorkReportUpdate,
} from "@/types/workReport";

import styles from "./WorkRecordReport.module.css";

type SectionKey =
  | "section1"
  | "section2"
  | "summary"
  | "section3"
  | "section4"
  | "section5";

type OpenSections = Record<SectionKey, boolean>;

type Props = {
  empCode: string;
  displayName?: string;

  unitCode?: string | null;
  unitName?: string | null;
  routeLabel?: string | null;
  employeePosition?: string | null;

  /**
   * time_record_id ของ Attendance ที่กำลังเปิดบันทึกรายงาน
   * ใช้เชื่อม WorkRecordReport กับ work_report
   */
  timeRecordId?: number | null;

  /**
   * true เฉพาะกรณีเข้าหน้านี้จากปุ่ม "กดลงเวลาออก"
   * ในหน้าเลือกหน่วยงาน
   */
  isCheckoutFlow?: boolean;

  onBack: () => void;
  onSaveAndCheckout?: () => void;

  /**
   * เรียกหลังบันทึกรายงานลง Backend สำเร็จ
   * ใช้ให้ App.tsx Refresh ประวัติและ Sync สถานะไปยังแท็บอื่น
   */
  onSaved?: () => void | Promise<void>;
};

type WorkItem = {
  id: string;
  workReportItemId: number | null;
  workItemTypeId: number;
  workItemCode: string;
  workItemOther: string;
  workItemDetail: string;
  requireDetail: boolean;
  title: string;
  imageName: string;
  imageDataUrl: string;
  imageNames?: string[];
  imageDataUrls?: string[];

  /**
   * time_record_image_id ของรูปใน imageDataUrls ตามตำแหน่งเดียวกัน
   * - number = รูปเดิมที่บันทึกอยู่บน Backend
   * - null = รูปใหม่ที่ยังไม่ได้บันทึก
   */
  imageIds?: Array<number | null>;

  /**
   * time_record_image_id ของรูปเดิมที่ผู้ใช้ลบหรือกดเปลี่ยน
   * Backend จะจัดการเฉพาะรูปเหล่านี้ตอนกดบันทึกรายงาน
   */
  deletedImageIds?: number[];

  /**
   * รูปชุดล่าสุดที่บันทึกอยู่บน Backend
   * ใช้ตรวจว่าผู้ใช้แก้ไข/เพิ่ม/ลบรูปใน Modal หรือไม่
   */
  persistedImageDataUrls?: string[];
};

type DetailSection = "section3" | "section4";

type DetailItem = {
  id: string;
  workReportDetailId: number | null;
  detail: string;
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

/**
 * false = แสดงเฉพาะข้อมูลส่วนหัว + ข้อ 2
 * true  = เปิดหัวข้อเดิม ข้อ 1 / สรุปข้อ 3-4 / ข้อ 5 กลับมาใช้งาน
 */
const SHOW_FUTURE_SECTIONS = false;

/**
 * false = ซ่อนข้อมูลผู้บันทึกรายงานไว้ก่อน
 * true  = แสดงผู้บันทึกรายงาน / ชื่อ-นามสกุล / ตำแหน่ง / วันเวลาที่บันทึกล่าสุด
 */
const SHOW_RECORDER_INFO = false;

function formatThaiDateTime(date: Date) {
  return `วัน ${THAI_DAYS[date.getDay()]} ที่ ${date.getDate()} ${
    THAI_MONTHS[date.getMonth()]
  } ${date.getFullYear() + 543} เวลาขณะนี้ ${String(
    date.getHours(),
  ).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function formatSignatureDateTime(date: Date) {
  return `วันที่เซ็น วัน ${THAI_DAYS[date.getDay()]} ที่ ${date.getDate()} ${
    THAI_MONTHS[date.getMonth()]
  } ${date.getFullYear() + 543} เวลาขณะนี้ ${String(
    date.getHours(),
  ).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function formatReportSavedDateTime(date: Date) {
  return `วันที่ ${THAI_DAYS[date.getDay()]} ที่ ${date.getDate()} ${
    THAI_MONTHS[date.getMonth()]
  } ${date.getFullYear() + 543} เวลา ${String(date.getHours()).padStart(
    2,
    "0",
  )}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function getSignatureDateTime(value: unknown): string | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const signatureDateTime = (
    value as { signature_datetime?: unknown }
  ).signature_datetime;

  return typeof signatureDateTime === "string" && signatureDateTime.trim()
    ? signatureDateTime.trim()
    : null;
}

function getDocumentNo(value: unknown): string | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const documentNo = (value as { document_no?: unknown }).document_no;

  return typeof documentNo === "string" && documentNo.trim()
    ? documentNo.trim()
    : null;
}


function getApiOriginForSignature() {
  const apiBaseUrl = String(import.meta.env.VITE_API_BASE_URL ?? "").trim();

  if (!apiBaseUrl) {
    return "";
  }

  return apiBaseUrl
    .replace(/\/api(?:\/v\d+)?\/?$/i, "")
    .replace(/\/$/, "");
}


function resolveSignatureImageUrl(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  const imageValue = String(value).trim();

  if (!imageValue) {
    return "";
  }

  if (
    /^data:image\/[a-zA-Z0-9.+-]+;base64,/i.test(imageValue) ||
    imageValue.startsWith("blob:") ||
    /^https?:\/\//i.test(imageValue)
  ) {
    return imageValue;
  }

  const normalizedPath = imageValue.replace(/\\/g, "/");
  const apiOrigin = getApiOriginForSignature();

  if (
    normalizedPath.startsWith("/uploads/") ||
    normalizedPath.startsWith("uploads/")
  ) {
    const uploadPath = normalizedPath.startsWith("/")
      ? normalizedPath
      : `/${normalizedPath}`;

    return apiOrigin ? `${apiOrigin}${uploadPath}` : uploadPath;
  }

  if (!apiOrigin) {
    return normalizedPath.startsWith("/")
      ? normalizedPath
      : `/${normalizedPath}`;
  }

  return normalizedPath.startsWith("/")
    ? `${apiOrigin}${normalizedPath}`
    : `${apiOrigin}/${normalizedPath}`;
}


function isSignatureBase64DataUrl(value: string | null | undefined) {
  return Boolean(
    value &&
      /^data:image\/(?:jpeg|jpg|png|webp);base64,/i.test(value.trim()),
  );
}


function areImageSourcesEqual(
  currentValues: string[],
  persistedValues: string[],
) {
  return (
    currentValues.length === persistedValues.length &&
    currentValues.every(
      (value, index) => value === persistedValues[index],
    )
  );
}


function getImageFileName(
  imagePath: string,
  fallbackIndex: number,
) {
  const normalizedPath = imagePath.replace(/\\/g, "/");
  const fileName = normalizedPath.split("/").filter(Boolean).pop();

  return fileName || `image-${fallbackIndex + 1}`;
}


async function imageSourceToBase64(imageSource: string) {
  const cleanedValue = imageSource.trim();

  if (!cleanedValue) {
    throw new Error("พบข้อมูลรูปภาพว่างเปล่า");
  }

  if (isSignatureBase64DataUrl(cleanedValue)) {
    return cleanedValue;
  }

  const response = await fetch(cleanedValue, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(
      `ไม่สามารถอ่านรูปภาพเดิมได้ (HTTP ${response.status})`,
    );
  }

  const imageBlob = await response.blob();

  if (!imageBlob.type.startsWith("image/")) {
    throw new Error("ไฟล์รูปภาพเดิมมีชนิดข้อมูลไม่ถูกต้อง");
  }

  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = String(reader.result ?? "");

      if (!isSignatureBase64DataUrl(result)) {
        reject(new Error("แปลงรูปภาพเดิมเป็น Base64 ไม่สำเร็จ"));
        return;
      }

      resolve(result);
    };

    reader.onerror = () => {
      reject(new Error("อ่านไฟล์รูปภาพเดิมไม่สำเร็จ"));
    };

    reader.readAsDataURL(imageBlob);
  });
}


function createWorkItemId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}


function isWorkReportNotFoundError(error: unknown) {
  if (error instanceof Error) {
    const message = error.message;

    return (
      message.includes("HTTP 404") ||
      message.includes("404") ||
      message.includes("Not Found") ||
      message.includes("Work report not found") ||
      message.includes("ไม่พบข้อมูล") ||
      message.includes("ไม่พบรายการ")
    );
  }

  return false;
}

type PersistedFormSnapshotInput = {
  normalPlanChecked: boolean;
  meetClientChecked: boolean;
  otherAssignmentChecked: boolean;
  otherAssignmentDetail: string;
  signatureValue: SignatureModalValue | null;
  workItems: WorkItem[];
  section3Items: DetailItem[];
  section4Items: DetailItem[];
};

function createPersistedFormSnapshot(
  value: PersistedFormSnapshotInput,
) {
  return JSON.stringify({
    normalPlanChecked: value.normalPlanChecked,
    meetClientChecked: value.meetClientChecked,
    otherAssignmentChecked: value.otherAssignmentChecked,
    otherAssignmentDetail: value.otherAssignmentDetail,
    signatureValue: value.signatureValue
      ? {
          firstName: value.signatureValue.firstName,
          lastName: value.signatureValue.lastName,
          position: value.signatureValue.position,
          signatureDataUrl: value.signatureValue.signatureDataUrl,
        }
      : null,
    workItems: value.workItems.map((item) => ({
      workReportItemId: item.workReportItemId,
      workItemTypeId: item.workItemTypeId,
      workItemCode: item.workItemCode,
      workItemOther: item.workItemOther,
      workItemDetail: item.workItemDetail,
      requireDetail: item.requireDetail,
      title: item.title,
      imageNames: item.imageNames ?? [],
      imageDataUrls: item.imageDataUrls ?? [],
    })),
    section3Items: value.section3Items.map((item) => ({
      workReportDetailId: item.workReportDetailId,
      detail: item.detail,
    })),
    section4Items: value.section4Items.map((item) => ({
      workReportDetailId: item.workReportDetailId,
      detail: item.detail,
    })),
  });
}

export default function WorkRecordReport({
  empCode,
  displayName,
  unitCode = null,
  unitName = null,
  routeLabel = null,
  employeePosition = null,
  timeRecordId = null,
  isCheckoutFlow = false,
  onBack,
  onSaveAndCheckout,
  onSaved,
}: Props) {
  const unitDisplay = useMemo(() => {
    return [unitCode, unitName]
      .filter((value): value is string => Boolean(value?.trim()))
      .join(" - ");
  }, [unitCode, unitName]);

  const currentRecorderName = useMemo(() => {
    const normalizedDisplayName = displayName?.trim() ?? "";

    if (!normalizedDisplayName) {
      return empCode;
    }

    if (normalizedDisplayName.startsWith(empCode)) {
      const nameWithoutEmployeeCode = normalizedDisplayName
        .slice(empCode.length)
        .replace(/^[\s\-–—:]+/, "")
        .trim();

      return nameWithoutEmployeeCode || normalizedDisplayName;
    }

    return normalizedDisplayName;
  }, [displayName, empCode]);

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

  const [purposeOptions, setPurposeOptions] = useState<
    WorkReportPurposeResponse[]
  >([]);

  const [workItemTypeOptions, setWorkItemTypeOptions] = useState<
    WorkReportItemTypeResponse[]
  >([]);

  const [purposeId, setPurposeId] = useState<number | null>(null);

  const [normalPlanChecked, setNormalPlanChecked] = useState(false);
  const [meetClientChecked, setMeetClientChecked] = useState(false);

  const [workItems, setWorkItems] = useState<WorkItem[]>([]);

  /**
   * work_report_item_id ที่ผู้ใช้กดลบจากหน้าจอ
   * ยังไม่ลบ Backend ทันที เพื่อให้ปุ่มยกเลิก/ย้อนกลับยังไม่ทำลายข้อมูลจริง
   * จะลบจริงเมื่อกดบันทึกรายงานหรือบันทึกและลงเวลาออกงาน
   */
  const [deletedWorkReportItemIds, setDeletedWorkReportItemIds] = useState<
    number[]
  >([]);

  const [workItemModalOpen, setWorkItemModalOpen] = useState(false);
  const [editingWorkItemId, setEditingWorkItemId] = useState<string | null>(
    null,
  );

  const [section3Items, setSection3Items] = useState<DetailItem[]>([]);
  const [section4Items, setSection4Items] = useState<DetailItem[]>([]);
  const [deletedWorkReportDetailIds, setDeletedWorkReportDetailIds] = useState<
    number[]
  >([]);
  const [detailModalSection, setDetailModalSection] =
    useState<DetailSection | null>(null);
  const [editingDetailItemId, setEditingDetailItemId] = useState<string | null>(
    null,
  );

  const [signatureModalOpen, setSignatureModalOpen] = useState(false);
  const [signatureValue, setSignatureValue] =
    useState<SignatureModalValue | null>(null);
  const [signatureDateTimeText, setSignatureDateTimeText] = useState<string | null>(
    null,
  );

  const [otherAssignmentChecked, setOtherAssignmentChecked] = useState(false);
  const [otherAssignmentDetail, setOtherAssignmentDetail] = useState("");

  const [masterDataLoading, setMasterDataLoading] = useState(true);
  const [masterDataError, setMasterDataError] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [workReportId, setWorkReportId] = useState<number | null>(null);
  const [documentNo, setDocumentNo] = useState<string | null>(null);
  const [lastSavedEmployeeCode, setLastSavedEmployeeCode] = useState<
    string | null
  >(null);
  const [lastSavedDateTimeText, setLastSavedDateTimeText] = useState<
    string | null
  >(null);

  /**
   * work_report_id อาจถูกสร้างไว้ล่วงหน้าหลังลงเวลาเข้า
   * ดังนั้นการมี workReportId ไม่ได้แปลว่า "ผู้ใช้บันทึกรายงานแล้ว"
   */
  const [hasSavedReportData, setHasSavedReportData] = useState(false);

  /**
   * Snapshot ของข้อมูลที่บันทึกอยู่จริงล่าสุด
   * ใช้เปรียบเทียบเพื่อเตือนเมื่อกำลังออกจากหน้าโดยยังไม่บันทึก
   */
  const [savedFormSnapshot, setSavedFormSnapshot] = useState<string | null>(
    null,
  );
  const [unsavedPromptOpen, setUnsavedPromptOpen] = useState(false);
  const [saveSuccessModalOpen, setSaveSuccessModalOpen] = useState(false);
  const [backAfterSaveSuccess, setBackAfterSaveSuccess] = useState(false);

  const [managerWaitingReview, setManagerWaitingReview] = useState(false);
  const [managerReviewed, setManagerReviewed] = useState(false);
  const [assistantWaitingReview, setAssistantWaitingReview] = useState(false);
  const [assistantReviewed, setAssistantReviewed] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setDateTimeText(formatThaiDateTime(new Date()));
    }, 30_000);

    return () => window.clearInterval(timer);
  }, []);

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
        setPurposeId(activePurposes[0]?.purpose_id ?? null);
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

  useEffect(() => {
    if (
      timeRecordId === null ||
      masterDataLoading ||
      purposeOptions.length === 0
    ) {
      return;
    }

    const currentTimeRecordId = timeRecordId;
    let active = true;

    function resetReportForm() {
      const emptySnapshot = createPersistedFormSnapshot({
        normalPlanChecked: false,
        meetClientChecked: false,
        otherAssignmentChecked: false,
        otherAssignmentDetail: "",
        signatureValue: null,
        workItems: [],
        section3Items: [],
        section4Items: [],
      });

      setWorkReportId(null);
      setDocumentNo(null);
      setLastSavedEmployeeCode(null);
      setLastSavedDateTimeText(null);
      setNormalPlanChecked(false);
      setMeetClientChecked(false);
      setOtherAssignmentChecked(false);
      setOtherAssignmentDetail("");
      setSignatureValue(null);
      setSignatureDateTimeText(null);
      setWorkItems([]);
      setDeletedWorkReportItemIds([]);
      setSection3Items([]);
      setSection4Items([]);
      setDeletedWorkReportDetailIds([]);
      setHasSavedReportData(false);
      setSavedFormSnapshot(emptySnapshot);
      setUnsavedPromptOpen(false);
      setSaveSuccessModalOpen(false);
      setBackAfterSaveSuccess(false);
    }

    async function loadExistingReport() {
      setIsLoadingReport(true);
      setError("");

      try {
        const report =
          await workReportService.getWorkReportByTimeRecordId(
            currentTimeRecordId,
          );

        if (!active) return;

        setWorkReportId(report.work_report_id);
        setDocumentNo(getDocumentNo(report));

        const normalPlanPurpose = purposeOptions.find(
          (item) => item.purpose_code === "normal_plan",
        );
        const meetClientPurpose = purposeOptions.find(
          (item) => item.purpose_code === "meet_client",
        );
        const otherAssignmentPurpose = purposeOptions.find(
          (item) => item.purpose_code === "other_assignment",
        );

        const selectedPurposeIds = new Set(
          report.purpose_selections
            .filter((item) => item.is_active && !item.mark_flag)
            .map((item) => item.purpose_id),
        );

        const loadedNormalPlanChecked = normalPlanPurpose
          ? selectedPurposeIds.has(normalPlanPurpose.purpose_id)
          : false;

        const loadedMeetClientChecked = meetClientPurpose
          ? selectedPurposeIds.has(meetClientPurpose.purpose_id)
          : false;

        setNormalPlanChecked(loadedNormalPlanChecked);
        setMeetClientChecked(loadedMeetClientChecked);

        const otherSelection = otherAssignmentPurpose
          ? report.purpose_selections.find(
              (item) =>
                item.purpose_id === otherAssignmentPurpose.purpose_id &&
                item.is_active &&
                !item.mark_flag,
            )
          : undefined;

        const loadedOtherAssignmentChecked = Boolean(otherSelection);
        const loadedOtherAssignmentDetail =
          otherSelection?.purpose_detail ?? "";

        setOtherAssignmentChecked(loadedOtherAssignmentChecked);
        setOtherAssignmentDetail(loadedOtherAssignmentDetail);

        setPurposeId(
          report.purpose_selections.find(
            (item) => item.is_active && !item.mark_flag,
          )?.purpose_id ??
            purposeOptions[0]?.purpose_id ??
            null,
        );

        const hasClientData = Boolean(
          report.client_first_name ||
            report.client_last_name ||
            report.client_position ||
            report.signature_path,
        );

        const loadedSignatureValue: SignatureModalValue | null =
          hasClientData
            ? {
                firstName: report.client_first_name ?? "",
                lastName: report.client_last_name ?? "",
                position: report.client_position ?? "",
                signatureDataUrl: resolveSignatureImageUrl(
                  report.signature_path,
                ),
              }
            : null;

        setSignatureValue(loadedSignatureValue);

        const savedSignatureDateTime = getSignatureDateTime(report);

        if (savedSignatureDateTime) {
          const signatureDate = new Date(savedSignatureDateTime);

          setSignatureDateTimeText(
            Number.isNaN(signatureDate.getTime())
              ? null
              : formatSignatureDateTime(signatureDate),
          );
        } else {
          setSignatureDateTimeText(null);
        }

        const savedWorkReportItems =
          await workReportService.getWorkReportItems({
            work_report_id: report.work_report_id,
            is_active: true,
            include_deleted: false,
          });

        if (!active) return;

        const loadedWorkItems: WorkItem[] = await Promise.all(
          savedWorkReportItems
            .slice()
            .sort((a, b) => a.sequence_no - b.sequence_no)
            .map(async (savedItem) => {
              const itemType = workItemTypeOptions.find(
                (option) =>
                  option.work_item_type_id === savedItem.work_item_type_id,
              );

              const detail = savedItem.work_item_detail?.trim() ?? "";
              const other = savedItem.work_item_other?.trim() ?? "";
              const title = itemType
                ? itemType.work_item_code === "other" && other
                  ? `อื่น ๆ: ${other}`
                  : itemType.require_detail && detail
                  ? `${itemType.work_item_name} - ${detail}`
                  : itemType.work_item_name
                : detail || `รายการ ${savedItem.work_item_type_id}`;

              const savedImages =
                await workReportService.getWorkReportItemImages(
                  savedItem.work_report_item_id,
                );

              const sortedImages = savedImages
                .slice()
                .sort((a, b) => a.sequence_no - b.sequence_no);

              const imageNames = sortedImages.map(
                (image, index) =>
                  getImageFileName(image.image_path, index),
              );

              const imageDataUrls = sortedImages.map((image) =>
                resolveSignatureImageUrl(image.image_path),
              );

              const imageIds = sortedImages.map(
                (image) => image.time_record_image_id,
              );

              return {
                id: `db-${savedItem.work_report_item_id}`,
                workReportItemId: savedItem.work_report_item_id,
                workItemTypeId: savedItem.work_item_type_id,
                workItemCode: itemType?.work_item_code ?? "",
                workItemOther: other,
                workItemDetail: detail,
                requireDetail: itemType?.require_detail ?? false,
                title,
                imageName: imageNames[0] ?? "",
                imageDataUrl: imageDataUrls[0] ?? "",
                imageNames,
                imageDataUrls,
                imageIds,
                deletedImageIds: [],
                persistedImageDataUrls: imageDataUrls,
              };
            }),
        );

        if (!active) return;

        const savedWorkReportDetails =
          await workReportService.getWorkReportDetails({
            work_report_id: report.work_report_id,
            is_active: true,
            include_deleted: false,
          });

        if (!active) return;

        const loadedSection3Items: DetailItem[] = savedWorkReportDetails
          .filter((item) => item.section_no === 3)
          .slice()
          .sort((a, b) => a.sequence_no - b.sequence_no)
          .map((item) => ({
            id: `db-detail-${item.work_report_detail_id}`,
            workReportDetailId: item.work_report_detail_id,
            detail: item.detail,
          }));

        const loadedSection4Items: DetailItem[] = savedWorkReportDetails
          .filter((item) => item.section_no === 4)
          .slice()
          .sort((a, b) => a.sequence_no - b.sequence_no)
          .map((item) => ({
            id: `db-detail-${item.work_report_detail_id}`,
            workReportDetailId: item.work_report_detail_id,
            detail: item.detail,
          }));

        const loadedHasSavedReportData =
          selectedPurposeIds.size > 0 ||
          Boolean(
            report.client_first_name ||
              report.client_last_name ||
              report.client_position ||
              report.signature_path ||
              report.additional_note,
          ) ||
          loadedWorkItems.length > 0 ||
          loadedSection3Items.length > 0 ||
          loadedSection4Items.length > 0;

        const loadedSnapshot = createPersistedFormSnapshot({
          normalPlanChecked: loadedNormalPlanChecked,
          meetClientChecked: loadedMeetClientChecked,
          otherAssignmentChecked: loadedOtherAssignmentChecked,
          otherAssignmentDetail: loadedOtherAssignmentDetail,
          signatureValue: loadedSignatureValue,
          workItems: loadedWorkItems,
          section3Items: loadedSection3Items,
          section4Items: loadedSection4Items,
        });

        if (loadedHasSavedReportData) {
          const savedEmployeeCode =
            report.updated_by?.trim() || report.created_by?.trim() || null;
          const savedDateTimeValue = report.updated_by
            ? report.updated_at
            : report.created_at;
          const savedDateTime = new Date(savedDateTimeValue);

          setLastSavedEmployeeCode(savedEmployeeCode);
          setLastSavedDateTimeText(
            Number.isNaN(savedDateTime.getTime())
              ? null
              : formatReportSavedDateTime(savedDateTime),
          );
        } else {
          setLastSavedEmployeeCode(null);
          setLastSavedDateTimeText(null);
        }

        setWorkItems(loadedWorkItems);
        setSection3Items(loadedSection3Items);
        setSection4Items(loadedSection4Items);
        setDeletedWorkReportDetailIds([]);
        setHasSavedReportData(loadedHasSavedReportData);
        setSavedFormSnapshot(loadedSnapshot);
        setUnsavedPromptOpen(false);
      } catch (loadError) {
        if (!active) return;

        if (isWorkReportNotFoundError(loadError)) {
          resetReportForm();
          return;
        }

        console.error("Load work report error:", loadError);

        resetReportForm();
        setError(
          loadError instanceof Error
            ? loadError.message
            : "โหลดข้อมูลรายงานไม่สำเร็จ",
        );
      } finally {
        if (active) {
          setIsLoadingReport(false);
        }
      }
    }

    resetReportForm();
    void loadExistingReport();

    return () => {
      active = false;
    };
  }, [
    masterDataLoading,
    purposeOptions,
    timeRecordId,
    workItemTypeOptions,
  ]);

  const currentFormSnapshot = useMemo(
    () =>
      createPersistedFormSnapshot({
        normalPlanChecked,
        meetClientChecked,
        otherAssignmentChecked,
        otherAssignmentDetail,
        signatureValue,
        workItems,
        section3Items,
        section4Items,
      }),
    [
      normalPlanChecked,
      meetClientChecked,
      otherAssignmentChecked,
      otherAssignmentDetail,
      signatureValue,
      workItems,
      section3Items,
      section4Items,
    ],
  );

  const isDirty =
    savedFormSnapshot !== null &&
    currentFormSnapshot !== savedFormSnapshot;

  useEffect(() => {
    if (!isDirty) {
      return;
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isDirty]);

  function toggleSection(section: SectionKey) {
    setOpenSections((current) => ({
      ...current,
      [section]: !current[section],
    }));
  }

  function openSignatureModal() {
    setSignatureModalOpen(true);
  }

  function closeSignatureModal() {
    setSignatureModalOpen(false);
  }

  function saveSignature(value: SignatureModalValue) {
    setSignatureValue(value);
    setSignatureDateTimeText(formatSignatureDateTime(new Date()));
    setSignatureModalOpen(false);
  }

  function openWorkItemModal(itemId: string | null = null) {
    if (
      masterDataLoading ||
      purposeOptions.length === 0 ||
      workItemTypeOptions.length === 0
    ) {
      return;
    }

    setEditingWorkItemId(itemId);
    setError("");
    setWorkItemModalOpen(true);
  }

  function closeWorkItemModal() {
    setWorkItemModalOpen(false);
    setEditingWorkItemId(null);
  }

  function saveWorkItemFromModal(item: WorkItemModalValue) {
    setPurposeId(item.purposeId);

    const currentEditingItem =
      editingWorkItemId === null
        ? null
        : workItems.find(
            (currentItem) => currentItem.id === editingWorkItemId,
          ) ?? null;

    const nextItem: WorkItem = {
      id: editingWorkItemId ?? createWorkItemId(),
      workReportItemId: currentEditingItem?.workReportItemId ?? null,
      workItemTypeId: item.workItemTypeId,
      workItemCode: item.workItemCode,
      workItemOther: item.workItemOther,
      workItemDetail: item.workItemDetail,
      requireDetail: item.requireDetail,
      title: item.title,
      imageName: item.imageName,
      imageDataUrl: item.imageDataUrl,
      imageNames: item.imageNames,
      imageDataUrls: item.imageDataUrls,
      imageIds: item.imageIds,
      deletedImageIds: item.deletedImageIds ?? [],
      persistedImageDataUrls:
        currentEditingItem?.persistedImageDataUrls ?? [],
    };

    if (editingWorkItemId) {
      setWorkItems((current) =>
        current.map((currentItem) =>
          currentItem.id === editingWorkItemId ? nextItem : currentItem,
        ),
      );
    } else {
      setWorkItems((current) => [...current, nextItem]);
    }

    setWorkItemModalOpen(false);
    setEditingWorkItemId(null);
    setError("");
  }

  function removeWorkItem(id: string) {
    const removingItem =
      workItems.find((item) => item.id === id) ?? null;

    /**
     * ถ้าเป็นรายการที่เคยบันทึก Backend แล้ว
     * ให้จำ work_report_item_id ไว้ก่อน แล้วค่อย soft delete ตอนกดบันทึก
     *
     * ถ้าเป็นรายการใหม่ที่ยังไม่มี workReportItemId
     * ลบออกจาก state ได้เลย เพราะยังไม่มี row ในฐานข้อมูล
     */
    if (
      removingItem?.workReportItemId !== null &&
      removingItem?.workReportItemId !== undefined
    ) {
      const workReportItemId = removingItem.workReportItemId;

      setDeletedWorkReportItemIds((current) => {
        if (current.includes(workReportItemId)) {
          return current;
        }

        return [...current, workReportItemId];
      });
    }

    setWorkItems((current) =>
      current.filter((item) => item.id !== id),
    );

    setError("");
  }

  function openDetailModal(
    section: DetailSection,
    itemId: string | null = null,
  ) {
    setEditingDetailItemId(itemId);
    setError("");
    setDetailModalSection(section);
  }

  function closeDetailModal() {
    setDetailModalSection(null);
    setEditingDetailItemId(null);
  }

  function saveDetailItem(detail: string) {
    const cleanDetail = detail.trim();

    if (detailModalSection === "section3") {
      if (editingDetailItemId) {
        setSection3Items((current) =>
          current.map((item) =>
            item.id === editingDetailItemId
              ? { ...item, detail: cleanDetail }
              : item,
          ),
        );
      } else {
        setSection3Items((current) => [
          ...current,
          {
            id: createWorkItemId(),
            workReportDetailId: null,
            detail: cleanDetail,
          },
        ]);
      }
    } else if (detailModalSection === "section4") {
      if (editingDetailItemId) {
        setSection4Items((current) =>
          current.map((item) =>
            item.id === editingDetailItemId
              ? { ...item, detail: cleanDetail }
              : item,
          ),
        );
      } else {
        setSection4Items((current) => [
          ...current,
          {
            id: createWorkItemId(),
            workReportDetailId: null,
            detail: cleanDetail,
          },
        ]);
      }
    }

    setDetailModalSection(null);
    setEditingDetailItemId(null);
    setError("");
  }

  function removeDetailItem(section: DetailSection, id: string) {
    const sourceItems =
      section === "section3" ? section3Items : section4Items;

    const removingItem =
      sourceItems.find((item) => item.id === id) ?? null;

    if (
      removingItem?.workReportDetailId !== null &&
      removingItem?.workReportDetailId !== undefined
    ) {
      const workReportDetailId = removingItem.workReportDetailId;

      setDeletedWorkReportDetailIds((current) => {
        if (current.includes(workReportDetailId)) {
          return current;
        }

        return [...current, workReportDetailId];
      });
    }

    if (section === "section3") {
      setSection3Items((current) => current.filter((item) => item.id !== id));
    } else {
      setSection4Items((current) => current.filter((item) => item.id !== id));
    }

    setError("");
  }

  function handleCancel() {
    if (isDirty) {
      setUnsavedPromptOpen(true);
      return;
    }

    onBack();
  }

  function handleStayOnPage() {
    setUnsavedPromptOpen(false);
  }

  function handleDiscardAndBack() {
    setUnsavedPromptOpen(false);
    onBack();
  }

  async function handleSaveBeforeBack() {
    const saved = await saveReport();

    if (!saved) {
      setUnsavedPromptOpen(false);
      return;
    }

    setUnsavedPromptOpen(false);
    setBackAfterSaveSuccess(true);
    setSaveSuccessModalOpen(true);
  }

  async function saveReport(): Promise<boolean> {
    if (timeRecordId === null) {
      setError("ไม่พบ time_record_id สำหรับบันทึกรายงาน");
      return false;
    }

    /**
     * ตอนนี้หน้าจอใช้งานเฉพาะข้อ 2
     * จึงไม่สร้าง/แก้ไข purpose_selections ใน current flow
     *
     * เก็บ logic เดิมไว้สำหรับอนาคต เมื่อเปิด SHOW_FUTURE_SECTIONS = true
     */
    const purposeSelections: NonNullable<
      WorkReportUpdate["purpose_selections"]
    > = [];

    if (SHOW_FUTURE_SECTIONS) {
      const normalPlanPurpose = purposeOptions.find(
        (item) => item.purpose_code === "normal_plan",
      );
      const meetClientPurpose = purposeOptions.find(
        (item) => item.purpose_code === "meet_client",
      );
      const otherAssignmentPurpose = purposeOptions.find(
        (item) => item.purpose_code === "other_assignment",
      );

      if (normalPlanChecked) {
        if (!normalPlanPurpose) {
          setError("ไม่พบวัตถุประสงค์ ผู้ปฏิบัติงานตามแผนปกติ");
          return false;
        }

        purposeSelections.push({
          purpose_id: normalPlanPurpose.purpose_id,
          purpose_detail: null,
        });
      }

      if (meetClientChecked) {
        if (!meetClientPurpose) {
          setError("ไม่พบวัตถุประสงค์ เข้าพบผู้ว่าจ้าง");
          return false;
        }

        purposeSelections.push({
          purpose_id: meetClientPurpose.purpose_id,
          purpose_detail: null,
        });
      }

      if (otherAssignmentChecked) {
        if (!otherAssignmentPurpose) {
          setError("ไม่พบวัตถุประสงค์ ได้รับมอบหมายงานอื่น ๆ");
          return false;
        }

        const purposeDetail = otherAssignmentDetail.trim();

        if (!purposeDetail) {
          setError("กรุณาระบุงานที่ได้รับมอบหมาย");
          return false;
        }

        purposeSelections.push({
          purpose_id: otherAssignmentPurpose.purpose_id,
          purpose_detail: purposeDetail,
        });
      }

      if (purposeSelections.length === 0) {
        setError("กรุณาเลือกบันทึกรายงานอย่างน้อย 1 รายการ");
        return false;
      }
    }

    setError("");
    setIsSaving(true);

    try {
      let savedWorkReportId = workReportId;
      let persistedSignatureValue = signatureValue;
      let persistedWorkItems = workItems;
      let persistedSection3Items = section3Items;
      let persistedSection4Items = section4Items;

      /**
       * ปกติ work_report ถูก ensure ตั้งแต่ Check-in แล้ว
       * แต่เก็บ fallback นี้ไว้สำหรับข้อมูลเก่าหรือกรณีที่ยังไม่มี work_report
       *
       * ensure endpoint สร้าง work_report เปล่าพร้อม document_no
       * โดยไม่ต้องส่ง purpose_selections
       */
      if (savedWorkReportId === null) {
        const ensuredReport =
          await workReportService.ensureWorkReportByTimeRecordId(
            timeRecordId,
          );

        savedWorkReportId = ensuredReport.work_report_id;

        setWorkReportId(ensuredReport.work_report_id);
        setDocumentNo(getDocumentNo(ensuredReport));
      }

      /**
       * บันทึกรายงานหลักก่อนรายการย่อยทุกครั้ง
       * เพื่อให้ backend คืนสถานะรายงานที่ยกเลิกเป็น active
       * current flow ส่งเฉพาะ updated_by ส่วนหัวข้อเดิมส่งเมื่อเปิดใช้งาน
       */
      const updatePayload: WorkReportUpdate = SHOW_FUTURE_SECTIONS
        ? {
            purpose_selections: purposeSelections,
            additional_note: null,
            client_first_name: signatureValue?.firstName?.trim() || null,
            client_last_name: signatureValue?.lastName?.trim() || null,
            client_position: signatureValue?.position?.trim() || null,
            updated_by: empCode,
          }
        : {
            updated_by: empCode,
          };

      await workReportService.updateWorkReport(
        savedWorkReportId,
        updatePayload,
      );

      const signatureDataUrl = signatureValue?.signatureDataUrl ?? "";

      if (
        savedWorkReportId !== null &&
        isSignatureBase64DataUrl(signatureDataUrl)
      ) {
        const signatureReport =
          await workReportService.saveWorkReportSignature(
            savedWorkReportId,
            {
              signature_base64: signatureDataUrl,
              updated_by: empCode,
            },
          );

        const savedSignatureUrl = resolveSignatureImageUrl(
          signatureReport.signature_path,
        );

        if (savedSignatureUrl && signatureValue) {
          persistedSignatureValue = {
            ...signatureValue,
            signatureDataUrl: savedSignatureUrl,
          };

          setSignatureValue(persistedSignatureValue);
        }
      }

      if (savedWorkReportId !== null) {
        const currentWorkReportId = savedWorkReportId;
        const syncedWorkItems: WorkItem[] = [];

        /**
         * ลบรายการที่ผู้ใช้กดลบก่อน update sequence ของรายการที่เหลือ
         *
         * ตัวอย่าง:
         * เดิม 2.1, 2.2, 2.3
         * ถ้าลบ 2.2 ต้อง soft delete row ของ 2.2 ก่อน
         * แล้วจึง update 2.3 ให้กลายเป็น sequence_no = 2
         * เพื่อไม่ให้ชน unique sequence_no
         */
        for (const deletedItemId of deletedWorkReportItemIds) {
          await workReportService.deleteWorkReportItem(
            deletedItemId,
            {
              updated_by: empCode,
            },
          );

          /**
           * เอา ID ที่ลบสำเร็จออกจากคิวทันที
           * หากขั้นตอนถัดไป error แล้วผู้ใช้กดบันทึกใหม่
           * จะไม่ยิง DELETE ซ้ำกับ row ที่ถูก soft delete ไปแล้ว
           */
          setDeletedWorkReportItemIds((current) =>
            current.filter((itemId) => itemId !== deletedItemId),
          );
        }

        for (const [index, workItem] of workItems.entries()) {
          const sequenceNo = index + 1;
          const workItemOther =
            workItem.workItemCode === "other"
              ? workItem.workItemOther.trim() || null
              : null;
          const workItemDetail =
            workItem.workItemDetail.trim() || null;

          let savedWorkReportItemId = workItem.workReportItemId;

          if (savedWorkReportItemId === null) {
            const createdItem =
              await workReportService.createWorkReportItem({
                work_report_id: savedWorkReportId,
                work_item_type_id: workItem.workItemTypeId,
                sequence_no: sequenceNo,
                work_item_other: workItemOther,
                work_item_detail: workItemDetail,
                is_active: true,
                created_by: empCode,
              });

            savedWorkReportItemId =
              createdItem.work_report_item_id;
          } else {
            const updatedItem =
              await workReportService.updateWorkReportItem(
                savedWorkReportItemId,
                {
                  work_item_type_id: workItem.workItemTypeId,
                  sequence_no: sequenceNo,
                  work_item_other: workItemOther,
                  work_item_detail: workItemDetail,
                  is_active: true,
                  updated_by: empCode,
                },
              );

            savedWorkReportItemId =
              updatedItem.work_report_item_id;
          }

          const currentImageDataUrls =
            workItem.imageDataUrls?.length
              ? workItem.imageDataUrls
              : workItem.imageDataUrl
                ? [workItem.imageDataUrl]
                : [];

          const persistedImageDataUrls =
            workItem.persistedImageDataUrls ?? [];

          const currentImageIds = currentImageDataUrls.map(
            (_, imageIndex) => workItem.imageIds?.[imageIndex] ?? null,
          );

          const deletedImageIds = workItem.deletedImageIds ?? [];

          let nextImageDataUrls = currentImageDataUrls;
          let nextImageNames =
            workItem.imageNames?.length
              ? workItem.imageNames
              : workItem.imageName
                ? [workItem.imageName]
                : [];
          let nextImageIds = currentImageIds;
          let nextPersistedImageDataUrls =
            persistedImageDataUrls;

          const imagesChanged =
            deletedImageIds.length > 0 ||
            !areImageSourcesEqual(
              currentImageDataUrls,
              persistedImageDataUrls,
            );

          if (imagesChanged) {
            /**
             * Differential mode:
             * - รูปเดิมที่มี image_id ส่งค่าว่างแทน Base64 เพื่อไม่ upload ซ้ำ
             * - รูปใหม่/รูปที่กดเปลี่ยนมี image_id = null และส่ง Base64 จริง
             */
            const imageBase64Values = await Promise.all(
              currentImageDataUrls.map(async (imageSource, imageIndex) => {
                if (currentImageIds[imageIndex] !== null) {
                  return "";
                }

                return imageSourceToBase64(imageSource);
              }),
            );

            const savedImages =
              await workReportService.saveWorkReportItemImages(
                savedWorkReportItemId,
                {
                  image_base64_values: imageBase64Values,
                  image_ids: currentImageIds,
                  deleted_image_ids: deletedImageIds,
                  updated_by: empCode,
                },
              );

            const sortedSavedImages = savedImages
              .slice()
              .sort((a, b) => a.sequence_no - b.sequence_no);

            nextImageDataUrls = sortedSavedImages.map((image) =>
              resolveSignatureImageUrl(image.image_path),
            );

            nextImageNames = sortedSavedImages.map(
              (image, imageIndex) =>
                getImageFileName(
                  image.image_path,
                  imageIndex,
                ),
            );

            nextImageIds = sortedSavedImages.map(
              (image) => image.time_record_image_id,
            );

            nextPersistedImageDataUrls = nextImageDataUrls;
          }

          syncedWorkItems.push({
            ...workItem,
            workReportItemId: savedWorkReportItemId,
            imageName: nextImageNames[0] ?? "",
            imageDataUrl: nextImageDataUrls[0] ?? "",
            imageNames: nextImageNames,
            imageDataUrls: nextImageDataUrls,
            imageIds: nextImageIds,
            deletedImageIds: [],
            persistedImageDataUrls:
              nextPersistedImageDataUrls,
          });
        }

        persistedWorkItems = syncedWorkItems;
        setWorkItems(syncedWorkItems);
        setDeletedWorkReportItemIds([]);

        if (SHOW_FUTURE_SECTIONS) {
          for (const deletedDetailId of deletedWorkReportDetailIds) {
            await workReportService.deleteWorkReportDetail(
              deletedDetailId,
              {
                updated_by: empCode,
              },
            );

            setDeletedWorkReportDetailIds((current) =>
              current.filter((detailId) => detailId !== deletedDetailId),
            );
          }

          async function syncDetailSection(
            sectionNo: 3 | 4,
            items: DetailItem[],
          ): Promise<DetailItem[]> {
            const syncedItems: DetailItem[] = [];

            for (const [index, item] of items.entries()) {
              const sequenceNo = index + 1;
              let savedWorkReportDetailId = item.workReportDetailId;

              if (savedWorkReportDetailId === null) {
                const createdDetail =
                  await workReportService.createWorkReportDetail({
                    work_report_id: currentWorkReportId,
                    section_no: sectionNo,
                    sequence_no: sequenceNo,
                    detail: item.detail.trim(),
                    is_active: true,
                    created_by: empCode,
                  });

                savedWorkReportDetailId =
                  createdDetail.work_report_detail_id;
              } else {
                const updatedDetail =
                  await workReportService.updateWorkReportDetail(
                    savedWorkReportDetailId,
                    {
                      section_no: sectionNo,
                      sequence_no: sequenceNo,
                      detail: item.detail.trim(),
                      is_active: true,
                      updated_by: empCode,
                    },
                  );

                savedWorkReportDetailId =
                  updatedDetail.work_report_detail_id;
              }

              syncedItems.push({
                ...item,
                id: `db-detail-${savedWorkReportDetailId}`,
                workReportDetailId: savedWorkReportDetailId,
              });
            }

            return syncedItems;
          }

          persistedSection3Items = await syncDetailSection(
            3,
            section3Items,
          );
          persistedSection4Items = await syncDetailSection(
            4,
            section4Items,
          );

          setSection3Items(persistedSection3Items);
          setSection4Items(persistedSection4Items);
          setDeletedWorkReportDetailIds([]);
        }
      }

      setHasSavedReportData(true);
      setLastSavedEmployeeCode(empCode);
      setLastSavedDateTimeText(formatReportSavedDateTime(new Date()));
      setSavedFormSnapshot(
        createPersistedFormSnapshot({
          normalPlanChecked,
          meetClientChecked,
          otherAssignmentChecked,
          otherAssignmentDetail,
          signatureValue: persistedSignatureValue,
          workItems: persistedWorkItems,
          section3Items: persistedSection3Items,
          section4Items: persistedSection4Items,
        }),
      );

      /**
       * Backend บันทึกรายงานสำเร็จแล้ว
       * แจ้ง App.tsx ให้โหลดสถานะประวัติล่าสุด และ Sync ไปยังแท็บอื่น
       *
       * หากการ Refresh/Sync UI มีปัญหา ไม่ให้ถือว่าการบันทึกรายงานล้มเหลว
       * เพราะข้อมูลหลักถูกบันทึกลง Backend สำเร็จแล้ว
       */
      try {
        await onSaved?.();
      } catch (syncError) {
        console.error("Sync work report history after save error:", syncError);
      }

      return true;
    } catch (saveError) {
      console.error("Save work report error:", saveError);

      setError(
        saveError instanceof Error
          ? saveError.message
          : "บันทึกรายงานไม่สำเร็จ",
      );

      return false;
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSave() {
    const saved = await saveReport();

    if (saved) {
      if (isCheckoutFlow) {
        // ครั้งที่ 2: กด "บันทึกรายงาน" ระหว่าง flow ลงเวลาออก
        // บันทึกสำเร็จแล้วให้อยู่หน้ารายงานเดิม
        setBackAfterSaveSuccess(false);
      } else {
        // ครั้งแรก: เข้าหน้ารายงานหลังลงเวลาเข้า
        // บันทึกสำเร็จแล้วให้กลับหน้าเลือกหน่วยงาน
        setBackAfterSaveSuccess(true);
      }

      setSaveSuccessModalOpen(true);
    }
  }

  function closeSaveSuccessModal() {
    setSaveSuccessModalOpen(false);

    if (backAfterSaveSuccess) {
      setBackAfterSaveSuccess(false);
      onBack();
    }
  }

  async function handleSaveAndCheckout() {
    const saved = await saveReport();

    if (!saved) {
      return;
    }

    onSaveAndCheckout?.();
  }

  const hasSelectedPurpose =
    normalPlanChecked ||
    meetClientChecked ||
    otherAssignmentChecked;

  const canSaveReport = SHOW_FUTURE_SECTIONS
    ? hasSelectedPurpose
    : workItems.length > 0 || deletedWorkReportItemIds.length > 0;

  const showCheckoutActions =
    SHOW_FUTURE_SECTIONS && isCheckoutFlow && hasSavedReportData;

  const editingWorkItem =
    editingWorkItemId === null
      ? null
      : workItems.find((item) => item.id === editingWorkItemId) ?? null;

  const workItemModalItemNumber =
    editingWorkItemId === null
      ? workItems.length + 1
      : Math.max(
          1,
          workItems.findIndex((item) => item.id === editingWorkItemId) + 1,
        );

  const editingDetailItem =
    detailModalSection === "section3"
      ? section3Items.find((item) => item.id === editingDetailItemId) ?? null
      : detailModalSection === "section4"
        ? section4Items.find((item) => item.id === editingDetailItemId) ?? null
        : null;

  const detailModalItemNumber =
    detailModalSection === "section3"
      ? editingDetailItemId
        ? Math.max(
            1,
            section3Items.findIndex(
              (item) => item.id === editingDetailItemId,
            ) + 1,
          )
        : section3Items.length + 1
      : editingDetailItemId
        ? Math.max(
            1,
            section4Items.findIndex(
              (item) => item.id === editingDetailItemId,
            ) + 1,
          )
        : section4Items.length + 1;

  const isCurrentUserLastSaver = lastSavedEmployeeCode === empCode;
  const recorderNameText = hasSavedReportData
    ? isCurrentUserLastSaver
      ? currentRecorderName
      : lastSavedEmployeeCode ?? "-"
    : "-";
  const recorderPositionText =
    hasSavedReportData && isCurrentUserLastSaver
      ? employeePosition?.trim() || "-"
      : "-";
  const recorderSavedAtText = hasSavedReportData
    ? lastSavedDateTimeText ?? "-"
    : "-";

  return (
    <>
      <main className="guts-bg">
        <div className="guts-home">
          <section
            className={`guts-home-card ${styles.pageCard}`}
            aria-label="บันทึกรายงาน"
          >
            <Header empCode={empCode} displayName={displayName} />

            <h2 className={styles.pageTitle}>
              หน้าจอ - บันทึกรายงาน
            </h2>

            <div className={styles.unitStatus}>
              {unitDisplay ? (
                <div className={styles.unitName}>{unitDisplay}</div>
              ) : null}

              {routeLabel ? <div>{routeLabel}</div> : null}

              <div>{dateTimeText}</div>

              {SHOW_FUTURE_SECTIONS && employeePosition ? (
                <div>ตำแหน่ง {employeePosition}</div>
              ) : null}
            </div>

            <div className={styles.unitStatus}>
              <div>
                <strong>รหัสบันทึกรายงาน</strong>{" "}
                {isLoadingReport ? "กำลังโหลด..." : documentNo ?? "-"}
              </div>
            </div>

            {SHOW_RECORDER_INFO ? (
              <div className={styles.unitStatus}>
                <div>
                  <strong>ผู้บันทึกรายงาน</strong>
                </div>

                <div>
                  <strong>ชื่อ-นามสกุล</strong>{" "}
                  {isLoadingReport ? "กำลังโหลด..." : recorderNameText}
                </div>

                <div>
                  <strong>ตำแหน่ง</strong>{" "}
                  {isLoadingReport ? "กำลังโหลด..." : recorderPositionText}
                </div>

                <div>
                  <strong>วันเวลาที่บันทึกล่าสุด</strong>{" "}
                  {isLoadingReport ? "กำลังโหลด..." : recorderSavedAtText}
                </div>
              </div>
            ) : null}

            <div className={styles.formCard}>
              {SHOW_FUTURE_SECTIONS ? (
              <section className={styles.section}>
                <button
                  type="button"
                  className={styles.sectionHeader}
                  onClick={() => toggleSection("section1")}
                >
                  <span>ข้อ 1. บันทึกรายงาน</span>

                  <svg
                    className={`${styles.chevron} ${
                      openSections.section1 ? "" : styles.chevronClosed
                    }`}
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
                </button>

                {openSections.section1 ? (
                  <div className={styles.sectionBody}>
                    <label className={styles.checkRow}>
                      <input
                        type="checkbox"
                        checked={normalPlanChecked}
                        onChange={(event) =>
                          setNormalPlanChecked(event.target.checked)
                        }
                      />
                      <span>ผู้ปฏิบัติงานตามแผนปกติ</span>
                    </label>

                    <label className={styles.checkRow}>
                      <input
                        type="checkbox"
                        checked={meetClientChecked}
                        onChange={(event) =>
                          setMeetClientChecked(event.target.checked)
                        }
                      />
                      <span>เข้าพบผู้ว่าจ้าง</span>
                    </label>

                    <label className={styles.checkRow}>
                      <input
                        type="checkbox"
                        checked={otherAssignmentChecked}
                        onChange={(event) => {
                          const checked = event.target.checked;
                          setOtherAssignmentChecked(checked);

                          if (!checked) {
                            setOtherAssignmentDetail("");
                          }
                        }}
                      />
                      <span>ได้รับมอบหมายงานอื่น ๆ</span>
                    </label>

                    {otherAssignmentChecked ? (
                      <div className={styles.otherAssignmentBlock}>
                        <label
                          className={styles.otherAssignmentLabel}
                          htmlFor="other-assignment-detail"
                        >
                          ระบุงานที่ได้รับมอบหมาย
                        </label>

                        <textarea
                          id="other-assignment-detail"
                          className={styles.otherAssignmentInput}
                          value={otherAssignmentDetail}
                          onChange={(event) =>
                            setOtherAssignmentDetail(event.target.value)
                          }
                          rows={3}
                          placeholder="กรอกรายละเอียดงานที่ได้รับมอบหมาย"
                        />
                      </div>
                    ) : null}

                    <div className={styles.signatureBlock}>
                      <div className={styles.signatureTopRow}>
                        <span>ลงชื่อ</span>

                        <button
                          type="button"
                          className={styles.signatureButton}
                          onClick={openSignatureModal}
                        >
                          {signatureValue?.signatureDataUrl ? (
                            <img
                              className={styles.signatureImage}
                              src={signatureValue.signatureDataUrl}
                              alt="ลายมือชื่อผู้ว่าจ้าง/ตัวแทน"
                            />
                          ) : (
                            "กดปุ่มเพื่อเซ็นชื่อ"
                          )}
                        </button>

                        <span>ผู้ว่าจ้าง/ตัวแทน</span>
                      </div>

                      <div className={styles.signatureNameRow}>
                        <span
                          className={styles.signatureNameSpacer}
                          aria-hidden="true"
                        />

                        <div className={styles.signatureNameValue}>
                          {signatureValue
                            ? `(${signatureValue.firstName} ${signatureValue.lastName})`
                            : ""}
                        </div>

                        {signatureValue ? (
                          <button
                            type="button"
                            className={styles.editSignatureButton}
                            onClick={openSignatureModal}
                          >
                            แก้ไข
                          </button>
                        ) : null}
                      </div>

                      <div className={styles.positionRow}>
                        <span>ตำแหน่งงาน</span>
                        <span className={styles.positionValue}>
                          {signatureValue?.position ?? ""}
                        </span>
                      </div>

                      {signatureDateTimeText ? (
                        <div className={styles.signatureDateTime}>
                          {signatureDateTimeText}
                        </div>
                      ) : null}

                      <div className={styles.unitStatus}>
                        <div>
                          <strong>ผู้บันทึกรายงาน</strong>
                        </div>

                        <div>
                          <strong>ชื่อ-นามสกุล</strong>{" "}
                          {isLoadingReport ? "กำลังโหลด..." : recorderNameText}
                        </div>

                        <div>
                          <strong>ตำแหน่ง</strong>{" "}
                          {isLoadingReport
                            ? "กำลังโหลด..."
                            : recorderPositionText}
                        </div>

                        <div>
                          <strong>วันที่บันทึกล่าสุด</strong>{" "}
                          {isLoadingReport
                            ? "กำลังโหลด..."
                            : recorderSavedAtText}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </section>
              ) : null}

              <section className={styles.section}>
                <button
                  type="button"
                  className={styles.sectionHeader}
                  onClick={() => toggleSection("section2")}
                >
                  <span>ข้อ 2. สิ่งที่ดำเนินการเรียบร้อย</span>

                  <svg
                    className={`${styles.chevron} ${
                      openSections.section2 ? "" : styles.chevronClosed
                    }`}
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
                </button>

                {openSections.section2 ? (
                  <div className={styles.sectionBody}>
                    {workItems.map((item, index) => (
                      <div className={styles.workItemRow} key={item.id}>
                        <div className={styles.workItemNumber}>
                          2.{index + 1}
                        </div>

                        <div className={styles.workItemContent}>
                          <div className={styles.workItemTitle}>
                            {item.title}
                          </div>

                          <div className={styles.workItemActions}>
                            <button
                              type="button"
                              onClick={() => openWorkItemModal(item.id)}
                            >
                              แก้ไข
                            </button>

                            <button
                              type="button"
                              onClick={() => removeWorkItem(item.id)}
                            >
                              ลบ
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}

                    <div className={styles.tableRow}>
                      <div className={styles.tableNumber}>
                        2.{workItems.length + 1}
                      </div>

                      <button
                        type="button"
                        className={styles.tableAddButton}
                        onClick={() => openWorkItemModal()}
                        disabled={
                          masterDataLoading ||
                          purposeOptions.length === 0 ||
                          workItemTypeOptions.length === 0
                        }
                      >
                        <svg
                          className={styles.addIcon}
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M12 5v14" />
                          <path d="M5 12h14" />
                        </svg>

                        <span>กดเพิ่มข้อมูล</span>
                      </button>
                    </div>
                  </div>
                ) : null}
              </section>

              {SHOW_FUTURE_SECTIONS ? (
              <section className={styles.section}>
                <button
                  type="button"
                  className={`${styles.sectionHeader} ${styles.summaryHeader}`}
                  onClick={() => toggleSection("summary")}
                >
                  <span>สรุปผลดำเนินการของบริษัทฯ ข้อ 3. และข้อ 4.</span>

                  <svg
                    className={`${styles.chevron} ${
                      openSections.summary ? "" : styles.chevronClosed
                    }`}
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

                        <svg
                    className={`${styles.chevron} ${
                            openSections.section3
                              ? ""
                              : styles.chevronClosed
                          }`}
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
                      </button>

                      {openSections.section3 ? (
                        <div className={styles.sectionBody}>
                          {section3Items.map((item, index) => (
                            <div className={styles.workItemRow} key={item.id}>
                              <div className={styles.workItemNumber}>
                                3.{index + 1}
                              </div>

                              <div className={styles.workItemContent}>
                                <div className={styles.workItemTitle}>
                                  {item.detail}
                                </div>

                                <div className={styles.workItemActions}>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openDetailModal("section3", item.id)
                                    }
                                  >
                                    แก้ไข
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      removeDetailItem("section3", item.id)
                                    }
                                  >
                                    ลบ
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}

                          <div className={styles.tableRow}>
                            <div className={styles.tableNumber}>
                              3.{section3Items.length + 1}
                            </div>

                            <button
                              type="button"
                              className={styles.tableAddButton}
                              onClick={() => openDetailModal("section3")}
                            >
                              <svg
                                className={styles.addIcon}
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                              >
                                <path d="M12 5v14" />
                                <path d="M5 12h14" />
                              </svg>

                              <span>กดเพิ่มข้อมูล</span>
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
                          ข้อ 4. ไม่สามารถแก้ไขได้ทันที
                          (นำเสนอ/ดำเนินการต่อ)
                        </span>

                        <svg
                    className={`${styles.chevron} ${
                            openSections.section4
                              ? ""
                              : styles.chevronClosed
                          }`}
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
                      </button>

                      {openSections.section4 ? (
                        <div className={styles.sectionBody}>
                          {section4Items.map((item, index) => (
                            <div className={styles.workItemRow} key={item.id}>
                              <div className={styles.workItemNumber}>
                                4.{index + 1}
                              </div>

                              <div className={styles.workItemContent}>
                                <div className={styles.workItemTitle}>
                                  {item.detail}
                                </div>

                                <div className={styles.workItemActions}>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openDetailModal("section4", item.id)
                                    }
                                  >
                                    แก้ไข
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      removeDetailItem("section4", item.id)
                                    }
                                  >
                                    ลบ
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}

                          <div className={styles.tableRow}>
                            <div className={styles.tableNumber}>
                              4.{section4Items.length + 1}
                            </div>

                            <button
                              type="button"
                              className={styles.tableAddButton}
                              onClick={() => openDetailModal("section4")}
                            >
                              <svg
                                className={styles.addIcon}
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                              >
                                <path d="M12 5v14" />
                                <path d="M5 12h14" />
                              </svg>

                              <span>กดเพิ่มข้อมูล</span>
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </section>
                  </div>
                ) : null}
              </section>
              ) : null}

              {SHOW_FUTURE_SECTIONS ? (
              <section className={styles.section}>
                <button
                  type="button"
                  className={styles.sectionHeader}
                  onClick={() => toggleSection("section5")}
                >
                  <span>ข้อ 5. ปัญหาทรัพย์สินเสียหาย/สูญหาย</span>

                  <svg
                    className={`${styles.chevron} ${
                      openSections.section5 ? "" : styles.chevronClosed
                    }`}
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
                </button>

                {openSections.section5 ? (
                  <div className={styles.sectionBody}>
                    <div className={styles.section5Text}>
                      ข้อ 5.
                      ปัญหาทรัพย์สินเสียหาย/สูญหาย/ปัญหาที่ต้องการแก้ไขอย่างต่อเนื่อง
                      หรือเกี่ยวข้องกับส่วนอื่น ให้สรุปข้อมูลโดยย่อ
                    </div>

                    <div className={styles.section5ApprovalArea}>
                      <div className={styles.approvalGroup}>
                        <div className={styles.approvalTitle}>
                          รองผู้จัดการเขต/ผู้จัดการเขต
                        </div>

                        <label className={styles.approvalCheckRow}>
                          <input
                            type="checkbox"
                            checked={managerWaitingReview}
                            onChange={(event) =>
                              setManagerWaitingReview(event.target.checked)
                            }
                          />
                          <span>รอตรวจสอบรายงาน</span>
                        </label>

                        <label className={styles.approvalCheckRow}>
                          <input
                            type="checkbox"
                            checked={managerReviewed}
                            onChange={(event) =>
                              setManagerReviewed(event.target.checked)
                            }
                          />
                          <span>ตรวจสอบรายงานเรียบร้อย</span>
                        </label>

                        <div className={styles.approvalDate}>
                          {dateTimeText}
                        </div>
                      </div>

                      <div className={styles.approvalGroup}>
                        <div className={styles.approvalTitle}>
                          รองผู้อำนวยการ/ผู้อำนวยการ
                        </div>

                        <label className={styles.approvalCheckRow}>
                          <input
                            type="checkbox"
                            checked={assistantWaitingReview}
                            onChange={(event) =>
                              setAssistantWaitingReview(event.target.checked)
                            }
                          />
                          <span>รอตรวจสอบรายงาน</span>
                        </label>

                        <label className={styles.approvalCheckRow}>
                          <input
                            type="checkbox"
                            checked={assistantReviewed}
                            onChange={(event) =>
                              setAssistantReviewed(event.target.checked)
                            }
                          />
                          <span>ตรวจสอบรายงานเรียบร้อย</span>
                        </label>

                        <div className={styles.approvalDate}>
                          {dateTimeText}
                        </div>
                      </div>

                    </div>
                  </div>
                ) : null}
              </section>
              ) : null}

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

              {showCheckoutActions ? (
                <footer className={styles.checkoutFooterBar}>
                  <div className={styles.checkoutActionRow}>
                    <button
                      type="button"
                      className={styles.saveReportButton}
                      onClick={handleSave}
                      disabled={
                        !canSaveReport ||
                        timeRecordId === null ||
                        isLoadingReport ||
                        isSaving
                      }
                    >
                      {isLoadingReport ? "กำลังโหลด..." : "บันทึกรายงาน"}
                    </button>

                    <button
                      type="button"
                      className={styles.saveAndCheckoutButton}
                      onClick={handleSaveAndCheckout}
                      disabled={
                        !canSaveReport ||
                        timeRecordId === null ||
                        isLoadingReport ||
                        isSaving
                      }
                    >
                      บันทึกและกดออกงาน
                    </button>
                  </div>

                  <button
                    type="button"
                    className={styles.backButton}
                    onClick={handleCancel}
                    disabled={isSaving}
                  >
                    ย้อนกลับ
                  </button>
                </footer>
              ) : (
                <footer className={styles.footerBar}>
                  <button
                    type="button"
                    className={styles.cancelButton}
                    onClick={handleCancel}
                  >
                    ยกเลิก
                  </button>

                  <button
                    type="button"
                    className={styles.saveButton}
                    onClick={handleSave}
                    disabled={
                      !canSaveReport ||
                      timeRecordId === null ||
                      isLoadingReport ||
                      isSaving
                    }
                  >
                    {isLoadingReport ? "กำลังโหลด..." : "บันทึก"}
                  </button>
                </footer>
              )}
            </div>
          </section>
        </div>
      </main>

      {unsavedPromptOpen ? (
        <UnsavedChangesModal
          busy={isSaving}
          onSave={handleSaveBeforeBack}
          onDiscard={handleDiscardAndBack}
          onStay={handleStayOnPage}
        />
      ) : null}

      <WorkReportSuccessModal
        open={saveSuccessModalOpen}
        onOk={closeSaveSuccessModal}
      />

      {signatureModalOpen ? (
        <SignatureModal
          initialValue={signatureValue}
          onClose={closeSignatureModal}
          onSave={saveSignature}
        />
      ) : null}

      {detailModalSection ? (
        <RecordDetailModal
          sectionNumber={detailModalSection === "section3" ? 3 : 4}
          itemNumber={detailModalItemNumber}
          title={
            detailModalSection === "section3"
              ? "ข้อบกพร่อง/ตำหนิ ที่สามารถแก้ไขได้ทันที"
              : "ไม่สามารถแก้ไขได้ทันที (นำเสนอ/ดำเนินการต่อ)"
          }
          initialValue={editingDetailItem?.detail ?? ""}
          onClose={closeDetailModal}
          onSave={saveDetailItem}
        />
      ) : null}

      {workItemModalOpen ? (
        <WorkItemModal
          itemNumber={workItemModalItemNumber}
          purposeOptions={purposeOptions}
          workItemTypeOptions={workItemTypeOptions}
          initialPurposeId={purposeId}
          initialValue={
            editingWorkItem
              ? {
                  purposeId,
                  workItemTypeId: editingWorkItem.workItemTypeId,
                  workItemOther: editingWorkItem.workItemOther,
                  workItemDetail: editingWorkItem.workItemDetail,
                  imageName: editingWorkItem.imageName,
                  imageDataUrl: editingWorkItem.imageDataUrl,
                  imageNames: editingWorkItem.imageNames,
                  imageDataUrls: editingWorkItem.imageDataUrls,
                  imageIds: editingWorkItem.imageIds,
                }
              : null
          }
          onClose={closeWorkItemModal}
          onSave={saveWorkItemFromModal}
        />
      ) : null}
    </>
  );
}
