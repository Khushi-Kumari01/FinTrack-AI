// src/components/ForecastCard.jsx
import React, { useMemo } from "react";

const fmtINR = (v) => `₹${Number(v || 0).toLocaleString("en-IN")}`;

const fmtCompact = (v) => {
  const abs = Math.abs(Number(v || 0));
  if (abs >= 1_00_000) return `₹${(abs / 1_00_000).toFixed(1)}L`;
  if (abs >= 1_000) return `₹${(abs / 1_000).toFixed(1)}k`;
  return `₹${abs.toLocaleString("en-IN")}`;
};

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Build a 7-day projection from the forecast total and any available spend series.
function buildSevenDay(forecast, spendSeries) {
  const expectedTotal = Number(forecast.expected || 0);

  // If we have real historical spend series, weight recent days to shape the chart.
  const historical = Array.isArray(spendSeries) ? spendSeries : [];
  const weights = [0.12, 0.13, 0.14, 0.15, 0.16, 0.15, 0.15];

  // Derive a gentle per-category weighting from the last known day of data, else even.
  let series = historical.map((d) => Number(d.amount || d.value || 0)).filter((n) => n >= 0);
  if (!series.length && historical.length) {
    series = historical.map((d) => Number(d.amount || d.value || 0) || 0);
  }

  const last7 = series.slice(-7).filter((n) => Number.isFinite(n));
  const recentAvg = last7.length
    ? last7.reduce((a, b) => a + b, 0) / last7.length
    : expectedTotal / 7;

  return DAY_LABELS.map((label, i) => {
    // Blend real tail with a smooth daily share of the expected month.
    const share = expectedTotal * weights[i];
    const anchor = last7[i] !== undefined ? last7[i] : recentAvg;
    // Bias the projection slightly toward the more recent real observations.
    const projected = anchor * (0.45 + 0.08 * i) + share * 0.55;
    return {
      label,
      amount: projected > 0 ? Math.round(projected) : Math.round(expectedTotal / 7),
    };
  });
}

const ForecastCard = ({ forecast, categoryBreakdown = [], spendSeries = [], completedMonthsUsed }) => {
// For a *spending* forecast, an increase (positive delta) is unfavorable (red),
  // while a decrease (negative delta) is favorable (green). The sign still reflects
  // the actual direction of the change.
  const increasing = Number(forecast.delta) > 0;
  const deltaColor = increasing ? "#f97373" : "#22c55e";
  const sign = Number(forecast.delta) < 0 ? "-" : "+";
  const absDelta = Math.abs(forecast.delta ?? 0);

// Confidence is NOT a statistically computed value here — it would be misleading to show a
  // made-up percentage. Instead we surface a transparent "data basis" so the user knows how
  // many real complete months (or data points) the projection rests on. We only show a
  // confidence-style badge when we actually have enough history to call it meaningful.
  const dataBasis = useMemo(() => {
    const cats = Array.isArray(categoryBreakdown) ? categoryBreakdown : [];
    const activeCats = cats.filter((c) => Number(c.value || 0) > 0).length;

    if (Number(forecast.expected) <= 0) return "No complete month history yet";

    // completedMonthsUsed comes from the backend (candidates.length in getDashboardAnalytics).
    // This is the exact number of complete calendar months whose data was averaged for the forecast.
    // A value of -1 means the prop was not supplied (older API response).
    const monthsUsed = typeof completedMonthsUsed === "number" && completedMonthsUsed >= 0
      ? completedMonthsUsed
      : null;

    if (monthsUsed === 0) return "No complete month history yet — current month is partial";
    if (monthsUsed === null) {
      // Fallback: count active months from spendSeries (all-time), note it may include partials
      const series = Array.isArray(spendSeries) ? spendSeries : [];
      const activeMonths = series.filter((d) => Number(d.amount || d.value || 0) > 0).length;
      const monthLabel = activeMonths > 0
        ? `${activeMonths} month${activeMonths > 1 ? "s" : ""} of data`
        : "Limited data";
      const catLabel = activeCats > 0 ? ` · ${activeCats} ${activeCats === 1 ? "category" : "categories"}` : "";
      return `${monthLabel}${catLabel} · complete months only`;
    }

    const monthLabel = `${monthsUsed} complete month${monthsUsed !== 1 ? "s" : ""} used`;
    const catLabel = activeCats > 0 ? ` · ${activeCats} ${activeCats === 1 ? "category" : "categories"}` : "";
    return `${monthLabel}${catLabel}`;
  }, [forecast, categoryBreakdown, spendSeries, completedMonthsUsed]);

  const week = useMemo(
    () => buildSevenDay(forecast, spendSeries),
    [forecast, spendSeries]
  );

  const maxDay = Math.max(...week.map((d) => d.amount), 1);

  // Top 3 predicted categories — derive from the live breakdown (frontend only).
  const topCategories = useMemo(() => {
    const cats = Array.isArray(categoryBreakdown) ? categoryBreakdown : [];
    const ranked = cats
      .map((c) => ({ name: c.name, value: Number(c.value || 0) }))
      .filter((c) => c.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 3);
    const total = ranked.reduce((a, c) => a + c.value, 0) || 1;
    return ranked.map((c) => ({ ...c, pct: Math.round((c.value / total) * 100) }));
  }, [categoryBreakdown]);

  const catColors = ["#22c55e", "#38bdf8", "#f59e0b"];

  return (
    <div className="card">
      {/* Header */}
      <div className="card-header">
        <div>
          <div className="card-title">Spend forecast</div>
          <div style={{ fontSize: 12, color: "var(--text-soft)" }}>
            Rough projection for next month
          </div>
        </div>
<span
          style={{
            fontSize: 10,
            fontWeight: 700,
            padding: "3px 10px",
            borderRadius: 999,
            background: "rgba(34,197,94,0.15)",
            border: "1px solid rgba(34,197,94,0.3)",
            color: "#4ade80",
            whiteSpace: "nowrap",
          }}
        >
          ● {dataBasis}
        </span>
      </div>

      {/* Main value + delta indicator */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <div className="card-value" style={{ fontVariantNumeric: "tabular-nums" }}>
          {fmtINR(forecast.expected)}
        </div>
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: deltaColor,
            background: `${deltaColor}1a`,
            padding: "3px 10px",
            borderRadius: 999,
            whiteSpace: "nowrap",
          }}
        >
          {sign}{absDelta}% vs last month
        </span>
      </div>

      {/* 7-day forecast chart */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 6,
          height: 110,
          marginTop: 16,
          padding: "10px 4px 4px",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        {week.map((d, i) => (
          <div
            key={d.label}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 5,
              height: "100%",
              justifyContent: "flex-end",
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: 26,
                height: `${Math.max(6, Math.round((d.amount / maxDay) * 82))}px`,
                borderRadius: 6,
                background:
                  i === week.length - 1
                    ? "linear-gradient(180deg,#22c55e,#15803d)"
                    : "linear-gradient(180deg,#38bdf8,#0369a1)",
                opacity: 0.9,
                transition: "height 0.4s ease",
              }}
              title={fmtINR(d.amount)}
            />
            <span style={{ fontSize: 9, color: "var(--text-subtle)" }}>{d.label}</span>
          </div>
        ))}
      </div>

      {/* Top 3 categories */}
      <div style={{ marginTop: 14 }}>
<div style={{ fontSize: 11, color: "var(--text-soft)", marginBottom: 8 }}>
          Recent spend by category (selected window)
        </div>
        {topCategories.length === 0 ? (
          <div style={{ fontSize: 11, color: "var(--text-subtle)" }}>
            Add transactions to forecast category spending.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {topCategories.map((c, i) => (
              <div key={c.name} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    background: catColors[i % catColors.length],
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    flex: 1,
                    fontSize: 12,
                    color: "var(--text)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {c.name}
                </span>
                <div
                  style={{
                    flex: 2,
                    height: 6,
                    borderRadius: 999,
                    background: "var(--bg-elevated-soft)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      borderRadius: 999,
                      width: `${c.pct}%`,
                      background: catColors[i % catColors.length],
                    }}
                  />
                </div>
                <span
                  style={{
                    width: 56,
                    textAlign: "right",
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--text-soft)",
                    fontVariantNumeric: "tabular-nums",
                    whiteSpace: "nowrap",
                  }}
                >
                  {fmtCompact(c.value)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Note */}
      <div style={{ fontSize: 11, color: "var(--text-subtle)", marginTop: 12, lineHeight: 1.5 }}>
        {forecast.note}
      </div>
    </div>
  );
};

export default ForecastCard;

