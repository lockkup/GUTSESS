import React from "react";
import "./TotalsGridSection.css";

const cards = [
  { id: 1, count: "1,200,000", unit: "", label: "ภาค", cls: "card-blue" },
  { id: 2, count: "120,000", unit: "คน", label: "ลา", cls: "card-teal" },
  {
    id: 3,
    count: "1,200,000",
    unit: "คน",
    label: "กำลังพล",
    cls: "card-green",
  },
  {
    id: 4,
    count: "1,200,000",
    unit: "คน",
    label: "เครื่องแต่งกาย",
    cls: "card-orange",
  },
  {
    id: 5,
    count: "1,200,000",
    unit: "คน",
    label: "ผิดข้อปฏิบัติ",
    cls: "card-red",
  },
];

export default function TotalsGrid() {
  return (
    <div className="mo-totals">
      <div className="totals-grid">
        {cards.map((c) => (
          <div
            key={c.id}
            className={`totals-card ${c.cls}`}
            role="group"
            aria-label={c.label}
          >
            <div className="totals-count-row">
              <span className="totals-count">{c.count}</span>
              {c.unit && <span className="totals-unit">{c.unit}</span>}
            </div>
            <div className="totals-label">{c.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
