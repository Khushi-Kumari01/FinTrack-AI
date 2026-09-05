// src/components/CashflowChart.jsx
//
// Cashflow Timeline — grouped bar chart (inflow + outflow per time bucket).
//
// AGGREGATION:
//   7d  → 7 daily buckets    (shown directly)
//   30d → 30 daily buckets   (shown directly, bars narrower but readable)
//   90d → MONTHLY buckets    (aggregated from daily for readability)
//
// BAR SIZING — responsive, NO horizontal scrolling:
//   Uses ResponsiveContainer (width="100%") + barCategoryGap (%) + maxBarSize (px).
//   This guarantees the chart always fits inside the card without overflow.
//
//   barCategoryGap controls the gap percentage between category slots.
//   maxBarSize caps each individual bar so sparse windows (7d, 90d) don't produce
//   extremely fat bars.
//
//   7d  → 7 slots,  barCategoryGap=35%, maxBarSize=18 per bar
//   30d → 30 slots, barCategoryGap=15%, maxBarSize=10 per bar
//   90d → 4 slots,  barCategoryGap=35%, maxBarSize=28 per bar

import React, { useMemo } from "react";
import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// ─── Formatters ───────────────────────────────────────────────────────────────

const fmt = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return "₹0.00";
  const abs = Math.abs(n);
  const str = abs.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < 0 ? `-₹${str}` : `₹${str}`;
};

const fmtCompact = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return "₹0.00";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_00_000) return `${sign}₹${(abs / 1_00_000).toFixed(1)}L`;
  if (abs >= 1_000)    return `${sign}₹${(abs / 1_000).toFixed(1)}k`;
  return `${sign}₹${abs.toFixed(2)}`;
};

const fmtYAxis = (v) => {
  const abs = Math.abs(Number(v));
  if (abs >= 1_00_000) return `₹${(abs / 1_00_000).toFixed(1)}L`;
  if (abs >= 1_000)    return `₹${(abs / 1_000).toFixed(0)}k`;
  return `₹${abs}`;
};

// ─── Month helpers ────────────────────────────────────────────────────────────
const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const dayKeyToMonth = (dayKey) => {
  const parts = dayKey.split("/");
  if (parts.length !== 2) return null;
  const idx = parseInt(parts[1], 10) - 1;
  return (idx >= 0 && idx < 12) ? { month: MONTH_NAMES[idx], monthIndex: idx } : null;
};

const fmtAxisLabel = (key) => {
  if (!key || typeof key !== "string") return key;
  if (/^\d{2}\/\d{2}$/.test(key)) {
    const [dd, mm] = key.split("/");
    const idx = parseInt(mm, 10) - 1;
    if (idx >= 0 && idx < 12) return `${dd} ${MONTH_NAMES[idx]}`;
  }
  return key;
};

// 90d: aggregate daily cashflowSeries → monthly buckets.
// Uses sequential month-rollover detection so Dec→Jan year boundaries work.
// Insertion order of the Map preserves chronological sequence.
const aggregateToMonthly = (dailySeries) => {
  const map = new Map();
  let prevMonthIdx = -1;
  let year = new Date().getFullYear();

  // Detect if the window started in the previous year
  if (dailySeries.length > 0) {
    const firstInfo = dayKeyToMonth(dailySeries[0].day);
    if (firstInfo && firstInfo.monthIndex > new Date().getMonth() + 1) {
      year = new Date().getFullYear() - 1;
    }
  }

  for (const pt of dailySeries) {
    const info = dayKeyToMonth(pt.day);
    if (!info) continue;
    const { month, monthIndex } = info;
    // Detect year rollover (e.g. Dec→Jan)
    if (prevMonthIdx >= 0 && monthIndex < prevMonthIdx) year++;
    prevMonthIdx = monthIndex;

    // Use "Mmm-YYYY" as map key for year-safety; display label is just "Mmm"
    const mapKey = `${month}-${year}`;
    if (!map.has(mapKey)) map.set(mapKey, { month, inflow: 0, outflow: 0 });
    const b = map.get(mapKey);
    b.inflow  += Number(pt.inflow)  || 0;
    b.outflow += Number(pt.outflow) || 0;
  }
  return Array.from(map.values());
};

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  const inflow  = payload.find((p) => p.dataKey === "inflow")?.value  ?? 0;
  const outflow = payload.find((p) => p.dataKey === "outflow")?.value ?? 0;
  const net     = inflow - outflow;
  return (
    <div
      style={{
        background: "var(--tooltip-bg, #1a1f2e)",
        borderRadius: 10,
        border: "1px solid var(--border-subtle, rgba(148,163,184,0.2))",
        padding: "10px 14px",
        fontSize: 12,
        boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
        minWidth: 178,
        pointerEvents: "none",
      }}
    >
      <div style={{ fontWeight: 700, color: "var(--tooltip-color, #e2e8f0)", marginBottom: 8,
        fontSize: 13, borderBottom: "1px solid var(--border-subtle, rgba(148,163,184,0.15))", paddingBottom: 5 }}>
        {fmtAxisLabel(label)}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ color: "var(--tooltip-label, #94a3b8)" }}>Inflow</span>
        <span style={{ color: "#22c55e", fontWeight: 600 }}>{fmt(inflow)}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ color: "var(--tooltip-label, #94a3b8)" }}>Outflow</span>
        <span style={{ color: "#f97373", fontWeight: 600 }}>{fmt(outflow)}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 5,
        borderTop: "1px solid var(--border-subtle, rgba(148,163,184,0.15))", marginTop: 2 }}>
        <span style={{ color: "var(--tooltip-label, #94a3b8)", fontWeight: 600 }}>Net</span>
        <span style={{ fontWeight: 700, color: net >= 0 ? "#22c55e" : "#f97373" }}>{fmt(net)}</span>
      </div>
    </div>
  );
};

// ─── Metric Pill ──────────────────────────────────────────────────────────────
const MetricPill = ({ label, value, color }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
    <span style={{ fontSize: 9, color: "var(--text-subtle, #64748b)", textTransform: "uppercase",
      letterSpacing: "0.06em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
      {label}
    </span>
    <span style={{ fontSize: 13, fontWeight: 700, color: color || "var(--text, #e2e8f0)",
      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
      {value}
    </span>
  </div>
);

// ─── Consistent bar sizing across all windows ───────────────────────────────
// The spec requires 7d, 30d, and 90d bars to have the same physical width.
// Solution: use `barSize` (absolute pixels on <Bar>) — this forces a fixed
// pixel width regardless of how many category slots exist.
//
// With barSize=5px:
//   7d  (7 slots,  slotW≈39px): 2 bars × 5px + 2px gap = 12px in a 39px slot → 27px gap
//   30d (30 slots, slotW≈9px):  2 bars × 5px + 1px gap = 11px in a 9px slot → bars fill slot
//   90d (4 slots,  slotW≈69px): 2 bars × 5px + 3px gap = 13px in a 69px slot → 56px gap
//
// 5px is the maximum that fits cleanly in 30d slots (slotW≈9px, 2 bars + gap).
// All three windows render bars at exactly 5px — visually identical thickness.
//
// tickEvery: X-axis label reduction for readability.
const BAR_SIZE = 5;   // px — single shared value for all windows
const RANGE_CONFIG = {
  "7d":  { barCategoryGap: "35%", tickEvery: 1, barGap: 2 },
  "30d": { barCategoryGap: "0%",  tickEvery: 5, barGap: 1 },
  "90d": { barCategoryGap: "35%", tickEvery: 1, barGap: 3 },
};

// ─── Main Component ───────────────────────────────────────────────────────────
const CashflowChart = ({ data, windowDays, globalMax }) => {
  const wDays    = (windowDays && windowDays > 0) ? windowDays : (data?.length || 30);
  const is90d    = wDays > 35;
  const rangeKey = is90d ? "90d" : (wDays <= 10 ? "7d" : "30d");
  const cfg      = RANGE_CONFIG[rangeKey];

  // ── Chart data ────────────────────────────────────────────────────────────
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    if (is90d) return aggregateToMonthly(data);
    return data;
  }, [data, is90d]);

  const xDataKey     = is90d ? "month" : "day";
  // X-axis: show every tick for 7d/90d; thin out for 30d
  const tickInterval = cfg.tickEvery - 1;

  // ── Y-axis: per-window dynamic domain ────────────────────────────────
  // Scales to the actual max inflow/outflow in the currently displayed window.
  // 7d: max≈₹700  → [0, ₹800]
  // 30d: max≈₹25k → [0, ₹30k]
  // 90d: max≈₹25k → [0, ₹30k]
  // Uses original daily `data` (not chart-aggregated data) so the domain
  // is always computed from the raw daily values regardless of aggregation.
  const yDomain = useMemo(() => {
    const vals = (data || []).flatMap((d) => [Number(d.inflow) || 0, Number(d.outflow) || 0]);
    const dataMax = Math.max(0, ...vals);
    if (dataMax <= 0) return [0, 100];
    const magnitude = Math.pow(10, Math.floor(Math.log10(dataMax)));
    const ratio = dataMax / magnitude;
    let step;
    if      (ratio <= 1) step = magnitude * 0.2;
    else if (ratio <= 2) step = magnitude * 0.5;
    else if (ratio <= 5) step = magnitude;
    else                 step = magnitude * 2;
    const niceMax = Math.ceil((dataMax * 1.08) / step) * step;
    return [0, niceMax];
  }, [data]);

  // ── Financial metrics (always from ORIGINAL daily data) ──────────────────
  const metrics = useMemo(() => {
    if (!data || data.length === 0) {
      return { totalIncome: 0, totalExpenses: 0, netCashflow: 0,
        hasPositiveNet: false, highestNetFlowDay: null, highestNetFlowAmt: 0,
        highestOutflowDay: null, highestOutflowAmt: 0, avgDailyExpense: 0 };
    }
    let totalIncome = 0, totalExpenses = 0, maxNet = -Infinity;
    let maxNetDay = null, maxOutflow = 0, maxOutflowDay = null;
    for (const pt of data) {
      const inflow  = Number(pt.inflow)  || 0;
      const outflow = Number(pt.outflow) || 0;
      totalIncome   += inflow;
      totalExpenses += outflow;
      const dayNet   = inflow - outflow;
      if (dayNet > maxNet)      { maxNet = dayNet; maxNetDay = pt.day; }
      if (outflow > maxOutflow) { maxOutflow = outflow; maxOutflowDay = pt.day; }
    }
    const actualMaxNet   = maxNet === -Infinity ? 0 : maxNet;
    const hasPositiveNet = actualMaxNet > 0;
    return {
      totalIncome, totalExpenses,
      netCashflow:       totalIncome - totalExpenses,
      hasPositiveNet,
      highestNetFlowDay:  maxNetDay,
      highestNetFlowAmt:  actualMaxNet,
      highestOutflowDay:  maxOutflowDay,
      highestOutflowAmt:  maxOutflow,
      avgDailyExpense:    totalExpenses / wDays,
    };
  }, [data, wDays]);

  const hasIncome = metrics.totalIncome   > 0;
  const hasData   = metrics.totalIncome   > 0 || metrics.totalExpenses > 0;

  const hnfDay   = metrics.highestNetFlowDay ? fmtAxisLabel(metrics.highestNetFlowDay) : null;
  const hnfValue = hnfDay ? `${hnfDay} · ${fmtCompact(metrics.highestNetFlowAmt)}` : "—";
  const hnfColor = metrics.highestNetFlowAmt > 0 ? "#22c55e"
    : metrics.highestNetFlowAmt < 0 ? "#f97373" : "var(--text-subtle)";

  const hoDay   = metrics.highestOutflowDay ? fmtAxisLabel(metrics.highestOutflowDay) : null;
  const hoValue = hoDay ? `${hoDay} · ${fmtCompact(metrics.highestOutflowAmt)}` : "—";

  return (
    <div className="card cashflow-card" style={{ paddingBottom: 12 }}>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="card-header" style={{ marginBottom: 4 }}>
        <div>
          <div className="card-title">Cashflow timeline</div>
          <div style={{ fontSize: 12, color: "var(--text-soft)" }}>
            {is90d ? "Monthly inflow vs outflow — selected window"
                   : "Daily inflow vs outflow — selected window"}
          </div>
        </div>
      </div>

      {/* ── Chart — responsive, NO horizontal scroll ──────────────────────── */}
      <div className="cf-chart-wrap">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 4, right: 12, left: -4, bottom: 0 }}
            barCategoryGap={cfg.barCategoryGap}
            barGap={cfg.barGap}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(148,163,184,0.12)"
              vertical={false}
            />

            <XAxis
              dataKey={xDataKey}
              tick={{ fontSize: 9, fill: "var(--text-subtle, #94a3b8)" }}
              tickFormatter={fmtAxisLabel}
              axisLine={false}
              tickLine={false}
              interval={tickInterval}
              preserveStartEnd={true}
              angle={0}
              textAnchor="middle"
              height={18}
            />

            <YAxis
              domain={yDomain}
              tick={{ fontSize: 9, fill: "var(--text-subtle, #94a3b8)" }}
              tickFormatter={fmtYAxis}
              axisLine={false}
              tickLine={false}
              width={38}
            />

            <Tooltip
              content={<CustomTooltip />}
              cursor={{ fill: "rgba(148,163,184,0.06)" }}
            />

            <Legend
              verticalAlign="top"
              align="right"
              height={22}
              iconType="circle"
              iconSize={7}
              wrapperStyle={{ paddingBottom: 2 }}
              formatter={(value) => (
                <span style={{ color: "var(--text-subtle, #94a3b8)", fontSize: 10 }}>{value}</span>
              )}
            />

            <Bar
              dataKey="inflow"
              name="Inflow"
              fill="#22c55e"
              radius={[3,3,0,0]}
              barSize={BAR_SIZE}
              isAnimationActive={false}
            />
            <Bar
              dataKey="outflow"
              name="Outflow"
              fill="#f97373"
              radius={[3,3,0,0]}
              barSize={BAR_SIZE}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── No-income notice ─────────────────────────────────────────────── */}
      {!hasIncome && hasData && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
          gap: 6, marginTop: 6, marginBottom: 2 }}>
          <span style={{ fontSize: 10, padding: "2px 10px", borderRadius: 999,
            background: "rgba(249,115,22,0.12)", color: "#fb923c",
            border: "1px solid rgba(249,115,22,0.25)", fontWeight: 600 }}>
            📉 No income recorded in this period — showing expenses only
          </span>
        </div>
      )}

      {/* ── Empty state ──────────────────────────────────────────────────── */}
      {!hasData && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", gap: 6, padding: "12px 0 4px", textAlign: "center" }}>
          <div style={{ fontSize: 24 }}>💳</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>No cashflow in this period</div>
          <div style={{ fontSize: 12, color: "var(--text-subtle)" }}>
            Add income or expense transactions to see your timeline.
          </div>
        </div>
      )}

      {/* ── Summary metrics strip ─────────────────────────────────────────── */}
      {hasData && (
        <div style={{
          display: "grid",
          gridTemplateColumns: hasIncome ? "1fr 1fr 1fr 1fr 1fr" : "1fr 1fr 1fr 1fr",
          gap: 6, padding: "8px 2px 0",
          borderTop: "1px solid var(--border-subtle)", marginTop: 8,
        }}>
          {hasIncome && (
            <MetricPill label="Income" value={fmtCompact(metrics.totalIncome)} color="#22c55e" />
          )}

          <MetricPill
            label={hasIncome ? "Expenses" : "Total Spent"}
            value={fmtCompact(metrics.totalExpenses)}
            color="#f97373"
          />

          <MetricPill
            label={hasIncome ? "Net Flow" : "Net Spend"}
            value={fmtCompact(metrics.netCashflow)}
            color={metrics.netCashflow >= 0 ? (hasIncome ? "#22c55e" : "var(--text-soft)") : "#f97373"}
          />

          {hasIncome ? (
            <MetricPill label="Highest Net Flow" value={hnfValue} color={hnfColor} />
          ) : (
            <MetricPill label="Highest Outflow"  value={hoValue}  color="#f97373" />
          )}

          <MetricPill
            label="Avg Daily Expense"
            value={fmtCompact(metrics.avgDailyExpense)}
            color="var(--text-soft)"
          />
        </div>
      )}
    </div>
  );
};

export default CashflowChart;
