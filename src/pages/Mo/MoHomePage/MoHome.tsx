import styles from "./MoHome.module.css";
import { useState, useEffect } from "react";
import {
  ChevronRight,
  Home,
  Plus,
  MapPinX,
  MapPinCheck,
  Search,
} from "lucide-react";
import caseData from "@/temp_data/case.json";
import userLocationsData from "@/temp_data/userLocations.json";
type Props = {
  onAdd?: (location?: string) => void;
  onOpenDetail?: (item: any) => void;
  onOpenUpdate?: (item: any) => void;
  onOpenDashboard?: () => void;
  openOnMount?: boolean;
  onMounted?: () => void;
  onBackHome?: () => void;
  empCode?: string;
  initialView?: "home" | "addNew" | "search";
};

export default function MoHome(props: Props) {
  const [searchSection, setSearchSection] = useState(props.initialView === "search" ? true : false);
  const [isListOpen, setIsListOpen] = useState(props.initialView === "addNew" ? true : false);
  const [selectedLocation, setSelectedLocation] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [searchSubmitted, setSearchSubmitted] = useState(false);
  const [searchFilters, setSearchFilters] = useState({
    location: "",
    date: "",
  });

  useEffect(() => {
    if (props.openOnMount) {
      setSearchSection(true);
      if (props.onMounted) {
        props.onMounted();
      }
    }
  }, [props.openOnMount, props.onMounted]);

  function openSearch() {
    setSearchSection(true);
  }

  function openList() {
    setIsListOpen(true);
  }

  function goBack() {
    if (searchSection) {
      setSearchSection(false);
      setSearchSubmitted(false);  // Reset search when going back
      return;
    }
    if (isListOpen) {
      setIsListOpen(false);
      return;
    }
    return window.history.back();
  }

  function submitSearch() {
    // Apply the search filters only when button is clicked
    setSearchSubmitted(true);
    setSearchFilters({ location: selectedLocation, date: selectedDate });
  }

  // Get today's date in YYYY-MM-DD format
  const todayDate = new Date().toISOString().split("T")[0];

  // Get allowed locations for the selected employee
  const employeeLocations = props.empCode 
    ? (userLocationsData as any[]).find((u: any) => u.employeeId === props.empCode)?.locations || []
    : [];

  // Filter cases by employee code AND today's date only (used for "เพิ่มใหม่" list)
  const filteredByEmployee = props.empCode 
    ? (caseData as any[]).filter((r: any) => r.user_id === props.empCode && r.create_at?.startsWith(todayDate))
    : (caseData as any[]).filter((r: any) => r.create_at?.startsWith(todayDate));

  // All records for this employee across all dates (used for search)
  const allEmployeeRecords = props.empCode
    ? (caseData as any[]).filter((r: any) => r.user_id === props.empCode)
    : (caseData as any[]);

  // Extract unique locations from all employee records (for search dropdown)
  const uniqueLocations = Array.from(
    new Set(allEmployeeRecords.map((r: any) => r.location).filter(Boolean)),
  ).sort();

  // Filter data based on applied search filters (only when search button is clicked)
  // If search not submitted yet, show empty results
  const filteredData = !searchSubmitted
    ? []  // Don't show results until search button is clicked
    : allEmployeeRecords.filter((r: any) => {
        const locationMatch =
          !searchFilters.location || r.location === searchFilters.location;
        const dateMatch =
          !searchFilters.date || r.create_at?.startsWith(searchFilters.date);
        return locationMatch && dateMatch;
      });

  // For location list: separate into existing cases and non-existing locations
  // Only include cases where the location belongs to the employee's allowed locations
  const locationsWithCases = filteredByEmployee.filter((r: any) =>
    employeeLocations.includes(r.location)
  );
  const locationsWithoutCases = employeeLocations.filter(
    (loc: string) => !locationsWithCases.some((r: any) => r.location === loc)
  );

  // Debug logging
  console.log("empCode:", props.empCode);
  console.log("employeeLocations:", employeeLocations);
  console.log("todayDate:", todayDate);
  console.log("locationsWithCases:", locationsWithCases.map((r: any) => r.location));
  console.log("locationsWithoutCases:", locationsWithoutCases);

  return (
    <>

        {!searchSection ? (
          <>
            {isListOpen ? (
              // add new group
              <>
                <div className={styles["location-list"]}>
                  <div className={styles["location-header"]}>บันทึก</div>
                  {/* for lcaoitn not exst case yet  */}
                  {locationsWithoutCases
                    .map((location: string, idx: number) => {
                      return (
                        <div
                          className={styles["location-item"]}
                          key={`${props.empCode}-${location}-${idx}`}
                        >
                          <div className={styles["location-avatar"]}>
                            <MapPinX />
                          </div>
                          <div className={styles["location-body-col"]}>
                            <div className={styles["location-top-row"]}>
                              <div className={styles["location-title"]}>
                                {location ?? "-"}
                              </div>
                              {/* this go to add MOnew */}
                              <button
                                className={styles["mo-item-open"]}
                                aria-label="Open item"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (props.onAdd) props.onAdd(location);
                                }}
                              >
                                <Plus />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                      {/* for lcaoitn exst case   */}
                  {locationsWithCases
                    .map((r: any, idx: number) => {
                      const leaveTotal =
                        (Number(r.leave_sick_count) || 0) +
                        (Number(r.leave_business_count) || 0) +
                        (Number(r.leave_other_count) || 0) +
                        (Number(r.absent_count) || 0);
                      const workTotal =
                        (Number(r.shift_18_count) || 0) +
                        (Number(r.shift_24_count) || 0) +
                        (Number(r.shift_36_count) || 0);
                      const wearTotal =
                        (Number(r.wear_hat_count) || 0) +
                        (Number(r.wear_shirt_count) || 0) +
                        (Number(r.wear_pants_count) || 0) +
                        (Number(r.wear_shoes_count) || 0);
                      const key = r.id ?? r.user_id ?? idx;
                      return (
                        <div
                          className={styles["location-check-item"]}
                          key={String(key)}
                        >
                          <div className={styles["location-check-avatar"]}>
                            <MapPinCheck />
                          </div>
                          <div className={styles["location-check-body-col"]}>
                            <div className={styles["location-check-top-row"]}>
                              <div className={styles["location-check-title"]}>
                                {r.location ?? "-"}
                              </div>
                              <p className={styles["location-check-date"]}>
                                {r.create_at
                                  ? new Date(r.create_at).toLocaleDateString("th-TH")
                                  : "03/02/2569"}
                              </p>
                            </div>
                            <div
                              className={styles["location-check-bottom-row"]}
                            >
                              <div className={styles["location-check-lines"]}>
                                <div className={styles["location-check-sub"]}>
                                  ลา: {leaveTotal} คน &nbsp; กำลังพล:{" "}
                                  {workTotal} คน
                                </div>
                                <div className={styles["location-check-sub"]}>
                                  เครื่องแต่งกาย: {wearTotal} คน
                                </div>
                                {r.other_job
                                  ? (() => {
                                      const otherJob = String(
                                        r.other_job || "",
                                      );
                                      const otherShort =
                                        otherJob.length > 20
                                          ? otherJob.slice(0, 40) + "…"
                                          : otherJob;
                                      return (
                                        <div
                                          className={
                                            styles["location-check-sub"]
                                          }
                                          title={otherJob}
                                        >
                                          อื่น: {otherShort}
                                        </div>
                                      );
                                    })()
                                  : null}
                              </div>
                                 {/* this for show updatePage */}
                              <button
                                className={styles["mo-item-open"]}
                                aria-label="Open item"
                                onClick={() =>
                                  props.onOpenUpdate
                                    ? props.onOpenUpdate(r)
                                    : undefined
                                }
                              >
                                <ChevronRight />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>

                <div className={styles["guts-back-outer"]} aria-hidden>
                  <button
                    type="button"
                    className={[
                      styles["guts-btn"],
                      styles["guts-back-btn"],
                    ].join(" ")}
                    onClick={goBack}
                  >
                    Back
                  </button>
                </div>
              </>
            ) : (
              // Home two bnt
              <>
                <div className={styles["guts-mo-btn"]} aria-hidden>
                  <button
                    type="button"
                    className={styles["mo-home-addnew"]}
                    onClick={() => {
                      openList();
                    }}
                  >
                    เพิ่มใหม่
                  </button>
                </div>
                <div className={styles["guts-mo-btn"]} aria-hidden>
                  <button
                    type="button"
                    className={styles["mo-home-search"]}
                    onClick={openSearch}
                  >
                    รายการค้นหา
                  </button>
                </div>
                <div className={styles["guts-mo-btn"]} aria-hidden>
                  <button
                    type="button"
                    className={styles["mo-home-addnew"]}
                    onClick={() => {
                      if (props.onOpenDashboard) props.onOpenDashboard();
                    }}>
                      แดชบอร์ด
                  </button>
                </div>
                {/* Back button - visible only on home */}
                <div
                  className={[
                    styles["guts-back-outer"],
                    styles["mo-back-home"],
                  ].join(" ")}
                  aria-hidden
                >
                  <button
                    type="button"
                    className={[
                      styles["guts-btn"],
                      styles["mo-back-home-btn"],
                    ].join(" ")}
                    onClick={() => {
                      if (props.onBackHome) {
                        props.onBackHome();
                        return;
                      }
                      return window.history.back();
                    }}
                  >
                    ย้อนกลับ
                  </button>
                </div>
              </>
            )}
          </>
        ) : (
          // search group
          <>
            <div className={styles["mo-search"]}>
              <select
                value={selectedLocation}
                onChange={(e) => {
                  setSelectedLocation(e.target.value);
                  setSearchSubmitted(false);
                }}
                className={styles["guts-mo-search-input"]}
              >
                <option value="">ทั้งหมด (ภาค)</option>
                {(props.empCode ? employeeLocations : uniqueLocations).map((location: string) => (
                  <option key={location} value={location}>
                    {location}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setSearchSubmitted(false);
                }}
                className={styles["guts-mo-search-input"]}
                max={new Date().toISOString().split("T")[0]}
              />
              <button
                className={styles["mo-search-clear"]}
                aria-label="Search"
                onClick={submitSearch}
                type="button"
                disabled={!selectedLocation || !selectedDate}
              >
                <Search />
              </button>
            </div>

            <div className={styles["location-list"]}>
              <div className={styles["location-header"]}>
                {/* <Search /> */}
                บันทึก ({Math.min(5, filteredData.length)} รายการ)
              </div>
              {/* show filtered items */}
              {filteredData.slice(0, 4).map((r: any, idx: number) => {
                const leaveTotal =
                  (Number(r.leave_sick_count) || 0) +
                  (Number(r.leave_business_count) || 0) +
                  (Number(r.leave_other_count) || 0) +
                  (Number(r.absent_count) || 0);
                const workTotal =
                  (Number(r.shift_18_count) || 0) +
                  (Number(r.shift_24_count) || 0) +
                  (Number(r.shift_36_count) || 0);
                const wearTotal =
                  (Number(r.wear_hat_count) || 0) +
                  (Number(r.wear_shirt_count) || 0) +
                  (Number(r.wear_pants_count) || 0) +
                  (Number(r.wear_shoes_count) || 0);
                const key = r.id ?? r.user_id ?? idx;
                return (
                  <div
                    className={styles["search-result"]}
                    key={String(key) + "-search"}
                    onClick={() =>
                      props.onOpenDetail ? props.onOpenDetail(r) : undefined
                    }
                  >
                    <div className={styles["result-avatar"]}>
                      <Home />
                    </div>
                    <div className={styles["result-body-col"]}>
                      <div className={styles["result-top-row"]}>
                        <div className={styles["result-title"]}>
                          {r.location ?? "-"}
                        </div>
                        <p className={styles["result-date"]}>
                          {r.create_at
                            ? new Date(r.create_at).toLocaleDateString("th-TH")
                            : "03/02/2569"}
                        </p>
                      </div>
                      <div className={styles["result-bottom-row"]}>
                        <div className={styles["result-lines"]}>
                          <div className={styles["result-sub"]}>
                            ลา: {leaveTotal} คน &nbsp; กำลังพล: {workTotal} คน
                          </div>
                          <div className={styles["result-sub"]}>
                            เครื่องแต่งกาย: {wearTotal} คน
                          </div>
                          {r.other_job
                            ? (() => {
                                const otherJob = String(r.other_job || "");
                                const otherShort =
                                  otherJob.length > 20
                                    ? otherJob.slice(0, 40) + "…"
                                    : otherJob;
                                return (
                                  <div
                                    className={styles["result-sub"]}
                                    title={otherJob}
                                  >
                                    อื่น: {otherShort}
                                  </div>
                                );
                              })()
                            : null}
                        </div>
                        {/* this for show detailPage */}
                        <button
                          className={styles["mo-item-open"]}
                          aria-label="Open item"
                          onClick={() =>
                            props.onOpenDetail
                              ? props.onOpenDetail(r)
                              : undefined
                          }
                        >
                          <ChevronRight />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className={styles["guts-back-outer"]} aria-hidden>
              <button
                type="button"
                className={[styles["guts-btn"], styles["guts-back-btn"]].join(
                  " ",
                )}
                onClick={goBack}
              >
                Back
              </button>
            </div>
          </>
        )}

    </>
  );
}

export { MoHome };
