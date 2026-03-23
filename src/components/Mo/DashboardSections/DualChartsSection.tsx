import React, { useMemo, useState, useEffect } from "react";
import "./DualChartsSection.css";
import RankedBarList from "../charts/RankedBarList";
import DonutChartCard from "../charts/DonutChart";
import caseData from "@/temp_data/case.json";

const BAR_CATEGORIES = [
  { key: "leave",  label: "ลา",             color: "#4e9af1" },
  { key: "shift",  label: "เวร",            color: "#f4a34a" },
  { key: "issues", label: "ผิดระเบียบ",     color: "#e06b8b" },
  { key: "wear",   label: "เครื่องแต่งกาย", color: "#6dcf81" },
  { key: "other",  label: "อื่นๆ",          color: "#a78bfa" },
];

const BAR_SUB_CATEGORIES: Record<string, { key: string; label: string; color: string }[]> = {
  leave: [
    { key: "leave_sick_count",     label: "ลาป่วย",  color: "#93c5fd" },
    { key: "leave_business_count", label: "ลากิจ",   color: "#3b82f6" },
    { key: "leave_other_count",    label: "ลาอื่นๆ", color: "#1d4ed8" },
    { key: "absent_count",         label: "ขาด",     color: "#1e3a8a" },
  ],
  shift: [
    { key: "shift_18_count", label: "เวร 18 ชม.", color: "#fde68a" },
    { key: "shift_24_count", label: "เวร 24 ชม.", color: "#f59e0b" },
    { key: "shift_36_count", label: "เวร 36 ชม.", color: "#b45309" },
  ],
  issues: [
    { key: "rule_sleep_count",   label: "นอนหลับ",   color: "#fbcfe8" },
    { key: "rule_phone_count",   label: "โทรศัพท์",  color: "#ec4899" },
    { key: "rule_no_card_count", label: "ไม่มีบัตร", color: "#be185d" },
    { key: "warning_count",      label: "คำเตือน",   color: "#881337" },
  ],
  wear: [
    { key: "wear_hat_count",   label: "หมวก",    color: "#bbf7d0" },
    { key: "wear_shirt_count", label: "เสื้อ",   color: "#22c55e" },
    { key: "wear_pants_count", label: "กางเกง",  color: "#15803d" },
    { key: "wear_shoes_count", label: "รองเท้า", color: "#14532d" },
  ],
  other: [
    { key: "other_job_count",      label: "งานพิเศษ", color: "#ddd6fe" },
    { key: "other_training_count", label: "ฝึกอบรม",  color: "#7c3aed" },
  ],
};

export default function DualCharts() {
  const records = caseData || [];

  const [topN, setTopN] = useState(5);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [selectedCat, setSelectedCat] = useState<string | null>(null);

  // Date-range controls at the section level so both charts receive filtered data
  const hasDateField = useMemo(
    () => records.some((r) => r && (r.date || r.timestamp || r.created_at)),
    [records],
  );

  const parseDate = (v?: string | number | null) => {
    if (!v) return null;
    const d = new Date(v as any);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const dataMinMax = useMemo(() => {
    if (!hasDateField) return { min: null as Date | null, max: null as Date | null };
    let min: Date | null = null;
    let max: Date | null = null;
    records.forEach((r) => {
      const v = r.date || r.timestamp || r.created_at;
      const pd = parseDate(v);
      if (!pd) return;
      if (!min || pd < min) min = pd;
      if (!max || pd > max) max = pd;
    });
    return { min, max };
  }, [records, hasDateField]);

  const formatInputDate = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");
  const [startDate, setStartDate] = useState(dataMinMax.min ? formatInputDate(dataMinMax.min) : "");
  const [endDate, setEndDate] = useState(dataMinMax.max ? formatInputDate(dataMinMax.max) : "");

  React.useEffect(() => {
    if (dataMinMax.min) setStartDate(formatInputDate(dataMinMax.min));
    if (dataMinMax.max) setEndDate(formatInputDate(dataMinMax.max));
  }, [dataMinMax.min, dataMinMax.max]);

  const filteredRecords = useMemo(() => {
    if (!hasDateField) return records;
    const s = parseDate(startDate);
    const e = parseDate(endDate);
    return records.filter((r) => {
      const v = r.date || r.timestamp || r.created_at;
      const pd = parseDate(v);
      if (!pd) return false;
      if (s && pd < s) return false;
      if (e && pd > e) return false;
      return true;
    });
  }, [records, hasDateField, startDate, endDate]);
  const barData = useMemo(() => {
    const map = new Map();
    filteredRecords.forEach((r) => {
      const loc = r.location || "Unknown";

      const leave = (r.leave_sick_count || 0) + (r.leave_business_count || 0) + (r.leave_other_count || 0) + (r.absent_count || 0);
      const shift = (r.shift_18_count || 0) + (r.shift_24_count || 0) + (r.shift_36_count || 0);
      const issues = (r.rule_sleep_count || 0) + (r.rule_phone_count || 0) + (r.rule_no_card_count || 0) + (r.warning ? 1 : 0);
      const wear = (r.wear_hat_count || 0) + (r.wear_shirt_count || 0) + (r.wear_pants_count || 0) + (r.wear_shoes_count || 0);
      const other = (r.other_job_count || 0) + (r.other_training_count || 0);

      const prev = map.get(loc) || { leave: 0, shift: 0, issues: 0, wear: 0, other: 0, leave_sick_count: 0, leave_business_count: 0, leave_other_count: 0, absent_count: 0, shift_18_count: 0, shift_24_count: 0, shift_36_count: 0, rule_sleep_count: 0, rule_phone_count: 0, rule_no_card_count: 0, warning_count: 0, wear_hat_count: 0, wear_shirt_count: 0, wear_pants_count: 0, wear_shoes_count: 0, other_job_count: 0, other_training_count: 0 };
      map.set(loc, {
        leave: prev.leave + leave,
        shift: prev.shift + shift,
        issues: prev.issues + issues,
        wear: prev.wear + wear,
        other: prev.other + other,
        leave_sick_count:     prev.leave_sick_count     + (r.leave_sick_count     || 0),
        leave_business_count: prev.leave_business_count + (r.leave_business_count || 0),
        leave_other_count:    prev.leave_other_count    + (r.leave_other_count    || 0),
        absent_count:         prev.absent_count         + (r.absent_count         || 0),
        shift_18_count:  prev.shift_18_count  + (r.shift_18_count  || 0),
        shift_24_count:  prev.shift_24_count  + (r.shift_24_count  || 0),
        shift_36_count:  prev.shift_36_count  + (r.shift_36_count  || 0),
        rule_sleep_count:   prev.rule_sleep_count   + (r.rule_sleep_count   || 0),
        rule_phone_count:   prev.rule_phone_count   + (r.rule_phone_count   || 0),
        rule_no_card_count: prev.rule_no_card_count + (r.rule_no_card_count || 0),
        warning_count:      prev.warning_count      + (r.warning ? 1 : 0),
        wear_hat_count:   prev.wear_hat_count   + (r.wear_hat_count   || 0),
        wear_shirt_count: prev.wear_shirt_count + (r.wear_shirt_count  || 0),
        wear_pants_count: prev.wear_pants_count + (r.wear_pants_count  || 0),
        wear_shoes_count: prev.wear_shoes_count + (r.wear_shoes_count  || 0),
        other_job_count:      prev.other_job_count      + (r.other_job_count      || 0),
        other_training_count: prev.other_training_count + (r.other_training_count || 0),
      });
    });

    const arr = Array.from(map.entries()).map(([key, value]) => ({ key, group: key, ...value }));
    arr.sort((a, b) => {
      const ta = (a.leave || 0) + (a.shift || 0) + (a.issues || 0) + (a.wear || 0) + (a.other || 0);
      const tb = (b.leave || 0) + (b.shift || 0) + (b.issues || 0) + (b.wear || 0) + (b.other || 0);
      return tb - ta;
    });

    return arr.slice(0, topN);
  }, [filteredRecords, topN]);


  const pieData = useMemo(() => {
    let leave = 0,
      shift = 0,
      issues = 0,
      wear = 0,
      other = 0;

    filteredRecords.forEach((r) => {
      leave += (r.leave_sick_count || 0) + (r.leave_business_count || 0) + (r.leave_other_count || 0) + (r.absent_count || 0);
      shift += (r.shift_18_count || 0) + (r.shift_24_count || 0) + (r.shift_36_count || 0);
      issues += (r.rule_sleep_count || 0) + (r.rule_phone_count || 0) + (r.rule_no_card_count || 0) + (r.warning ? 1 : 0);
      wear += (r.wear_hat_count || 0) + (r.wear_shirt_count || 0) + (r.wear_pants_count || 0) + (r.wear_shoes_count || 0);
      other += (r.other_job_count || 0) + (r.other_training_count || 0);
    });

    const arr = [
      { key: "leave", name: "Leave", value: leave },
      { key: "shift", name: "Shift", value: shift },
      { key: "issues", name: "Issues", value: issues },
      { key: "wear", name: "Wear", value: wear },
      { key: "other", name: "Other", value: other },
    ].filter((d) => d.value > 0);

    return arr;
  }, [filteredRecords]);

  const donutTitle = useMemo(() => {
    if (selectedGroup && selectedCat)
      return BAR_CATEGORIES.find((c) => c.key === selectedCat)?.label ?? selectedCat;
    if (selectedGroup) return selectedGroup;
    return "ผิดข้อปฏิบัติ";
  }, [selectedGroup, selectedCat]);

  const donutData = useMemo(() => {
    if (selectedGroup) {
      const item = barData.find((d) => d.group === selectedGroup);
      if (!item) return pieData;
      if (selectedCat) {
        const subs = BAR_SUB_CATEGORIES[selectedCat] || [];
        return subs
          .map((sc) => ({ key: sc.key, name: sc.label, value: (item as any)[sc.key] || 0, color: sc.color }))
          .filter((d) => d.value > 0);
      }
      return BAR_CATEGORIES
        .map((c) => ({ key: c.key, name: c.label, value: (item as any)[c.key] || 0, color: c.color }))
        .filter((d) => d.value > 0);
    }
    return pieData;
  }, [selectedGroup, selectedCat, barData, pieData]);

  return (
    <div style={{ marginBottom: 12 }}>

      <div className="mo-dualcharts" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, alignItems: "start" }}>
        <RankedBarList
          data={barData}
          title="ภาค"
          categories={BAR_CATEGORIES}
          subCategories={BAR_SUB_CATEGORIES}
          onGroupSelect={(g: string | null) => { setSelectedGroup(g); setSelectedCat(null); }}
          onCatSelect={(c: string | null) => setSelectedCat(c)}
        />

        <DonutChartCard data={donutData} title={donutTitle} height={220} />

      </div>
  
    </div>
  );
}
