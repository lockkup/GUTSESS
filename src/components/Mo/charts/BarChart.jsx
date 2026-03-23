import React, { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import "./BarChart.css";

// Generate a distinct color for each index using HSL
function getColor(idx) {
  const hue = (idx * 47) % 360;
  return `hsl(${hue}, 70%, 50%)`;
}

const monthOptions = [
  { value: "all", label: "All" },
  ...Array.from({ length: 12 }).map((_, i) => ({
    value: i,
    label: new Intl.DateTimeFormat("en-US", { month: "short" }).format(new Date(2020, i, 1)),
  })),
];

const BarChartCard = ({ data, categories, title = "Bar Chart", height = 320, layout = "horizontal", availableYears, selectedYear, setSelectedYear, selectedMonth, setSelectedMonth }) => {
  // using CSS variables in charts.css instead of theme hook
  // `layout` prop: "horizontal" => bars extend left-right (horizontal bars)
  const isHorizontal = layout === "horizontal";
  const rechartsLayout = isHorizontal ? "vertical" : "horizontal";

  // Use categories prop if provided, otherwise auto-detect from data
  const chartCategories = useMemo(() => {
    if (categories && categories.length > 0) {
      return categories.map((cat, idx) => ({
        key: typeof cat === "string" ? cat : cat.key,
        label: typeof cat === "string"
          ? cat.charAt(0).toUpperCase() + cat.slice(1)
          : `${cat.name || cat.key} (${cat.value})`,
        color: typeof cat === "string" ? getColor(idx) : cat.color || getColor(idx),
      }));
    }
    if (!data || data.length === 0) return [];
    return Object.keys(data[0])
      .filter(key => key !== "group" && typeof data[0][key] === "number")
      .map((key, idx) => ({
        key,
        label: key.charAt(0).toUpperCase() + key.slice(1),
        color: getColor(idx),
      }));
  }, [categories, data]);

  const [includedCategories, setIncludedCategories] = useState(chartCategories.map(c => c.key));

  React.useEffect(() => {
    const keys = chartCategories.map(c => c.key);
    setIncludedCategories(prev => {
      if (prev.length === keys.length && prev.every((v, i) => v === keys[i])) {
        return prev;
      }
      return keys;
    });
  }, [chartCategories]);

  // responsive font sizing (match LineChart behavior)
  const [windowWidth, setWindowWidth] = React.useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
  React.useEffect(() => {
    const onResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const tickSize = windowWidth < 640 ? 8 : 11;
  const legendFont = windowWidth < 640 ? 10 : 12;
  const tooltipFont = windowWidth < 640 ? '0.55rem' : '0.75rem';
  const margin = windowWidth < 640 ? { top: 10, right: 5, left: -35, bottom: 5 } : { top: 10, right: 10, left: -20, bottom: 10 };

  const handleCategoryToggle = (key) => {
    setIncludedCategories((prev) =>
      prev.includes(key)
        ? prev.filter((cat) => cat !== key)
        : [...prev, key]
    );
  };

  const allSelected = includedCategories.length === chartCategories.length;
  const handleAllToggle = () => {
    setIncludedCategories(allSelected ? [] : chartCategories.map(c => c.key));
  };

  // Custom label renderer for inside the pie slice
  const renderCustomizedLabel = ({
    cx, cy, midAngle, innerRadius, outerRadius, percent, index, name, value,
  }) => {
    const RADIAN = Math.PI / 180;
    // Calculate label position
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    // Show value (count) inside the slice
    return (
      <text
        x={x}
        y={y}
        fill="#fff"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={14}
        fontWeight={600}
      >
        {value}
      </text>
    );
  };

  // Prepare pie chart data: sum each category across all groups
  const pieData = chartCategories
    .filter(cat => includedCategories.includes(cat.key))
    .map(cat => ({
      key: cat.key,
      name: cat.label,
      value: data.reduce((sum, d) => sum + (d[cat.key] || 0), 0),
      color: cat.color,
    }));

  // Use entire dataset for category-based series rendering
  const filteredData = data || [];
  const filteredCategories = chartCategories.filter(c => includedCategories.includes(c.key));

  return (
    <div className="chart-card">
      <div className="chart-controls" style={{ justifyContent: 'space-between', alignItems: 'center', maxHeight: 'none', flexWrap: 'nowrap' }}>
        <h2 className="chart-title" style={{ margin: 0 }}>{title}</h2>
        {availableYears && setSelectedYear && (
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <select
              className="chart-pill-select"
              value={selectedYear ?? 'all'}
              onChange={(e) => {
                if (e.target.value === 'all') { setSelectedYear(null); if (setSelectedMonth) setSelectedMonth(null); }
                else setSelectedYear(Number(e.target.value));
              }}
            >
              <option value="all">Year</option>
              {availableYears.map((y) => (
                <option key={y} value={y}>Year -{y + 543}</option>
              ))}
            </select>
            <select
              className="chart-pill-select"
              value={selectedMonth ?? 'all'}
              onChange={(e) => {
                if (!setSelectedMonth) return;
                if (e.target.value === 'all') setSelectedMonth(null);
                else setSelectedMonth(Number(e.target.value));
              }}
              disabled={selectedYear === null}
            >
              {monthOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        )}
      </div>
      <div className="chart-container" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={filteredData} layout={rechartsLayout} margin={margin}>
            <CartesianGrid strokeDasharray="3 3" />
            {isHorizontal ? (
              <>
                <XAxis type="number" stroke="#8884d8" tick={{ fontSize: tickSize, fill: '#8884d8' }} />
                <YAxis type="category" dataKey="group" stroke="#8884d8" tick={{ fontSize: tickSize, fill: '#8884d8' }} />
              </>
            ) : (
              <>
                <XAxis dataKey="group" stroke="#8884d8" tick={{ fontSize: tickSize, fill: '#8884d8' }} />
                <YAxis stroke="#8884d8" tick={{ fontSize: tickSize, fill: '#8884d8' }} />
              </>
            )}
            <Tooltip wrapperStyle={{ fontSize: tooltipFont }} />
            {filteredCategories.map((cat, idx) => (
              <Bar
                key={`bar-${cat.key}`}
                dataKey={cat.key}
                stackId={isHorizontal ? "a" : undefined}
                barSize={isHorizontal ? 18 : 32}
                fill={cat.color}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default BarChartCard;