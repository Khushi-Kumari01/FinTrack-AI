// src/components/AutomationsPanel.jsx
import React, { useMemo, useState } from "react";
import { api } from "../api/client";
import SavingsAutomationModal from "./SavingsAutomationModal";

const formatRuleType = (type) => {
  switch (type) {
    case "savings-fixed-amount":      return "Fixed amount";
    case "savings-income-arrival":    return "Save on income";
    case "savings-round-up":          return "Round-up spare change";
    case "savings-below-spending-limit": return "Below spending limit";
    default: return type;
  }
};

/**
 * Calculate the monthly-equivalent planned savings for a single rule.
 *
 * Returns { monthlyEquivalent, yearlyEquivalent, displayText, feasible? }
 * where monthlyEquivalent = ₹/month and displayText is a human-readable label.
 *
 * NOTE: These are PLANNED amounts only. No actual bank transfer happens.
 */
function calcRuleSavings(rule, currentMonthlyIncome, currentMonthlyExpense) {
  if (!rule.enabled) return { monthlyEquivalent: 0, yearlyEquivalent: 0, displayText: "Disabled" };

  const amt = Number(rule.amount) || 0;
  const freq = (rule.frequency || "monthly").toLowerCase();
  const surplus = Math.max(0, (currentMonthlyIncome || 0) - (currentMonthlyExpense || 0));

  switch (rule.type) {
    case "savings-fixed-amount": {
      if (amt <= 0) return { monthlyEquivalent: 0, yearlyEquivalent: 0, displayText: "No amount set" };
      // Normalise any frequency to monthly equivalent
      const monthly =
        freq === "daily"  ? Math.round(amt * 30) :
        freq === "weekly" ? Math.round((amt * 52) / 12) :
        Math.round(amt); // monthly
      const yearly  = freq === "daily" ? Math.round(amt * 365) : freq === "weekly" ? Math.round(amt * 52) : Math.round(amt * 12);
      const feasible = surplus === 0 || monthly <= surplus;
      return {
        monthlyEquivalent: monthly,
        yearlyEquivalent: yearly,
        displayText: `₹${monthly.toLocaleString("en-IN")}/mo planned`,
        feasible,
        feasibilityNote: surplus > 0
          ? feasible
            ? `Feasible — within your ₹${surplus.toLocaleString("en-IN")} surplus`
            : `⚠️ Exceeds your ₹${surplus.toLocaleString("en-IN")} surplus`
          : null,
      };
    }

    case "savings-income-arrival": {
      // If a percentage was configured, calculate from actual income
      const pct = Number(rule.amount) || 0;
      if (pct > 0 && pct <= 100 && monthlyIncome > 0) {
        const monthly = Math.round((pct / 100) * monthlyIncome);
        return {
          monthlyEquivalent: monthly,
          yearlyEquivalent: monthly * 12,
          displayText: `₹${monthly.toLocaleString("en-IN")}/mo (${pct}% of income)`,
          feasibilityNote: `Based on ₹${monthlyIncome.toLocaleString("en-IN")} income`,
          feasible: true,
        };
      }
      return {
        monthlyEquivalent: 0,
        yearlyEquivalent: 0,
        displayText: pct > 0 ? `${pct}% of income (no income recorded)` : "Triggers on income",
        feasibilityNote: "Amount depends on income received",
      };
    }

    case "savings-round-up": {
      return {
        monthlyEquivalent: 0,
        yearlyEquivalent: 0,
        displayText: "Spare change (variable)",
        feasibilityNote: "Calculated from your transaction history",
      };
    }

    case "savings-below-spending-limit": {
      const limit = Number(rule.limit ?? rule.amount) || 0;
      if (limit <= 0) return { monthlyEquivalent: 0, yearlyEquivalent: 0, displayText: "No limit set" };
      // rule: "save ₹X if monthly spending < limit"
      // we can only show the potential saving — actual depends on whether spending is under limit
      const saveAmt = amt > 0 ? amt : 0;
      const monthly = saveAmt;
      const belowLimit = currentMonthlyExpense > 0 && currentMonthlyExpense < limit;
      return {
        monthlyEquivalent: belowLimit ? monthly : 0,
        yearlyEquivalent: belowLimit ? monthly * 12 : 0,
        displayText: belowLimit
          ? `₹${monthly.toLocaleString("en-IN")}/mo (spending is under ₹${limit.toLocaleString("en-IN")})`
          : `₹0 (spending ≥ ₹${limit.toLocaleString("en-IN")} limit)`,
        feasibilityNote: `Limit: ₹${limit.toLocaleString("en-IN")}`,
      };
    }

    default:
      return { monthlyEquivalent: 0, yearlyEquivalent: 0, displayText: "—" };
  }
}

const AutomationsPanel = ({ rules, onRulesChange, totalsLive }) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState("create"); // create | edit
  const [modalInitial, setModalInitial] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const hasRules = (rules || []).length > 0;

  // Derive monthly income/expense from dashboard totals for feasibility checks.
  // These are the SELECTED-WINDOW totals — good enough for a planning estimate.
  const monthlyIncome  = Number(totalsLive?.income  || 0);
  const monthlyExpense = Number(totalsLive?.spent   || 0);

  // Compute planned savings per rule, and aggregate totals
  const rulesWithCalc = useMemo(() => {
    return (rules || []).map((r) => ({
      ...r,
      calc: calcRuleSavings(r, monthlyIncome, monthlyExpense),
    }));
  }, [rules, monthlyIncome, monthlyExpense]);

  const totalPlannedMonthly = useMemo(() =>
    rulesWithCalc.filter(r => r.enabled).reduce((s, r) => s + r.calc.monthlyEquivalent, 0),
    [rulesWithCalc]
  );
  const totalPlannedYearly = useMemo(() =>
    rulesWithCalc.filter(r => r.enabled).reduce((s, r) => s + r.calc.yearlyEquivalent, 0),
    [rulesWithCalc]
  );

  const emptyState = useMemo(() => {
    if (hasRules) return null;
    return (
      <div
        style={{
          border: "1px dashed rgba(148,163,184,0.35)",
          borderRadius: 14,
          padding: 16,
          background: "rgba(15,23,42,0.25)",
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 800 }}>No automations yet</div>
        <div style={{ fontSize: 12, color: "var(--text-soft)", marginTop: 6 }}>
          Create a savings rule to plan recurring savings goals.
        </div>
        <div style={{ marginTop: 12, fontSize: 12, color: "var(--text-soft)" }}>
          Tip: Start with a fixed amount or a round-up rule.
        </div>
      </div>
    );
  }, [hasRules]);

  const openCreate = () => {
    setErrorMessage("");
    setMode("create");
    setModalInitial(null);
    setModalOpen(true);
  };

  const openEdit = (r) => {
    setErrorMessage("");
    setMode("edit");
    setModalInitial(r);
    setModalOpen(true);
  };

  const close = () => {
    if (submitting) return;
    setModalOpen(false);
  };

  const refresh = async () => {
    try {
      const res = await api.get("/automations");
      const next = (res.data || []).map((a, idx) => ({
        id: a._id?.toString?.() || idx + 1,
        _id: a._id,
        title: a.title,
        description: a.description || "",
        enabled: !!a.enabled,
        type: a.type,
        frequency: a.frequency,
        amount: a.amount,
        // UI expects limit for spending-limit; backend stored it in `amount`.
        limit: a.type === "savings-below-spending-limit" ? a.amount : undefined,
      }));
      onRulesChange?.(next);
    } catch (e) {
      console.error("Failed to refresh automations", e);
    }
  };

  const submit = async (payload) => {
    setSubmitting(true);
    setErrorMessage("");
    try {
      const body = payload;

      if (mode === "create") {
        const res = await api.post("/automations", body);
        void res;
      } else {
        const id = modalInitial?._id || modalInitial?.id;
        await api.patch(`/automations/${id}`, body);
      }

      setModalOpen(false);
      await refresh();
    } catch (err) {
      console.error(err);
      setErrorMessage(err?.response?.data?.message || "Failed to save automation.");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleEnabled = async (r) => {
    setSubmitting(true);
    setErrorMessage("");
    try {
      const id = r._id || r.id;
      await api.patch(`/automations/${id}`, { enabled: !r.enabled });
      await refresh();
    } catch (err) {
      console.error(err);
      setErrorMessage(err?.response?.data?.message || "Failed to update rule.");
    } finally {
      setSubmitting(false);
    }
  };

  const deleteRule = async (r) => {
    setSubmitting(true);
    setErrorMessage("");
    try {
      const id = r._id || r.id;
      await api.delete(`/automations/${id}`);
      await refresh();
    } catch (err) {
      console.error(err);
      setErrorMessage(err?.response?.data?.message || "Failed to delete rule.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="card card-fill">
      <div className="card-header">
        <div>
          <div className="card-title">Savings automations</div>
          <div style={{ fontSize: 12, color: "var(--text-soft)" }}>Plan and track your savings rules</div>
        </div>
        <button className="btn-ghost btn" style={{ fontSize: 11 }} onClick={openCreate} type="button">
          + New rule
        </button>
      </div>

      {errorMessage && (
        <div style={{ marginTop: 10, color: "#fb7185", fontSize: 12, paddingLeft: 6 }}>
          {errorMessage}
        </div>
      )}

      <div className="grid" style={{ gap: 8 }}>
        {!hasRules ? (
          <div style={{ gridColumn: "1 / -1" }}>{emptyState}</div>
        ) : (
          rulesWithCalc.map((r) => (
            <div
              key={r.id}
              style={{
                padding: 10,
                borderRadius: 12,
                background: "rgba(15,23,42,0.9)",
                border: "1px solid var(--border-subtle)",
                fontSize: 12,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.title}>
                    {r.title}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-subtle)", marginTop: 2 }}>
                    {formatRuleType(r.type)}
                    {r.frequency ? ` · ${r.frequency}` : ""}
                  </div>
                  {/* Planned savings amount — the key new piece of data */}
                  {r.enabled && (
                    <div style={{ marginTop: 4, fontSize: 11, color: "#4ade80", fontWeight: 600 }}>
                      {r.calc.displayText}
                    </div>
                  )}
                  {r.enabled && r.calc.feasibilityNote && (
                    <div style={{ fontSize: 10, color: r.calc.feasible === false ? "#f97316" : "var(--text-subtle)", marginTop: 2 }}>
                      {r.calc.feasibilityNote}
                    </div>
                  )}
                  {!r.enabled && (
                    <div style={{ fontSize: 10, color: "var(--text-subtle)", marginTop: 2 }}>Rule is disabled</div>
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end", flexShrink: 0 }}>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11 }}>
                    <span>{r.enabled ? "On" : "Off"}</span>
                    <input
                      type="checkbox"
                      checked={!!r.enabled}
                      onChange={() => toggleEnabled(r)}
                      disabled={submitting}
                      style={{ cursor: "pointer" }}
                    />
                  </label>

                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => openEdit(r)}
                      disabled={submitting}
                      style={{
                        background: "rgba(56,189,248,0.12)",
                        border: "1px solid rgba(56,189,248,0.35)",
                        color: "#dbeafe",
                        padding: "6px 10px",
                        borderRadius: 10,
                        cursor: "pointer",
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteRule(r)}
                      disabled={submitting}
                      style={{
                        background: "rgba(244,63,94,0.12)",
                        border: "1px solid rgba(244,63,94,0.35)",
                        color: "#ffe4e6",
                        padding: "6px 10px",
                        borderRadius: 10,
                        cursor: "pointer",
                        fontSize: 12,
                        fontWeight: 700,
                        opacity: submitting ? 0.7 : 1,
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── Planned savings summary footer ───────────────────────── */}
      {hasRules && totalPlannedMonthly > 0 && (
        <div
          style={{
            marginTop: 10,
            padding: "8px 12px",
            borderRadius: 10,
            background: "rgba(34,197,94,0.08)",
            border: "1px solid rgba(34,197,94,0.2)",
            fontSize: 12,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "var(--text-soft)" }}>Planned monthly savings</span>
            <span style={{ fontWeight: 700, color: "#4ade80" }}>
              ₹{totalPlannedMonthly.toLocaleString("en-IN")}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
            <span style={{ fontSize: 11, color: "var(--text-subtle)" }}>Projected yearly</span>
            <span style={{ fontSize: 11, color: "var(--text-soft)" }}>
              ₹{totalPlannedYearly.toLocaleString("en-IN")}
            </span>
          </div>
          <div style={{ fontSize: 10, color: "var(--text-subtle)", marginTop: 6, fontStyle: "italic" }}>
            ⚠️ Planned amounts only — no real bank transfer occurs.
          </div>
        </div>
      )}

      <SavingsAutomationModal
        open={modalOpen}
        mode={mode}
        initial={modalInitial}
        loading={submitting}
        errorMessage={errorMessage}
        onClose={close}
        onSubmit={submit}
      />
    </div>
  );
};

export default AutomationsPanel;

