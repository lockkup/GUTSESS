import { useState } from "react";
import type { FormEvent } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faClock,
  faRoute,
} from "@fortawesome/free-solid-svg-icons";
import { CircleAlert } from "lucide-react";

import BackButton from "@/components/BackButton";
import SuccessModal from "@/components/SuccessModal";
import PatrolAreaInfoModal, {
  type PatrolAreaInfoModalLocation,
  type PatrolAreaInfoUpdateContext,
  type PatrolAreaInfoUpdatePayload,
  type PatrolAreaInfoUpdateSetting,
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


type PatrolAreaLocationUpdateResponse = {
  location_id: number;
  department_id: number;
  division_id: number;
  route_id: number;
  contract_code: string;
  location_name: string;
  location_detail: string | null;
  latitude: string | number;
  longitude: string | number;
  radius_meter: number;
  grace_meter: number;
  updated_at: string;
};


const PATROL_AREA_SEARCH_ENDPOINT = "/patrol-areas/search";
const PATROL_AREA_UPDATE_LOCATION_ENDPOINT =
  "/patrol-areas/update-location";
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


function toPositiveInteger(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);

  return Number.isSafeInteger(parsed) && parsed > 0
    ? parsed
    : null;
}


function getPatrolAreaUpdateContext(
  location: SiteLocation,
): PatrolAreaInfoUpdateContext | null {
  const locationId = toPositiveInteger(
    location.location_id ?? location.id,
  );

  const departmentId = toPositiveInteger(
    location.department_id,
  );

  const divisionId = toPositiveInteger(
    location.division_id,
  );

  const routeId = toPositiveInteger(
    location.routes_id,
  );

  if (
    locationId === null ||
    departmentId === null ||
    divisionId === null ||
    routeId === null
  ) {
    return null;
  }

  return {
    locationId,
    departmentId,
    divisionId,
    routeId,
  };
}


function toSettingBoolean(
  value: unknown,
): boolean | null {
  if (
    value === true ||
    value === 1 ||
    value === "1" ||
    value === "true"
  ) {
    return true;
  }

  if (
    value === false ||
    value === 0 ||
    value === "0" ||
    value === "false"
  ) {
    return false;
  }

  return null;
}


function toPatrolAreaUpdateSetting(
  value: unknown,
  context: PatrolAreaInfoUpdateContext,
): PatrolAreaInfoUpdateSetting | null {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return null;
  }

  const data = value as Record<string, unknown>;

  const departmentId = toPositiveInteger(
    data.department_id,
  );

  const divisionId = toPositiveInteger(
    data.division_id,
  );

  const routeId = toPositiveInteger(
    data.route_id,
  );

  if (
    departmentId !== context.departmentId ||
    divisionId !== context.divisionId ||
    routeId !== context.routeId ||
    toSettingBoolean(data.allow_location_update) !== true ||
    toSettingBoolean(data.is_active) !== true ||
    toSettingBoolean(data.mark_flag) !== false ||
    (
      data.effective_from !== null &&
      typeof data.effective_from !== "string"
    ) ||
    (
      data.effective_to !== null &&
      typeof data.effective_to !== "string"
    )
  ) {
    return null;
  }

  return {
    departmentId,
    divisionId,
    routeId,
    allowLocationUpdate: true,
    effectiveFrom: data.effective_from as string | null,
    effectiveTo: data.effective_to as string | null,
    isActive: true,
    markFlag: false,
  };
}


async function loadPatrolAreaUpdateSetting(
  context: PatrolAreaInfoUpdateContext,
): Promise<PatrolAreaInfoUpdateSetting | null> {
  const data = await api.get<unknown>(
    "/route-location-update-settings/",
    {
      department_id: context.departmentId,
      division_id: context.divisionId,
      route_id: context.routeId,
      allow_location_update: true,
      is_active: true,
      include_deleted: false,
      only_effective: true,
      limit: 2,
    },
  );

  if (!Array.isArray(data)) {
    throw new Error(
      "รูปแบบข้อมูลสิทธิ์แก้ไขพิกัดไม่ถูกต้อง",
    );
  }

  if (data.length === 0) {
    return null;
  }

  if (data.length !== 1) {
    throw new Error(
      "พบการตั้งค่าสิทธิ์แก้ไขพิกัดซ้ำสำหรับเส้นทางนี้",
    );
  }

  return toPatrolAreaUpdateSetting(
    data[0],
    context,
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

  const [
    modalUpdateSetting,
    setModalUpdateSetting,
  ] = useState<PatrolAreaInfoUpdateSetting | null>(
    null,
  );

  const [
    modalPermissionLoading,
    setModalPermissionLoading,
  ] = useState(false);

  const [
    isSuccessModalOpen,
    setIsSuccessModalOpen,
  ] = useState(false);

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


  async function handleOpenLocationModal(
    location: SiteLocation,
  ) {
    const updateContext =
      getPatrolAreaUpdateContext(location);

    setSelectedModalLocation({
      locationId:
        location.location_id ??
        location.id ??
        null,

      departmentId:
        location.department_id ?? null,

      divisionId:
        location.division_id ?? null,

      routeId:
        location.routes_id ?? null,

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

    setModalUpdateSetting(null);
    setModalPermissionLoading(
      updateContext !== null,
    );
    setIsModalOpen(true);

    if (!updateContext) {
      return;
    }

    try {
      const updateSetting =
        await loadPatrolAreaUpdateSetting(
          updateContext,
        );

      setModalUpdateSetting(
        updateSetting,
      );
    } catch (error) {
      console.error(
        "[PatrolAreaInfo] load location update setting error:",
        error,
      );

      setModalUpdateSetting(null);
    } finally {
      setModalPermissionLoading(false);
    }
  }


  function handleCloseLocationModal() {
    setIsModalOpen(false);
    setSelectedModalLocation(null);
    setModalUpdateSetting(null);
    setModalPermissionLoading(false);
  }


  async function handleUpdateLocation(
    payload: PatrolAreaInfoUpdatePayload,
  ) {
    const normalizedEmployeeCode = empCode.trim();

    if (!normalizedEmployeeCode) {
      throw new Error(
        "ไม่พบรหัสพนักงาน กรุณาเข้าสู่ระบบใหม่",
      );
    }

    if (!selectedModalLocation) {
      throw new Error(
        "ไม่พบข้อมูลหน่วยงานที่กำลังแก้ไข",
      );
    }

    const selectedContext = {
      locationId: toPositiveInteger(
        selectedModalLocation.locationId,
      ),
      departmentId: toPositiveInteger(
        selectedModalLocation.departmentId,
      ),
      divisionId: toPositiveInteger(
        selectedModalLocation.divisionId,
      ),
      routeId: toPositiveInteger(
        selectedModalLocation.routeId,
      ),
    };

    if (
      selectedContext.locationId !== payload.locationId ||
      selectedContext.departmentId !== payload.departmentId ||
      selectedContext.divisionId !== payload.divisionId ||
      selectedContext.routeId !== payload.routeId
    ) {
      throw new Error(
        "ข้อมูลหน่วยงานเปลี่ยนแปลงแล้ว กรุณาปิดและเปิดข้อมูลหน่วยงานใหม่",
      );
    }

    const response =
      await api.post<PatrolAreaLocationUpdateResponse>(
        PATROL_AREA_UPDATE_LOCATION_ENDPOINT,
        {
          employee_code: normalizedEmployeeCode,
          location_id: payload.locationId,
          department_id: payload.departmentId,
          division_id: payload.divisionId,
          route_id: payload.routeId,
          latitude: payload.latitude,
          longitude: payload.longitude,
          accuracy_meter: payload.accuracyMeter,
          radius_meter: payload.radiusMeter,
        },
      );

    if (
      response.location_id !== payload.locationId ||
      response.department_id !== payload.departmentId ||
      response.division_id !== payload.divisionId ||
      response.route_id !== payload.routeId
    ) {
      throw new Error(
        "ข้อมูลที่ Backend ส่งกลับไม่ตรงกับหน่วยงานที่เลือก",
      );
    }

    /**
     * อัปเดตเฉพาะ state บนหน้าจอ
     * ไม่ Refresh ทั้งหน้า และไม่ต้องค้นหาใหม่
     */
    setSearchResults((currentResults) =>
      currentResults.map((location) => {
        const locationId = toPositiveInteger(
          location.location_id ?? location.id,
        );

        if (locationId !== response.location_id) {
          return location;
        }

        return {
          ...location,
          latitude: response.latitude,
          longitude: response.longitude,
          radius_meter: response.radius_meter,
          grace_meter: response.grace_meter,
          location_detail: response.location_detail,
          updated_at: response.updated_at,
        };
      }),
    );

    handleCloseLocationModal();
    setIsSuccessModalOpen(true);
  }


  function handleSuccessOk() {
    setIsSuccessModalOpen(false);
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

                              void handleOpenLocationModal(
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
                                  (ติดตาม/มอบหมาย)
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
            updateSetting={modalUpdateSetting}
            permissionLoading={
              modalPermissionLoading
            }
            onUpdate={handleUpdateLocation}
            onClose={handleCloseLocationModal}
          />

          <SuccessModal
            open={isSuccessModalOpen}
            title="บันทึกสำเร็จ"
            message="บันทึกข้อมูลเรียบร้อยแล้ว"
            okText="ตกลง"
            onOk={handleSuccessOk}
            closeOnBackdrop={false}
            closeOnEsc={false}
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
