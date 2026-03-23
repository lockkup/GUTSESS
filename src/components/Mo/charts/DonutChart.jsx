import React, { useState, useMemo, useEffect } from "react";
import {
  PieChart as RePieChart,
  Pie as RePie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import "./DonutChart.css";
import "./RankedBarList.css";

// Generate a distinct color for each index using HSL
function getColor(idx) {
  const hue = (idx * 47) % 360;
  return `hsl(${hue}, 70%, 50%)`;
}

const DonutChartCard = ({
  data = [],
  categories = [],
  title = "Donut Chart",
  height = 320,
}) => {
  // using CSS variables in charts.css instead of theme hook

  // Memoize categories for performance
  const chartCategories = useMemo(() => {
    if (categories.length > 0) {
      return categories.map((cat, idx) => ({
        key: typeof cat === "string" ? cat : cat.key,
        label:
          typeof cat === "string"
            ? cat.charAt(0).toUpperCase() + cat.slice(1)
            : cat.label || cat.key.charAt(0).toUpperCase() + cat.key.slice(1),
        color:
          typeof cat === "string" ? getColor(idx) : cat.color || getColor(idx),
      }));
    }
    return data.map((d, idx) => {
      const keyStr = String(d.key);
      return {
        key: d.key,
        label: d.name || keyStr.charAt(0).toUpperCase() + keyStr.slice(1),
        color: d.color || getColor(idx),
      };
    });
  }, [categories, data]);

  const [includedCategories, setIncludedCategories] = useState(
    chartCategories.map((c) => c.key),
  );

  useEffect(() => {
    const keys = chartCategories.map((c) => c.key);
    setIncludedCategories((prev) => {
      if (prev.length === keys.length && prev.every((v, i) => v === keys[i])) {
        return prev;
      }
      return keys;
    });
  }, [chartCategories]);

  // Optional date filtering: detect if data items include a `date` field
  const hasDateField = useMemo(
    () => data.some((d) => d && (d.date || d.timestamp)),
    [data],
  );
  const parseDate = (v) => {
    if (!v) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  };
  const formatInputDate = (d) => {
    if (!d) return "";
    return new Date(d).toISOString().slice(0, 10);
  };

  const dataMinMax = useMemo(() => {
    if (!hasDateField) return { min: null, max: null };
    let min = null;
    let max = null;
    data.forEach((it) => {
      const v = it.date || it.timestamp;
      const pd = parseDate(v);
      if (!pd) return;
      if (!min || pd < min) min = pd;
      if (!max || pd > max) max = pd;
    });
    return { min, max };
  }, [data, hasDateField]);

  const [startDate, setStartDate] = useState(
    dataMinMax.min ? formatInputDate(dataMinMax.min) : "",
  );
  const [endDate, setEndDate] = useState(
    dataMinMax.max ? formatInputDate(dataMinMax.max) : "",
  );

  useEffect(() => {
    if (dataMinMax.min) setStartDate(formatInputDate(dataMinMax.min));
    if (dataMinMax.max) setEndDate(formatInputDate(dataMinMax.max));
  }, [dataMinMax.min, dataMinMax.max]);

  // responsive font sizing like LineChart
  const [windowWidth, setWindowWidth] = React.useState(
    typeof window !== "undefined" ? window.innerWidth : 1024,
  );
  React.useEffect(() => {
    const onResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const tooltipFont = windowWidth < 640 ? "0.55rem" : "0.75rem";
  const margin = { top: 0, right: 0, left: 0, bottom: 0 };

  // Make donut hole more visible by using a slightly smaller outer radius and larger inner radius
  // Use a smaller donut for a tighter visual footprint
  const outerRadius = Math.min(64, Math.max(30, Math.floor(height / 2) - 24));
  const innerRadius = Math.floor(outerRadius * 0.6);

  const renderCustomizedLabel = ({
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    percent,
    index,
    name,
    value,
  }) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    const fontSize = windowWidth < 640 ? 10 : 14;
    return (
      <text
        x={x}
        y={y}
        fill="#fff"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={fontSize}
        fontWeight={600}
      >
        {value}
      </text>
    );
  };

  const handleCategoryToggle = (key) => {
    setIncludedCategories((prev) =>
      prev.includes(key) ? prev.filter((cat) => cat !== key) : [...prev, key],
    );
  };

  const allSelected = includedCategories.length === chartCategories.length;
  const handleAllToggle = () => {
    setIncludedCategories(allSelected ? [] : chartCategories.map((c) => c.key));
  };

  // Apply optional date filtering (if date field exists), then category filtering
  const dateFiltered = useMemo(() => {
    if (!hasDateField) return data;
    const s = parseDate(startDate);
    const e = parseDate(endDate);
    return data.filter((d) => {
      const v = d.date || d.timestamp;
      const pd = parseDate(v);
      if (!pd) return false;
      if (s && pd < s) return false;
      if (e && pd > e) return false;
      return true;
    });
  }, [data, hasDateField, startDate, endDate]);

  const filteredData = dateFiltered.filter((d) =>
    includedCategories.includes(d.key),
  );
  const filteredCategories = chartCategories.filter((c) =>
    includedCategories.includes(c.key),
  );

  return (
    <div className="chart-card" style={{ display: 'flex', flexDirection: 'column', height: '100%', boxSizing: 'border-box' }}>
      <div className="rl-header-row" style={{ marginBottom: 8 }}>
        <h2 className="rl-title">{title}</h2>
        {filteredCategories.length > 0 && (
          <div className="rl-kebab-wrap">
            <button className="rl-kebab" aria-label="Show legend">
              <span /><span /><span />
            </button>
            <div className="rl-legend-popup">
              {filteredCategories.map((c) => (
                <span key={String(c.key)} className="rl-legend-item">
                  <span className="rl-legend-dot" style={{ background: c.color }} />
                  {c.label}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
      <div
        className="chart-container"
        style={{
          flex: 1,
          minHeight: 200,
        }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <RePieChart margin={margin}>
            <RePie
              data={filteredData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius="100%"
              innerRadius="30%"
              label={renderCustomizedLabel}
              paddingAngle={2}
              labelLine={false}
            >
              {filteredCategories.map((cat, idx) => (
                <Cell
                  key={`cell-${String(cat.key)}-${idx}`}
                  fill={cat.color}
                />
              ))}
            </RePie>
            <Tooltip wrapperStyle={{ fontSize: tooltipFont }} />
          </RePieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default DonutChartCard;
