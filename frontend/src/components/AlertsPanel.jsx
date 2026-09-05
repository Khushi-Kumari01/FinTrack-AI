// src/components/AlertsPanel.jsx
import React from "react";

/**
 * Smart Nudges card.
 * Renders data-driven insights generated from the user's actual transactions.
 * No fake/static numbers — nudges come directly from getSpendingInsights().
 */
const AlertsPanel = ({ alerts }) => {
  const nudgeCount = alerts?.length || 0;

  return (
    <div className="card card-fill" style={{ display: "flex", flexDirection: "column" }}>
      <div className="card-header">
        <div>
          <div className="card-title">Smart nudges</div>
          <div style={{ fontSize: 12, color: "var(--text-soft)" }}>
            Personalized insights based on your spending trends
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          marginTop: 4,
          flex: 1,
        }}
      >
        {nudgeCount === 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              gap: 8,
              padding: "24px 12px",
              border: "1px dashed rgba(148,163,184,0.25)",
              borderRadius: 14,
              color: "var(--text-soft)",
            }}
          >
            <div style={{ fontSize: 30 }}>💡</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
              Add transactions to see insights here
            </div>
            <div style={{ fontSize: 12 }}>
              The system will surface savings ideas, spending risks, and nudges
              based on your actual financial activity.
            </div>
          </div>
        ) : (
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              fontSize: 12,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {alerts.map((a) => (
              <li
                key={a.id}
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "flex-start",
                  padding: "10px 12px",
                  borderRadius: 12,
                  background: "rgba(15,23,42,0.55)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <span style={{ flexShrink: 0, marginTop: 1 }}>•</span>
                <span style={{ flex: 1, lineHeight: 1.5 }}>
                  {a.text}{" "}
                  {a.highlight && (
                    <strong style={{ color: "var(--accent-strong)" }}>
                      {a.highlight}
                    </strong>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default AlertsPanel;

