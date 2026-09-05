/**
 * AI Budget Planner Card — Intelligent monthly budget recommendations
 *
 * Fetches AI recommendations from GET /api/budgets/ai-recommend (live from transaction data).
 * Displays per-category progress bars with green/yellow/red status.
 * "Apply" saves budgets to MongoDB (upsert) with duplicate detection.
 * "Recalculate" fetches fresh recommendations.
 *
 * Features:
 * - Fixed-height, internally scrollable card (content never expands the dashboard)
 * - Shows top 3 highest-spending categories by default
 * - "View All Categories" opens a right-side drawer with every category
 * - Compact rows for zero-spend categories (category name + ₹0 only)
 * - Over-budget: red bar + "Over by ₹X" display
 * - Under-budget: "₹X remaining" display
 * - Dark/light mode via CSS variables
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { api } from "../api/client";

// ─── Category Emojis ─────────────────────────────────────────────────────
const CATEGORY_ICONS = {
  "Food & Dining": "🍔",
  Shopping: "🛍️",
  Transport: "🚗",
  Health: "🏥",
  Bills: "📄",
  Income: "💰",
  Housing: "🏠",
  Entertainment: "🎬",
  Education: "📚",
  Travel: "✈️",
  Groceries: "🛒",
  Investment: "📈",
  Others: "📦",
};

// ─── Toast system ────────────────────────────────────────────────────────
function useToast() {
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type, id: Date.now() });
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const toastStyle = {
    position: "fixed",
    top: "20px",
    right: "20px",
    zIndex: 9999,
    padding: "14px 20px",
    borderRadius: "12px",
    fontSize: "13px",
    fontWeight: "600",
    maxWidth: "360px",
    boxShadow: "0 8px 30px rgba(0,0,0,0.3)",
    border: "1px solid",
    backdropFilter: "blur(8px)",
    animation: "budget-slide-in 0.3s ease-out",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    ...(toast?.type === "success"
      ? {
          background: "rgba(34, 197, 94, 0.15)",
          borderColor: "rgba(34, 197, 94, 0.3)",
          color: "#22c55e",
        }
      : {
          background: "rgba(239, 68, 68, 0.15)",
          borderColor: "rgba(239, 68, 68, 0.3)",
          color: "#ef4444",
        }),
  };

  const ToastComponent = toast ? (
    <div style={toastStyle} key={toast.id}>
      <span>{toast.type === "success" ? "✅" : "❌"}</span>
      <span>{toast.message}</span>
      <style>{`
        @keyframes budget-slide-in {
          from { opacity: 0; transform: translateX(100px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  ) : null;

  return { toast, showToast, ToastComponent };
}

// ─── Progress Bar Helpers ──────────────────────────────────────────────
function getStatus(usedPct) {
  if (usedPct > 100) return "over";
  if (usedPct >= 80) return "warning";
  return "good";
}

// ─── Category Row ──────────────────────────────────────────────────────
// Active (hasActivity) rows use the full layout (progress bar, status, AI insight).
// Inactive (zero-spend) rows use a compact layout showing only name + ₹0.
//
// NORMALIZATION NOTE:
// recommendedLimit is always a MONTHLY figure.
// windowSpend is the raw total in the selected window (e.g. ₹2,005 over 90 days).
// monthlyAvg  is the normalized monthly rate (windowSpend/days * 30).
// All comparisons (%, over/remaining, progress bar) use monthlyAvg vs recommendedLimit
// so we are always comparing values on the same time basis.
// The headline figure displayed is windowSpend (what the user actually spent in the window).
function CategoryRow({ item, explanation, expanded, onToggleExplain, explaining, compact }) {
  const { category, windowSpend, currentSpend, monthlyAvg, recommendedLimit, confidence, message } = item;

  const limit = recommendedLimit || 0;
  // windowSpend = raw amount in the selected window (display only)
  const wSpend = windowSpend ?? currentSpend ?? 0;
  // avg = normalised monthly rate — used for ALL comparison math
  const avg = monthlyAvg || 0;

  // Comparisons: avg (monthly) vs limit (monthly) — same time basis.
  const remaining = limit - avg;
  const usedPct = limit > 0 ? Math.round((avg / limit) * 100) : 0;
  const status = getStatus(usedPct);
  const exceeded = avg > limit ? Math.round(avg - limit) : 0;
  const hasActivity = wSpend > 0 || limit > 0;

  const icon = CATEGORY_ICONS[category] || "📋";

  // Compact layout for zero-spend / no-data categories: name + ₹0 only.
  if (compact || !hasActivity) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "9px 4px",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <span
          style={{
            fontSize: "12.5px",
            fontWeight: "500",
            color: "var(--text-soft)",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ fontSize: "14px" }}>{icon}</span>
          {category}
        </span>
        <span
          style={{
            fontSize: "12px",
            fontWeight: "600",
            color: "var(--text-subtle)",
            whiteSpace: "nowrap",
            marginLeft: 8,
          }}
        >
          ₹0
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "12px 2px",
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "8px",
        }}
      >
        <div
          style={{
            fontSize: "13px",
            fontWeight: "600",
            color: "var(--text)",
            display: "flex",
            alignItems: "center",
            gap: "7px",
            minWidth: 0,
          }}
        >
          <span style={{ fontSize: "15px" }}>{icon}</span>
          <span
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {category}
          </span>
          {confidence && (
            <span
              style={{
                fontSize: "10px",
                color: "var(--text-subtle)",
                marginLeft: "2px",
              }}
            >
              {confidence === "high" ? "🟢" : confidence === "medium" ? "🟡" : "⚪"}
            </span>
          )}
        </div>
        <div
          style={{
            textAlign: "right",
            flexShrink: 0,
            marginLeft: 12,
            minWidth: 78,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          <div style={{ fontSize: "13px", fontWeight: "700", color: "var(--text)" }}>
            ₹{wSpend.toLocaleString("en-IN")}
          </div>
          {limit > 0 && (
            <div style={{ fontSize: "11px", color: "var(--text-subtle)" }}>
              ~₹{avg.toLocaleString("en-IN")}/mo · limit ₹{limit.toLocaleString("en-IN")}
            </div>
          )}
        </div>
      </div>

      {/* Progress Bar — thicker with rounded ends */}
      <div
        style={{
          height: "12px",
          borderRadius: "999px",
          backgroundColor: "var(--bg-elevated-soft)",
          overflow: "hidden",
          boxShadow: "inset 0 1px 2px rgba(0,0,0,0.3)",
        }}
      >
        <div
          style={{
            width: `${Math.min(100, Math.max(0, usedPct))}%`,
            height: "100%",
            borderRadius: "999px",
            transition: "width 0.5s ease",
            background:
              status === "over"
                ? "linear-gradient(90deg, #ef4444, #dc2626)"
                : status === "warning"
                  ? "linear-gradient(90deg, #f59e0b, #d97706)"
                  : "linear-gradient(90deg, #22c55e, #16a34a)",
          }}
        />
      </div>

      {/* Status row */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: "6px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
          <span
            style={{
              fontSize: "10.5px",
              fontWeight: "600",
              padding: "2px 8px",
              borderRadius: "999px",
              backgroundColor:
                status === "over"
                  ? "rgba(239, 68, 68, 0.15)"
                  : status === "warning"
                    ? "rgba(245, 158, 11, 0.15)"
                    : "rgba(34, 197, 94, 0.15)",
              color:
                status === "over"
                  ? "#ef4444"
                  : status === "warning"
                    ? "#d97706"
                    : "#16a34a",
            }}
          >
            {usedPct}% used
          </span>

          {remaining > 0 && exceeded === 0 && (
            <span style={{ fontSize: "10.5px", color: "#16a34a", fontWeight: "600" }}>
              ✅ ₹{Math.round(remaining).toLocaleString("en-IN")}/mo left
            </span>
          )}

          {exceeded > 0 && (
            <span style={{ fontSize: "10.5px", color: "#ef4444", fontWeight: "700" }}>
              ⚠️ Over by ₹{exceeded.toLocaleString("en-IN")}/mo
            </span>
          )}
        </div>
      </div>

      {message && (
        <div
          style={{
            fontSize: "11px",
            color: "var(--text-subtle)",
            marginTop: "5px",
            fontStyle: "italic",
          }}
        >
          {message}
        </div>
      )}

{/* AI Insight — compact pill directly below each category */}
      <div style={{ marginTop: "6px" }}>
        <button
          onClick={() => onToggleExplain && onToggleExplain(category)}
          style={{
            fontSize: "10px",
            padding: "4px 12px",
            borderRadius: "999px",
            border: "1px solid var(--border-subtle)",
            background: expanded ? "var(--accent-soft)" : "rgba(34,197,94,0.08)",
            color: "var(--accent-strong, #4ade80)",
            cursor: "pointer",
            fontWeight: "600",
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            transition: "all 0.2s",
            boxShadow: expanded ? "0 0 0 2px rgba(34,197,94,0.15)" : "none",
          }}
        >
          {explaining ? (
            <>⏳ Loading...</>
          ) : expanded ? (
            <>🤖 Hide Insight</>
          ) : (
            <>🤖 AI Insight{explanation?.source === "gemini" ? " ✦" : ""}</>
          )}
        </button>
      </div>

      {expanded && explanation && (
        <div
          style={{
            marginTop: "6px",
            padding: "8px 10px",
            borderRadius: "6px",
            backgroundColor: "var(--bg-elevated-soft)",
            border: "1px solid var(--border-subtle)",
            fontSize: "11px",
            lineHeight: "1.5",
            color: "var(--text-soft)",
          }}
        >
          <div style={{ marginBottom: "5px" }}>
            <span style={{ color: "var(--text)", fontWeight: "600" }}>💡 Budget:</span>{" "}
            {explanation.explanation}
          </div>
          <div style={{ marginBottom: "5px" }}>
            <span style={{ color: "var(--text)", fontWeight: "600" }}>📊 Pattern:</span>{" "}
            {explanation.patterns?.[0] || explanation.behavior || "No significant patterns detected."}
          </div>
          <div>
            <span style={{ color: "var(--text)", fontWeight: "600" }}>🎯 Suggestion:</span>{" "}
            {explanation.suggestions?.[0] || "Track your spending to stay within budget."}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Right-side Drawer (modal) for all categories ──────────────────────
function AllCategoriesDrawer({ open, onClose, items, explanations, expandedCategories, explainingCategories, onToggleExplain }) {
  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 4000,
        backgroundColor: "rgba(2, 6, 23, 0.65)",
        backdropFilter: "blur(3px)",
        display: "flex",
        justifyContent: "flex-end",
        alignItems: "center",
        padding: "0 5vw",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(520px, 92vw)",
          height: "75vh",
          backgroundColor: "var(--bg-elevated)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "18px",
          boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          animation: "budget-drawer-in 0.3s ease",
        }}
      >
        <style>{`
          @keyframes budget-drawer-in {
            from { transform: translateY(20px) scale(0.98); opacity: 0.4; }
            to { transform: translateY(0) scale(1); opacity: 1; }
          }
.budget-cat-row {
            border-radius: 10px;
            transition: background 0.15s ease;
            padding-left: 8px;
            padding-right: 8px;
          }
          .budget-cat-row:hover {
            background: rgba(148, 163, 184, 0.08);
          }
          .budget-drawer-list::-webkit-scrollbar {
            width: 4px;
          }
          .budget-drawer-list::-webkit-scrollbar-thumb {
            background: rgba(148, 163, 184, 0.25);
            border-radius: 999px;
          }
          .budget-drawer-list::-webkit-scrollbar-track {
            background: transparent;
          }
        `}</style>

        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "20px 22px 16px",
            borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          <div>
            <div className="card-title">All Categories</div>
            <div style={{ fontSize: 11, color: "var(--text-subtle)", marginTop: 4 }}>
              {items.length} categories on your plan
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "rgba(148,163,184,0.12)",
              border: "none",
              fontSize: "16px",
              cursor: "pointer",
              color: "var(--text-soft)",
              width: 34,
              height: 34,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "background 0.15s ease",
            }}
          >
            ✕
          </button>
        </div>

{/* List */}
        <div
          className="budget-drawer-list"
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            padding: "16px 16px 22px",
            overscrollBehavior: "contain",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          {items.map((item) => (
            <div className="budget-cat-row" key={item.category}>
              <CategoryRow
                item={item}
                explanation={explanations[item.category]}
                expanded={!!expandedCategories[item.category]}
                onToggleExplain={onToggleExplain}
                explaining={!!explainingCategories[item.category]}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────
export default function BudgetPlannerCard({ suggested: suggestedProp, onRecalculate, range }) {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState(null);
  const [meta, setMeta] = useState(null);
  const { showToast, ToastComponent } = useToast();

  // Stable ref to showToast — breaks the dependency chain so fetchRecommendations
  // never changes identity after mount, preventing infinite re-render loops.
  const showToastRef = useRef(showToast);

  // ── AI Explanation State ────────────────────────────────────────────
  const [explanations, setExplanations] = useState({}); // { category: { explanation, behavior, patterns, suggestions } }
  const [expandedCategories, setExpandedCategories] = useState({}); // { category: true/false }
  const [explainingCategories, setExplainingCategories] = useState({}); // { category: true/false } — loading state per category

  // ── All-categories drawer ───────────────────────────────────────────
  const [drawerOpen, setDrawerOpen] = useState(false);

  // ── Toggle AI Explanation ───────────────────────────────────────────
  const handleToggleExplain = useCallback(async (category) => {
    // If already expanded, just collapse it
    if (expandedCategories[category]) {
      setExpandedCategories((prev) => ({ ...prev, [category]: false }));
      return;
    }

    // If we already have explanation data cached, just expand
    if (explanations[category]) {
      setExpandedCategories((prev) => ({ ...prev, [category]: true }));
      return;
    }

    // Fetch explanation from backend
    setExplainingCategories((prev) => ({ ...prev, [category]: true }));
    setExpandedCategories((prev) => ({ ...prev, [category]: true }));

    try {
      // Find the recommendation item for this category
      const recItem = recommendations.find((r) => r.category === category);
      if (!recItem) {
        setExplanations((prev) => ({
          ...prev,
          [category]: {
            explanation: "No budget data available for this category.",
            behavior: "",
            patterns: [],
            suggestions: [],
          },
        }));
        setExplainingCategories((prev) => ({ ...prev, [category]: false }));
        return;
      }

      const response = await api.post("/budgets/ai-explain", {
        recommendations: [recItem],
        // Pass lookbackDays so the explainer can use window-appropriate terminology
        lookbackDays: meta?.lookbackDays ?? (range === "7d" ? 7 : range === "90d" ? 90 : 30),
      });

      if (response.data?.success && response.data.explanations?.length > 0) {
        const exp = response.data.explanations[0];
        setExplanations((prev) => ({
          ...prev,
          [category]: exp,
        }));
      } else {
        throw new Error(response.data?.message || "No explanation returned");
      }
    } catch (err) {
      console.error("AI Explain error:", err);
      // Set a fallback explanation on error
      setExplanations((prev) => ({
        ...prev,
        [category]: {
          explanation: "Could not generate AI explanation at this time.",
          behavior: "",
          patterns: [],
          suggestions: ["Try again later or check your connection."],
        },
      }));
    } finally {
      setExplainingCategories((prev) => ({ ...prev, [category]: false }));
    }
  }, [recommendations, expandedCategories, explanations]);
  useEffect(() => {
    showToastRef.current = showToast;
  }, [showToast]);

  // ── Fetch AI Recommendations ─────────────────────────────────────────
  // lookbackDays is derived from the current range prop and must always be
  // passed explicitly — never falls back to a hardcoded 90.
  const fetchRecommendations = useCallback(async (lookbackDays) => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.get("/budgets/ai-recommend", {
        params: { lookbackDays, reductionFactor: 0.9 },
      });

      if (response.data?.success) {
        setRecommendations(response.data.recommendations || []);
        setMeta(response.data.meta);
      } else {
        throw new Error(response.data?.message || "Failed to fetch recommendations");
      }
    } catch (err) {
      console.error("Budget recommendations error:", err);
      const msg = err.response?.data?.message || err.message || "Could not load AI budget recommendations.";
      setError(msg);
      showToastRef.current(msg, "error");
    } finally {
      setLoading(false);
    }
  }, []);

// ── Clear stale planner state whenever the selected time window changes ─
  // This is the guard that ensures no values, insight text, or recommendation
  // from a previous window can survive into the new one.
  const prevRangeRef = useRef(range);
  useEffect(() => {
    if (prevRangeRef.current !== range) {
      prevRangeRef.current = range;
      // Wipe everything that is window-specific
      setRecommendations([]);
      setMeta(null);
      setExplanations({});
      setExpandedCategories({});
      setError(null);
    }
  }, [range]);

  // ── Use the Dashboard's suggested budgets as the single data source ─
  // Dashboard passes `suggested` (built from /budgets + /dashboard-analytics).
  // If the user has saved budgets, use them — they carry the correct time-window
  // spend. If suggestedProp is empty (no saved budgets yet), fall through to
  // fetchRecommendations so the card still shows real category spending derived
  // directly from transactions via /budgets/ai-recommend.
  //
  // `range` is in deps so this re-runs when the window changes, ensuring the
  // planner recalculates immediately for the new window.
  useEffect(() => {
    if (!Array.isArray(suggestedProp)) return;

    // Exact lookback days for the current range — single source of truth, no hardcoded fallback.
    const rangeDays = range === "7d" ? 7 : range === "90d" ? 90 : 30;

    if (suggestedProp.length > 0) {
      // User has saved budgets — use the dashboard-filtered spend figures.
      // Preserve all enriched fields so AI Insight receives real values and
      // cannot produce contradictory text (e.g. "0 transactions" while card shows ₹2,005).
      setRecommendations(
        suggestedProp.map((b) => {
          const spent = Number(b.spent || 0);
          // monthlyAvg = (spend in window / window days) * 30
          // Matches budgetRecommender.js formula so AI Insight and card agree.
          const monthlyAvg = rangeDays > 0 ? Math.round((spent / rangeDays) * 30) : 0;
          return {
            category: b.category,
            recommendedLimit: Number(b.limit || 0),
            windowSpend: spent,     // raw window total — display only
            currentSpend: spent,    // alias kept for compat
            monthlyAvg,             // normalised monthly rate — used for all math
            // Carry through any enriched fields if present
            transactionCount: b.transactionCount ?? undefined,
            confidence: b.confidence ?? undefined,
            message: b.message ?? undefined,
            isVolatile: b.isVolatile ?? false,
          };
        })
      );
      // Always set meta from the current range so the header text is correct.
      setMeta({ lookbackDays: rangeDays });
      setLoading(false);
    } else {
      // No saved budgets yet — fetch AI recommendations from transactions directly
      // using the EXACT current range so the card shows window-correct data.
      fetchRecommendations(rangeDays);
    }
  }, [suggestedProp, range, fetchRecommendations]);

  // ── Recalculate ──────────────────────────────────────────────────────
  const handleRecalculate = async () => {
    // Clear stale insight cache before recalculating so no old window's
    // explanation text can show through while the new fetch is in flight.
    setExplanations({});
    setExpandedCategories({});
    setLoading(true);
    setError(null);

    try {
      // Use the EXACT dashboard range — no clamping, no minimum floor.
      // The selected window is the single source of truth.
      const rangeTodays = range === "7d" ? 7 : range === "90d" ? 90 : 30;

      const response = await api.get("/budgets/ai-recommend", {
        params: { lookbackDays: rangeTodays, reductionFactor: 0.9 },
      });

      if (response.data?.success) {
        setRecommendations(response.data.recommendations || []);
        setMeta({ ...response.data.meta, lookbackDays: rangeTodays });
        showToast(`Budget updated from last ${rangeTodays} days of spending.`, "success");
      } else {
        throw new Error(response.data?.message || "Recalculation failed");
      }
    } catch (err) {
      console.error("Recalculate error:", err);
      const msg = err.response?.data?.message || err.message || "Failed to recalculate budgets.";
      setError(msg);
      showToast(msg, "error");
    } finally {
      setLoading(false);
    }

    if (onRecalculate) onRecalculate();
  };

  // ── Apply Recommendations ──────────────────────────────────────────
  const handleApply = async () => {
    setApplying(true);
    setError(null);

    try {
const budgetsToApply = recommendations
        .filter((r) => r.recommendedLimit > 0)
        .map((r) => ({
          category: r.category,
          limit: r.recommendedLimit,
        }));

      if (budgetsToApply.length === 0) {
        showToast("No budgets with positive limits to apply.", "error");
        setApplying(false);
        return;
      }

      const response = await api.post("/budgets/apply-recommendations", {
        budgets: budgetsToApply,
      });

      if (response.data?.success) {
        if (response.data.isUpToDate) {
          showToast("Budget is already up to date.", "success");
        } else {
          showToast(
            `Budget plan applied successfully (${response.data.applied} categories).`,
            "success"
          );
        }
      } else {
        throw new Error(response.data?.message || "Apply failed");
      }
    } catch (err) {
      console.error("Apply budgets error:", err);
      const msg = err.response?.data?.message || err.message || "Failed to apply budgets.";
      setError(msg);
      showToast(msg, "error");
    } finally {
      setApplying(false);
    }
  };

  // ── Compute stats ────────────────────────────────────────────────────
  const activeBudgets = recommendations.filter((r) => r.recommendedLimit > 0);
  const totalLimit = activeBudgets.reduce((s, r) => s + r.recommendedLimit, 0);
  // totalSpent = sum of raw window spending (what the user actually spent in this window).
  // This matches what each category card headline displays.
  const totalSpent = activeBudgets.reduce((s, r) => s + (r.windowSpend ?? r.currentSpend ?? 0), 0);
  // totalMonthlyAvg = sum of normalised monthly rates (for pct/over math if needed in future).
  const totalMonthlyAvg = activeBudgets.reduce((s, r) => s + (r.monthlyAvg || 0), 0);
  const hasData = recommendations.some((r) => (r.windowSpend ?? r.currentSpend ?? 0) > 0);

  // Categories with real activity (spend or limit) — used for the top-3 preview.
  const activeCategories = recommendations
    .filter((r) => (r.windowSpend ?? r.currentSpend ?? 0) > 0 || r.recommendedLimit > 0)
    .sort((a, b) => ((b.windowSpend ?? b.currentSpend ?? 0) - (a.windowSpend ?? a.currentSpend ?? 0)));

  // Top 3 highest-spending categories shown on the card by default.
  const top3 = activeCategories.slice(0, 3);

  // All categories (for the drawer). Zero-spend ones render compactly.
  const allCategories = recommendations;

  // ── Inject spinner animation ─────────────────────────────────────────
  useEffect(() => {
    const styleId = "budget-spinner-style";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = `
        @keyframes budget-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        @keyframes budget-slide-in {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <div className="card card--fixed">
      {ToastComponent}

      <div className="card-header">
        <div>
          <div className="card-title">Smart Budget Planner</div>
          <div style={{ fontSize: 12, color: "var(--text-soft)" }}>
            {meta
              ? `Based on last ${meta.lookbackDays} days of spending`
              : `Based on last ${range === "7d" ? 7 : range === "90d" ? 90 : 30} days of spending`}
          </div>
        </div>
        <div style={{ display: "flex", gap: "6px" }}>
          {activeBudgets.length > 0 && (
            <button
              className="btn-ghost btn"
              style={{ fontSize: 11 }}
              onClick={handleApply}
              disabled={applying}
            >
              {applying ? (
                <>
                  <span className="budget-spinner-sm" />
                  Applying...
                </>
              ) : (
                "💾 Apply"
              )}
            </button>
          )}
          <button
            className="btn-ghost btn"
            style={{ fontSize: 11 }}
            onClick={handleRecalculate}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="budget-spinner-sm" />
                Recalculating...
              </>
            ) : (
              "🔄 Recalculate"
            )}
          </button>
        </div>
      </div>

      {/* Inline spinner animation styles */}
      <style>{`
        .budget-spinner-sm {
          display: inline-block;
          width: 12px;
          height: 12px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top: 2px solid var(--accent, #00d084);
          border-radius: 50%;
          animation: budget-spin 0.8s linear infinite;
          margin-right: 4px;
          vertical-align: middle;
        }
      `}</style>

      {/* Loading State */}
      {loading && (
        <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-soft)", fontSize: "13px" }}>
          <div
            style={{
              display: "inline-block",
              width: "24px",
              height: "24px",
              border: "3px solid var(--border-subtle)",
              borderTop: "3px solid var(--accent)",
              borderRadius: "50%",
              animation: "budget-spin 0.8s linear infinite",
              marginBottom: "10px",
            }}
          />
          <div>Analyzing your spending patterns...</div>
        </div>
      )}

      {/* Empty State */}
      {!loading && !hasData && !error && (
        <div style={{ textAlign: "center", padding: "32px 16px", color: "var(--text-soft)" }}>
          <div style={{ fontSize: "48px", marginBottom: "12px" }}>🧠</div>
          <div style={{ fontSize: "16px", fontWeight: "600", color: "var(--text)", marginBottom: "8px" }}>
            No Spending Data Yet
          </div>
          <div
            style={{
              fontSize: "13px",
              lineHeight: "1.5",
              color: "var(--text-soft)",
              maxWidth: "280px",
              margin: "0 auto",
            }}
          >
            Add some transactions to get budget recommendations. The planner will
            analyze your category spending and suggest monthly limits.
          </div>
          <div style={{ marginTop: "16px", fontSize: "12px", color: "var(--text-subtle)" }}>
            💡 Use Voice Add or Receipt Scanner to quickly log expenses
          </div>
        </div>
      )}

      {/* Error inline display */}
      {error && (
        <div
          style={{
            backgroundColor: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            borderRadius: "8px",
            padding: "12px",
            marginBottom: "12px",
            fontSize: "12px",
            color: "#ef4444",
            lineHeight: "1.5",
          }}
        >
          ❌ {error}
        </div>
      )}

      {/* Recommendations List — top 3 highest-spending, internally scrollable */}
      {!loading && hasData && (
        <div className="card-scroll" style={{ display: "flex", flexDirection: "column" }}>
          {top3.map((item) => (
            <CategoryRow
              key={item.category}
              item={item}
              explanation={explanations[item.category]}
              expanded={!!expandedCategories[item.category]}
              onToggleExplain={handleToggleExplain}
              explaining={!!explainingCategories[item.category]}
            />
          ))}

          {/* View All Categories — opens the right drawer */}
          <button
            onClick={() => setDrawerOpen(true)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              width: "100%",
              marginTop: "10px",
              padding: "9px 12px",
              border: "1px solid var(--border-subtle)",
              borderRadius: "10px",
              background: "rgba(34, 197, 94, 0.1)",
              color: "var(--accent-strong)",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "background 0.2s",
            }}
          >
            👁 View All Categories ({allCategories.length})
          </button>

{/* Summary Footer — pinned to bottom */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "10px 0 2px",
              borderTop: "1px solid var(--border-subtle)",
              marginTop: "auto",
            }}
          >
            <span style={{ fontSize: "12px", fontWeight: "600", color: "var(--text)" }}>
              📊 Total spent
            </span>
            <span style={{ fontSize: "14px", fontWeight: "700", color: "var(--text)" }}>
              ₹{totalSpent.toLocaleString("en-IN")} / ₹{totalLimit.toLocaleString("en-IN")} budget
            </span>
          </div>
        </div>
      )}

      {/* All-categories drawer */}
      <AllCategoriesDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        items={allCategories}
        explanations={explanations}
        expandedCategories={expandedCategories}
        explainingCategories={explainingCategories}
        onToggleExplain={handleToggleExplain}
      />
    </div>
  );
}

