import { useEffect, useMemo, useState } from "react";
import ShiftFormModal, {
  type ShiftFormValues,
} from "../../components/ShiftFormModal";
import styles from "./Shifts.module.css";
import { shiftService } from "@/services/shift.service";

type Props = {
  onBack: () => void;
  currentUserCode: string;
};

type StatusFilter = "all" | "active" | "inactive";

type ShiftItem = Omit<ShiftFormValues, "effective_from" | "effective_to"> & {
  shift_id: number;
  effective_from: string;
  effective_to: string | null;
  mark_flag: boolean | number;
};

type ShiftPayload = Omit<ShiftFormValues, "effective_from" | "effective_to"> & {
  effective_from: string;
  effective_to: string | null;
  created_by?: string;
  updated_by?: string;
};

function getTodayDateString() {
  const today = new Date();
  const timezoneOffset = today.getTimezoneOffset() * 60000;
  return new Date(today.getTime() - timezoneOffset).toISOString().slice(0, 10);
}

function normalizeShiftValues(values: ShiftFormValues): ShiftPayload {
  return {
    ...values,
    effective_from: values.effective_from || getTodayDateString(),
    effective_to: values.effective_to || null,
  };
}

function getCurrentUserCode(currentUserCode: string) {
  const userCode = currentUserCode.trim();

  if (!/^\d{6}$/.test(userCode)) {
    throw new Error("ไม่พบรหัสพนักงานผู้ใช้งาน กรุณาเข้าสู่ระบบใหม่");
  }

  return userCode;
}

function formatThaiDate(value?: string | null) {
  if (!value) return "-";

  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;

  return `${day}/${month}/${year}`;
}

function formatDurationThai(minutes: number) {
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hrs} ชั่วโมง ${mins} นาที`;
}

function isMarkedDeleted(item: ShiftItem) {
  return item.mark_flag === true || item.mark_flag === 1;
}

function getStatusLabel(item: ShiftItem) {
  if (isMarkedDeleted(item)) return "ลบแล้ว";
  return item.is_active ? "ON" : "OFF";
}

function getStatusClass(item: ShiftItem) {
  if (isMarkedDeleted(item)) return "deleted";
  return item.is_active ? "active" : "inactive";
}

export default function ShiftsPage({ onBack, currentUserCode }: Props) {
  const [shifts, setShifts] = useState<ShiftItem[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [showDeleted, setShowDeleted] = useState(false);

  const [loading, setLoading] = useState(false);
  const [pageError, setPageError] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<ShiftItem | null>(null);

  const loadShifts = async (
    options?: {
      statusFilter?: StatusFilter;
      showDeleted?: boolean;
    },
  ) => {
    try {
      setLoading(true);
      setPageError("");

      const nextStatusFilter = options?.statusFilter ?? statusFilter;
      const nextShowDeleted = options?.showDeleted ?? showDeleted;

      const data = await shiftService.getShifts({
        is_active:
          nextStatusFilter === "all"
            ? undefined
            : nextStatusFilter === "active"
              ? true
              : false,
        include_deleted: nextShowDeleted,
        skip: 0,
        limit: 100,
      });

      setShifts(data as ShiftItem[]);
    } catch (error) {
      setPageError(
        error instanceof Error ? error.message : "โหลดข้อมูลกะงานไม่สำเร็จ",
      );
      setShifts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadShifts();
  }, [statusFilter, showDeleted]);

  const filteredShifts = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return shifts;

    return shifts.filter((item) => {
      return (
        item.shift_name_th.toLowerCase().includes(keyword) ||
        item.shift_name_en.toLowerCase().includes(keyword)
      );
    });
  }, [search, shifts]);

  const openCreateModal = () => {
    try {
      getCurrentUserCode(currentUserCode);
      setEditingShift(null);
      setIsModalOpen(true);
    } catch (error) {
      alert(error instanceof Error ? error.message : "ไม่พบรหัสพนักงานผู้ใช้งาน");
    }
  };

  const openEditModal = (shift: ShiftItem) => {
    if (isMarkedDeleted(shift)) return;

    try {
      getCurrentUserCode(currentUserCode);
      setEditingShift(shift);
      setIsModalOpen(true);
    } catch (error) {
      alert(error instanceof Error ? error.message : "ไม่พบรหัสพนักงานผู้ใช้งาน");
    }
  };

  const closeModal = () => {
    setEditingShift(null);
    setIsModalOpen(false);
  };

  const handleSubmitShift = async (values: ShiftFormValues) => {
    try {
      const userCode = getCurrentUserCode(currentUserCode);
      const payload = normalizeShiftValues(values);

      if (editingShift) {
        const updatePayload: ShiftPayload = {
          ...payload,
          updated_by: userCode,
        };

        await shiftService.updateShift(
          editingShift.shift_id,
          updatePayload as unknown as ShiftFormValues,
        );
      } else {
        const createPayload: ShiftPayload = {
          ...payload,
          created_by: userCode,
        };

        await shiftService.createShift(
          createPayload as unknown as ShiftFormValues,
        );
      }

      await loadShifts();
      closeModal();
    } catch (error) {
      alert(error instanceof Error ? error.message : "บันทึกกะงานไม่สำเร็จ");
    }
  };

  const handleSoftDelete = async (shiftId: number) => {
    const confirmed = window.confirm("ยืนยันการลบกะงานนี้หรือไม่");
    if (!confirmed) return;

    try {
      const userCode = getCurrentUserCode(currentUserCode);

      await shiftService.deleteShift(shiftId, userCode);
      await loadShifts();
    } catch (error) {
      alert(error instanceof Error ? error.message : "ลบข้อมูลไม่สำเร็จ");
    }
  };

  const handleView = (shift: ShiftItem) => {
    window.alert(
      [
        `Shift ID: ${shift.shift_id}`,
        `ชื่อกะไทย: ${shift.shift_name_th}`,
        `ชื่อกะอังกฤษ: ${shift.shift_name_en}`,
        `เวลา: ${shift.start_time} - ${shift.end_time}`,
        `ข้ามวัน: ${shift.crosses_midnight ? "ใช่" : "ไม่ใช่"}`,
        `เวลางานรวม: ${formatDurationThai(shift.work_minutes)}`,
        `สถานะ: ${getStatusLabel(shift)}`,
        `วันที่เริ่มใช้: ${formatThaiDate(shift.effective_from)}`,
        `วันที่สิ้นสุด: ${formatThaiDate(shift.effective_to)}`,
      ].join("\n"),
    );
  };

  const handleRefresh = async () => {
    const defaultStatusFilter: StatusFilter = "all";
    const defaultShowDeleted = false;

    setSearch("");
    setStatusFilter(defaultStatusFilter);
    setShowDeleted(defaultShowDeleted);

    await loadShifts({
      statusFilter: defaultStatusFilter,
      showDeleted: defaultShowDeleted,
    });
  };

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <div className={styles.titleWrap}>
          <h1 className={styles.title}>จัดการข้อมูลกะงาน</h1>
          <p className={styles.subtitle}>ใช้เพิ่ม แก้ไข และจัดการกะงานพนักงาน</p>
        </div>

        <div className={styles.actions}>
          <button className={styles.secondaryButton} onClick={onBack}>
            กลับ
          </button>

          <button className={styles.primaryButton} onClick={openCreateModal}>
            <span className={styles.buttonIcon}>＋</span>
            เพิ่มกะงาน
          </button>

          <button
            className={styles.secondaryButton}
            onClick={() => void handleRefresh()}
          >
            รีเฟรช
          </button>
        </div>
      </div>

      <div className={styles.listCard}>
        <div className={styles.toolbar}>
          <div className={styles.toolbarLeft}>
            <div className={styles.searchWrap}>
              <span className={styles.searchIcon}>⌕</span>
              <input
                className={styles.searchInput}
                type="text"
                placeholder="ค้นหาชื่อกะงาน..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <select
              className={styles.select}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            >
              <option value="all">สถานะทั้งหมด</option>
              <option value="active">ใช้งาน</option>
              <option value="inactive">ไม่ใช้งาน</option>
            </select>
          </div>

          <div className={styles.toggleWrap}>
            <span className={styles.toggleText}>แสดงรายการที่ลบแล้ว</span>
            <label className={styles.switch}>
              <input
                className={styles.switchInput}
                type="checkbox"
                checked={showDeleted}
                onChange={(e) => setShowDeleted(e.target.checked)}
              />
              <span className={styles.switchSlider} />
            </label>
          </div>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Shift ID</th>
                <th>ชื่อกะไทย</th>
                <th>ชื่อกะอังกฤษ</th>
                <th>เวลาเข้างาน–ออกงาน</th>
                <th>ข้ามวัน</th>
                <th>เวลางานรวม</th>
                <th>สถานะ</th>
                <th>วันที่เริ่มใช้</th>
                <th>วันที่สิ้นสุด</th>
                <th>จัดการ</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td className={styles.emptyCell} colSpan={10}>
                    กำลังโหลดข้อมูลกะงาน...
                  </td>
                </tr>
              ) : pageError ? (
                <tr>
                  <td className={styles.emptyCell} colSpan={10}>
                    {pageError}
                  </td>
                </tr>
              ) : filteredShifts.length === 0 ? (
                <tr>
                  <td className={styles.emptyCell} colSpan={10}>
                    ไม่พบข้อมูลกะงาน
                  </td>
                </tr>
              ) : (
                filteredShifts.map((item) => (
                  <tr key={item.shift_id}>
                    <td>{item.shift_id}</td>
                    <td>{item.shift_name_th}</td>
                    <td>{item.shift_name_en}</td>
                    <td>
                      {item.start_time} - {item.end_time}
                    </td>
                    <td>
                      <span
                        className={`${styles.crossBadge} ${
                          item.crosses_midnight
                            ? styles.crossYes
                            : styles.crossNo
                        }`}
                      >
                        {item.crosses_midnight ? "ข้ามวัน" : "ปกติ"}
                      </span>
                    </td>
                    <td>{formatDurationThai(item.work_minutes)}</td>
                    <td>
                      <span
                        className={`${styles.statusChip} ${
                          getStatusClass(item) === "active"
                            ? styles.statusActive
                            : getStatusClass(item) === "inactive"
                              ? styles.statusInactive
                              : styles.statusDeleted
                        }`}
                      >
                        {getStatusLabel(item)}
                      </span>
                    </td>
                    <td>{formatThaiDate(item.effective_from)}</td>
                    <td>{formatThaiDate(item.effective_to)}</td>
                    <td>
                      <div className={styles.actionGroup}>
                        <button
                          className={styles.iconButton}
                          onClick={() => openEditModal(item)}
                          title="แก้ไข"
                          disabled={isMarkedDeleted(item)}
                        >
                          ✎
                        </button>

                        <button
                          className={styles.iconButton}
                          onClick={() => void handleSoftDelete(item.shift_id)}
                          title="ลบ"
                          disabled={isMarkedDeleted(item)}
                        >
                          🗑
                        </button>

                        <button
                          className={styles.iconButton}
                          onClick={() => handleView(item)}
                          title="ดูรายละเอียด"
                        >
                          👁
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ShiftFormModal
        isOpen={isModalOpen}
        mode={editingShift ? "edit" : "create"}
        initialValues={editingShift ?? undefined}
        onClose={closeModal}
        onSubmit={(values) => void handleSubmitShift(values)}
      />
    </div>
  );
}