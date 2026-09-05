// src/components/SpendBreakdown.jsx
import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const COLORS = ["#22c55e", "#38bdf8", "#f97316", "#a855f7", "#e5e7eb"];

const SpendBreakdown = ({ data }) => {
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">Category breakdown</div>
          <div style={{ fontSize: 12, color: "var(--text-soft)" }}>
            Where your money actually goes
          </div>
        </div>
      </div>
      <div style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={55}
              outerRadius={80}
              paddingAngle={2}
            >
              {data.map((entry, idx) => (
                <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--tooltip-bg, #111827)",
                color: "var(--tooltip-color, #f3f4f6)",
                borderRadius: 10,
                border: "1px solid var(--border-subtle, #374151)",
                fontSize: 13,
                padding: "10px 14px",
                boxShadow: "0 8px 20px rgba(0,0,0,0.35)",
                fontWeight: 500,
              }}
              itemStyle={{
                color: "var(--tooltip-color, #f3f4f6)",
                fontSize: 13,
              }}
              labelStyle={{
                color: "var(--tooltip-label, #9ca3af)",
                fontSize: 11,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
              formatter={(v, name, props) => [
                <span style={{ fontWeight: 700, color: "var(--tooltip-accent, #22c55e)" }}>
                  ₹{v.toLocaleString("en-IN")}
                </span>,
                <span style={{ color: "var(--tooltip-color, #f3f4f6)" }}>
                  {props.payload.name}
                </span>,
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, fontSize: 11 }}>
        {data.map((d, idx) => (
          <span
            key={d.name}
            className="badge"
            style={{ borderColor: COLORS[idx % COLORS.length], color: "inherit" }}
          >
            {d.name}: {d.percent}%
          </span>
        ))}
      </div>
    </div>
  );
};

export default SpendBreakdown;
