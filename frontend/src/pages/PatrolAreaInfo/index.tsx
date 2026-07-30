// src/pages/PatrolAreaInfo/index.tsx

import { useState } from "react";
import type { FormEvent } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faClock,
  faRoute,
} from "@fortawesome/free-solid-svg-icons";
import { CircleAlert } from "lucide-react";

import BackButton from "@/components/BackButton";
import PatrolAreaInfoModal, {
  type PatrolAreaInfoModalLocation,
} from "@/components/PatrolAreaInfoModal";
import Header from "@/layout/Header";
import api from "@/lib/api";

import styles from "./PatrolAreaInfo.module.css";


export type OutsidePlanCheckInOutLocation = {
  locationId: number | string | null;
  contractCode: string;
  locationName: string;
  locationDetail: string | null;
  latitude: string | number | null;
  longitude: string | number | null;
  radiusMeter: string | number | null;
  graceMeter: string | number | null;
};


type Props = {
  empCode: string;
  displayName?: string;

  onOutsidePlanCheckInOut: (
    location: OutsidePlanCheckInOutLocation,
  ) => void;

  onBack: () => void;
};


type SiteLocation = {
  /**
   * ความสัมพันธ์ระหว่างเส้นทางกับจุดรักษาการณ์
   */
  route_site_location_id?: number | null;

  /**
   * ภาค จาก departments
   */
  department_id?: number | null;
  department_name?: string | null;

  /**
   * เขต จาก divisions
   */
  division_id?: number | null;
  division_name?: string | null;

  /**
   * เส้นทาง จาก routes
   */
  routes_id?: number | null;
  route_name?: string | null;

  /**
   * ข้อมูลจุดรักษาการณ์ จาก site_location
   */
  id?: number | null;
  location_id?: number | null;
  contract_code?: string | null;
  location_name?: string | null;
  location_detail?: string | null;
  latitude?: string | number | null;
  longitude?: string | number | null;
  radius_meter?: string | number | null;
  grace_meter?: string | number | null;

  /**
   * ข้อความรอบตรวจที่ Backend ส่งมาโดยตรง
   */
  patrol_round_text?: string | null;

  /**
   * รองรับกรณี Backend ส่งรอบตรวจเป็นข้อความหรือรายการ
   */
  patrol_rounds?: string | string[] | null;

  updated_at?: string | null;
};


type SiteLocationResponse =
  | SiteLocation[]
  | {
      items?: SiteLocation[];
      data?: SiteLocation[];
      results?: SiteLocation[];
    };


const PATROL_AREA_SEARCH_ENDPOINT = "/patrol-areas/search";
const PAGE_LIMIT = 20;


function cleanText(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number") {
    return String(value);
  }

  return "";
}


function extractSiteLocations(
  response: SiteLocationResponse,
): SiteLocation[] {
  if (Array.isArray(response)) {
    return response;
  }

  if (Array.isArray(response.items)) {
    return response.items;
  }

  if (Array.isArray(response.data)) {
    return response.data;
  }

  if (Array.isArray(response.results)) {
    return response.results;
  }

  return [];
}


function getLocationId(
  location: SiteLocation,
): string {
  return cleanText(
    location.location_id ?? location.id,
  );
}


function formatUpdatedAt(
  value?: string | null,
): string {
  const cleanValue = cleanText(value);

  if (!cleanValue) {
    return "-";
  }

  const date = new Date(cleanValue);

  if (Number.isNaN(date.getTime())) {
    return cleanValue;
  }

  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(date);
}


function formatPatrolRounds(
  location: SiteLocation,
): string {
  const directText = cleanText(
    location.patrol_round_text,
  );

  if (directText) {
    return directText;
  }

  if (Array.isArray(location.patrol_rounds)) {
    const roundItems = location.patrol_rounds
      .map((item) => cleanText(item))
      .filter(Boolean);

    if (roundItems.length > 0) {
      return roundItems.join("\n");
    }
  }

  const roundsText = cleanText(
    location.patrol_rounds,
  );

  if (roundsText) {
    return roundsText;
  }

  return "-";
}


export default function PatrolAreaInfo({
  empCode,
  displayName,
  onOutsidePlanCheckInOut,
  onBack,
}: Props) {
  const [keyword, setKeyword] = useState("");
  const [searchResults, setSearchResults] = useState<
    SiteLocation[]
  >([]);

  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);

  const [
    selectedModalLocation,
    setSelectedModalLocation,
  ] = useState<PatrolAreaInfoModalLocation | null>(
    null,
  );

  const hasSearchCriteria =
    keyword.trim() !== "";


  async function handleSearch() {
    const cleanKeyword = keyword.trim();

    if (!cleanKeyword) {
      setSearchResults([]);
      setHasSearched(false);
      setErrorMessage("");
      return;
    }

    setIsSearching(true);
    setHasSearched(true);
    setErrorMessage("");
    setSearchResults([]);

    try {
      const params = new URLSearchParams({
        skip: "0",
        limit: String(PAGE_LIMIT),
      });

      params.set(
        "keyword",
        cleanKeyword,
      );

      const response =
        await api.get<SiteLocationResponse>(
          `${PATROL_AREA_SEARCH_ENDPOINT}?${params.toString()}`,
        );

      setSearchResults(
        extractSiteLocations(response),
      );
    } catch (error) {
      console.error(
        "[PatrolAreaInfo] search error:",
        error,
      );

      setSearchResults([]);
      setErrorMessage(
        "ไม่สามารถค้นหาข้อมูลหน่วยงานได้",
      );
    } finally {
      setIsSearching(false);
    }
  }


  function handleClear() {
    setKeyword("");
    setSearchResults([]);
    setHasSearched(false);
    setErrorMessage("");
  }


  function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    void handleSearch();
  }


  function handleOpenLocationModal(
    location: SiteLocation,
  ) {
    setSelectedModalLocation({
      locationId:
        location.location_id ??
        location.id ??
        null,

      contractCode: cleanText(
        location.contract_code,
      ),

      locationName: cleanText(
        location.location_name,
      ),

      locationDetail:
        location.location_detail ?? null,

      latitude:
        location.latitude ?? null,

      longitude:
        location.longitude ?? null,

      radiusMeter:
        location.radius_meter ?? null,

      graceMeter:
        location.grace_meter ?? null,

      updatedAt:
        location.updated_at ?? null,
    });

    setIsModalOpen(true);
  }


  function handleCloseLocationModal() {
    setIsModalOpen(false);
    setSelectedModalLocation(null);
  }


  function handleOutsidePlanCheckInOut(
    location: SiteLocation,
  ) {
    onOutsidePlanCheckInOut({
      locationId:
        location.location_id ??
        location.id ??
        null,

      contractCode: cleanText(
        location.contract_code,
      ),

      locationName: cleanText(
        location.location_name,
      ),

      locationDetail:
        location.location_detail ?? null,

      latitude:
        location.latitude ?? null,

      longitude:
        location.longitude ?? null,

      radiusMeter:
        location.radius_meter ?? null,

      graceMeter:
        location.grace_meter ?? null,
    });
  }


  return (
    <main className="guts-bg">
      <div className="guts-home">
        <section
          className="guts-home-card"
          aria-label="PatrolAreaInfo"
        >
          <Header
            empCode={empCode}
            displayName={displayName}
          />

          <h2 className={styles.patrolAreaTitle}>
            หน้าจอ - ข้อมูลหน่วยงาน
          </h2>

          <form
            className={styles.searchCard}
            onSubmit={handleSubmit}
            aria-label="ค้นหาข้อมูลหน่วยงาน"
          >
            <div className={styles.formGroup}>
              <label
                className={styles.formLabel}
                htmlFor="location-keyword"
              >
                ค้นหา
              </label>

              <input
                id="location-keyword"
                className={styles.textInput}
                type="search"
                value={keyword}
                onChange={(event) =>
                  setKeyword(event.target.value)
                }
                placeholder="พิมพ์ชื่อหน่วยงาน/รหัสสัญญา"
                autoComplete="off"
              />
            </div>

            <div className={styles.searchActions}>
              <button
                className={styles.searchButton}
                type="submit"
                disabled={isSearching}
              >
                {isSearching
                  ? "กำลังค้นหา..."
                  : "ค้นหา"}
              </button>

              <button
                className={styles.clearButton}
                type="button"
                onClick={handleClear}
                disabled={isSearching}
              >
                ล้างค่า
              </button>
            </div>
          </form>

          {!hasSearchCriteria &&
            !isSearching && (
              <div
                className={styles.emptyStateCard}
                role="status"
              >
                <div
                  className={
                    styles.emptyStateIconArea
                  }
                  aria-hidden="true"
                >
                  <FontAwesomeIcon
                    className={styles.fa}
                    icon={faRoute}
                  />
                </div>

                <div
                  className={
                    styles.emptyStateTitle
                  }
                >
                  กรุณาระบุชื่อหน่วยงาน/รหัสสัญญา
                </div>

                <div
                  className={
                    styles.emptyStateDivider
                  }
                />

                <div
                  className={
                    styles.emptyStateHint
                  }
                >
                  <CircleAlert
                    size={24}
                    strokeWidth={2.3}
                  />

                  <span>
                    ระบุชื่อหน่วยงาน/รหัสสัญญา
                    แล้วกดค้นหา
                  </span>
                </div>
              </div>
            )}

          {errorMessage && (
            <div
              className={styles.errorCard}
              role="alert"
            >
              {errorMessage}
            </div>
          )}

          {hasSearchCriteria &&
            hasSearched &&
            !isSearching &&
            !errorMessage &&
            searchResults.length === 0 && (
              <div
                className={styles.emptyStateCard}
                role="status"
              >
                <div
                  className={
                    styles.emptyStateIconArea
                  }
                  aria-hidden="true"
                >
                  <FontAwesomeIcon
                    className={styles.fa}
                    icon={faRoute}
                  />
                </div>

                <div
                  className={
                    styles.emptyStateTitle
                  }
                >
                  ไม่พบข้อมูลหน่วยงาน/รหัสสัญญานี้
                </div>

                <div
                  className={
                    styles.emptyStateDivider
                  }
                />

                <div
                  className={
                    styles.emptyStateHint
                  }
                >
                  <CircleAlert
                    size={24}
                    strokeWidth={2.3}
                  />

                  <span>
                    กรุณาตรวจสอบชื่อหน่วยงาน/รหัสสัญญา
                    อีกครั้ง
                  </span>
                </div>
              </div>
            )}

          {hasSearchCriteria &&
            searchResults.length > 0 && (
              <div
                className={styles.resultList}
                aria-label="รายการข้อมูลหน่วยงาน"
              >
                {searchResults.map(
                  (location, index) => {
                    const routeSiteLocationId =
                      cleanText(
                        location.route_site_location_id,
                      );

                    const locationId =
                      getLocationId(location);

                    const locationName =
                      cleanText(
                        location.location_name,
                      ) || "-";

                    const contractCode =
                      cleanText(
                        location.contract_code,
                      );

                    const radiusMeter =
                      cleanText(
                        location.radius_meter,
                      );

                    const patrolRounds =
                      formatPatrolRounds(location);

                    const locationDetail =
                      cleanText(
                        location.location_detail,
                      ) || "-";

                    /**
                     * ภาค เขต เส้นทางของแต่ละหน่วยงาน
                     * รับจาก Backend ตาม route_site_location
                     */
                    const organizationPath = [
                      cleanText(
                        location.department_name,
                      ),
                      cleanText(
                        location.division_name,
                      ),
                      cleanText(
                        location.route_name,
                      ),
                    ]
                      .filter(Boolean)
                      .join(" ");

                    return (
                      <article
                        className={
                          styles.resultCard
                        }
                        key={
                          routeSiteLocationId ||
                          `${locationId}-${cleanText(
                            location.routes_id,
                          )}-${index}`
                        }
                      >
                        <h3
                          className={
                            styles.resultTitle
                          }
                        >
                          <a
                            href="#patrol-area-info-modal-title"
                            className={
                              styles.resultTitleLink
                            }
                            onClick={(event) => {
                              event.preventDefault();

                              handleOpenLocationModal(
                                location,
                              );
                            }}
                          >
                            {locationName}
                          </a>
                        </h3>

                        <div
                          className={
                            styles.resultDetails
                          }
                        >
                          <div
                            className={
                              styles.resultOrganization
                            }
                          >
                            {organizationPath || "-"}
                          </div>

                          <div
                            className={
                              styles.resultLine
                            }
                          >
                            <span
                              className={
                                styles.resultLineLabel
                              }
                            >
                              รหัสสัญญา :
                            </span>{" "}
                            {contractCode || "-"}
                          </div>

                          <div
                            className={
                              styles.resultLine
                            }
                          >
                            <span
                              className={
                                styles.resultLineLabel
                              }
                            >
                              รัศมีที่อนุญาต :
                            </span>{" "}
                            {radiusMeter
                              ? `${radiusMeter} เมตร`
                              : "-"}
                          </div>

                          <div
                            className={
                              styles.resultLine
                            }
                            style={{
                              display: "block",
                            }}
                          >
                            <div
                              className={
                                styles.resultLineLabel
                              }
                            >
                              กลุ่มตรวจ :
                            </div>

                            <div
                              style={{
                                whiteSpace: "pre-line",
                              }}
                            >
                              {patrolRounds}
                            </div>
                          </div>

                          <div
                            className={
                              styles.resultLine
                            }
                          >
                            <span
                              className={
                                styles.resultLineLabel
                              }
                            >
                              รายละเอียดสถานที่:
                            </span>{" "}
                            {locationDetail}
                          </div>

                          <div
                            className={
                              styles.resultLine
                            }
                          >
                            <span
                              className={
                                styles.resultLineLabel
                              }
                            >
                              อัปเดตล่าสุด:
                            </span>{" "}
                            {formatUpdatedAt(
                              location.updated_at,
                            )}
                          </div>

                          <button
                            type="button"
                            className={
                              styles.outsidePlanButton
                            }
                            onClick={() =>
                              handleOutsidePlanCheckInOut(
                                location,
                              )
                            }
                          >
                            <div
                              className={
                                styles.outsidePlanBox
                              }
                            >
                              <div
                                className={
                                  styles.outsidePlanIconWrap
                                }
                                aria-hidden="true"
                              >
                                <FontAwesomeIcon
                                  className={
                                    styles.outsidePlanIcon
                                  }
                                  icon={faClock}
                                />
                              </div>

                              <div
                                className={
                                  styles.outsidePlanText
                                }
                              >
                                <span
                                  className={
                                    styles.outsidePlanMainLine
                                  }
                                >
                                  กดทำรายการ ลงเวลา เข้า-ออกงาน
                                </span>

                                <span
                                  className={
                                    styles.outsidePlanSubLine
                                  }
                                >
                                  (นอกแผน)
                                </span>
                              </div>
                            </div>
                          </button>
                        </div>
                      </article>
                    );
                  },
                )}
              </div>
            )}

          <PatrolAreaInfoModal
            open={isModalOpen}
            location={selectedModalLocation}
            onClose={handleCloseLocationModal}
          />

          <div className="guts-fv-bottom">
            <BackButton
              onClick={onBack}
              className="guts-fv-backBtn"
            />
          </div>
        </section>
      </div>
    </main>
  );
}
