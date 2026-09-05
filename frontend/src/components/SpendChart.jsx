// src/components/SpendChart.jsx
//
// Spending Trend — single-series bar chart.
//
// DATA CONTRACT (from backend /api/dashboard-analytics):
//   spendSeries for 7d:        Array<{ day: "DD/MM", amount }>  — 7 daily entries
//   spendSeries for 30d:       Array<{ day: "DD/MM", amount }>  — 30 daily entries
//   spendSeries for 90d:       Array<{ month: "Mmm", amount }>  — monthly entries
//
// RENDERING STRATEGY:
//   7d  → daily bars (7 slots, one per calendar day)
//   30d → MONTHLY bars (aggregate the 30 daily backend entries into months here)
//   90d → monthly bars (backend already sends monthly buckets)
//
// The spec requires 30d to show monthly aggregation, not 30 individual daily bars.
// This keeps the X-axis readable (2–3 month labels vs 30 date labels) and avoids
// the label-alignment issues that plagued the daily 30d view.

import React, { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

// ─── Subtitle per range ───────────────────────────────────────────────────────
const rangeSubtitle = (range) => {
  if (range === "7d")  return "Last 7 days — daily expenses";
  if (range === "30d") return "Last 30 days — weekly breakdown";
  return "Last 90 days — monthly breakdown";
};

// ─── Month names ──────────────────────────────────────────────────────────────
const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ─── Aggregate daily spendSeries entries into WEEKLY buckets (30d view) ───────
// Input:  Array<{ day: "DD/MM", amount: number }>  (backend 30d daily entries,
//         chronological, exactly 30 entries for the rolling 30-day window)
// Output: Array<{ key: "W1".."W5", label: "Aug 4–10", amount: number }>
//
// Buckets are 7-day chunks starting from the first day in the series.
// The final bucket may be shorter than 7 days (e.g. "Sep 1–2" for a window
// ending on Sep 2). This correctly represents partial weeks at the window end.
//
// Label format:
//   Same-month week:        "Aug 4–10"
//   Cross-month week:       "Aug 25–Sep 1"   (shows both months)
//   Single-day bucket:      "Sep 2"
//
// The backend has already filtered transactions to the exact rolling window, so
// summing the weekly buckets always equals Total Spent for the window.
const aggregateDailyToWeekly = (dailySeries) => {
  if (!dailySeries || dailySeries.length === 0) return [];

  // Parse "DD/MM" into { day, month, amount } with year-rollover detection
  const currentYear = new Date().getFullYear();
  const nowMonth    = new Date().getMonth() + 1;

  // Detect starting year using first entry month
  const firstParts = dailySeries[0]?.day?.split("/");
  let   year = currentYear;
  if (firstParts && firstParts.length === 2) {
    const firstMonth = parseInt(firstParts[1], 10);
    if (firstMonth > nowMonth + 1) year = currentYear - 1;
  }

  let prevMonth = -1;
  const parsed = dailySeries.map((entry) => {
    if (!entry.day || typeof entry.day !== "string") return null;
    const parts = entry.day.split("/");
    if (parts.length !== 2) return null;
    const d = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (isNaN(d) || isNaN(m) || m < 1 || m > 12) return null;
    if (prevMonth > 0 && m < prevMonth) year++;
    prevMonth = m;
    return { d, m, year, amount: Number(entry.amount) || 0 };
  }).filter(Boolean);

  if (parsed.length === 0) return [];

  const CHUNK = 7;
  const weeks = [];

  for (let i = 0; i < parsed.length; i += CHUNK) {
    const chunk = parsed.slice(i, i + CHUNK);
    const first = chunk[0];
    const last  = chunk[chunk.length - 1];
    const total = chunk.reduce((s, e) => s + e.amount, 0);

    // Build a readable label
    const startMon = MON[first.m - 1];
    const endMon   = MON[last.m  - 1];
    let label;
    if (chunk.length === 1) {
      label = `${startMon} ${first.d}`;
    } else if (first.m === last.m) {
      label = `${startMon} ${first.d}–${last.d}`;
    } else {
      label = `${startMon} ${first.d}–${endMon} ${last.d}`;
    }

    weeks.push({
      key:    `W${weeks.length + 1}`,
      label,
      amount: Math.round(total * 100) / 100,   // avoid floating-point drift
    });
  }

  return weeks;
};

// ─── Tooltip label formatter ──────────────────────────────────────────────────
// "DD/MM" → "DD Mon"  (7d daily labels)
// "Mmm"   → "Mmm"    (monthly labels pass through unchanged)
const fmtAxisLabel = (key) => {
  if (!key || typeof key !== "string") return "";
  if (/^\d{2}\/\d{2}$/.test(key)) {
    const [dd, mm] = key.split("/");
    const idx = parseInt(mm, 10) - 1;
    if (idx >= 0 && idx < 12) return `${dd} ${MON[idx]}`;
  }
  // Monthly key or anything else — return as-is (safe fallback)
  return key;
};

// ─── Y-axis "nice" scale ──────────────────────────────────────────────────────
const niceScale = (dataMax) => {
  if (!dataMax || dataMax <= 0) return { niceMax: 100, ticks: [0, 25, 50, 75, 100] };
  const magnitude = Math.pow(10, Math.floor(Math.log10(dataMax)));
  let step;
  const ratio = dataMax / magnitude;
  if      (ratio <= 1) step = magnitude * 0.2;
  else if (ratio <= 2) step = magnitude * 0.5;
  else if (ratio <= 5) step = magnitude;
  else                 step = magnitude * 2;
  const niceMax = Math.ceil((dataMax * 1.05) / step) * step;
  const ticks = [];
  for (let t = 0; t <= niceMax + step * 0.01; t += step)
    ticks.push(Math.round(t * 100) / 100);
  return { niceMax, step, ticks };
};

// ─── Y-axis formatter ─────────────────────────────────────────────────────────
const fmtYAxis = (v) => {
  const n = Number(v);
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(1)}L`;
  if (n >= 1_000) {
    // Use Math.round to 1 decimal place — avoids toFixed(0) banker's rounding
    // which would map both 1500 and 2000 to "2k", producing duplicate labels.
    const k = Math.round((n / 1_000) * 10) / 10;
    return `₹${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}k`;
  }
  return `₹${Math.round(n)}`;
};

// ─── Normalise 90d monthly data from backend — with partial-month labels ──────
// Backend sends Array<{ month: "Mmm", amount }> for 90d.
// Add a unique `key` field and compute accurate partial-month labels for
// the first and last months in the rolling 90-day window.
//
// windowStart / windowEnd are Date objects for the exact rolling window so
// the first and last buckets can show "Jun 5–30" and "Sep 1–2" respectively.
//
// Year-boundary safe: sequential month rollover detection handles Dec→Jan.
const normalise90dMonthly = (monthlySeries, windowStart, windowEnd) => {
  if (!monthlySeries || monthlySeries.length === 0) return [];
  const monIdx = Object.fromEntries(MON.map((m, i) => [m, i]));
  const currentYear = new Date().getFullYear();
  const nowMonth    = new Date().getMonth() + 1;

  let year    = currentYear;
  let prevMon = -1;

  const firstMon = monIdx[monthlySeries[0]?.month];
  if (firstMon !== undefined && firstMon + 1 > nowMonth + 1) year = currentYear - 1;

  return monthlySeries.map((entry, idx) => {
    const mIdx = monIdx[entry.month];
    if (mIdx === undefined) return null;
    const month = mIdx + 1;
    if (prevMon > 0 && month < prevMon) year++;
    prevMon = month;
    const key = `${String(month).padStart(2, "0")}/${year}`;

    // Build a label that shows the exact date range for boundary months
    let label = entry.month; // default: "Jun", "Aug", etc.
    if (windowStart && windowEnd) {
      const isFirst = idx === 0;
      const isLast  = idx === monthlySeries.length - 1;
      // First month: may start mid-month (e.g. Jun 5)
      // Last month:  may end mid-month  (e.g. Sep 2)
      if (isFirst && isLast) {
        // Only one month in the window — show full date range
        label = `${entry.month} ${windowStart.getDate()}–${windowEnd.getDate()}`;
      } else if (isFirst && windowStart.getDate() > 1) {
        // Start is not the 1st — show "Jun 5–30"
        const lastDayOfMonth = new Date(year, month, 0).getDate(); // day 0 of next month = last day of this month
        label = `${entry.month} ${windowStart.getDate()}–${lastDayOfMonth}`;
      } else if (isLast && windowEnd.getDate() !== new Date(year, month, 0).getDate()) {
        // End is not the last day of the month — show "Sep 1–2"
        label = `${entry.month} 1–${windowEnd.getDate()}`;
      }
    }

    return { key, label, amount: Number(entry.amount) || 0 };
  }).filter(Boolean);
};

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
// `label` is the dataKey value: "DD/MM" for 7d, "MM/YYYY" for monthly views.
// For monthly views the actual display label is stored in the data as `label`.
const CustomBarTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  const amount      = Number(payload[0]?.value ?? 0);
  // Monthly views: use the `label` field from the data entry for display.
  // 7d daily view: format the "DD/MM" key.
  const entry       = payload[0]?.payload;
  const displayLabel = entry?.label
    ? entry.label                      // "Aug", "Sep" etc.
    : fmtAxisLabel(label);             // "27 Aug" from "27/08"
  return (
    <div style={{
      background: "var(--tooltip-bg, #1a1f2e)", borderRadius: 8,
      border: "1px solid var(--border-subtle, rgba(148,163,184,0.2))",
      padding: "8px 12px", fontSize: 12,
      boxShadow: "0 4px 16px rgba(0,0,0,0.4)", pointerEvents: "none", minWidth: 130,
    }}>
      <div style={{ fontWeight: 600, marginBottom: 4, color: "var(--text, #e2e8f0)" }}>
        {displayLabel || ""}
      </div>
      <div style={{ color: "#22c55e", fontWeight: 700 }}>
        ₹{amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </div>
    </div>
  );
};

// ─── Component ────────────────────────────────────────────────────────────────
const SpendChart = ({ data, range, globalYMax }) => {
  // ── Build chart dataset ───────────────────────────────────────────────────
  // Compute window boundaries from `range` using the same formula as Dashboard.jsx
  // getDateParams: from = startOfToday - (N-1) days, to = now.
  // These are passed to normalise90dMonthly so it can build accurate partial-month labels.
  const { chartData, xKey, isNonDaily } = useMemo(() => {
    const raw = data || [];
    if (range === "7d") {
      return { chartData: raw, xKey: "day", isNonDaily: false };
    }
    if (range === "30d") {
      return {
        chartData: aggregateDailyToWeekly(raw),
        xKey:      "key",
        isNonDaily: true,
      };
    }
    // 90d: compute exact window boundaries for partial-month label generation
    const now   = new Date();
    const sot   = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // midnight today
    const wStart = new Date(sot.getTime() - 89 * 24 * 60 * 60 * 1000);      // today - 89 days
    const wEnd   = now;
    return {
      chartData: normalise90dMonthly(raw, wStart, wEnd),
      xKey:      "key",
      isNonDaily: true,
    };
  }, [data, range]);

  const isEmpty = useMemo(
    () => chartData.every((d) => (d.amount || 0) === 0),
    [chartData]
  );

  // ── Y-axis ────────────────────────────────────────────────────────────────
  // When globalYMax is provided (computed from all three windows in Dashboard),
  // use it as the scale basis so the Y-axis is identical across 7d/30d/90d.
  // Fall back to the current window's max if globalYMax is not yet available.
  const { ticks: yTicks, niceMax } = useMemo(() => {
    const currentMax = Math.max(0, ...chartData.map((d) => d.amount || 0));
    // Use the global max if it's a valid positive number; otherwise fall back
    const scaleMax = (globalYMax && globalYMax > 0) ? globalYMax : currentMax;
    return niceScale(scaleMax);
  }, [chartData, globalYMax]);

  // ── Bar sizing ────────────────────────────────────────────────────────────
  // All three views use the same maxBarSize so bars look visually consistent.
  // Without a cap, monthly views (2–4 bars) would get very wide bars because
  // each category slot is much larger (640px / 4 = 160px vs 640px / 7 = 91px).
  // maxBarSize=32 keeps every bar at the same physical width regardless of
  // how many categories are displayed.
  // barCategoryGap="35%" controls spacing between bars.
  const maxBarSize  = 32;   // same for 7d, 30d, 90d
  const categoryGap = "35%";

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">Spending trend</div>
          <div style={{ fontSize: 12, color: "var(--text-soft)" }}>
            {rangeSubtitle(range)}
          </div>
        </div>
      </div>

      <div style={{ height: 220 }}>
        {isEmpty ? (
          <div style={{
            height: "100%", display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 8,
            padding: "0 24px", textAlign: "center",
          }}>
            <div style={{ fontSize: 28 }}>📊</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
              No expenses in this period
            </div>
            <div style={{ fontSize: 12, color: "var(--text-subtle)", lineHeight: 1.5 }}>
              Add an expense transaction to see your spending trend.
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 10, right: 16, left: 0, bottom: 24 }}
              barCategoryGap={categoryGap}
            >
              <defs>
                <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#22c55e" stopOpacity={0.85} />
                  <stop offset="100%" stopColor="#22c55e" stopOpacity={0.2}  />
                </linearGradient>
              </defs>

              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(148,163,184,0.12)"
                vertical={false}
              />

              {/*
                XAxis — category axis.
                For 7d: 7 daily slots, all labels shown, formatted "DD Mon".
                For 30d/90d: 2–4 monthly slots, all labels shown as "Mmm".
                interval={0} = show every tick.  With only 2–7 categories
                there is no risk of overlap.
                tickFormatter returns "" for invalid/null keys to prevent
                blank labels on the axis.
              */}
              <XAxis
                dataKey={xKey}
                tick={{ fontSize: 10, fill: "var(--text-subtle, #94a3b8)" }}
                tickFormatter={(keyVal) => {
                  if (!keyVal || typeof keyVal !== "string") return "";
                  // Non-daily views (weekly/monthly): look up entry.label in chartData
                  if (isNonDaily) {
                    const entry = chartData.find((d) => d.key === keyVal);
                    return entry?.label || "";
                  }
                  // 7d daily view: dataKey is "DD/MM" → format as "DD Mon"
                  return fmtAxisLabel(keyVal);
                }}
                axisLine={false}
                tickLine={false}
                interval={0}
                angle={0}
                textAnchor="middle"
                height={22}
              />

              <YAxis
                domain={[0, niceMax]}
                ticks={yTicks}
                tick={{ fontSize: 10, fill: "var(--text-subtle, #94a3b8)" }}
                tickFormatter={fmtYAxis}
                axisLine={false}
                tickLine={false}
                width={44}
              />

              <Tooltip
                content={<CustomBarTooltip />}
                cursor={{ fill: "rgba(148,163,184,0.07)" }}
              />

              <Bar
                dataKey="amount"
                fill="url(#spendGrad)"
                radius={[4, 4, 0, 0]}
                maxBarSize={maxBarSize}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

export default SpendChart;
