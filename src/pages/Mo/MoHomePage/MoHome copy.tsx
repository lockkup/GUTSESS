import styles from "./MoHome.module.css";
import React, { useState, useEffect } from "react";
import { ChevronRight, Home } from "lucide-react";
import caseData from "@/api/data/case.json";
type Props = {
  onAdd?: () => void;
  onOpenDetail?: (ev: any) => void;
  openOnMount?: boolean;
  onMounted?: () => void;
  onBackHome?: () => void;
};

export default function MoHome(props: Props) {
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    if (props.openOnMount) {
      setSearchOpen(true);
      props.onMounted && props.onMounted();
    }
  }, [props.openOnMount]);

  function openSearch() {
    setSearchOpen(true);
  }

  return (
    <>
      <div>
        {!searchOpen ? (
          <>
            <div className={styles["guts-mo-btn"]} aria-hidden>
              <button
                type="button"
                className={styles["mo-home-addnew"]}
                onClick={() =>
                  props.onAdd ? props.onAdd() : window.history.back()
                }
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

            {/* Home button: moved here so it only shows with the main actions */}
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
        ) : (
          <>
            {/* <div className="mo-search">
              <div className="mo-search-inner">
                <Search />
                <input
                  type="search"
                  placeholder="ค้นหา"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitSearch();
                    if (e.key === "Escape") cancelSearch();
                  }}
                />
                {query && (
                  <button
                    className="mo-search-clear"
                    aria-label="Clear search"
                    onClick={() => setQuery("")}
                  >
                    <X />
                  </button>
                )}
              </div>
            </div> */}

            {searchOpen && (
              <div className={styles["search-results"]}>
                <div className={styles["search-results-header"]}>
                  {/* <Search /> */}
                  บันทึก ({Math.min(5, (caseData as any[]).length)} รายการ)
                </div>
                {/* show first 5 items from case.json */}
                {(caseData as any[]).slice(0, 4).map((r: any, idx: number) => {
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
                      key={String(key)}
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
                          <p className={styles["result-date"]}>03/02/2569</p>
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
            )}

            <div className={styles["guts-back-outer"]} aria-hidden>
              <button
                type="button"
                className={[styles["guts-btn"], styles["guts-back-btn"]].join(
                  " ",
                )}
                onClick={() => {
                  if (searchOpen) {
                    setSearchOpen(false);
                    return;
                  }
                  return window.history.back();
                }}
              >
                Back
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

export { MoHome };
