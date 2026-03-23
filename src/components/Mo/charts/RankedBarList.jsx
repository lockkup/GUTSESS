import React, { useState } from "react";
import "./RankedBarList.css";

/**
 * RankedBarList
 * Props:
 *   data       – array of row objects. Each row must have a `group` field.
 *                If `categories` is provided, rows must have numeric fields matching each category key.
 *                If not, rows must have a `value` field (simple mode).
 *   categories – optional [{ key, label, color }]. When provided, each bar is segmented by category.
 *   title      – string
 */
const RankedBarList = ({
  data = [],
  categories = null,
  subCategories = null,
  title = "",
  onGroupSelect = null,
  onCatSelect = null,
}) => {
  // Compute total per row
  const getTotal = (item) => {
    if (categories) {
      return categories.reduce((s, c) => s + (item[c.key] || 0), 0);
    }
    return item.value || 0;
  };

  const maxTotal = Math.max(...data.map(getTotal), 1);

  // Build legend from categories
  const legend = categories || [];

  const [expandedGroup, setExpandedGroup] = useState(null);
  const [expandedCat, setExpandedCat] = useState(null);
  const handleRowClick = (group) => {
    setExpandedGroup(group);
    setExpandedCat(null);
    onGroupSelect?.(group);
  };
  const handleBack = () => {
    setExpandedGroup(null);
    setExpandedCat(null);
    onGroupSelect?.(null);
    onCatSelect?.(null);
  };

  const currentTitle = expandedGroup ?? title;

  return (
    <div className="rl-card">
      <div className="rl-header-row">
        <div style={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {expandedGroup && (
            <button className="rl-back-btn" onClick={handleBack} aria-label="Back">
              ›
            </button>
          )}
          {title && <h2 className="rl-title">{currentTitle}</h2>}
        </div>
        {legend.length > 0 && (
          <div className="rl-kebab-wrap">
            <button className="rl-kebab" aria-label="Show legend">
              <span /><span /><span />
            </button>
            <div className="rl-legend-popup">
              {legend.map((c) => (
                <span key={c.key} className="rl-legend-item">
                  <span className="rl-legend-dot" style={{ background: c.color }} />
                  {c.label}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="rl-list">
        {/* Normal list view */}
        {!expandedGroup && data.map((item, idx) => {
          const total = getTotal(item);
          const trackPct = Math.round((total / maxTotal) * 100);
          const isTop = idx === 0;
          return (
            <div key={item.group} className={`rl-row${isTop ? " rl-row--top" : ""}`}>
              <div
                className="rl-label-row"
                onClick={() => handleRowClick(item.group)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && handleRowClick(item.group)}
              >
                <span className="rl-name">{item.group}</span>
                <span className="rl-value">{total.toLocaleString()}</span>
              </div>
              <div className="rl-track" style={{ width: `${trackPct}%` }}>
                {categories ? (
                  categories.map((c) => {
                    const segPct = total > 0 ? (item[c.key] || 0) / total * 100 : 0;
                    return segPct > 0 ? (
                      <div
                        key={c.key}
                        className="rl-bar"
                        style={{ width: `${segPct}%`, background: c.color }}
                        title={`${c.label}: ${(item[c.key] || 0).toLocaleString()}`}
                      />
                    ) : null;
                  })
                ) : (
                  <div className="rl-bar" style={{ width: "100%", background: isTop ? "#8b1a1a" : "#d0d5dd" }} />
                )}
              </div>
            </div>
          );
        })}

        {/* Detail view: category list with inline sub-categories */}
        {expandedGroup && categories && (() => {
          const item = data.find((d) => d.group === expandedGroup);
          if (!item) return null;
          const total = getTotal(item);
          const maxVal = Math.max(...categories.map((c) => item[c.key] || 0), 1);
          return categories.map((c) => {
            const val = item[c.key] || 0;
            const trackPct = Math.round((val / maxVal) * 100);
            const hasSubs = subCategories?.[c.key]?.length > 0;
            const isExpanded = expandedCat === c.key;
            const subs = hasSubs ? subCategories[c.key] : [];
            return (
              <div key={c.key} className="rl-row">
                <div
                  className="rl-label-row"
                  style={{ cursor: hasSubs ? 'pointer' : 'default' }}
                  onClick={hasSubs ? () => { setExpandedCat(c.key); onCatSelect?.(c.key); } : undefined}
                  role={hasSubs ? 'button' : undefined}
                  tabIndex={hasSubs ? 0 : undefined}
                  onKeyDown={hasSubs ? (e) => { if (e.key === 'Enter') { setExpandedCat(c.key); onCatSelect?.(c.key); } } : undefined}
                >
                  <span className="rl-name" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="rl-legend-dot" style={{ background: c.color }} />
                    {c.label}
                  </span>
                  <span className="rl-value">{val.toLocaleString()}</span>
                </div>
                <div className="rl-track" style={{ width: `${trackPct}%` }}>
                  {hasSubs ? subs.map((sc) => {
                    const sv = item[sc.key] || 0;
                    const segPct = val > 0 ? (sv / val) * 100 : 0;
                    return segPct > 0 ? (
                      <div
                        key={sc.key}
                        className="rl-bar"
                        style={{ width: `${segPct}%`, background: sc.color }}
                        title={`${sc.label}: ${sv.toLocaleString()}`}
                      />
                    ) : null;
                  }) : (
                    <div className="rl-bar" style={{ width: '100%', background: c.color }} />
                  )}
                </div>
              </div>
            );
          });
        })()}
      </div>
    </div>
  );
};

export default RankedBarList;
