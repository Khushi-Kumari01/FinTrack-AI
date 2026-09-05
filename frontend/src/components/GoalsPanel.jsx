import React, { forwardRef, useImperativeHandle, useMemo, useState } from "react";
import { api } from "../api/client";
import GoalModal from "./GoalModal";

const formatINR = (n) => {
  const num = Number(n || 0);
  return `₹${num.toLocaleString()}`;
};

const computePct = (current, target) => {
  const t = Number(target || 0);
  const c = Number(current || 0);
  if (t <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((c / t) * 100)));
};

const GoalsPanel = forwardRef(function GoalsPanel({ goals = [], onGoalsChange }, ref) {
  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState("create"); // create | edit
  const [modalInitial, setModalInitial] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const hasGoals = (goals || []).length > 0;

  useImperativeHandle(ref, () => ({
    // Open the existing create flow pre-filled with a suggested goal.
    openCreateWithPrefill: (prefill) => {
      setErrorMessage("");
      setMode("create");
      setModalInitial(prefill || null);
      setModalOpen(true);
    },
  }));

  const emptyState = useMemo(() => {
    if (hasGoals) return null;
    return (
      <div
        style={{
          border: "1px dashed rgba(148,163,184,0.35)",
          borderRadius: 14,
          padding: 16,
          background: "rgba(15,23,42,0.25)",
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 800 }}>No goals yet</div>
        <div style={{ fontSize: 12, color: "var(--text-soft)", marginTop: 6 }}>
          Set a target and track your progress over time.
        </div>
        <div style={{ marginTop: 12 }}>
          <div style={{ color: "var(--text-soft)", fontSize: 12 }}>
            <span style={{ opacity: 0.9 }}>Tip:</span> Set a target and a start amount.
          </div>
        </div>
      </div>
    );
  }, [hasGoals]);

  const openCreate = () => {
    setErrorMessage("");
    setMode("create");
    setModalInitial(null);
    setModalOpen(true);
  };

  const openEdit = (g) => {
    setErrorMessage("");
    setMode("edit");
    setModalInitial(g);
    setModalOpen(true);
  };

  const close = () => {
    if (submitting) return;
    setModalOpen(false);
  };

  const refresh = async () => {
    try {

      const res = await api.get("/goals");
      onGoalsChange?.(res.data || []);
    } catch (e) {
      // Keep silent; UI already shows error on operation.
      console.error("Failed to refresh goals", e);
    }
  };

  // Map backend Goal schema -> UI schema expected by this card
  // GoalModal expects: title, targetAmount, currentAmount, deadline, category, description
  // Keep BOTH aliased names so both GoalModal (uses targetAmount) and the card render
  // (uses target) work from the same object without an extra mapping step.
  const internalGoals = (goals || []).map((g) => ({
    id: g._id || g.id,
    _id: g._id || g.id,          // keep _id for delete/edit lookup
    label: g.title,
    title: g.title,
    // Aliased for card render
    target: Number(g.targetAmount || 0),
    current: Number(g.currentAmount || 0),
    // Canonical names expected by GoalModal
    targetAmount: Number(g.targetAmount || 0),
    currentAmount: Number(g.currentAmount || 0),
    deadline: g.deadline,
    category: g.category,
    description: g.description,
    raw: g,
  }));

  const submit = async (payload) => {
    setSubmitting(true);
    setErrorMessage("");
    try {
      if (mode === "create") {
        await api.post("/goals", payload);
      } else {
        const goalId = modalInitial._id || modalInitial.id;
        if (!goalId) throw new Error("Cannot update goal: missing ID");
        await api.patch(`/goals/${goalId}`, payload);
      }
      setModalOpen(false);
      await refresh();
    } catch (err) {
      console.error(err);
      const msg = err?.response?.data?.message || "Failed to save goal.";
      setErrorMessage(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="card card-fill">
      <div className="card-header">
        <div>
          <div className="card-title">Goals</div>
          <div style={{ fontSize: 12, color: "var(--text-soft)" }}>
            Set and track your financial goals
          </div>
        </div>
        <button
          className="btn-ghost btn"
          style={{ fontSize: 11 }}
          onClick={openCreate}
          type="button"
        >
          + New Goal
        </button>
      </div>

      <div className="grid" style={{ gap: 10, alignItems: "start" }}>
        {!hasGoals ? (
          <div style={{ gridColumn: "1 / -1" }}>
            {emptyState}
          </div>
        ) : (
          internalGoals.map((g) => {
            const pct = computePct(g.current, g.target);
            // Actual progress — may exceed 100% when current > target
            const actualPct = g.target > 0 ? Math.round((g.current / g.target) * 100) : 0;
            const isAchieved = g.target > 0 && g.current >= g.target;
            const isOverTargetBy = isAchieved ? g.current - g.target : 0;

            // Deadline status
            const deadlineDate = g.deadline ? new Date(g.deadline) : null;
            const deadlineStr = deadlineDate
              ? deadlineDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
              : "—";
            const now = new Date();
            now.setHours(0, 0, 0, 0);
            const deadlinePassed = deadlineDate && deadlineDate < now;
            const daysToDeadline = deadlineDate
              ? Math.round((deadlineDate.getTime() - now.getTime()) / 86400000)
              : null;

            return (
              <div key={g.id || g._id} style={{ width: "100%" }}>
                <div
                  style={{
                    fontSize: 12,
                    marginBottom: 4,
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 10,
                  }}
                >
                  <span
                    style={{
                      fontWeight: 700,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      maxWidth: 220,
                    }}
                    title={g.title || g.label || ""}
                  >
                    {g.title || g.label}
                  </span>
                  <span style={{ color: isAchieved ? "#22c55e" : "var(--text-soft)", fontWeight: isAchieved ? 700 : 400 }}>
                    {isAchieved ? `✅ ${actualPct}%` : `${pct}%`}
                  </span>
                </div>


                <div
                  style={{
                    height: 8,
                    borderRadius: 999,
                    background: "rgba(148,163,184,0.18)",   /* visible track at any % */
                    overflow: "hidden",
                    border: "1px solid rgba(148,163,184,0.12)",
                  }}
                >
                  <div
                    style={{
                      width: `${pct}%`,
                      height: "100%",
                      borderRadius: 999,
                      background:
                        pct >= 100
                          ? "linear-gradient(90deg,#22c55e,#4ade80)"
                          : pct >= 50
                          ? "linear-gradient(90deg,#38bdf8,#22c55e)"
                          : "linear-gradient(90deg,#f97316,#facc15)",
                      transition: "width 300ms ease",
                      minWidth: pct > 0 ? 4 : 0,  /* always show a sliver when > 0% */
                    }}
                  />
                </div>

                <div
                  style={{
                    fontSize: 11,
                    color: "var(--text-subtle)",
                    marginTop: 8,
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 10,
                  }}
                >
                  <span>
                    Target: {formatINR(g.target)}
                    <span style={{ color: "var(--text-soft)" }}> • Current: {formatINR(g.current)}</span>
                    {isAchieved && isOverTargetBy > 0 && (
                      <span style={{ color: "#22c55e", marginLeft: 4 }}>
                        (+{formatINR(isOverTargetBy)} above target)
                      </span>
                    )}
                  </span>
                </div>

                <div style={{ fontSize: 11, color: "var(--text-subtle)", marginTop: 4, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                  <span>Category: {g.category || "Savings"}</span>
                  <span>•</span>
                  {isAchieved ? (
                    <span style={{ color: "#22c55e", fontWeight: 700 }}>🎉 Goal Achieved</span>
                  ) : deadlinePassed ? (
                    <span style={{ color: "#f97373", fontWeight: 700 }}>
                      ⚠️ Overdue — was due {deadlineStr}
                    </span>
                  ) : deadlineDate ? (
                    <span>
                      Deadline: {deadlineStr}
                      {daysToDeadline !== null && daysToDeadline <= 30 && daysToDeadline > 0 && (
                        <span style={{ color: "#fbbf24", marginLeft: 4 }}>({daysToDeadline}d left)</span>
                      )}
                      {daysToDeadline === 0 && (
                        <span style={{ color: "#f97316", marginLeft: 4, fontWeight: 700 }}>(Due today)</span>
                      )}
                    </span>
                  ) : (
                    <span>Deadline: —</span>
                  )}
                </div>

<div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                  <button
                    type="button"
                    onClick={() => openEdit(g)}
                    aria-label="Edit goal"
                    title="Edit goal"
                    style={{
                      width: 30,
                      height: 30,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "rgba(56,189,248,0.12)",
                      border: "1px solid rgba(56,189,248,0.35)",
                      color: "#7dd3fc",
                      borderRadius: 999,
                      cursor: "pointer",
                      fontSize: 13,
                      transition: "all 0.16s ease",
                    }}
                  >
                    ✏️
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      setSubmitting(true);
                      setErrorMessage("");
                      try {
                        await api.delete(`/goals/${g._id || g.id}`);
                        await refresh();
                      } catch (err) {
                        console.error(err);
                        setErrorMessage(err?.response?.data?.message || "Failed to delete goal.");
                      } finally {
                        setSubmitting(false);
                      }
                    }}
                    disabled={submitting}
                    aria-label="Delete goal"
                    title="Delete goal"
                    style={{
                      width: 30,
                      height: 30,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "rgba(244,63,94,0.12)",
                      border: "1px solid rgba(244,63,94,0.35)",
                      color: "#fda4af",
                      borderRadius: 999,
                      cursor: "pointer",
                      fontSize: 13,
                      opacity: submitting ? 0.6 : 1,
                      transition: "all 0.16s ease",
                    }}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

<GoalModal
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
});

export default GoalsPanel;

