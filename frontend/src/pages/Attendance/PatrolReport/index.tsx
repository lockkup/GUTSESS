import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  Check,
  ChevronRight,
  ChevronUp,
  FileSearch,
  Hourglass,
  Info,
  PhoneCall,
  RefreshCcw,
  Search,
  UserRoundPen,
} from "lucide-react";

import BackButton from "@/components/BackButton";
import {
  getPatrolReport,
  getPatrolReportFilterOptions,
  type PatrolReportFilterOptions,
  type PatrolReportRow,
  type PatrolStatus,
} from "@/services/patrolReportApi";

import styles from "./PatrolReport.module.css";

type ShiftValue = "day" | "night";

type PatrolNotificationLevel = "none" | "green" | "yellow" | "orange" | "red";

type ReportDisplayStatus = PatrolStatus | "completed_call";
type StatusFilterValue = "all" | ReportDisplayStatus;

type PatrolReportPageProps = {
  onBack: () => void;
};

type FetchPatrolReportOptions = {
  workday: string;
  shiftValue: ShiftValue;
  searchText: string;
  departmentIdText: string;
  divisionIdText: string;
  routeIdText: string;
  locationIdText: string;
  employeeCodeText: string;
};

type ExtraPatrolReportFilterParams = {
  departmentId?: number;
  divisionId?: number;
  routeId?: number;
  locationId?: number;
  employeeCode?: string;
};

type PatrolReportDisplayRow = PatrolReportRow & {
  assignmentStatus?: PatrolStatus | null;
  assignment_status?: PatrolStatus | null;

  departmentId?: number | string | null;
  department_id?: number | string | null;

  divisionId?: number | string | null;
  division_id?: number | string | null;

  routeId?: number | string | null;
  route_id?: number | string | null;

  locationId?: number | string | null;
  location_id?: number | string | null;

  effectiveFrom?: string | null;
  effective_from?: string | null;

  byContract?: number | string | null;
  by_contract?: number | string | null;

  lastInspectionDate?: string | null;
  last_inspection_date?: string | null;

  daysWithoutInspection?: number | string | null;
  days_without_inspection?: number | string | null;

  notificationLevel?: PatrolNotificationLevel | null;
  notification_level?: PatrolNotificationLevel | null;

  notificationText?: string | null;
  notification_text?: string | null;

  scheduleText?: string | null;
  schedule_text?: string | null;

  contactDetail?: string | null;
  contact_detail?: string | null;

  callStatus?: number | string | null;
  call_status?: number | string | null;

  callNote?: string | null;
  call_note?: string | null;

  employeeCode?: string | null;
  employee_code?: string | null;

  positionName?: string | null;
  position_name?: string | null;

  operatorName?: string | null;
  operator_name?: string | null;
};

type CalendarCell = {
  date: Date;
  isCurrentMonth: boolean;
};

type EmptyReportStateProps = {
  title?: string;
  hint?: string;
};

const EMPTY_FILTER_OPTIONS: PatrolReportFilterOptions = {
  departments: [],
  divisions: [],
  routes: [],
  locations: [],
  employees: [],
};

const THAI_MONTH_SHORT = [
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

const THAI_MONTH_FULL = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];

const THAI_WEEKDAYS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

function getTodayYYYYMMDD() {
  const today = new Date();

  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseYYYYMMDD(value: string) {
  if (!value) return undefined;

  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if (!year || !month || !day) return undefined;

  return new Date(year, month - 1, day);
}

function formatDateToYYYYMMDD(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDateThaiShort(value: string) {
  const date = parseYYYYMMDD(value);

  if (!date) return "เลือกวันที่";

  return `${date.getDate()} ${THAI_MONTH_SHORT[date.getMonth()]} ${
    date.getFullYear() + 543
  }`;
}

function getCalendarTitle(date: Date) {
  return `${THAI_MONTH_FULL[date.getMonth()]} ${date.getFullYear() + 543}`;
}

function getCalendarCells(monthDate: Date): CalendarCell[] {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();

  const firstDate = new Date(year, month, 1);
  const firstDayIndex = firstDate.getDay();

  const currentMonthDays = new Date(year, month + 1, 0).getDate();
  const previousMonthDays = new Date(year, month, 0).getDate();

  return Array.from({ length: 42 }, (_, index) => {
    const dayNumber = index - firstDayIndex + 1;

    if (dayNumber <= 0) {
      return {
        date: new Date(year, month - 1, previousMonthDays + dayNumber),
        isCurrentMonth: false,
      };
    }

    if (dayNumber > currentMonthDays) {
      return {
        date: new Date(year, month + 1, dayNumber - currentMonthDays),
        isCurrentMonth: false,
      };
    }

    return {
      date: new Date(year, month, dayNumber),
      isCurrentMonth: true,
    };
  });
}

function toPositiveNumber(value: string) {
  const text = value.trim();

  if (!text) return undefined;

  const numberValue = Number(text);

  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    return undefined;
  }

  return numberValue;
}

function makeReactKey(...values: Array<string | number | null | undefined>) {
  return values.map((value) => String(value ?? "")).join("-");
}

const SHIFT_ID_BY_VALUE: Record<ShiftValue, number> = {
  day: 1,
  night: 2,
};

const DEFAULT_SHIFT_VALUE: ShiftValue = "day";
const DEFAULT_STATUS_VALUE: StatusFilterValue = "all";
const DEFAULT_SEARCH_TEXT = "";

const DEFAULT_DEPARTMENT_ID_TEXT = "";
const DEFAULT_DIVISION_ID_TEXT = "";
const DEFAULT_ROUTE_ID_TEXT = "";
const DEFAULT_LOCATION_ID_TEXT = "";
const DEFAULT_EMPLOYEE_CODE_TEXT = "";

function getStatusLabel(status: ReportDisplayStatus) {
  switch (status) {
    case "completed":
      return "ตรวจแล้ว";
    case "completed_call":
      return "ตรวจแล้ว(โทร)";
    case "in_progress":
      return "อยู่ระหว่างการเข้าตรวจ";
    case "pending":
      return "รอดำเนินการเข้าตรวจ";
    default:
      return "-";
  }
}

function getStatusClass(status: ReportDisplayStatus) {
  switch (status) {
    case "completed":
      return styles.statusCompleted;
    case "completed_call":
      return styles.statusCompletedCall;
    case "in_progress":
      return styles.statusInProgress;
    case "pending":
      return styles.statusPending;
    default:
      return "";
  }
}

function getAssignmentStatus(row: PatrolReportDisplayRow): PatrolStatus {
  return row.assignmentStatus ?? row.assignment_status ?? row.status;
}

function getCallStatus(row: PatrolReportDisplayRow) {
  const value = row.callStatus ?? row.call_status ?? null;

  if (value === null || value === undefined) {
    return null;
  }

  const text = String(value).trim();

  if (!text) {
    return null;
  }

  const numberValue = Number(text);

  return Number.isFinite(numberValue) ? numberValue : null;
}

function getDisplayStatus(row: PatrolReportDisplayRow): ReportDisplayStatus {
  const callStatus = getCallStatus(row);

  if (callStatus !== null) {
    return "completed_call";
  }

  return getAssignmentStatus(row);
}

function getEffectiveFromText(row: PatrolReportDisplayRow) {
  const value = row.effectiveFrom ?? row.effective_from ?? null;

  if (!value) {
    return "-";
  }

  const text = String(value).trim();

  if (!text) {
    return "-";
  }

  const dateText = text.slice(0, 10);

  if (/^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
    return formatDateThaiShort(dateText);
  }

  return text;
}

function getNotificationLevel(
  row: PatrolReportDisplayRow,
): PatrolNotificationLevel {
  const value = row.notificationLevel ?? row.notification_level ?? "none";

  if (
    value === "green" ||
    value === "yellow" ||
    value === "orange" ||
    value === "red" ||
    value === "none"
  ) {
    return value;
  }

  return "none";
}

function getNotificationText(row: PatrolReportDisplayRow) {
  const text = row.notificationText ?? row.notification_text ?? null;

  if (!text) {
    return "-";
  }

  const textValue = String(text).trim();

  return textValue || "-";
}

function getScheduleText(row: PatrolReportDisplayRow) {
  const scheduleText = row.scheduleText ?? row.schedule_text ?? null;

  if (scheduleText !== null && scheduleText !== undefined) {
    const textValue = String(scheduleText).trim();

    if (textValue) {
      return textValue;
    }
  }

  const byContract = row.byContract ?? row.by_contract ?? null;

  if (byContract === null || byContract === undefined) {
    return "-";
  }

  const textValue = String(byContract).trim();

  if (!textValue) {
    return "-";
  }

  if (textValue.includes("วัน")) {
    return textValue;
  }

  const numberValue = Number(textValue);

  if (Number.isFinite(numberValue) && numberValue > 0) {
    return `${numberValue} วัน`;
  }

  return textValue;
}

function getNotificationRowClass(row: PatrolReportDisplayRow) {
  const level = getNotificationLevel(row);

  switch (level) {
    case "green":
      return styles.notificationRowGreen;
    case "yellow":
      return styles.notificationRowYellow;
    case "orange":
      return styles.notificationRowOrange;
    case "red":
      return styles.notificationRowRed;
    default:
      return styles.notificationRowNone;
  }
}

function getEmployeeCode(row: PatrolReportDisplayRow) {
  return row.employeeCode ?? row.employee_code ?? "-";
}

function getPositionName(row: PatrolReportDisplayRow) {
  return row.positionName ?? row.position_name ?? "-";
}

function getContactDetail(row: PatrolReportDisplayRow) {
  return row.contactDetail ?? row.contact_detail ?? "-";
}

function getCallNote(row: PatrolReportDisplayRow) {
  return row.callNote ?? row.call_note ?? "-";
}

function getOperatorText(row: PatrolReportDisplayRow) {
  const employeeCode = getEmployeeCode(row);
  const positionName = getPositionName(row);

  const hasEmployeeCode = employeeCode !== "-";
  const hasPositionName = positionName !== "-";

  if (hasEmployeeCode && hasPositionName) {
    return `${employeeCode} – ${positionName}`;
  }

  if (hasEmployeeCode) return employeeCode;
  if (hasPositionName) return positionName;

  return row.operatorName ?? row.operator_name ?? "-";
}

function getContractCodeText(contractCode: string | null | undefined) {
  if (!contractCode) return "-";

  const value = String(contractCode).trim();

  return value.replace(/^([^\d]+)(\d+)$/, "$1 $2");
}

function getReportCountText(count: number) {
  if (count <= 0) return "แสดง 0 รายการ";
  return `แสดง 1 - ${count} จาก ${count} รายการ`;
}

function getDepartmentOptionLabel(departmentName: string, departmentId: number) {
  const name = departmentName.trim();

  if (!name) {
    return `ภาค ${departmentId}`;
  }

  return `${departmentId} - ${name}`;
}

function getDivisionOptionLabel(divisionName: string, divisionId: number) {
  const name = divisionName.trim();

  if (!name) {
    return `เขต ${divisionId}`;
  }

  return `${divisionId} - ${name}`;
}

function getRouteOptionLabel(routeName: string, routeId: number) {
  const name = routeName.trim();

  if (!name) {
    return `เส้นทาง ${routeId}`;
  }

  return `${routeId} - ${name}`;
}

function getLocationOptionLabel(
  contractCode: string,
  locationName: string,
  locationId: number,
) {
  const contractText = getContractCodeText(contractCode);
  const locationText = locationName.trim();

  if (contractText !== "-" && locationText) {
    return `${contractText} - ${locationText}`;
  }

  if (locationText) {
    return `${locationId} - ${locationText}`;
  }

  return `หน่วยงาน ${locationId}`;
}

function getEmployeeOptionLabel(
  employeeCode: string,
  employeeName: string | null,
  positionName: string | null,
) {
  const employeeNameText = employeeName?.trim();
  const positionNameText = positionName?.trim();

  if (employeeNameText && positionNameText) {
    return `${employeeCode} - ${employeeNameText} (${positionNameText})`;
  }

  if (employeeNameText) {
    return `${employeeCode} - ${employeeNameText}`;
  }

  if (positionNameText) {
    return `${employeeCode} - ${positionNameText}`;
  }

  return employeeCode;
}

function EmptyReportState({
  title = "ไม่พบข้อมูลรายงานสายตรวจ",
  hint = "กรุณาติดต่อผู้ดูแลระบบ",
}: EmptyReportStateProps) {
  return (
    <div className={styles.emptyState}>
      <div className={styles.emptyIconWrap} aria-hidden="true">
        <div className={styles.emptyIconCircle}>
          <FileSearch
            className={styles.emptyClipboardIcon}
            size={64}
            strokeWidth={1.9}
          />
        </div>
      </div>

      <h3 className={styles.emptyTitle}>{title}</h3>
      <div className={styles.emptyDivider} />

      <div className={styles.emptyHint}>
        <Info
          className={styles.emptyHintIcon}
          size={24}
          strokeWidth={2.5}
          aria-hidden="true"
        />
        <span>{hint}</span>
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: ReportDisplayStatus }) {
  if (status === "completed_call") {
    return (
      <span className={`${styles.statusIcon} ${styles.iconCompletedCall}`}>
        <PhoneCall size={17} strokeWidth={2.8} />
      </span>
    );
  }

  if (status === "completed") {
    return (
      <span className={`${styles.statusIcon} ${styles.iconCompleted}`}>
        <Check size={18} strokeWidth={3} />
      </span>
    );
  }

  if (status === "in_progress") {
    return (
      <span className={`${styles.statusIcon} ${styles.iconInProgress}`}>
        <UserRoundPen size={17} strokeWidth={2.8} />
      </span>
    );
  }

  return (
    <span className={`${styles.statusIcon} ${styles.iconPending}`}>
      <Hourglass size={17} strokeWidth={2.8} />
    </span>
  );
}

export default function PatrolReportPage({ onBack }: PatrolReportPageProps) {
  const [patrolRows, setPatrolRows] = useState<PatrolReportDisplayRow[]>([]);
  const [filterOptions, setFilterOptions] =
    useState<PatrolReportFilterOptions>(EMPTY_FILTER_OPTIONS);

  const [dateValue, setDateValue] = useState(() => getTodayYYYYMMDD());
  const [shiftValue, setShiftValue] = useState<ShiftValue>(DEFAULT_SHIFT_VALUE);
  const [statusValue, setStatusValue] =
    useState<StatusFilterValue>(DEFAULT_STATUS_VALUE);
  const [searchText, setSearchText] = useState(DEFAULT_SEARCH_TEXT);

  const [departmentIdText, setDepartmentIdText] = useState(
    DEFAULT_DEPARTMENT_ID_TEXT,
  );
  const [divisionIdText, setDivisionIdText] = useState(
    DEFAULT_DIVISION_ID_TEXT,
  );
  const [routeIdText, setRouteIdText] = useState(DEFAULT_ROUTE_ID_TEXT);
  const [locationIdText, setLocationIdText] = useState(
    DEFAULT_LOCATION_ID_TEXT,
  );
  const [employeeCodeText, setEmployeeCodeText] = useState(
    DEFAULT_EMPLOYEE_CODE_TEXT,
  );

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    return parseYYYYMMDD(getTodayYYYYMMDD()) ?? new Date();
  });

  const datePickerWrapRef = useRef<HTMLDivElement | null>(null);

  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedDepartmentId = toPositiveNumber(departmentIdText);
  const selectedDivisionId = toPositiveNumber(divisionIdText);
  const selectedRouteId = toPositiveNumber(routeIdText);
  const todayText = getTodayYYYYMMDD();

  const hasAnyReportFilter =
    departmentIdText.trim() !== "" ||
    divisionIdText.trim() !== "" ||
    routeIdText.trim() !== "" ||
    locationIdText.trim() !== "" ||
    employeeCodeText.trim() !== "" ||
    searchText.trim() !== "" ||
    shiftValue !== DEFAULT_SHIFT_VALUE ||
    statusValue !== DEFAULT_STATUS_VALUE ||
    dateValue !== todayText;

  const fetchFilterOptions = useCallback(async () => {
    try {
      const options = await getPatrolReportFilterOptions();

      setFilterOptions(options);
    } catch (err) {
      console.error(err);
      setFilterOptions(EMPTY_FILTER_OPTIONS);
      setError("ไม่สามารถดึงตัวเลือกตัวกรองรายงานได้");
    }
  }, []);

  const fetchPatrolReport = useCallback(
    async ({
      workday,
      shiftValue,
      searchText,
      departmentIdText,
      divisionIdText,
      routeIdText,
      locationIdText,
      employeeCodeText,
    }: FetchPatrolReportOptions) => {
      setLoading(true);
      setHasSearched(true);
      setError(null);

      try {
        const requestParams = {
          workday,
          shiftId: SHIFT_ID_BY_VALUE[shiftValue],
          status: "all",
          keyword: searchText,
        } as Parameters<typeof getPatrolReport>[0] &
          ExtraPatrolReportFilterParams;

        const departmentId = toPositiveNumber(departmentIdText);
        const divisionId = toPositiveNumber(divisionIdText);
        const routeId = toPositiveNumber(routeIdText);
        const locationId = toPositiveNumber(locationIdText);
        const employeeCode = employeeCodeText.trim();

        if (departmentId !== undefined) {
          requestParams.departmentId = departmentId;
        }

        if (divisionId !== undefined) {
          requestParams.divisionId = divisionId;
        }

        if (routeId !== undefined) {
          requestParams.routeId = routeId;
        }

        if (locationId !== undefined) {
          requestParams.locationId = locationId;
        }

        if (employeeCode) {
          requestParams.employeeCode = employeeCode;
        }

        const rows = await getPatrolReport(requestParams);

        setPatrolRows(rows as PatrolReportDisplayRow[]);
        setExpandedId(null);
      } catch (err) {
        console.error(err);
        setPatrolRows([]);
        setError("ไม่สามารถดึงข้อมูลรายงานสายตรวจได้");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void fetchFilterOptions();
  }, [fetchFilterOptions]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        datePickerWrapRef.current &&
        !datePickerWrapRef.current.contains(event.target as Node)
      ) {
        setIsDatePickerOpen(false);
      }
    };

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsDatePickerOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, []);

  const filteredRows = useMemo(() => {
    if (statusValue === "all") {
      return patrolRows;
    }

    return patrolRows.filter((row) => getDisplayStatus(row) === statusValue);
  }, [patrolRows, statusValue]);

  const calendarCells = useMemo(
    () => getCalendarCells(calendarMonth),
    [calendarMonth],
  );

  const departmentOptions = useMemo(() => {
    return filterOptions.departments;
  }, [filterOptions.departments]);

  const divisionOptions = useMemo(() => {
    return filterOptions.divisions.filter((division) => {
      if (selectedDepartmentId === undefined) return true;

      return division.departmentId === selectedDepartmentId;
    });
  }, [filterOptions.divisions, selectedDepartmentId]);

  const routeOptions = useMemo(() => {
    return filterOptions.routes.filter((route) => {
      const matchDepartment =
        selectedDepartmentId === undefined ||
        route.departmentId === selectedDepartmentId;
      const matchDivision =
        selectedDivisionId === undefined ||
        route.divisionId === selectedDivisionId;

      return matchDepartment && matchDivision;
    });
  }, [filterOptions.routes, selectedDepartmentId, selectedDivisionId]);

  const locationOptions = useMemo(() => {
    return filterOptions.locations.filter((location) => {
      const matchDepartment =
        selectedDepartmentId === undefined ||
        location.departmentId === selectedDepartmentId;
      const matchDivision =
        selectedDivisionId === undefined ||
        location.divisionId === selectedDivisionId;
      const matchRoute =
        selectedRouteId === undefined || location.routeId === selectedRouteId;

      return matchDepartment && matchDivision && matchRoute;
    });
  }, [
    filterOptions.locations,
    selectedDepartmentId,
    selectedDivisionId,
    selectedRouteId,
  ]);

  const employeeOptions = useMemo(() => {
    return filterOptions.employees;
  }, [filterOptions.employees]);

  const reportCountText = getReportCountText(filteredRows.length);

  const emptyTitle = hasSearched
    ? "ไม่พบข้อมูลรายงานสายตรวจ"
    : "โปรดเลือก ภาค เขต เส้นทาง รายหน่วยงาน";

  const emptyHint = hasSearched
    ? "กรุณาตรวจสอบเงื่อนไขการค้นหาอีกครั้ง"
    : "เลือกตัวกรองอย่างน้อย 1 รายการ แล้วกดค้นหา";

  const handleSearch = () => {
    if (!hasAnyReportFilter) {
      setPatrolRows([]);
      setExpandedId(null);
      setHasSearched(false);
      setError(null);
      return;
    }

    void fetchPatrolReport({
      workday: dateValue,
      shiftValue,
      searchText,
      departmentIdText,
      divisionIdText,
      routeIdText,
      locationIdText,
      employeeCodeText,
    });
  };

  const handleClear = () => {
    const today = getTodayYYYYMMDD();
    const todayDate = parseYYYYMMDD(today) ?? new Date();

    setDateValue(today);
    setCalendarMonth(
      new Date(todayDate.getFullYear(), todayDate.getMonth(), 1),
    );
    setShiftValue(DEFAULT_SHIFT_VALUE);
    setStatusValue(DEFAULT_STATUS_VALUE);
    setSearchText(DEFAULT_SEARCH_TEXT);
    setDepartmentIdText(DEFAULT_DEPARTMENT_ID_TEXT);
    setDivisionIdText(DEFAULT_DIVISION_ID_TEXT);
    setRouteIdText(DEFAULT_ROUTE_ID_TEXT);
    setLocationIdText(DEFAULT_LOCATION_ID_TEXT);
    setEmployeeCodeText(DEFAULT_EMPLOYEE_CODE_TEXT);
    setExpandedId(null);
    setIsDatePickerOpen(false);

    setPatrolRows([]);
    setHasSearched(false);
    setError(null);
  };

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.desktopHeaderRow}>
          <div className={styles.titleWrap}>
            <h1 className={styles.title}>รายงานงานการเข้าตรวจหน่วยงาน</h1>
            <p className={styles.subtitle}>
              ตรวจสอบสถานะการเข้าตรวจ เวลาเข้า-ออก และรายละเอียดการติดต่อ
            </p>
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={onBack}
            >
              กลับ
            </button>
          </div>
        </header>

        <header className={styles.topBar}>
          <h1 className={styles.pageTitle}>รายงานงานการเข้าตรวจหน่วยงาน</h1>
        </header>

        <section className={styles.filterPanel} aria-label="ตัวกรองรายงาน">
          <h2 className={styles.panelTitle}>ตัวกรองรายงาน</h2>

          <label className={styles.fieldGroup}>
            <span className={styles.fieldLabel}>ภาค</span>
            <select
              value={departmentIdText}
              onChange={(event) => {
                setDepartmentIdText(event.target.value);
                setDivisionIdText(DEFAULT_DIVISION_ID_TEXT);
                setRouteIdText(DEFAULT_ROUTE_ID_TEXT);
                setLocationIdText(DEFAULT_LOCATION_ID_TEXT);
                setEmployeeCodeText(DEFAULT_EMPLOYEE_CODE_TEXT);
                setPatrolRows([]);
                setHasSearched(false);
              }}
              className={styles.select}
            >
              <option value="">ทั้งหมด</option>
              {departmentOptions.map((option, index) => (
                <option
                  key={makeReactKey(
                    "department",
                    option.departmentId,
                    index,
                  )}
                  value={String(option.departmentId)}
                >
                  {getDepartmentOptionLabel(
                    option.departmentName,
                    option.departmentId,
                  )}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.fieldGroup}>
            <span className={styles.fieldLabel}>เขต</span>
            <select
              value={divisionIdText}
              onChange={(event) => {
                setDivisionIdText(event.target.value);
                setRouteIdText(DEFAULT_ROUTE_ID_TEXT);
                setLocationIdText(DEFAULT_LOCATION_ID_TEXT);
                setEmployeeCodeText(DEFAULT_EMPLOYEE_CODE_TEXT);
                setPatrolRows([]);
                setHasSearched(false);
              }}
              className={styles.select}
            >
              <option value="">ทั้งหมด</option>
              {divisionOptions.map((option, index) => (
                <option
                  key={makeReactKey("division", option.divisionId, index)}
                  value={String(option.divisionId)}
                >
                  {getDivisionOptionLabel(
                    option.divisionName,
                    option.divisionId,
                  )}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.fieldGroup}>
            <span className={styles.fieldLabel}>เส้นทาง</span>
            <select
              value={routeIdText}
              onChange={(event) => {
                setRouteIdText(event.target.value);
                setLocationIdText(DEFAULT_LOCATION_ID_TEXT);
                setEmployeeCodeText(DEFAULT_EMPLOYEE_CODE_TEXT);
                setPatrolRows([]);
                setHasSearched(false);
              }}
              className={styles.select}
            >
              <option value="">ทั้งหมด</option>
              {routeOptions.map((option, index) => (
                <option
                  key={makeReactKey("route", option.routeId, index)}
                  value={String(option.routeId)}
                >
                  {getRouteOptionLabel(option.routeName, option.routeId)}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.fieldGroup}>
            <span className={styles.fieldLabel}>รายหน่วยงาน</span>
            <select
              value={locationIdText}
              onChange={(event) => {
                setLocationIdText(event.target.value);
                setEmployeeCodeText(DEFAULT_EMPLOYEE_CODE_TEXT);
                setPatrolRows([]);
                setHasSearched(false);
              }}
              className={styles.select}
            >
              <option value="">ทั้งหมด</option>
              {locationOptions.map((option, index) => (
                <option
                  key={makeReactKey("location", option.locationId, index)}
                  value={String(option.locationId)}
                >
                  {getLocationOptionLabel(
                    option.contractCode,
                    option.locationName,
                    option.locationId,
                  )}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.fieldGroup}>
            <span className={styles.fieldLabel}>รายสายตรวจ</span>
            <select
              value={employeeCodeText}
              onChange={(event) => setEmployeeCodeText(event.target.value)}
              className={styles.select}
            >
              <option value="">ทั้งหมด</option>
              {employeeOptions.map((option, index) => (
                <option
                  key={makeReactKey("employee", option.employeeCode, index)}
                  value={option.employeeCode}
                >
                  {getEmployeeOptionLabel(
                    option.employeeCode,
                    option.employeeName,
                    option.positionName,
                  )}
                </option>
              ))}
            </select>
          </label>

          <div className={styles.fieldGroup}>
            <span className={styles.fieldLabel}>วันที่</span>

            <div className={styles.datePickerWrap} ref={datePickerWrapRef}>
              <button
                type="button"
                className={styles.dateControl}
                onClick={() => {
                  setCalendarMonth(parseYYYYMMDD(dateValue) ?? new Date());
                  setIsDatePickerOpen((prev) => !prev);
                }}
                aria-label="เลือกวันที่"
              >
                <span className={styles.controlIcon}>
                  <CalendarDays size={14} strokeWidth={2.5} />
                </span>

                <span className={styles.dateDisplay}>
                  {formatDateThaiShort(dateValue)}
                </span>
              </button>

              {isDatePickerOpen && (
                <div className={styles.datePopover}>
                  <div className={styles.calendarBox}>
                    <div className={styles.calendarHeader}>
                      <button
                        type="button"
                        className={styles.calendarNavButton}
                        onClick={() =>
                          setCalendarMonth(
                            (prev) =>
                              new Date(
                                prev.getFullYear(),
                                prev.getMonth() - 1,
                                1,
                              ),
                          )
                        }
                        aria-label="เดือนก่อนหน้า"
                      >
                        ‹
                      </button>

                      <strong className={styles.calendarTitle}>
                        {getCalendarTitle(calendarMonth)}
                      </strong>

                      <button
                        type="button"
                        className={styles.calendarNavButton}
                        onClick={() =>
                          setCalendarMonth(
                            (prev) =>
                              new Date(
                                prev.getFullYear(),
                                prev.getMonth() + 1,
                                1,
                              ),
                          )
                        }
                        aria-label="เดือนถัดไป"
                      >
                        ›
                      </button>
                    </div>

                    <div className={styles.calendarWeekdays}>
                      {THAI_WEEKDAYS.map((weekday) => (
                        <span
                          key={weekday}
                          className={styles.calendarWeekday}
                        >
                          {weekday}
                        </span>
                      ))}
                    </div>

                    <div className={styles.calendarGrid}>
                      {calendarCells.map((cell) => {
                        const cellValue = formatDateToYYYYMMDD(cell.date);
                        const isSelected = cellValue === dateValue;
                        const isToday = cellValue === todayText;

                        return (
                          <button
                            key={cellValue}
                            type="button"
                            className={`${styles.calendarDay} ${
                              !cell.isCurrentMonth
                                ? styles.calendarDayOutside
                                : ""
                            } ${isToday ? styles.calendarDayToday : ""} ${
                              isSelected ? styles.calendarDaySelected : ""
                            }`}
                            onClick={() => {
                              setDateValue(cellValue);
                              setCalendarMonth(
                                new Date(
                                  cell.date.getFullYear(),
                                  cell.date.getMonth(),
                                  1,
                                ),
                              );
                              setIsDatePickerOpen(false);
                            }}
                          >
                            {cell.date.getDate()}
                          </button>
                        );
                      })}
                    </div>

                    <div className={styles.calendarFooter}>
                      <button
                        type="button"
                        className={styles.calendarTodayButton}
                        onClick={() => {
                          const today = getTodayYYYYMMDD();
                          const todayDate = parseYYYYMMDD(today) ?? new Date();

                          setDateValue(today);
                          setCalendarMonth(
                            new Date(
                              todayDate.getFullYear(),
                              todayDate.getMonth(),
                              1,
                            ),
                          );
                          setIsDatePickerOpen(false);
                        }}
                      >
                        วันนี้
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <label className={styles.fieldGroup}>
            <span className={styles.fieldLabel}>ผลัด</span>
            <select
              value={shiftValue}
              onChange={(event) =>
                setShiftValue(event.target.value as ShiftValue)
              }
              className={styles.select}
            >
              <option value="day">ผลัดกลางวัน</option>
              <option value="night">ผลัดกลางคืน</option>
            </select>
          </label>

          <label className={styles.fieldGroup}>
            <span className={styles.fieldLabel}>สถานะ</span>
            <select
              value={statusValue}
              onChange={(event) =>
                setStatusValue(event.target.value as StatusFilterValue)
              }
              className={styles.select}
            >
              <option value="all">ทั้งหมด</option>
              <option value="completed">ตรวจแล้ว</option>
              <option value="completed_call">ตรวจแล้ว(โทร)</option>
              <option value="in_progress">อยู่ระหว่างการเข้าตรวจ</option>
              <option value="pending">รอดำเนินการเข้าตรวจ</option>
            </select>
          </label>

          <label className={`${styles.fieldGroup} ${styles.keywordGroup}`}>
            <span className={styles.fieldLabel}>
              ค้นหารหัสสัญญา / จุดรักษาการณ์
            </span>
            <div className={styles.control}>
              <input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="ค้นหารหัสสัญญา / จุดรักษาการณ์..."
                className={styles.input}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    handleSearch();
                  }
                }}
              />

              <span className={styles.searchIcon}>
                <Search size={13} strokeWidth={2.5} />
              </span>
            </div>
          </label>

          <div className={styles.filterActions}>
            <button
              type="button"
              className={styles.searchButton}
              onClick={handleSearch}
              disabled={loading}
            >
              <Search size={15} strokeWidth={2.6} />
              <span>{loading ? "กำลังค้นหา..." : "ค้นหา"}</span>
            </button>

            <button
              type="button"
              className={styles.clearButton}
              onClick={handleClear}
              disabled={loading}
            >
              <RefreshCcw size={15} strokeWidth={2.6} />
              <span>ล้างค่า</span>
            </button>
          </div>
        </section>

        {error && (
          <p
            role="alert"
            style={{
              margin: "10px 0 0",
              color: "#dc2626",
              fontSize: 13,
              fontWeight: 800,
              textAlign: "center",
            }}
          >
            {error}
          </p>
        )}

        <section className={styles.desktopSection} aria-label="รายการรายงาน">
          <div className={styles.reportCard}>
            <h2 className={styles.sectionTitle}>รายการรายงาน</h2>

            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>ลำดับ</th>
                    <th>รหัสสัญญา</th>
                    <th>ชื่อจุดรักษาการณ์</th>
                    <th>ผลัด</th>
                    <th>สถานะ</th>
                    <th>วันที่เริ่มสัญญา</th>
                    <th>แจ้งเตือน</th>
                    <th>ตามสัญญา</th>
                    <th>วันที่</th>
                    <th>เวลาเข้า</th>
                    <th>เวลาออก</th>
                    <th>ผู้ดำเนินการ</th>
                    <th>รายละเอียดการติดต่อ</th>
                    <th>หมายเหตุ</th>
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={14}>กำลังโหลดข้อมูล...</td>
                    </tr>
                  ) : filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={14} className={styles.emptyTableCell}>
                        <EmptyReportState
                          title={emptyTitle}
                          hint={emptyHint}
                        />
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row, index) => {
                      const status = getDisplayStatus(row);

                      return (
                        <tr
                          key={makeReactKey(
                            "desktop-row",
                            row.id,
                            row.contractCode,
                            row.locationId ?? row.location_id,
                            index,
                          )}
                        >
                          <td>{row.id}</td>
                          <td>{getContractCodeText(row.contractCode)}</td>
                          <td className={styles.textLeft}>{row.siteName}</td>
                          <td>{row.shiftLabel}</td>
                          <td>
                            <span
                              className={`${styles.statusBadge} ${getStatusClass(
                                status,
                              )}`}
                            >
                              {getStatusLabel(status)}
                            </span>
                          </td>
                          <td>{getEffectiveFromText(row)}</td>
                          <td
                            className={`${styles.notificationTableCell} ${getNotificationRowClass(
                              row,
                            )}`}
                          >
                            {getNotificationText(row)}
                          </td>
                          <td className={styles.textLeft}>
                            {getScheduleText(row)}
                          </td>
                          <td>{row.dateText}</td>
                          <td>{row.checkInTime ?? "-"}</td>
                          <td>{row.checkOutTime ?? "-"}</td>
                          <td>{getOperatorText(row)}</td>
                          <td className={styles.textLeft}>
                            {getContactDetail(row)}
                          </td>
                          <td className={styles.textLeft}>
                            {getCallNote(row)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className={styles.desktopFooter}>
              <span>{reportCountText}</span>

              <div className={styles.pagination}>
                <button type="button" disabled>
                  ก่อนหน้า
                </button>
                <button type="button" className={styles.activePage}>
                  1
                </button>
                <button type="button" disabled>
                  ถัดไป
                </button>
              </div>
            </div>
          </div>
        </section>

        <section
          className={styles.mobileSection}
          aria-label="รายการรายงานมือถือ"
        >
          <div className={styles.mobileListHeader}>
            <h2 className={styles.mobileSectionTitle}>รายการรายงาน</h2>
          </div>

          <div className={styles.mobileList}>
            {loading ? (
              <p className={styles.mobileFooter}>กำลังโหลดข้อมูล...</p>
            ) : filteredRows.length === 0 ? (
              <EmptyReportState title={emptyTitle} hint={emptyHint} />
            ) : (
              filteredRows.map((row, index) => {
                const isExpanded = expandedId === row.id;
                const status = getDisplayStatus(row);

                return (
                  <article
                    key={makeReactKey(
                      "mobile-row",
                      row.id,
                      row.contractCode,
                      row.locationId ?? row.location_id,
                      index,
                    )}
                    className={`${styles.mobileCard} ${
                      isExpanded ? styles.mobileCardExpanded : ""
                    }`}
                  >
                    <button
                      type="button"
                      className={styles.mobileCardButton}
                      onClick={() => setExpandedId(isExpanded ? null : row.id)}
                      aria-expanded={isExpanded}
                    >
                      <StatusIcon status={status} />

                      <div className={styles.mobileMain}>
                        <div className={styles.mobileContractRow}>
                          <span className={styles.mobileNo}>{row.id}</span>

                          <span className={styles.mobileCode}>
                            {getContractCodeText(row.contractCode)}
                          </span>
                        </div>

                        <strong className={styles.mobileSiteName}>
                          {row.siteName}
                        </strong>
                      </div>

                      <span
                        className={`${styles.mobileStatusBadge} ${getStatusClass(
                          status,
                        )}`}
                      >
                        {getStatusLabel(status)}
                      </span>

                      <span className={styles.chevron}>
                        {isExpanded ? (
                          <ChevronUp size={18} strokeWidth={2.8} />
                        ) : (
                          <ChevronRight size={18} strokeWidth={2.8} />
                        )}
                      </span>
                    </button>

                    {isExpanded && (
                      <div className={styles.mobileDetail}>
                        <div className={styles.detailRow}>
                          <span>ชื่อจุดรักษาการณ์</span>
                          <strong>{row.siteName}</strong>
                        </div>

                        <div className={styles.detailRow}>
                          <span>ผลัด</span>
                          <strong>{row.shiftLabel}</strong>
                        </div>

                        <div className={styles.detailRow}>
                          <span>สถานะ</span>
                          <strong>{getStatusLabel(status)}</strong>
                        </div>

                        <div className={styles.detailRow}>
                          <span>วันที่เริ่มสัญญา</span>
                          <strong>{getEffectiveFromText(row)}</strong>
                        </div>

                        <div
                          className={`${styles.detailRow} ${styles.notificationDetailRow} ${getNotificationRowClass(
                            row,
                          )}`}
                        >
                          <span>แจ้งเตือน</span>
                          <strong>{getNotificationText(row)}</strong>
                        </div>

                        <div className={styles.detailRow}>
                          <span>ตามสัญญา</span>
                          <strong>{getScheduleText(row)}</strong>
                        </div>

                        <div className={styles.detailRow}>
                          <span>วันที่</span>
                          <strong>{row.dateText}</strong>
                        </div>

                        <div className={styles.detailRow}>
                          <span>เวลาเข้า</span>
                          <strong>{row.checkInTime ?? "-"}</strong>
                        </div>

                        <div className={styles.detailRow}>
                          <span>เวลาออก</span>
                          <strong>{row.checkOutTime ?? "-"}</strong>
                        </div>

                        <div className={styles.detailRow}>
                          <span>ผู้ดำเนินการ</span>
                          <strong>{getOperatorText(row)}</strong>
                        </div>

                        <div className={styles.detailRow}>
                          <span>รายละเอียดการติดต่อ</span>
                          <strong>{getContactDetail(row)}</strong>
                        </div>

                        <div className={styles.detailRow}>
                          <span>หมายเหตุ</span>
                          <strong>{getCallNote(row)}</strong>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })
            )}
          </div>

          <p className={styles.mobileFooter}>{reportCountText}</p>

          <div className="guts-fv-bottom">
            <BackButton onClick={onBack} className="guts-fv-backBtn" />
          </div>
        </section>
      </div>
    </main>
  );
}