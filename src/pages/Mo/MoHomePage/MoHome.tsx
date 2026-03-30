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
import { useStore } from "../../../store/store";
import type { SectorReport, Sector } from "../../../store/store";

import MoNewPage from "../MoNewPage/MoNewPage";
import MoDetailPage from "../MoDetailPage/MoDetailPage";
import MoUpdatePage from "../MoUpdatePage/MoUpdatePage";
import MoDashboard from "../MoDashboard/MoDashborad";

type SubView = "main" | "new" | "detail" | "update" | "dashboard";

type Props = {
  onBackHome?: () => void;
  empCode?: string;
  initialView?: "main" | "search"; // Initial section of the main view
  displayName?: string;
};

export default function MoHome(props: Props) {
  const [subView, setSubView] = useState<SubView>("main");
  const [selectedItem, setSelectedItem] = useState<SectorReport | null>(null);
  const [selectedLocationForNew, setSelectedLocationForNew] = useState("");

  const [searchSection, setSearchSection] = useState(
    props.initialView === "search" ? true : false,
  );
  const [isListOpen, setIsListOpen] = useState(false);

  const reports = useStore((state) => state.reports);
  const sectors = useStore((state) => state.sectors);
  const currentEmployee = useStore((state) => state.currentEmployee);
  const fetchReports = useStore((state) => state.fetchReports);
  const fetchSectors = useStore((state) => state.fetchSectors);
  const fetchEmployeeByCode = useStore((state) => state.fetchEmployeeByCode);

  useEffect(() => {
    if (props.empCode) {
      fetchEmployeeByCode(props.empCode);
    }
  }, [props.empCode, fetchEmployeeByCode]);

  useEffect(() => {
    if (!currentEmployee?.sector_id) return;

    // Fetch ONLY the specific sector the employee belongs to
    fetchSectors({ sector_id: currentEmployee.sector_id });

    // Fetch reports for this sector specifically for TODAY
    const todayStr = new Date().toISOString().split("T")[0];
    fetchReports({
      sector_id: currentEmployee.sector_id,
      start_date: todayStr,
      end_date: todayStr,
    });
  }, [fetchReports, fetchSectors, currentEmployee?.sector_id]);

  const [selectedLocation, setSelectedLocation] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [searchSubmitted, setSearchSubmitted] = useState(false);
  const [searchFilters, setSearchFilters] = useState({
    location: "",
    date: "",
  });

  function openSearch() {
    setSearchSection(true);
    setSubView("main"); // Ensure main view is active for search section
  }

  function openList() {
    setIsListOpen(true);
    setSubView("main"); // Ensure main view is active for list section
  }

  function submitSearch() {
    // Apply the search filters and fetch from backend
    setSearchSubmitted(true);
    setSearchFilters({ location: selectedLocation, date: selectedDate });

    // Fetch reports for the selected criteria from the backend
    if (selectedDate) {
      // Find the sector ID for the selected location name if "all" is not selected
      const targetSector = sectors.find(
        (s) => s.sector_name === selectedLocation,
      );
      const targetSectorId =
        targetSector?.sector_id || currentEmployee?.sector_id;

      fetchReports({
        sector_id: targetSectorId ?? undefined,
        start_date: selectedDate,
        end_date: selectedDate,
      });
    }
  }

  function goBack() {
    if (searchSection) {
      setSearchSection(false);
      setSearchSubmitted(false); // Reset search when going back
      // When going back to Home, restore TODAY's reports
      if (currentEmployee?.sector_id) {
        const todayStr = new Date().toISOString().split("T")[0];
        fetchReports({
          sector_id: currentEmployee.sector_id,
          start_date: todayStr,
          end_date: todayStr,
        });
      }
      return;
    }
    if (isListOpen) {
      setIsListOpen(false);
      return;
    }
    // If on main view, and not in search/list, go back in history
    window.history.back();
  }

  // Get today's date in YYYY-MM-DD format
  const todayDate = new Date().toISOString().split("T")[0];

  // Get allowed locations for the selected employee from sectors in the store
  // Filter by sector_id to ensure only the user's area is shown
  const employeeLocations = sectors
    .filter((s: Sector) => s.sector_id === currentEmployee?.sector_id)
    .map((s: Sector) => s.sector_name);

  // Map store reports to the format expected by the UI
  const mappedReports = reports.map((r: SectorReport) => ({
    ...r,
    location:
      sectors.find((s) => s.sector_id === r.sector_id)?.sector_name ||
      `Sector ${r.sector_id}`,
    create_at: r.created_at, // map backend created_at to UI create_at
    user_id: r.created_by,
  }));

  // Filter cases by sector reports for today specifically
  // (if any report exists for today, show in existing cases and hide from "Add New")
  const todayReports = mappedReports.filter((r: any) =>
    r.create_at?.startsWith(todayDate),
  );

  // All records across all dates for the currently loaded sectors (used for search)
  // We don't filter by user_id here so search can find reports by any user for the sector
  const allSectorRecords = mappedReports;

  // Extract unique locations from all records (for search dropdown)
  const uniqueLocations = Array.from(
    new Set(allSectorRecords.map((r: any) => r.location).filter(Boolean)),
  ).sort() as string[];

  // Filter data based on applied search filters (only when search button is clicked)
  // If search not submitted yet, show empty results
  const filteredData = !searchSubmitted
    ? [] // Don't show results until search button is clicked
    : allSectorRecords.filter((r: any) => {
        const locationMatch =
          !searchFilters.location || r.location === searchFilters.location;
        const dateMatch =
          !searchFilters.date || r.create_at?.startsWith(searchFilters.date);
        return locationMatch && dateMatch;
      });

  // For location list: separate into existing cases and non-existing locations
  // Only include cases where the location belongs to the employee's allowed locations
  const locationsWithCases = todayReports.filter((r: any) =>
    employeeLocations.includes(r.location),
  );
  const locationsWithoutCases = employeeLocations.filter(
    (loc: string) => !locationsWithCases.some((r: any) => r.location === loc),
  );

  // Debug logging
  console.log("empCode:", props.empCode);
  console.log("employeeLocations:", employeeLocations);
  console.log("todayDate:", todayDate);
  console.log(
    "locationsWithCases:",
    locationsWithCases.map((r: any) => r.location),
  );
  console.log("locationsWithoutCases:", locationsWithoutCases);

  if (subView === "new") {
    return (
      <MoNewPage
        empCode={props.empCode}
        selectedLocation={selectedLocationForNew}
        onCancel={() => setSubView("main")}
      />
    );
  }

  if (subView === "detail" && selectedItem) {
    return (
      <MoDetailPage item={selectedItem} onCancel={() => setSubView("main")} />
    );
  }

  if (subView === "update" && selectedItem) {
    return (
      <MoUpdatePage item={selectedItem} onCancel={() => setSubView("main")} />
    );
  }

  if (subView === "dashboard") {
    return (
      <MoDashboard
        empCode={props.empCode || ""}
        displayName={props.displayName}
        onCancel={() => setSubView("main")}
      />
    );
  }

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
                {locationsWithoutCases.map((location: string, idx: number) => {
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
                              setSelectedLocationForNew(location);
                              setSubView("new");
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
                {locationsWithCases.map((r: any, idx: number) => {
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
                              ? new Date(r.create_at).toLocaleDateString(
                                  "th-TH",
                                )
                              : "03/02/2569"}
                          </p>
                        </div>
                        <div className={styles["location-check-bottom-row"]}>
                          <div className={styles["location-check-lines"]}>
                            <div className={styles["location-check-sub"]}>
                              ลา: {leaveTotal} คน &nbsp; กำลังพล: {workTotal} คน
                            </div>
                            <div className={styles["location-check-sub"]}>
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
                                      className={styles["location-check-sub"]}
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
                            onClick={() => {
                              setSelectedItem(r);
                              setSubView("update");
                            }}
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
                    setSubView("dashboard");
                  }}
                >
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
                  onClick={goBack}
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
              {(props.empCode ? employeeLocations : uniqueLocations).map(
                (location: string) => (
                  <option key={location} value={location}>
                    {location}
                  </option>
                ),
              )}
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
                  onClick={() => {
                    setSelectedItem(r);
                    setSubView("detail");
                  }}
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
                        onClick={() => {
                          setSelectedItem(r);
                          setSubView("detail");
                        }}
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
    //any select page redner child page here
  );
}
