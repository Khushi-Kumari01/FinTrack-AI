// src/components/GoalSuggestionsCard.jsx
import React, { useState, useEffect } from "react";

const formatINR = (n) => {
  const num = Number(n || 0);
  return `₹${num.toLocaleString()}`;
};

const GoalSuggestionsCard = ({ suggestions, onAddGoal }) => {
  const hasSuggestions = Array.isArray(suggestions) && suggestions.length > 0;

  // Track which suggestion id currently has its modal open.
  // Prevents duplicate goal creation from repeated clicks on the same button.
  const [pendingId, setPendingId] = useState(null);

  // When the suggestions list refreshes (dashboard re-fetches after a goal is
  // created), clear the pending state so buttons are re-enabled.
  useEffect(() => {
    setPendingId(null);
  }, [suggestions]);

  const handleAddGoal = (g) => {
    if (pendingId === g.id) return; // already pending, ignore
    setPendingId(g.id);
    if (onAddGoal) {
      onAddGoal({
        title: g.title,
        targetAmount: g.targetAmount,
        currentAmount: g.currentAmount || 0,
        category: g.category || "Savings",
        description: g.description,
        deadline: g.deadline,
      });
    }
    // Safety fallback: re-enable after 8 s in case the modal is dismissed
    // without creating a goal (user clicks Cancel) — the suggestions list
    // won't re-fetch in that case, so we must re-enable manually.
    setTimeout(() => setPendingId((prev) => (prev === g.id ? null : prev)), 8000);
  };

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">Smart goal ideas</div>
          <div style={{ fontSize: 12, color: "var(--text-soft)" }}>
            Based on your cashflow and spend habits
          </div>
        </div>
      </div>

      {!hasSuggestions ? (
        <div className="empty-state">
          <div className="empty-state-icon">🎯</div>
          <div className="empty-state-title">Not enough data yet</div>
          <p className="empty-state-text">
            Add transactions to unlock personalized savings ideas.
          </p>
        </div>
      ) : (
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            fontSize: 12,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {suggestions.map((g) => {
            const isPending = pendingId === g.id;
            const hasTarget = g.targetAmount != null && Number(g.targetAmount) > 0;

            return (
              <li
                key={g.id}
                style={{
                  padding: 10,
                  borderRadius: 12,
                  // Use CSS variables so the card follows the theme in both
                  // dark mode (dark background) and light mode (white background).
                  background: "var(--bg-elevated-soft)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <strong style={{ color: "var(--text)", fontSize: 13 }}>{g.title}</strong>
                <div style={{ color: "var(--text-soft)", marginTop: 2, fontSize: 12 }}>
                  {g.description}
                </div>
                <div
                  style={{
                    marginTop: 6,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <div style={{ fontSize: 11, color: "var(--accent-strong)", fontWeight: 600 }}>
                    {hasTarget && (
                      <span>
                        Target: {formatINR(g.targetAmount)}
                        {g.eta ? ` • ${g.eta}` : ""}
                      </span>
                    )}
                    {g.targetAmount != null && !hasTarget
                      ? "Target: — (needs more data)"
                      : ""}
                    {g.targetAmount == null && g.eta ? `ETA: ${g.eta}` : ""}
                  </div>

                  {hasTarget ? (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleAddGoal(g)}
                      style={{
                        background: isPending
                          ? "var(--bg-elevated-soft)"
                          : "var(--accent-soft)",
                        border: `1px solid ${isPending ? "var(--border-subtle)" : "var(--accent)"}`,
                        color: isPending ? "var(--text-subtle)" : "var(--accent-strong)",
                        padding: "5px 10px",
                        borderRadius: 8,
                        cursor: isPending ? "not-allowed" : "pointer",
                        fontSize: 11,
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                        opacity: isPending ? 0.6 : 1,
                        transition: "opacity 0.15s, background 0.15s",
                      }}
                    >
                      {isPending ? "Opening…" : "+ Add Goal"}
                    </button>
                  ) : (
                    <span
                      style={{
                        fontSize: 11,
                        color: "var(--text-subtle)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Waiting for more history
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default GoalSuggestionsCard;
