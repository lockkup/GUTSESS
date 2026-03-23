import React, { useState, useMemo, useEffect } from "react";
import { PieChart as RePieChart, Pie as RePie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import "./PieChart.css";

// Generate a distinct color for each index using HSL
function getColor(idx) {
  const hue = (idx * 47) % 360;
  return `hsl(${hue}, 70%, 50%)`;
}

const PieChartCard = ({
  data = [],
  categories = [],
  title = "Pie Chart",
  height = 320,
}) => {
  // using CSS variables in charts.css instead of theme hook

  // Memoize categories for performance
  const chartCategories = useMemo(() => {
    if (categories.length > 0) {
      return categories.map((cat, idx) => ({
        key: typeof cat === "string" ? cat : cat.key,
        label: typeof cat === "string"
          ? cat.charAt(0).toUpperCase() + cat.slice(1)
          : cat.label || (cat.key.charAt(0).toUpperCase() + cat.key.slice(1)),
        color: typeof cat === "string" ? getColor(idx) : cat.color || getColor(idx),
      }));
    }
    return data.map((d, idx) => {
      const keyStr = String(d.key);
      return {
        key: d.key,
        label: d.name || (keyStr.charAt(0).toUpperCase() + keyStr.slice(1)),
        color: getColor(idx),
      };
    });
  }, [categories, data]);

  const [includedCategories, setIncludedCategories] = useState(
    chartCategories.map(c => c.key)
  );

  useEffect(() => {
    const keys = chartCategories.map(c => c.key);
    setIncludedCategories(prev => {
      if (prev.length === keys.length && prev.every((v, i) => v === keys[i])) {
        return prev;
      }
      return keys;
    });
  }, [chartCategories]);

  // responsive font sizing like LineChart
  const [windowWidth, setWindowWidth] = React.useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
  React.useEffect(() => {
    const onResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const tooltipFont = windowWidth < 640 ? '0.55rem' : '0.75rem';
  const margin = windowWidth < 640 ? { top: 10, right: 5, left: -30, bottom: 5 } : { top: 10, right: 10, left: -20, bottom: 10 };

  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index, name, value }) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    const fontSize = windowWidth < 640 ? 10 : 14;
    return (
      <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={fontSize} fontWeight={600}>
        {value}
      </text>
    );
  };

  const handleCategoryToggle = (key) => {
    setIncludedCategories(prev =>
      prev.includes(key)
        ? prev.filter(cat => cat !== key)
        : [...prev, key]
    );
  };

  const allSelected = includedCategories.length === chartCategories.length;
  const handleAllToggle = () => {
    setIncludedCategories(allSelected ? [] : chartCategories.map(c => c.key));
  };

  // Filter data and categories for selected
  const filteredData = data.filter(d => includedCategories.includes(d.key));
  const filteredCategories = chartCategories.filter(c => includedCategories.includes(c.key));

  // Compute donut radii based on the available height; make the hole more pronounced
  const outerRadius = Math.min(80, Math.max(40, Math.floor(height / 2) - 10));
  const innerRadius = Math.floor(outerRadius * 0.7);

  const totalValue = filteredData.reduce((s, d) => s + (d.value || 0), 0);

  return (
    <div className="chart-card">
        {/* date picker here  */}




      {/* Category Toggles */}
      {/* <div className="chart-controls" style={{ maxHeight: 100 }}>
        <span className="font-semibold mb-2 block">Categories:</span>
        <label className="flex items-center gap-1 cursor-pointer">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={handleAllToggle}
            className="accent-sky-500"
            aria-label="Toggle all categories"
          />
          <span className="font-semibold">All</span>
        </label>
        {chartCategories.map((cat, idx) => (
          <label key={String(cat.key) + '-' + idx} className="chart-checkbox">
            <input
              type="checkbox"
              checked={includedCategories.includes(cat.key)}
              onChange={() => handleCategoryToggle(cat.key)}
              aria-label={`Toggle ${cat.label}`}
            />
            <span style={{ color: cat.color }}>{cat.label}</span>
          </label>
        ))}
      </div> */}

      <h2 className="chart-title">{title}</h2>
      <div className="chart-container" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <div style={{ display: "flex", alignItems: "center", height: "100%" }}>
              <div style={{ flex: "0 0 48%", height: "100%", display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {/* fixed-size centered donut to keep visual alignment with legend */}
                {
                  (() => {
                    const maxSize = Math.min(outerRadius * 2 + 40, height - 24, windowWidth < 640 ? 160 : 220);
                    const size = Math.max(80, Math.floor(maxSize));
                    return (
                      <div style={{ width: size, height: size }}>
                        <RePieChart width={size} height={size} margin={margin}>
                          <RePie
                            data={filteredData}
                            dataKey="value"
                            nameKey="name"
                            cx={size / 2}
                            cy={size / 2}
                            outerRadius={Math.floor(size / 2 - 8)}
                            innerRadius={Math.floor((size / 2 - 8) * 0.6)}
                            label={renderCustomizedLabel}
                            paddingAngle={2}
                            labelLine={false}
                          >
                            {filteredCategories.map((cat, idx) => (
                              <Cell key={`cell-${String(cat.key)}-${idx}`} fill={cat.color} />
                            ))}
                          </RePie>
                          <Tooltip wrapperStyle={{ fontSize: tooltipFont }} />
                        </RePieChart>
                      </div>
                    );
                  })()
                }
              </div>
            <div style={{ flex: "1 1 42%", paddingLeft: 12 }} className="donut-legend">
              {filteredData.map((d, idx) => {
                const color = (filteredCategories.find(c => c.key === d.key) || {}).color || getColor(idx);
                const pct = totalValue ? Math.round((d.value / totalValue) * 100) : 0;
                return (
                  <div className="donut-legend-item" key={String(d.key)}>
                    <div className="legend-label">
                      <span className="legend-swatch" style={{ background: color }} />
                      <span className="legend-name">{d.name}</span>
                    </div>
                    <div className="legend-value">{pct}%</div>
                  </div>
                );
              })}
            </div>
          </div>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default PieChartCard;