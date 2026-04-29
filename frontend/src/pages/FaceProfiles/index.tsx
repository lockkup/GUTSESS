import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import * as XLSX from "xlsx";
import * as faceapi from "face-api.js";

import styles from "./FaceProfiles.module.css";
import {
  createFaceProfile,
  deleteFaceProfile,
  listFaceProfiles,
  updateFaceProfile,
} from "@/services/faceProfiles";
import type { FaceProfile, EmbeddingStatus } from "@/types/faceProfiles";

type ModalMode = "create" | "edit" | "view";

type Props = {
  currentUserCode: string;
  onBack: () => void;
};

type FormState = {
  face_profile_id: number | null;
  employee_code: string;
  reference_image_preview: string;
  reference_image_file: File | null;
  reference_embedding: number[] | null;
  embedding_status: EmbeddingStatus;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
};

type ImportFaceRow = {
  employee_code: string;
  reference_image_url: string;
  is_active: boolean;
};

const emptyForm: FormState = {
  face_profile_id: null,
  employee_code: "",
  reference_image_preview: "",
  reference_image_file: null,
  reference_embedding: null,
  embedding_status: "not_uploaded",
  is_active: true,
  created_at: "",
  updated_at: "",
  created_by: "",
  updated_by: "",
};

const MODEL_URL = "/models";

function getEmbeddingLabel(status: EmbeddingStatus) {
  switch (status) {
    case "not_uploaded":
      return "ยังไม่อัปโหลดรูป";
    case "pending":
      return "กำลังประมวลผล";
    case "ready":
      return "สร้างแล้ว";
    case "failed":
      return "ล้มเหลว";
    default:
      return "-";
  }
}

function getEmbeddingClass(status: EmbeddingStatus) {
  switch (status) {
    case "not_uploaded":
      return styles.badgeNeutral;
    case "pending":
      return styles.badgeWarning;
    case "ready":
      return styles.badgeSuccess;
    case "failed":
      return styles.badgeDanger;
    default:
      return styles.badgeNeutral;
  }
}

function formatDate(value: string) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return `${String(date.getDate()).padStart(2, "0")}/${String(
    date.getMonth() + 1,
  ).padStart(2, "0")}/${date.getFullYear()}`;
}

function displayFaceId(faceProfileId: number) {
  return `FID-${String(faceProfileId).padStart(3, "0")}`;
}

function isDeletedFaceProfile(row: FaceProfile) {
  return Boolean(row.mark_flag);
}

function mapRowToForm(row: FaceProfile): FormState {
  return {
    face_profile_id: row.face_profile_id,
    employee_code: row.employee_code,
    reference_image_preview: row.reference_image_url ?? "",
    reference_image_file: null,
    reference_embedding: null,
    embedding_status: row.embedding_status,
    is_active: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at,
    created_by: row.created_by,
    updated_by: row.updated_by ?? "",
  };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("อ่านไฟล์ไม่สำเร็จ"));

    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.src = dataUrl;
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("โหลดรูปไม่สำเร็จ"));
  });
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function parseBooleanValue(value: unknown) {
  const raw = normalizeText(value).toLowerCase();

  if (!raw) return true;

  if (["1", "true", "yes", "on", "active", "ใช้งาน"].includes(raw)) {
    return true;
  }

  if (
    ["0", "false", "no", "off", "inactive", "ไม่ใช้งาน"].includes(raw)
  ) {
    return false;
  }

  return true;
}

function pickFirstValue(row: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    if (key in row) {
      const value = normalizeText(row[key]);
      if (value) return value;
    }
  }

  return "";
}

function normalizeImportedRows(rows: Record<string, unknown>[]): ImportFaceRow[] {
  return rows
    .map((row) => {
      const employee_code = pickFirstValue(row, [
        "employee_code",
        "employeeCode",
        "รหัสพนักงาน",
      ]);

      const reference_image_url = pickFirstValue(row, [
        "reference_image_url",
        "referenceImageUrl",
        "image_url",
        "imageUrl",
        "reference_image",
        "รูปอ้างอิง",
        "รูปใบหน้า",
        "image",
      ]);

      const is_active = parseBooleanValue(
        row.is_active ??
          row.active ??
          row.status ??
          row["สถานะใช้งาน"] ??
          row["สถานะ"],
      );

      return {
        employee_code,
        reference_image_url,
        is_active,
      };
    })
    .filter((item) => item.employee_code && item.reference_image_url);
}

async function parseImportFile(file: File): Promise<ImportFaceRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });

  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    throw new Error("ไม่พบชีตข้อมูลในไฟล์");
  }

  const sheet = workbook.Sheets[firstSheetName];

  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });

  const rows = normalizeImportedRows(rawRows);

  if (rows.length === 0) {
    throw new Error(
      "ไม่พบข้อมูลที่นำเข้าได้ กรุณาตรวจสอบคอลัมน์ employee_code และ reference_image_url",
    );
  }

  return rows;
}

async function urlToFile(url: string, employeeCode: string): Promise<File> {
  let response: Response;

  try {
    response = await fetch(url);
  } catch {
    throw new Error(`โหลดรูปไม่สำเร็จ: ${employeeCode}`);
  }

  if (!response.ok) {
    throw new Error(`โหลดรูปไม่สำเร็จ: ${employeeCode}`);
  }

  const blob = await response.blob();
  const urlObj = new URL(url, window.location.href);
  const rawName = urlObj.pathname.split("/").pop() || `${employeeCode}.jpg`;
  const filename = rawName.includes(".") ? rawName : `${rawName}.jpg`;

  return new File([blob], filename, {
    type: blob.type || "image/jpeg",
  });
}

export default function FaceProfiles({ currentUserCode, onBack }: Props) {
  const [rows, setRows] = useState<FaceProfile[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showDeleted, setShowDeleted] = useState(false);

  const [loading, setLoading] = useState(false);
  const [pageError, setPageError] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("create");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);

  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [modelError, setModelError] = useState("");
  const [embeddingBusy, setEmbeddingBusy] = useState(false);

  const importInputRef = useRef<HTMLInputElement | null>(null);

  const isReadOnly = modalMode === "view";

  useEffect(() => {
    let cancelled = false;

    const loadModels = async () => {
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);

        if (!cancelled) {
          setModelsLoaded(true);
          setModelError("");
        }
      } catch (error) {
        console.error("load face-api models error:", error);

        if (!cancelled) {
          setModelsLoaded(false);
          setModelError("โหลดโมเดลตรวจจับใบหน้าไม่สำเร็จ");
        }
      }
    };

    void loadModels();

    return () => {
      cancelled = true;
    };
  }, []);

  const loadRows = async () => {
    try {
      setLoading(true);
      setPageError("");

      const data = await listFaceProfiles({
        is_active:
          statusFilter === "all"
            ? undefined
            : statusFilter === "active"
              ? true
              : false,
        include_deleted: showDeleted,
        skip: 0,
        limit: 100,
      });

      setRows(data);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadRows();
    }, 300);

    return () => window.clearTimeout(timer);
  }, [statusFilter, showDeleted]);

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) return rows;

    return rows.filter((row) => row.employee_code.toLowerCase().includes(keyword));
  }, [rows, search]);

  const resetForm = () => {
    setForm(emptyForm);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSaving(false);
    setEmbeddingBusy(false);
    resetForm();
  };

  const openCreateModal = () => {
    setModalMode("create");
    setForm({
      ...emptyForm,
      is_active: true,
      created_by: currentUserCode,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (row: FaceProfile) => {
    if (isDeletedFaceProfile(row)) return;

    setModalMode("edit");
    setForm(mapRowToForm(row));
    setIsModalOpen(true);
  };

  const openViewModal = (row: FaceProfile) => {
    setModalMode("view");
    setForm(mapRowToForm(row));
    setIsModalOpen(true);
  };

  const extractEmbeddingFromFile = async (file: File) => {
    const dataUrl = await readFileAsDataUrl(file);
    const img = await loadImage(dataUrl);

    const detectorOptions = new faceapi.TinyFaceDetectorOptions({
      inputSize: 320,
      scoreThreshold: 0.5,
    });

    const faces = await faceapi.detectAllFaces(img, detectorOptions);

    if (faces.length === 0) {
      throw new Error("ไม่พบใบหน้าในรูปภาพ");
    }

    if (faces.length > 1) {
      throw new Error("กรุณาใช้รูปที่มีใบหน้าเพียง 1 คน");
    }

    const result = await faceapi
      .detectSingleFace(img, detectorOptions)
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!result) {
      throw new Error("ไม่สามารถสร้าง face embedding ได้");
    }

    return {
      preview: dataUrl,
      embedding: Array.from(result.descriptor),
    };
  };

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file) return;

    if (!modelsLoaded) {
      alert(modelError || "ระบบ AI ยังโหลดไม่เสร็จ กรุณารอสักครู่");
      e.target.value = "";
      return;
    }

    try {
      setEmbeddingBusy(true);

      setForm((prev) => ({
        ...prev,
        reference_image_file: file,
        reference_image_preview: "",
        reference_embedding: null,
        embedding_status: "pending",
      }));

      const { preview, embedding } = await extractEmbeddingFromFile(file);

      setForm((prev) => ({
        ...prev,
        reference_image_file: file,
        reference_image_preview: preview,
        reference_embedding: embedding,
        embedding_status: "ready",
      }));
    } catch (error) {
      setForm((prev) => ({
        ...prev,
        reference_image_file: null,
        reference_image_preview: "",
        reference_embedding: null,
        embedding_status: "failed",
      }));

      alert(error instanceof Error ? error.message : "ประมวลผลรูปไม่สำเร็จ");
    } finally {
      setEmbeddingBusy(false);
      e.target.value = "";
    }
  };

  const handleImportSpreadsheet = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file) return;

    if (!modelsLoaded) {
      alert(modelError || "ระบบ AI ยังโหลดไม่เสร็จ กรุณารอสักครู่");
      e.target.value = "";
      return;
    }

    try {
      setImporting(true);

      const importRows = await parseImportFile(file);

      let successCount = 0;
      const failedCodes: string[] = [];

      for (const item of importRows) {
        try {
          const imageFile = await urlToFile(
            item.reference_image_url,
            item.employee_code,
          );

          const { embedding } = await extractEmbeddingFromFile(imageFile);

          const payload = {
            employee_code: item.employee_code.trim(),
            is_active: item.is_active,
            created_by: currentUserCode,
            reference_image_file: imageFile,
            face_embedding: JSON.stringify(embedding),
          } as Parameters<typeof createFaceProfile>[0] & {
            face_embedding: string;
          };

          await createFaceProfile(payload);
          successCount += 1;
        } catch (error) {
          console.error("import row error:", item.employee_code, error);
          failedCodes.push(item.employee_code);
        }
      }

      await loadRows();

      const failText =
        failedCodes.length > 0 ? `\nไม่สำเร็จ: ${failedCodes.join(", ")}` : "";

      alert(`นำเข้าข้อมูลเสร็จสิ้น\nสำเร็จ: ${successCount} รายการ${failText}`);
    } catch (error) {
      alert(error instanceof Error ? error.message : "นำเข้าไฟล์ไม่สำเร็จ");
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  };

  const handleSave = async () => {
    const employeeCode = form.employee_code.trim();

    if (!employeeCode) {
      alert("กรุณากรอกรหัสพนักงาน");
      return;
    }

    if (employeeCode.length !== 6) {
      alert("รหัสพนักงานต้องมี 6 หลัก");
      return;
    }

    if (modalMode === "create" && !form.reference_image_file) {
      alert("กรุณาอัปโหลดรูปอ้างอิง");
      return;
    }

    if (modalMode === "create" && !form.reference_embedding) {
      alert("ยังไม่ได้สร้าง embedding จากรูปภาพ");
      return;
    }

    if (
      modalMode === "edit" &&
      form.reference_image_file &&
      !form.reference_embedding
    ) {
      alert("กรุณารอให้ระบบสร้าง embedding จากรูปใหม่ให้เสร็จก่อน");
      return;
    }

    try {
      setSaving(true);

      if (modalMode === "create") {
        const payload = {
          employee_code: employeeCode,
          is_active: form.is_active,
          created_by: currentUserCode,
          reference_image_file: form.reference_image_file as File,
          face_embedding: JSON.stringify(form.reference_embedding),
        } as Parameters<typeof createFaceProfile>[0] & {
          face_embedding: string;
        };

        await createFaceProfile(payload);
      }

      if (modalMode === "edit" && form.face_profile_id) {
        const payload = {
          is_active: form.is_active,
          updated_by: currentUserCode,
          reference_image_file: form.reference_image_file ?? undefined,
          face_embedding:
            form.reference_image_file && form.reference_embedding
              ? JSON.stringify(form.reference_embedding)
              : undefined,
        } as Parameters<typeof updateFaceProfile>[1] & {
          face_embedding?: string;
        };

        await updateFaceProfile(form.face_profile_id, payload);
      }

      await loadRows();
      closeModal();
    } catch (error) {
      alert(error instanceof Error ? error.message : "บันทึกข้อมูลไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const handleSoftDelete = async (row: FaceProfile) => {
    const confirmed = window.confirm(
      `ต้องการลบข้อมูล ${displayFaceId(row.face_profile_id)} ใช่หรือไม่`,
    );

    if (!confirmed) return;

    try {
      await deleteFaceProfile(row.face_profile_id, currentUserCode);
      await loadRows();
    } catch (error) {
      alert(error instanceof Error ? error.message : "ลบข้อมูลไม่สำเร็จ");
    }
  };

  const handleRefresh = () => {
    setSearch("");
    setStatusFilter("all");
    setShowDeleted(false);
    void loadRows();
  };

  const handleClearCreateForm = () => {
    setForm({
      ...emptyForm,
      is_active: true,
      created_by: currentUserCode,
    });
  };

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>จัดการข้อมูลใบหน้าพนักงาน</h1>
          <p className={styles.subtitle}>
            ใช้เพิ่ม แก้ไข และจัดการข้อมูลใบหน้าอ้างอิงของพนักงาน
          </p>
        </div>

        <div className={styles.headerActions}>
          <button className={styles.secondaryButton} onClick={onBack}>
            กลับ
          </button>

          <button
            className={styles.primaryButton}
            onClick={openCreateModal}
            disabled={importing}
          >
            <span className={styles.buttonIcon}>＋</span>
            เพิ่มข้อมูลใบหน้า
          </button>

          <button
            className={styles.primaryButton}
            onClick={() => importInputRef.current?.click()}
            disabled={importing}
          >
            <span className={styles.buttonIcon}>＋</span>
            {importing ? "กำลังนำเข้า..." : "นำเข้า CSV/Excel"}
          </button>

          <button
            className={styles.secondaryButton}
            onClick={handleRefresh}
            disabled={loading || importing}
          >
            รีเฟรช
          </button>

          <input
            ref={importInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className={styles.hiddenInput}
            onChange={(e) => void handleImportSpreadsheet(e)}
          />
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.toolbar}>
          <div className={styles.toolbarLeft}>
            <div className={styles.searchBox}>
              <span className={styles.searchIcon}>⌕</span>
              <input
                className={styles.input}
                type="text"
                placeholder="ค้นหารหัสพนักงาน..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <select
              className={styles.select}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">สถานะทั้งหมด</option>
              <option value="active">ใช้งาน</option>
              <option value="inactive">ไม่ใช้งาน</option>
            </select>
          </div>

          <label className={styles.switchRow}>
            <span>แสดงรายการที่ลบแล้ว</span>
            <button
              type="button"
              className={`${styles.switch} ${showDeleted ? styles.switchOn : ""}`}
              onClick={() => setShowDeleted((prev) => !prev)}
            >
              <span className={styles.switchThumb} />
            </button>
          </label>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Face ID</th>
                <th>รหัสพนักงาน</th>
                <th>รูปอ้างอิง</th>
                <th>Embedding</th>
                <th>สถานะ</th>
                <th>วันที่สร้าง</th>
                <th>วันที่แก้ไขล่าสุด</th>
                <th>จัดการ</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className={styles.emptyCell}>
                    กำลังโหลดข้อมูล...
                  </td>
                </tr>
              ) : pageError ? (
                <tr>
                  <td colSpan={8} className={styles.emptyCell}>
                    {pageError}
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className={styles.emptyCell}>
                    ไม่พบข้อมูล
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const deleted = isDeletedFaceProfile(row);

                  return (
                    <tr
                      key={row.face_profile_id}
                      className={deleted ? styles.deletedRow : ""}
                    >
                      <td>{displayFaceId(row.face_profile_id)}</td>
                      <td>{row.employee_code}</td>

                      <td>
                        {row.reference_image_url ? (
                          <img
                            src={row.reference_image_url}
                            alt=""
                            className={styles.avatar}
                          />
                        ) : (
                          <div className={styles.avatarPlaceholder}>ไม่มีรูป</div>
                        )}
                      </td>

                      <td>
                        <span
                          className={`${styles.badge} ${getEmbeddingClass(
                            row.embedding_status,
                          )}`}
                        >
                          {getEmbeddingLabel(row.embedding_status)}
                        </span>
                      </td>

                      <td>
                        <span
                          className={`${styles.statusPill} ${
                            row.is_active ? styles.statusOn : styles.statusOff
                          }`}
                        >
                          {row.is_active ? "ON" : "OFF"}
                        </span>
                      </td>

                      <td>{formatDate(row.created_at)}</td>
                      <td>{formatDate(row.updated_at)}</td>

                      <td>
                        <div className={styles.actionGroup}>
                          <button
                            className={styles.iconButton}
                            onClick={() => openViewModal(row)}
                            title="ดูรายละเอียด"
                          >
                            👁
                          </button>

                          {!deleted ? (
                            <>
                              <button
                                className={styles.iconButton}
                                onClick={() => openEditModal(row)}
                                title="แก้ไข"
                              >
                                ✎
                              </button>

                              <button
                                className={`${styles.iconButton} ${styles.deleteButton}`}
                                onClick={() => void handleSoftDelete(row)}
                                title="ลบ"
                              >
                                🗑
                              </button>
                            </>
                          ) : (
                            <span className={`${styles.badge} ${styles.badgeNeutral}`}>
                              ลบแล้ว
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className={styles.backdrop} onClick={closeModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>
                {modalMode === "create" && "เพิ่มข้อมูลใบหน้าพนักงาน"}
                {modalMode === "edit" && "แก้ไขข้อมูลใบหน้าพนักงาน"}
                {modalMode === "view" && "รายละเอียดข้อมูลใบหน้าพนักงาน"}
              </h2>

              <button className={styles.closeButton} onClick={closeModal}>
                ×
              </button>
            </div>

            <div className={styles.modalBody}>
              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>ข้อมูลพื้นฐาน</h3>

                <div className={styles.formGrid2}>
                  <div className={styles.field}>
                    <label>รหัสพนักงาน</label>
                    <input
                      className={styles.input}
                      type="text"
                      placeholder="เช่น 036259"
                      value={form.employee_code}
                      maxLength={6}
                      disabled={isReadOnly || modalMode === "edit"}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          employee_code: e.target.value.replace(/\D/g, "").slice(0, 6),
                        }))
                      }
                    />
                  </div>

                  <div className={styles.field}>
                    <label>สถานะใช้งาน</label>

                    <div className={styles.toggleBox}>
                      <button
                        type="button"
                        className={`${styles.switch} ${
                          form.is_active ? styles.switchOn : ""
                        }`}
                        onClick={() =>
                          !isReadOnly &&
                          setForm((prev) => ({
                            ...prev,
                            is_active: !prev.is_active,
                          }))
                        }
                        disabled={isReadOnly}
                      >
                        <span className={styles.switchThumb} />
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>รูปอ้างอิงใบหน้า</h3>

                {!isReadOnly && (
                  <label className={styles.uploadBox}>
                    <input
                      type="file"
                      accept="image/*"
                      className={styles.hiddenInput}
                      onChange={(e) => void handleUpload(e)}
                    />

                    <div className={styles.uploadIcon}>☁</div>
                    <div className={styles.uploadText}>
                      Drag & Drop รูปภาพใบหน้า หรือคลิกที่นี่
                    </div>
                    <div className={styles.uploadAction}>อัปโหลดรูป</div>
                  </label>
                )}

                <p className={styles.helperText}>
                  อัปโหลดภาพใบหน้าตรง ชัดเจน แสงเพียงพอ
                </p>

                {form.reference_image_preview && (
                  <div className={styles.previewRow}>
                    <img
                      src={form.reference_image_preview}
                      alt="preview"
                      className={styles.previewImage}
                    />

                    {!isReadOnly && (
                      <div className={styles.previewActions}>
                        <label className={styles.smallSecondaryButton}>
                          เปลี่ยนรูป
                          <input
                            type="file"
                            accept="image/*"
                            className={styles.hiddenInput}
                            onChange={(e) => void handleUpload(e)}
                          />
                        </label>

                        <button
                          type="button"
                          className={styles.smallDangerButton}
                          onClick={() =>
                            setForm((prev) => ({
                              ...prev,
                              reference_image_preview: "",
                              reference_image_file: null,
                              reference_embedding: null,
                              embedding_status: "not_uploaded",
                            }))
                          }
                        >
                          ลบรูป
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </section>

              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>การประมวลผลใบหน้า</h3>

                <div className={styles.processBox}>
                  <div className={styles.processText}>
                    <div>
                      สถานะ: <strong>{getEmbeddingLabel(form.embedding_status)}</strong>
                    </div>

                    {!modelsLoaded && (
                      <div className={styles.processSubtext}>
                        {modelError || "กำลังโหลดโมเดลตรวจจับใบหน้า..."}
                      </div>
                    )}

                    {embeddingBusy && (
                      <div className={styles.processSubtext}>
                        กำลังสร้าง embedding จากรูปภาพ...
                      </div>
                    )}

                    {form.embedding_status === "pending" && !embeddingBusy && (
                      <div className={styles.processSubtext}>
                        ระบบกำลังเตรียมข้อมูลใบหน้า
                      </div>
                    )}

                    {form.embedding_status === "ready" && form.reference_embedding && (
                      <div className={styles.readyWrap}>
                        <span className={`${styles.badge} ${styles.badgeSuccess}`}>
                          พร้อมใช้งาน
                        </span>

                        <div className={styles.processSubtext}>
                          face embedding: {form.reference_embedding.length} ค่า
                        </div>
                      </div>
                    )}

                    {form.embedding_status === "failed" && (
                      <div className={styles.readyWrap}>
                        <span className={`${styles.badge} ${styles.badgeDanger}`}>
                          สร้าง embedding ไม่สำเร็จ กรุณาเปลี่ยนรูปใหม่
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </section>

              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>ข้อมูลระบบ</h3>

                <div className={styles.formGrid2}>
                  <div className={styles.field}>
                    <label>วันที่สร้าง</label>
                    <input
                      className={`${styles.input} ${styles.readonlyInput}`}
                      value={form.created_at ? formatDate(form.created_at) : "-"}
                      disabled
                    />
                  </div>

                  <div className={styles.field}>
                    <label>วันที่แก้ไขล่าสุด</label>
                    <input
                      className={`${styles.input} ${styles.readonlyInput}`}
                      value={form.updated_at ? formatDate(form.updated_at) : "-"}
                      disabled
                    />
                  </div>

                  <div className={styles.field}>
                    <label>ผู้สร้าง</label>
                    <input
                      className={`${styles.input} ${styles.readonlyInput}`}
                      value={form.created_by || "-"}
                      disabled
                    />
                  </div>

                  <div className={styles.field}>
                    <label>ผู้แก้ไขล่าสุด</label>
                    <input
                      className={`${styles.input} ${styles.readonlyInput}`}
                      value={form.updated_by || "-"}
                      disabled
                    />
                  </div>
                </div>
              </section>
            </div>

            <div className={styles.modalFooter}>
              {!isReadOnly && (
                <>
                  <button
                    className={styles.primaryButton}
                    onClick={() => void handleSave()}
                    disabled={saving || embeddingBusy || !modelsLoaded}
                  >
                    {saving ? "กำลังบันทึก..." : "บันทึก"}
                  </button>

                  {modalMode === "create" && (
                    <button
                      className={styles.secondaryButton}
                      onClick={handleClearCreateForm}
                      disabled={saving || embeddingBusy}
                    >
                      ล้างข้อมูล
                    </button>
                  )}
                </>
              )}

              <button className={styles.cancelButton} onClick={closeModal}>
                {isReadOnly ? "ปิด" : "ยกเลิก"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}