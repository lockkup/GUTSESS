import React, { useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import "./VerticalBarSection.css";
import caseData from "@/temp_data/case.json";

const WEAR_SERIES = [
  { key: "hat",   label: "หมวก",    color: "#4e9af1" },
  { key: "shirt", label: "เสื้อ",   color: "#f4a34a" },
  { key: "pants", label: "กางเกง",  color: "#6dcf81" },
  { key: "shoes", label: "รองเท้า", color: "#e06b8b" },
];

const monthOptions = [
  { value: "all", label: "All" },
  ...Array.from({ length: 12 }).map((_, i) => ({
    value: i,
    label: new Intl.DateTimeFormat("en-US", { month: "short" }).format(new Date(2020, i, 1)),
  })),
];

export default function VerticalBar() {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState<number | null>(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [selectedSector, setSelectedSector] = useState<string>("all");

  const availableYears = useMemo(() => {
    const years = new Set(
      (caseData as any[]).map((e: any) => new Date(e.update_at || e.create_at || "").getFullYear()).filter((y) => !isNaN(y))
    );
    return Array.from(years).sort((a: any, b: any) => b - a) as number[];
  }, []);

  const availableSectors = useMemo(() => {
    const sectors = new Set((caseData as any[]).map((r: any) => r.location).filter(Boolean));
    return Array.from(sectors).sort() as string[];
  }, []);

  const data = useMemo(() => {
    const filtered = (caseData as any[]).filter((r: any) => {
      const d = new Date(r.update_at || r.create_at || "");
      if (isNaN(d.getTime())) return true;
      if (selectedYear !== null && d.getFullYear() !== selectedYear) return false;
      if (selectedMonth !== null && d.getMonth() !== selectedMonth) return false;
      if (selectedSector !== "all" && r.location !== selectedSector) return false;
      return true;
    });

    const totals = { hat: 0, shirt: 0, pants: 0, shoes: 0 };
    filtered.forEach((r: any) => {
      totals.hat   += r.wear_hat_count   || 0;
      totals.shirt += r.wear_shirt_count  || 0;
      totals.pants += r.wear_pants_count  || 0;
      totals.shoes += r.wear_shoes_count  || 0;
    });

    return WEAR_SERIES.map((s) => ({
      group: s.label,
      value: totals[s.key as keyof typeof totals],
      color: s.color,
    }));
  }, [selectedYear, selectedMonth, selectedSector]);

  return (
    <div className="mo-verticalbar">
      <div className="verticalbar-card">
        <div className="verticalbar-header">
          <h2 className="verticalbar-title">เครื่องแต่งกาย</h2>
          <div className="chart-controls verticalbar-controls">
            {/* Year selector */}
            <select
              className="chart-pill-select"
              value={selectedYear ?? "all"}
              onChange={(e) => {
                if (e.target.value === "all") { setSelectedYear(null); setSelectedMonth(null); }
                else setSelectedYear(Number(e.target.value));
              }}
            >
              <option value="all">Year</option>
              {availableYears.map((y) => (
                <option key={y} value={y}>Year -{y + 543}</option>
              ))}
            </select>
            {/* Month selector */}
            <select
              className="chart-pill-select"
              value={selectedMonth ?? "all"}
              onChange={(e) => {
                if (e.target.value === "all") setSelectedMonth(null);
                else setSelectedMonth(Number(e.target.value));
              }}
              disabled={selectedYear === null}
            >
              {monthOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            {/* Sector selector */}
            <select
              className="chart-pill-select"
              value={selectedSector}
              onChange={(e) => setSelectedSector(e.target.value)}
            >
              <option value="all">ทุกภาค</option>
              {availableSectors.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data} margin={{ top: 8, right: 10, left: -20, bottom: 8 }} barCategoryGap="35%">
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="group" tick={{ fontSize: 12, fill: "#8884d8" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "#8884d8" }} axisLine={false} tickLine={false} />
            <Tooltip formatter={(v: any) => [v, "จำนวน"]} />
            <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={60}>
              {data.map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

