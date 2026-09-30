// src/pages/Attendance/LocationSelect/index.tsx

import { useState } from "react";
import Header from "@/layout/Header";
import BackButton from "@/components/BackButton";
import WorkReportDeleteConfirmModal from "@/components/RecordReport/WorkReportDeleteConfirmModal";
import WorkReportSuccessModal from "@/components/RecordReport/WorkReportSuccessModal";
import styles from "./LocationSelect.module.css";

export type AttendancePunchType = "in" | "out";
export type AttendanceLocationOption = {
  locationId: number;
  contractCode?: string | null;
  locationName: string;
  /**
   * true  = หน่วยงานนี้มีรายการเข้างานที่ยังไม่ได้ออกงาน
   * false = หน่วยงานนี้สามารถลงเวลาเข้างานได้
   *
   * แต่ละหน่วยงานแยกสถานะออกจากกัน ผู้ใช้จึงสามารถเข้างาน
   * หน่วยงานอื่นได้ แม้จะมีรายการค้างอยู่คนละหน่วยงาน
   */
  hasOpenRecord: boolean;
};
export type AttendanceHistoryStatus =
  | "in_progress"
  | "completed"
  | "cancelled";
export type AttendanceHistoryItem = {
  timeRecordId: number;
  documentNo?: string | null;
  contractCode?: string | null;
  locationName: string;
  checkin?: string | null;
  checkout?: string | null;
  status: AttendanceHistoryStatus;
};
export type AttendanceLocationSelection = {
  location: AttendanceLocationOption;
  punchType: AttendancePunchType;
};
type Props = {
  empCode: string;
  displayName?: string;
  /** รายการหน่วยงานที่ GPS ปัจจุบันอยู่ภายในรัศมี */
  locations: AttendanceLocationOption[];
  /** locationId ที่กำลังเปิดหน้าถัดไปหรือกำลังประมวลผล */
  busyLocationId?: number | null;
  /** ประวัติการบันทึกรายงานตามวันที่ที่เลือก */
  historyDate: string;
  historyItems?: AttendanceHistoryItem[];
  onHistoryDateChange: (value: string) => void;
  onSelectLocation: (selection: AttendanceLocationSelection) => void;
  onOpenHistory?: (item: AttendanceHistoryItem) => void;
  onEditHistory?: (item: AttendanceHistoryItem) => void;
  /**
   * Callback สำหรับยกเลิกข้อมูลบันทึกรายงาน
   *
   * ฝั่ง Parent เป็นผู้จัดการข้อมูลจริงใน Backend
   * LocationSelect แสดงสถานะกำลังดำเนินการและ Success Modal
   */
  onDeleteHistory?: (
    item: AttendanceHistoryItem,
  ) => void | Promise<void>;
  onBack: () => void;
};
function getLocationLabel(params: {
  locationId: number;
  contractCode?: string | null;
  locationName: string;
}) {
  const contractCode = params.contractCode?.trim() || "";
  const locationName = params.locationName.trim();
  if (contractCode && locationName) {
    return `${contractCode} - ${locationName}`;
  }
  return contractCode || locationName || `หน่วยงาน ${params.locationId}`;
}
function getHistoryStatusText(status: AttendanceHistoryStatus) {
  if (status === "cancelled") {
    return (
      <>
        ยกเลิกบันทึก
        <br />
        รายงาน
      </>
    );
  }
  return status === "completed"
    ? "ดำเนินการเรียบร้อย"
    : "อยู่ระหว่างดำเนินการ";
}
function formatHistoryDocumentNo(value?: string | null) {
  const cleanValue = value?.trim() ?? "";
  return cleanValue || "-";
}
function formatHistoryTime(value?: string | null) {
  const cleanValue = value?.trim() ?? "";
  if (!cleanValue) {
    return "--:--";
  }
  const dateTimeMatch = cleanValue.match(
    /(?:T|\s)(\d{2}):(\d{2})(?::\d{2})?/,
  );
  if (dateTimeMatch) {
    return `${dateTimeMatch[1]}:${dateTimeMatch[2]}`;
  }
  const timeOnlyMatch = cleanValue.match(
    /^(\d{2}):(\d{2})(?::\d{2})?$/,
  );
  if (timeOnlyMatch) {
    return `${timeOnlyMatch[1]}:${timeOnlyMatch[2]}`;
  }
  const date = new Date(cleanValue);
  if (Number.isNaN(date.getTime())) {
    return "--:--";
  }
  return `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}`;
}
export default function AttendanceLocationSelect({
  empCode,
  displayName,
  locations,
  busyLocationId = null,
  historyDate,
  historyItems = [],
  onHistoryDateChange,
  onSelectLocation,
  onOpenHistory,
  onEditHistory,
  onDeleteHistory,
  onBack,
}: Props) {
  const [pendingCancelItem, setPendingCancelItem] =
    useState<AttendanceHistoryItem | null>(null);
  const [cancelSuccessModalOpen, setCancelSuccessModalOpen] =
    useState(false);
  const [cancellingTimeRecordId, setCancellingTimeRecordId] = useState<
    number | null
  >(null);
  const isBusy =
    busyLocationId !== null ||
    cancellingTimeRecordId !== null;
  function handleSelectLocation(location: AttendanceLocationOption) {
    if (isBusy) return;
    onSelectLocation({
      location,
      punchType: location.hasOpenRecord ? "out" : "in",
    });
  }
  function handleBackClick() {
    if (isBusy) return;
    onBack();
  }
  function requestCancelHistory(item: AttendanceHistoryItem) {
    if (!onDeleteHistory || isBusy) {
      return;
    }
    setPendingCancelItem(item);
  }
  function closeCancelConfirmModal() {
    if (cancellingTimeRecordId !== null) {
      return;
    }
    setPendingCancelItem(null);
  }
  async function confirmCancelHistory() {
    if (!pendingCancelItem || !onDeleteHistory || isBusy) {
      return;
    }
    const cancellingItem = pendingCancelItem;
    try {
      setCancellingTimeRecordId(cancellingItem.timeRecordId);
      await Promise.resolve(onDeleteHistory(cancellingItem));
      setPendingCancelItem(null);
      setCancelSuccessModalOpen(true);
    } catch (cancelError) {
      console.error(
        "Cancel work report history error:",
        cancelError,
      );
    } finally {
      setCancellingTimeRecordId(null);
    }
  }
  function closeCancelSuccessModal() {
    setCancelSuccessModalOpen(false);
  }
  return (
    <>
      <main className="guts-bg">
        <div className="guts-home">
          <section
            className="guts-home-card"
            aria-label="เลือกหน่วยงานสำหรับลงเวลาเข้า-ออกงาน"
          >
            <Header empCode={empCode} displayName={displayName} />
            <h2 className={styles.attTitle}>
              หน้าจอ - เลือกหน่วยงาน (ติดตาม/มอบหมาย)
            </h2>
            <section
              className={styles.section}
              aria-labelledby="attendance-location-heading"
            >
              <h3
                id="attendance-location-heading"
                className={styles.sectionTitle}
              >
                1. เลือกหน่วยงานที่ต้องเข้าปฏิบัติงาน
              </h3>
              <div className={styles.tableCard}>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th scope="col">หน่วยงาน</th>
                        <th
                          scope="col"
                          className={styles.actionColumn}
                        >
                          เลือกทำรายการ
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {locations.length > 0 ? (
                        locations.map((location) => {
                          const punchType: AttendancePunchType =
                            location.hasOpenRecord ? "out" : "in";
                          const rowBusy =
                            busyLocationId === location.locationId;
                          return (
                            <tr key={location.locationId}>
                              <td className={styles.locationCell}>
                                {getLocationLabel(location)}
                              </td>
                              <td className={styles.actionCell}>
                                <button
                                  type="button"
                                  className={`${styles.actionButton} ${
                                    punchType === "out"
                                      ? styles.checkOutButton
                                      : styles.checkInButton
                                  }`}
                                  disabled={isBusy}
                                  onClick={() =>
                                    handleSelectLocation(location)
                                  }
                                >
                                  {rowBusy
                                    ? "กำลังดำเนินการ..."
                                    : punchType === "out"
                                      ? "กดลงเวลาออก"
                                      : "กดลงเวลาเข้า"}
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td
                            className={styles.emptyCell}
                            colSpan={2}
                          >
                            ไม่พบหน่วยงานในพื้นที่ปัจจุบัน
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
            <section
              className={styles.section}
              aria-labelledby="attendance-history-heading"
            >
              <div className={styles.historyHeadingRow}>
                <h3
                  id="attendance-history-heading"
                  className={styles.sectionTitle}
                >
                  2. ประวัติการบันทึกรายงาน
                </h3>
                <input
                  type="date"
                  className={styles.dateInput}
                  value={historyDate}
                  onChange={(event) =>
                    onHistoryDateChange(
                      event.currentTarget.value,
                    )
                  }
                  aria-label="เลือกวันที่ของประวัติการเข้าทำงาน"
                  disabled={isBusy}
                />
              </div>
              <div className={styles.tableCard}>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th scope="col">หน่วยงาน</th>
                        <th
                          scope="col"
                          className={styles.statusColumn}
                        >
                          สถานะ
                        </th>
                        <th
                          scope="col"
                          className={styles.editColumn}
                        >
                          จัดการ
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyItems.length > 0 ? (
                        historyItems.map((item) => {
                          const rowCancelling =
                            cancellingTimeRecordId ===
                            item.timeRecordId;
                          return (
                            <tr key={item.timeRecordId}>
                              <td className={styles.locationCell}>
                                <div>
                                  <div
                                    style={{
                                      color: "#000000",
                                      fontWeight: 400,
                                    }}
                                  >
                                    <strong>
                                      รหัสบันทึกรายงาน
                                    </strong>
                                  </div>
                                  <div
                                    style={{
                                      color: "#000000",
                                      fontWeight: 400,
                                    }}
                                  >
                                    {formatHistoryDocumentNo(
                                      item.documentNo,
                                    )}
                                  </div>
                                  <div
                                    style={{
                                      color: "#000000",
                                      fontWeight: 400,
                                    }}
                                  >
                                    เข้า{" "}
                                    {item.checkin
                                      ? formatHistoryTime(
                                          item.checkin,
                                        )
                                      : "-:-"}
                                    {" / "}
                                    ออก{" "}
                                    {item.checkout
                                      ? formatHistoryTime(
                                          item.checkout,
                                        )
                                      : "-:-"}
                                  </div>
                                  <div>
                                    <button
                                      type="button"
                                      className={
                                        styles.historyLocationButton
                                      }
                                      disabled={
                                        !onOpenHistory || isBusy
                                      }
                                      onClick={() =>
                                        onOpenHistory?.(item)
                                      }
                                    >
                                      {getLocationLabel({
                                        locationId:
                                          item.timeRecordId,
                                        contractCode:
                                          item.contractCode,
                                        locationName:
                                          item.locationName,
                                      })}
                                    </button>
                                  </div>
                                </div>
                              </td>
                              <td
                                className={`${styles.historyStatus} ${
                                  item.status === "completed"
                                    ? styles.completedStatus
                                    : styles.inProgressStatus
                                }`}
                              >
                                <span
                                  style={{
                                    color:
                                      item.status === "completed"
                                        ? "#16a34a"
                                        : item.status === "cancelled"
                                          ? "#dc2626"
                                          : "#f97316",
                                  }}
                                >
                                  {getHistoryStatusText(item.status)}
                                </span>
                              </td>
                              <td
                                className={styles.editCell}
                                style={{ paddingLeft: 0 }}
                              >
                                <div
                                  className={
                                    styles.historyActions
                                  }
                                  style={{
                                    width: "100%",
                                    justifyContent: "space-between",
                                  }}
                                >
                                  <button
                                    type="button"
                                    className={styles.editButton}
                                    disabled={
                                      !onEditHistory || isBusy
                                    }
                                    onClick={() =>
                                      onEditHistory?.(item)
                                    }
                                  >
                                    แก้ไข
                                  </button>
                                  <button
                                    type="button"
                                    className={
                                      styles.deleteButton
                                    }
                                    disabled={
                                      !onDeleteHistory ||
                                      isBusy
                                    }
                                    onClick={() =>
                                      requestCancelHistory(item)
                                    }
                                  >
                                    {rowCancelling
                                      ? "กำลังยกเลิก..."
                                      : "ยกเลิก"}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td
                            className={styles.emptyCell}
                            colSpan={3}
                          >
                            ยังไม่มีข้อมูลประวัติการเข้าทำงาน
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
            <div className="guts-fv-bottom">
              <BackButton
                onClick={handleBackClick}
                disabled={isBusy}
                className="guts-fv-backBtn"
              />
            </div>
          </section>
        </div>
      </main>
      <WorkReportDeleteConfirmModal
        open={pendingCancelItem !== null}
        recordLabel={
          pendingCancelItem
            ? getLocationLabel({
                locationId: pendingCancelItem.timeRecordId,
                contractCode: pendingCancelItem.contractCode,
                locationName: pendingCancelItem.locationName,
              })
            : ""
        }
        busy={cancellingTimeRecordId !== null}
        onCancel={closeCancelConfirmModal}
        onConfirm={confirmCancelHistory}
      />
      <WorkReportSuccessModal
        open={cancelSuccessModalOpen}
        onOk={closeCancelSuccessModal}
        title="ยกเลิกข้อมูลบันทึกรายงานเรียบร้อย"
        message="ข้อมูลบันทึกรายงานถูกยกเลิกเรียบร้อยแล้ว"
      />
    </>
  );
}
