// src/pages/Dashboard.jsx
import React, { useState, useEffect, useContext, useMemo, useRef, useCallback } from "react";
import { AuthContext } from "../context/AuthContext";
import { api } from "../api/client";

// --- COMPONENTS ---
import DateRangePicker from "../components/DateRangePicker";
import SpendChart from "../components/SpendChart";
import SpendBreakdown from "../components/SpendBreakdown";
import TransactionTable from "../components/TransactionTable";
import GoalsPanel from "../components/GoalsPanel";
import AlertsPanel from "../components/AlertsPanel";
import HealthScoreCard from "../components/HealthScoreCard";
import ForecastCard from "../components/ForecastCard";
import BudgetPlannerCard from "../components/BudgetPlannerCard";
import BillsPanel from "../components/BillsPanel";
import SubscriptionsPanel from "../components/SubscriptionsPanel";
import PortfolioCard from "../components/PortfolioCard";
import GoalSuggestionsCard from "../components/GoalSuggestionsCard";
import CashflowChart from "../components/CashflowChart";
import AutomationsPanel from "../components/AutomationsPanel";
import PWAInstallCard from "../components/PWAInstallCard";
import SmartFeatures from "../components/SmartFeatures";

// ─── Lightweight inline toast ─────────────────────────────────────────────
// This avoids importing a separate library while still replacing all alert() calls.
let _toastFn = null;
export const setToastFn = (fn) => { _toastFn = fn; };
const toast = (msg, type = "success") => {
  if (_toastFn) { _toastFn(msg, type); return; }
  // Absolute fallback: log only — never use alert()
  console.info(`[toast:${type}] ${msg}`);
};

// ─── Inline Toast Component ───────────────────────────────────────────────
function DashboardToast() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    setToastFn((msg, type = "success") => {
      const id = Date.now();
      setToasts((prev) => [...prev, { id, msg, type }]);
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
    });
    return () => setToastFn(null);
  }, []);

  if (!toasts.length) return null;
  return (
    <div style={{ position: "fixed", top: 20, right: 20, zIndex: 9999, display: "flex", flexDirection: "column", gap: 8 }}>
      {toasts.map((t) => (
        <div key={t.id} style={{
          padding: "12px 18px", borderRadius: 10, fontSize: 13, fontWeight: 600,
          maxWidth: 340, boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
          background: t.type === "error" ? "rgba(239,68,68,0.15)" : "rgba(34,197,94,0.15)",
          border: `1px solid ${t.type === "error" ? "rgba(239,68,68,0.35)" : "rgba(34,197,94,0.35)"}`,
          color: t.type === "error" ? "#ef4444" : "#22c55e",
        }}>
          {t.type === "error" ? "❌" : "✅"} {t.msg}
        </div>
      ))}
    </div>
  );
}

// ─── Date format helper ───────────────────────────────────────────────────
const formatDate = (raw) => {
  if (!raw) return "—";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const Dashboard = () => {
  const { user } = useContext(AuthContext);

  // ─── State ────────────────────────────────────────────────────────────
  const [range, setRange] = useState("30d");

  const [transactions, setTransactions] = useState([]);
  const [insights, setInsights] = useState(null);
  const [loadingTx, setLoadingTx] = useState(true);
  const [loadingInsights, setLoadingInsights] = useState(true);

  // Add Transaction modal
  const [showModal, setShowModal] = useState(false);
  const [newTx, setNewTx] = useState({ merchant: "", amount: "", category: "Food & Dining", type: "expense" });
  const [addingTx, setAddingTx] = useState(false);

  // Dashboard widget data
  const [chartData, setChartData] = useState([]);      // windowed spend series (for SpendChart)
  const [chartDataAllTime, setChartDataAllTime] = useState([]);  // all-time (for ForecastCard context)
  const [cashflowData, setCashflowData] = useState([]);
  const [cashflowWindowDays, setCashflowWindowDays] = useState(30); // exact day count for avg daily
  // ── Shared Y-axis max for SpendChart ──────────────────────────────────
  // Computed from the max spend value across ALL three windows (7d, 30d, 90d)
  // so the Y-axis stays constant when switching windows.
  const [spendYMax, setSpendYMax] = useState(null);
  // ── Shared Y-axis max for CashflowChart ───────────────────────────────
  // Same concept: compute from max inflow/outflow across all three windows
  // so the cashflow Y-axis is consistent when switching 7d/30d/90d.
  const [cashflowGlobalMax, setCashflowGlobalMax] = useState(null);
  const [goals, setGoals] = useState([]);
  const [healthSummary, setHealthSummary] = useState({});
  const [forecast, setForecast] = useState({ expected: 0, delta: 0, note: "" });
  const [categoryBreakdown, setCategoryBreakdown] = useState([]);
  const [totalsLive, setTotalsLive] = useState({ spent: 0, income: 0, surplus: 0 });
  const refreshSequence = useRef(0);
  const [suggestedBudget, setSuggestedBudget] = useState([]);
  const [bills, setBills] = useState([]);
  const [subs, setSubs] = useState([]);
  const [goalSuggestions, setGoalSuggestions] = useState([]);
  const [rules, setRules] = useState([]);

  // Edit transaction modal
  const [editTx, setEditTx] = useState(null);
  const [editForm, setEditForm] = useState({ merchant: "", amount: "", category: "Others", type: "expense" });
  const [savingEdit, setSavingEdit] = useState(false);

  const goalsPanelRef = useRef(null);

  // ─── Date params ──────────────────────────────────────────────────────
  // "Last N days" means exactly N calendar-day buckets: [today-(N-1), today].
  //
  // Previous formula: from = now - N*86400000
  //   → from = 25 Aug 12:xx, to = 1 Sep 12:xx
  //   → backend loop produces 8 entries (25,26,27,28,29,30,31 Aug, 1 Sep)
  //   → wrong: a "7-day" window showed 8 daily buckets.
  //
  // Fixed formula: from = startOfToday - (N-1)*86400000
  //   → from = 26 Aug 00:00, to = now (1 Sep 12:xx)
  //   → backend loop produces 7 entries (26,27,28,29,30,31 Aug, 1 Sep) ✓
  //   → windowDays = round(6.5d) = 7 ✓
  //
  // Using start-of-day for `from` prevents partial-first-day from being counted
  // as a full bucket and ensures the loop produces exactly N date entries.
  const getDateParams = useCallback((rangeKey) => {
    const now   = new Date();
    const N     = rangeKey === "7d" ? 7 : rangeKey === "90d" ? 90 : 30;
    // Start of today (midnight local time) minus (N-1) full days
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const from  = new Date(startOfToday.getTime() - (N - 1) * 24 * 60 * 60 * 1000);
    return { from: from.toISOString(), to: now.toISOString() };
  }, []);

  // ─── Main fetch ───────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    const requestSequence = ++refreshSequence.current;
    setLoadingTx(true);
    setLoadingInsights(true);

    const { from, to } = getDateParams(range);

    try {
      const results = await Promise.allSettled([
          // Recent Transactions: fetch ALL (no date filter) so older receipts/imports
          // are always visible, regardless of the dashboard time-window selector.
          // The time window only filters analytics (totals, charts, health, forecast).
          api.get("/transactions"),
          api.get("/insights", { params: { from, to } }),
          api.get("/budgets"),
          api.get("/bills"),
          api.get("/goals"),
          api.get("/subscriptions"),
          api.get("/automations"),
          api.get("/dashboard-analytics", { params: { from, to } }),
          api.get("/goal-suggestions"),
      ]);

      if (requestSequence !== refreshSequence.current) return;

      const failedRequests = [];
      const getResponse = (result, name) => {
        if (result.status === "rejected") {
          failedRequests.push(name);
          console.error(`Dashboard ${name} request failed:`, result.reason);
          return { data: null };
        }
        return result.value;
      };
      const [txRes, insightsRes, budgetsRes, billsRes, goalsRes, subsRes, automationsRes, analyticsRes, suggestionsRes] = [
        getResponse(results[0], "transactions"),
        getResponse(results[1], "insights"),
        getResponse(results[2], "budgets"),
        getResponse(results[3], "bills"),
        getResponse(results[4], "goals"),
        getResponse(results[5], "subscriptions"),
        getResponse(results[6], "automations"),
        getResponse(results[7], "dashboard analytics"),
        getResponse(results[8], "goal suggestions"),
      ];
      const analyticsSucceeded = results[7].status === "fulfilled";
      const budgetsSucceeded = results[2].status === "fulfilled";

      // Transactions
      if (results[0].status === "fulfilled") setTransactions(txRes.data || []);
      if (results[1].status === "fulfilled") setInsights(insightsRes.data);

      // Bills
      if (results[3].status === "fulfilled") setBills((billsRes.data || []).map((b, idx) => ({
        id: b._id?.toString() || idx + 1,
        _id: b._id,
        name: b.name,
        amount: Number(b.amount || 0),
        due: b.dueDate || b.due || "",
        autoPay: !!b.autoPay,
        frequency: b.frequency || "Monthly",
        category: b.category || "Bills",
      })));

      // Subscriptions
      if (results[5].status === "fulfilled") setSubs((subsRes.data || []).map((s, idx) => ({
        id: s._id?.toString() || idx + 1,
        _id: s._id,
        name: s.name,
        amount: Number(s.amount || 0),
        frequency: s.frequency || "Monthly",
        // Normalize to monthly equivalent so the UI always shows a consistent /mo figure.
        // Daily ₹100 → ₹3,000/mo  |  Weekly ₹100 → ₹433/mo  |  Yearly ₹12,000 → ₹1,000/mo
        monthlyAmount: (() => {
          const amt = Number(s.amount || 0);
          const freq = (s.frequency || "Monthly").toLowerCase();
          if (freq === "daily")  return Math.round(amt * 30);
          if (freq === "weekly") return Math.round((amt * 52) / 12);
          if (freq === "yearly") return Math.round(amt / 12);
          return amt; // monthly (default)
        })(),
        lastUsed: s.lastUsed ? new Date(s.lastUsed).toLocaleDateString("en-IN") : "—",
      })));

      // Goals
      if (results[4].status === "fulfilled") setGoals((goalsRes.data || []).map((g, idx) => ({
        id: g._id?.toString() || idx + 1,
        _id: g._id,
        label: g.title, title: g.title,
        target: Number(g.targetAmount || 0), targetAmount: Number(g.targetAmount || 0),
        current: Number(g.currentAmount || 0), currentAmount: Number(g.currentAmount || 0),
        deadline: g.deadline, category: g.category,
        notes: g.description, description: g.description,
      })));

      // Automations
      if (results[6].status === "fulfilled") setRules((automationsRes.data || []).map((a, idx) => ({
        id: a._id?.toString() || idx + 1, _id: a._id,
        title: a.title, description: a.description || "",
        enabled: !!a.enabled, type: a.type,
        frequency: a.frequency, amount: a.amount,
        limit: a.type === "savings-below-spending-limit" ? a.amount : undefined,
      })));

      // Analytics (main data source)
      if (analyticsSucceeded) {
        const analytics = analyticsRes.data || {};
        const totals = analytics.totals || { spent: 0, income: 0, surplus: 0 };
        setTotalsLive({ spent: Number(totals.spent || 0), income: Number(totals.income || 0), surplus: Number(totals.surplus || 0) });
        setCategoryBreakdown(analytics.categoryBreakdown || []);

        // SpendChart uses the WINDOWED spend series so bars reflect the selected period.
        // ForecastCard still gets all-time context for its data-basis badge.
        setChartData(analytics.spendSeries || []);
        setChartDataAllTime(analytics.spendSeriesAllTime || analytics.spendSeries || []);
        setCashflowData(analytics.cashflowSeries || []);
        setHealthSummary(analytics.health || {});
        setForecast({
          expected: Number(analytics.forecast?.expected || 0),
          delta: Number(analytics.forecast?.delta || 0),
          note: analytics.forecast?.note || "",
          completedMonthsUsed: Number(analytics.forecast?.completedMonthsUsed ?? -1),
        });
        // windowDays from the backend is the exact day count for the selected window
        // (used by CashflowChart for accurate Avg Daily calculation)
        const wDays = analytics.meta?.windowDays || (range === "7d" ? 7 : range === "90d" ? 90 : 30);
        setCashflowWindowDays(wDays);

        // Budget planner: budget limits from /budgets, actual spend from analytics
        if (budgetsSucceeded) {
          const budgets = budgetsRes.data || [];
          const spentMap = new Map((analytics.categoryBreakdown || []).map((c) => [c.name, Number(c.value || 0)]));
          setSuggestedBudget(budgets.map((b) => {
            const spent = spentMap.get(b.category) ?? 0;
            const limit = Number(b.limit || 0);
            return { category: b.category, limit, spent, usedPct: limit > 0 ? Math.round((spent / limit) * 100) : 0 };
          }));
        }
      }

      // Goal suggestions
      const sugg = suggestionsRes.data || [];
      setGoalSuggestions(Array.isArray(sugg) ? sugg.map((s, idx) => ({
        id: s.id ?? idx + 1, title: s.title, description: s.description,
        eta: s.eta, targetAmount: s.targetAmount, currentAmount: s.currentAmount,
        category: s.category, deadline: s.deadline,
      })) : []);

      if (failedRequests.length) {
        toast(`Some dashboard data could not be refreshed: ${failedRequests.join(", ")}.`, "error");
      }

    } catch (err) {
      console.error("Dashboard fetch failed:", err);
      toast("Failed to load dashboard data. Please refresh.", "error");
    } finally {
      if (requestSequence === refreshSequence.current) {
        setLoadingTx(false);
        setLoadingInsights(false);
      }
    }
  }, [range, getDateParams]);

  useEffect(() => {
    if (localStorage.getItem("token")) fetchData();
  }, [fetchData]);

  // ─── Compute shared SpendChart Y-axis max across all three windows ────
  // Fetches the spendSeries for 7d, 30d, and 90d in parallel.
  // Only the spend maximum matters here — we don't need the full analytics.
  // The result is stable across window switches: same Y-axis for 7d/30d/90d.
  useEffect(() => {
    if (!localStorage.getItem("token")) return;
    const now = new Date();
    const sot = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const windows = [
      { N: 7  }, // 7d  → from = today − 6 days
      { N: 30 }, // 30d → from = today − 29 days
      { N: 90 }, // 90d → from = today − 89 days
    ];
    Promise.allSettled(
      windows.map(({ N }) => {
        const from = new Date(sot.getTime() - (N - 1) * 24 * 60 * 60 * 1000);
        return api.get("/dashboard-analytics", {
          params: { from: from.toISOString(), to: now.toISOString() },
        });
      })
    ).then((results) => {
      let globalMax = 0;
      for (const result of results) {
        if (result.status !== "fulfilled") continue;
        const series = result.value?.data?.spendSeries || [];
        for (const entry of series) {
          const v = Number(entry.amount) || 0;
          if (v > globalMax) globalMax = v;
        }
      }
      if (globalMax > 0) setSpendYMax(globalMax);
    }).catch(() => {/* non-fatal — SpendChart falls back to per-window scale */});
  // Re-run whenever the user's transactions might have changed (same dep as fetchData).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchData]);

  // ─── Compute shared CashflowChart Y-axis max across all three windows ─
  // Fetches cashflowSeries for 7d, 30d, 90d in parallel.
  // Max of all inflow/outflow values across all windows → consistent Y-axis
  // when the user switches between 7d/30d/90d.
  useEffect(() => {
    if (!localStorage.getItem("token")) return;
    const now = new Date();
    const sot = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    Promise.allSettled(
      [7, 30, 90].map((N) => {
        const from = new Date(sot.getTime() - (N - 1) * 24 * 60 * 60 * 1000);
        return api.get("/dashboard-analytics", {
          params: { from: from.toISOString(), to: now.toISOString() },
        });
      })
    ).then((results) => {
      let cfMax = 0;
      for (const result of results) {
        if (result.status !== "fulfilled") continue;
        const series = result.value?.data?.cashflowSeries || [];
        for (const pt of series) {
          const v = Math.max(Number(pt.inflow) || 0, Number(pt.outflow) || 0);
          if (v > cfMax) cfMax = v;
        }
      }
      if (cfMax > 0) setCashflowGlobalMax(cfMax);
    }).catch(() => {/* non-fatal — CashflowChart falls back to per-window scale */});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchData]);

  // ─── Add Transaction ──────────────────────────────────────────────────
  const handleSaveTransaction = async (e) => {
    e.preventDefault();
    if (addingTx) return;
    setAddingTx(true);
    try {
      await api.post("/transactions", {
        merchant: newTx.merchant,
        amount: Number(newTx.amount),
        category: newTx.category,
        date: new Date().toISOString(),
        type: newTx.type,
      });
      setShowModal(false);
      setNewTx({ merchant: "", amount: "", category: "Food & Dining", type: "expense" });
      toast("Transaction added successfully.");
      await fetchData();
    } catch (err) {
      console.error("Add transaction error:", err);
      toast(err?.response?.data?.message || "Failed to add transaction.", "error");
    } finally {
      setAddingTx(false);
    }
  };

  // ─── Edit Transaction ─────────────────────────────────────────────────
  const handleEditClick = (tx) => {
    setEditTx(tx);
    setEditForm({
      merchant: tx.merchant || "",
      amount: String(Math.abs(tx.amount)),
      category: tx.category || "Others",
      type: tx.type || "expense",
    });
  };

  const handleEditSave = async (e) => {
    e.preventDefault();
    if (!editTx || savingEdit) return;
    setSavingEdit(true);
    try {
      await api.patch(`/transactions/${editTx.id}`, {
        merchant: editForm.merchant,
        amount: Number(editForm.amount),
        category: editForm.category,
        type: editForm.type,
        date: editTx.date || new Date().toISOString(),
      });
      setEditTx(null);
      toast("Transaction updated.");
      await fetchData();
    } catch (err) {
      console.error("Edit error:", err);
      toast(err?.response?.data?.message || "Failed to update transaction.", "error");
    } finally {
      setSavingEdit(false);
    }
  };

  // ─── Delete Transaction ───────────────────────────────────────────────
  const handleDeleteTx = async (id) => {
    try {
      await api.delete(`/transactions/${id}`);
      toast("Transaction deleted.");
      await fetchData();
    } catch (err) {
      console.error("Delete error:", err);
      toast(err?.response?.data?.message || "Failed to delete transaction.", "error");
    }
  };

  // ─── Goals change handler ─────────────────────────────────────────────
  const handleGoalsChange = useCallback((nextGoals) => {
    setGoals((prev) => Array.isArray(nextGoals) ? nextGoals : prev);
  }, []);

  // ─── Derived values ───────────────────────────────────────────────────
  const totals = totalsLive;
  const netPosition = totals.surplus ?? 0;
  const totalSpent = totals.spent ?? 0;
  // savingsPotential: show real surplus OR real deficit — never clamp to 0
  // When income=0 and spend=₹5204, this is -₹5204 (a deficit), not ₹0.
  const netSurplus = totals.surplus ?? 0;
  const isSurplus = netSurplus > 0;
  const isBreakEven = netSurplus === 0;
  // Labels: surplus = "Cash-flow surplus", deficit = "Cash-flow deficit",
  // break-even = "Break-even"
  const savingsLabel = isSurplus ? "Cash-flow surplus"
    : isBreakEven ? "Break-even"
    : "Cash-flow deficit";
  const savingsSubtitle = isSurplus
    ? "Inflow − outflow (selected period)"
    : isBreakEven
      ? "Inflow equals outflow"
      : totals.income === 0
        ? "No income recorded — spending only"
        : "Spending exceeds income";

  const badges = useMemo(() => {
    const b = [];
    // Only show Monk Mode (genuinely no spending) — the others are removed
    // as they are persona/demo labels not appropriate for final production UI
    if (totalSpent === 0) b.push("🧘 Monk Mode");
    return b;
  }, [totalSpent]);

  const breakdown = categoryBreakdown?.length
    ? categoryBreakdown
    : [{ name: "No Data", value: 1, percent: 100 }];

  // Empty-state placeholder must NOT claim "AI" — nudges are rule-based
  // personalized insights, not AI-generated.
  const alerts = insights?.smartNudges?.length
    ? insights.smartNudges.map((text, idx) => ({ id: idx + 1, text, highlight: null }))
    : [{ id: 1, text: "Add transactions to see personalized insights here.", highlight: "Get started!" }];

  const tableRows = (transactions || []).map((t) => ({
    id: t._id,
    date: formatDate(t.date),   // P2-1 FIX: formatted date
    merchant: t.merchant,
    category: t.category,
    amount: t.amount,
    type: t.type || (t.amount < 0 ? "expense" : "income"),
    channel: t.channel || "Account",
    status: t.status || "cleared",
  }));

  // ─── Styles (unchanged from original) ────────────────────────────────
  const modalOverlayStyle = {
    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.7)", display: "flex",
    justifyContent: "center", alignItems: "center", zIndex: 1000,
  };
  const modalContentStyle = {
    backgroundColor: "#1e1e1e", padding: "20px", borderRadius: "12px",
    width: "350px", border: "1px solid #333", color: "#fff",
  };
  const inputStyle = {
    width: "100%", padding: "10px", margin: "10px 0",
    backgroundColor: "#2a2a2a", border: "1px solid #444", color: "white", borderRadius: "6px",
  };
  const btnStyle = {
    padding: "10px 20px", borderRadius: "6px", cursor: "pointer",
    border: "none", fontWeight: "bold", marginTop: "10px",
  };

  return (
    <>
      {/* Inline toast system — replaces all alert() calls */}
      <DashboardToast />

      {/* ── Add Transaction Modal ──────────────────────────────────────── */}
      {showModal && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle}>
            <h3>Add Transaction</h3>
            <form onSubmit={handleSaveTransaction}>
              <input
                placeholder="Merchant (e.g. Uber)"
                style={inputStyle}
                value={newTx.merchant}
                onChange={(e) => setNewTx({ ...newTx, merchant: e.target.value })}
                required
              />
              <input
                type="number"
                placeholder="Amount (e.g. 500)"
                style={inputStyle}
                value={newTx.amount}
                onChange={(e) => setNewTx({ ...newTx, amount: e.target.value })}
                min="0.01"
                step="0.01"
                required
              />
              <select
                style={inputStyle}
                value={newTx.category}
                onChange={(e) => setNewTx({ ...newTx, category: e.target.value })}
              >
                <option>Food & Dining</option>
                <option>Shopping</option>
                <option>Transport</option>
                <option>Health</option>
                <option>Bills</option>
                <option>Housing</option>
                <option>Entertainment</option>
                <option>Education</option>
                <option>Travel</option>
                <option>Groceries</option>
                <option>Investment</option>
                <option>Others</option>
              </select>
              <select
                style={inputStyle}
                value={newTx.type}
                onChange={(e) => setNewTx({ ...newTx, type: e.target.value })}
              >
                <option value="expense">Expense</option>
                <option value="income">Income (Salary / Credit)</option>
              </select>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ ...btnStyle, backgroundColor: "#444", color: "#fff" }}>
                  Cancel
                </button>
                <button type="submit" disabled={addingTx} style={{ ...btnStyle, backgroundColor: "#00d084", color: "#000", opacity: addingTx ? 0.7 : 1 }}>
                  {addingTx ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        {/* P1-9 FIX: AccountsBar hidden — no backend account source, shows blank space */}
        <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
          {badges.map((b, i) => (
            <span key={i} style={{ background: "#2a2a2a", padding: "6px 12px", borderRadius: "20px", fontSize: "12px", border: "1px solid #444", color: "#ccc" }}>
              {b}
            </span>
          ))}
        </div>
        <button
          onClick={() => setShowModal(true)}
          style={{ backgroundColor: "#00d084", color: "#000", border: "none", padding: "10px 20px", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", fontSize: "14px" }}
        >
          + Add Transaction
        </button>
      </div>

      {/* ── Gen Z Features ─────────────────────────────────────────────── */}
      <SmartFeatures
        onVoiceAdd={async (data, skipSave) => {
          try {
            if (skipSave) {
              // Receipt was already saved by ReceiptScanner — just refresh the dashboard.
              // Fetch transactions independently first so Recent Transactions updates
              // immediately even if one of the other parallel analytics calls fails.
              // No date filter — Recent Transactions shows all history.
              try {
                const txRes = await api.get("/transactions");
                setTransactions(txRes.data || []);
              } catch (txErr) {
                console.error("Transaction refresh error:", txErr);
              }
              // Then do the full dashboard refresh in the background.
              await fetchData();
              return;
            }
            await api.post("/transactions", {
              merchant: data.merchant,
              amount: Number(data.amount),
              category: data.category || "Uncategorized",
              date: new Date().toISOString(),
              // Derive type from category: income categories must be stored as "income"
              // so dashboard analytics, cash flow, and Recent Transactions all reflect
              // the correct sign and colour.  Hardcoding "expense" here was the bug
              // that made "Salary 25000" appear as a red outflow.
              type: (() => {
                const INCOME_CATS = new Set([
                  "income", "salary", "freelance", "freelance payment", "stipend", "bonus", "refund",
                  "cashback", "credit", "deposit", "interest", "dividend",
                  "payout", "commission", "consulting", "wages", "payroll",
                ]);
                const cat = (data.category || "").toLowerCase().trim();
                return INCOME_CATS.has(cat) ? "income" : "expense";
              })(),
            });
            toast("Voice transaction saved.");
            await fetchData();
          } catch (err) {
            console.error(err);
            toast("Failed to save voice transaction.", "error");
          }
        }}
      />

      {/* ── Top Stats ──────────────────────────────────────────────────── */}
      <div className="grid-3">
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Net cash flow</div>
              <div className="card-value">₹{netPosition.toLocaleString("en-IN")}</div>
              <div style={{ fontSize: 12, color: "var(--text-soft)", marginTop: 4 }}>Inflow – outflow ({range})</div>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Total spent</div>
              <div className="card-value">₹{totalSpent.toLocaleString("en-IN")}</div>
              <div style={{ fontSize: 12, color: "var(--text-soft)", marginTop: 4 }}>Across all categories ({range})</div>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <div>
              {/* Dynamic label: surplus = "Savings potential", deficit = "Net deficit" */}
              <div className="card-title">{savingsLabel}</div>
              <div
                className="card-value"
                style={{ color: isSurplus ? undefined : isBreakEven ? undefined : "#f97373" }}
              >
                {(!isSurplus && !isBreakEven) ? "−" : ""}₹{Math.abs(Math.round(netSurplus)).toLocaleString("en-IN")}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-soft)", marginTop: 4 }}>{savingsSubtitle}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Time Window + Monthly Burn + Nudges ────────────────────────── */}
      <div className="grid-2">
        <div>
          <div className="card" style={{ marginBottom: 14, paddingBottom: 10 }}>
            <div className="card-header">
              <div>
                <div className="card-title">Time window</div>
                <DateRangePicker value={range} onChange={setRange} />
              </div>
            </div>
          </div>
        {/* SpendChart uses windowed spendSeries so bars reflect the selected period */}
          <SpendChart data={chartData} range={range} globalYMax={spendYMax} />
        </div>
        <AlertsPanel alerts={alerts} />
      </div>

      {/* ── Cashflow + Budget + Bills ───────────────────────────────────── */}
      <div className="grid-3">
        <CashflowChart data={cashflowData} windowDays={cashflowWindowDays} globalMax={cashflowGlobalMax} />
        {/* P1-4 FIX: pass range so Recalculate can use the same window */}
        <BudgetPlannerCard suggested={suggestedBudget} range={range} />
        <BillsPanel bills={bills} onBillsChange={setBills} />
      </div>

      {/* ── Breakdown + Health + Forecast ──────────────────────────────── */}
      <div className="grid-3">
        <SpendBreakdown data={breakdown} />
        <HealthScoreCard score={healthSummary?.score ?? 0} summary={healthSummary?.summary ?? healthSummary} />
        <ForecastCard forecast={forecast} categoryBreakdown={categoryBreakdown} spendSeries={chartDataAllTime} completedMonthsUsed={forecast.completedMonthsUsed} />
      </div>

      {/* ── Subscriptions + Goals + Smart Goal Ideas ───────────────────── */}
      <div className="grid-3">
        <SubscriptionsPanel subs={subs} onSubsChange={setSubs} />
        <GoalsPanel ref={goalsPanelRef} goals={goals} onGoalsChange={handleGoalsChange} />
        <GoalSuggestionsCard
          suggestions={goalSuggestions}
          onAddGoal={(prefill) => goalsPanelRef.current?.openCreateWithPrefill(prefill)}
        />
      </div>

      {/* ── Portfolio + Automations + PWA ───────────────────────────────── */}
      <div className="grid-3">
        <PortfolioCard />
        <AutomationsPanel rules={rules} onRulesChange={setRules} totalsLive={totalsLive} />
        <PWAInstallCard />
      </div>

      {/* ── Edit Transaction Modal ─────────────────────────────────────── */}
      {editTx && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle}>
            <h3>✏️ Edit Transaction</h3>
            <form onSubmit={handleEditSave}>
              <input
                placeholder="Merchant"
                style={inputStyle}
                value={editForm.merchant}
                onChange={(e) => setEditForm({ ...editForm, merchant: e.target.value })}
                required
              />
              <input
                type="number"
                placeholder="Amount"
                style={inputStyle}
                value={editForm.amount}
                onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                min="0.01"
                step="0.01"
                required
              />
              <select
                style={inputStyle}
                value={editForm.category}
                onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
              >
                <option>Food & Dining</option><option>Shopping</option><option>Transport</option>
                <option>Health</option><option>Bills</option><option>Income</option>
                <option>Housing</option><option>Entertainment</option><option>Education</option>
                <option>Travel</option><option>Groceries</option><option>Investment</option>
                <option>Others</option>
              </select>
              <select
                style={inputStyle}
                value={editForm.type}
                onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <button type="button" onClick={() => setEditTx(null)} style={{ ...btnStyle, backgroundColor: "#444", color: "#fff" }}>
                  Cancel
                </button>
                <button type="submit" disabled={savingEdit} style={{ ...btnStyle, backgroundColor: "#f39c12", color: "#000", opacity: savingEdit ? 0.7 : 1 }}>
                  {savingEdit ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Recent Transactions ─────────────────────────────────────────── */}
      <TransactionTable
        rows={tableRows}
        loading={loadingTx}
        onEdit={handleEditClick}
        onDelete={handleDeleteTx}
      />
    </>
  );
};

export default Dashboard;
