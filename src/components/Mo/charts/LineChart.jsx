import React, { useState, useMemo } from "react";
import { LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import "./LineChart.css";

// Generate a distinct color for each index using HSL
function getColor(idx) {
  const hue = (idx * 47) % 360;
  return `hsl(${hue}, 70%, 50%)`;
}

const LineChart = ({ chartData, chartCategories }) => {
  // using CSS variables in charts.css instead of theme hook

  const [windowWidth, setWindowWidth] = React.useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
  React.useEffect(() => {
    const onResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // responsive sizes: smaller for narrow screens
  const getSizes = () => {
    // small screens get smaller markers; medium and larger share the same (medium) sizes
    if (windowWidth < 640) return { dot: 1, activeDot: 2, strokeWidth: 0.9 };
    return { dot: 2, activeDot: 3, strokeWidth: 1.2 };
  };
  const sizes = getSizes();
  const tickSize = windowWidth < 640 ? 8 : 11;
  const legendFont = windowWidth < 640 ? 10 : 12;
  const tooltipFont = windowWidth < 640 ? '0.55rem' : '0.75rem';

  const categories = useMemo(() => {
    if (chartCategories && chartCategories.length > 0) {
      return chartCategories.map((key, idx) => ({
        key,
        label: key.charAt(0).toUpperCase() + key.slice(1),
        color: getColor(idx),
      }));
    }
    if (!chartData || chartData.length === 0) return [];
    return Object.keys(chartData[0])
      .filter(key => key !== "group" && typeof chartData[0][key] === "number")
      .map((key, idx) => ({
        key,
        label: key.charAt(0).toUpperCase() + key.slice(1),
        color: getColor(idx),
      }));
  }, [chartCategories, chartData]);

  const [includedCategories, setIncludedCategories] = useState(categories.map(c => c.key));

  React.useEffect(() => {
    setIncludedCategories(categories.map(c => c.key));
  }, [categories]);

  const handleCategoryToggle = (key) => {
    setIncludedCategories((prev) =>
      prev.includes(key)
        ? prev.filter((cat) => cat !== key)
        : [...prev, key]
    );
  };

  return (
    <div className="chart-card">
      {/* Category Options */}
      {/* <div className="chart-controls">
        <span className="font-semibold">Categories:</span>
        {categories.map((cat) => (
          <label key={cat.key} className="chart-checkbox">
            <input
              type="checkbox"
              checked={includedCategories.includes(cat.key)}
              onChange={() => handleCategoryToggle(cat.key)}
            />
            <span style={{ color: cat.color }}>{cat.label}</span>
          </label>
        ))}
      </div> */}

      <div className="chart-mobile">
        {/* Mobile chart: smaller axis text */}
        <ResponsiveContainer width="100%" height={192}>
          <RechartsLineChart
            data={chartData}
            margin={{ top: 10, right: 5, left: -35, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="2 2" />
            <XAxis
              dataKey="group"
              stroke="#8884d8"
              tick={{ fontSize: tickSize, fill: "#8884d8" }}
            />
            <YAxis
              stroke="#8884d8"
              tick={{ fontSize: tickSize, fill: "#8884d8" }}
            />
            <Tooltip wrapperStyle={{ fontSize: tooltipFont }} />
            <Legend wrapperStyle={{ fontSize: legendFont }} />
            {categories.map(
              (cat) =>
                includedCategories.includes(cat.key) && (
                  <Line
                    key={cat.key}
                    type="monotone"
                    dataKey={cat.key}
                    stroke={cat.color}
                    strokeWidth={sizes.strokeWidth}
                    dot={{ r: sizes.dot }}
                    activeDot={{ r: sizes.activeDot }}
                    name={cat.label}
                  />
                )
            )}
          </RechartsLineChart>
        </ResponsiveContainer>
      </div>
      <div className="chart-desktop">
        {/* Desktop/tablet chart: larger axis text */}
        <ResponsiveContainer width="100%" height={256}>
          <RechartsLineChart
            data={chartData}
            margin={{ top: 10, right: 10, left: -20, bottom: 10 }}
          >
            <CartesianGrid strokeDasharray="2 2" />
            <XAxis
              dataKey="group"
              stroke="#8884d8"
              tick={{ fontSize: tickSize, fill: "#8884d8" }}
            />
            <YAxis
              stroke="#8884d8"
              tick={{ fontSize: tickSize, fill: "#8884d8" }}
            />
            {/* <Tooltip wrapperStyle={{ fontSize: tooltipFont }} /> */}
            <Legend wrapperStyle={{ fontSize: legendFont }} />
            {categories.map(
              (cat) =>
                includedCategories.includes(cat.key) && (
                  <Line
                    key={cat.key}
                    type="monotone"
                    dataKey={cat.key}
                    stroke={cat.color}
                    strokeWidth={sizes.strokeWidth}
                    dot={{ r: sizes.dot }}
                    activeDot={{ r: sizes.activeDot }}
                    name={cat.label}
                  />
                )
            )}
          </RechartsLineChart>
        </ResponsiveContainer>
      </div>

    </div>
  );
};

export default LineChart;