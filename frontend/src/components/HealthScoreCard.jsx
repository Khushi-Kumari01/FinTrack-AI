import React from "react";

const HealthScoreCard = ({ score, summary }) => {
  const numeric = Number(score) || 0;
  const color =
    numeric >= 80 ? "#22c55e" : numeric >= 60 ? "#facc15" : "#f97373";

  const label = numeric >= 80 ? "Strong" : numeric >= 60 ? "Fair" : "Needs Attention";

  // Summary can be an array of {emoji, text} objects, or a flat object/array of strings
  const raw = Array.isArray(summary) ? summary : summary ? [summary] : [];
  const lines = raw.map((l) => {
    if (typeof l === "string") return { emoji: "•", text: l };
    return { emoji: l?.emoji || "•", text: l?.text || "" };
  }).filter((l) => l.text);

  return (
    <div className="card card-fill" style={{ display: "flex", flexDirection: "column" }}>
      <div className="card-header">
        <div>
          <div className="card-title">Financial health</div>
          <div style={{ fontSize: 12, color: "var(--text-soft)" }}>
            Savings, volatility &amp; runway
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 20,
          flex: 1,
        }}
      >
        {/* Large score circle */}
        <div
          style={{
            width: 92,
            height: 92,
            minWidth: 92,
            borderRadius: "50%",
            border: `5px solid ${color}`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            boxShadow: `0 0 22px ${color}44`,
          }}
        >
          <span style={{ fontSize: 30, fontWeight: 700, lineHeight: 1 }}>
            {numeric}
          </span>
          <span
            style={{
              fontSize: 8.5,
              fontWeight: 600,
              color: color,
              marginTop: 3,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {label}
          </span>
        </div>

        {/* Supporting metrics in a column */}
        <div
          style={{
            fontSize: 12,
            display: "flex",
            flexDirection: "column",
            gap: 7,
            flex: 1,
            minWidth: 0,
          }}
        >
          {lines.length > 0 ? (
            lines.slice(0, 4).map((line, idx) => (
              <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                <span style={{ flexShrink: 0 }}>{line.emoji}</span>
                <span
                  style={{
                    color: "var(--text-soft)",
                    lineHeight: 1.4,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {line.text}
                </span>
              </div>
            ))
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span>📊</span>
                <span style={{ color: "var(--text-subtle)" }}>
                  Track spending to see health data
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span>🎯</span>
                <span style={{ color: "var(--text-subtle)" }}>
                  Add transactions for a full score
                </span>
              </div>
            </>
          )}

          {/* Support bar indicator */}
          <div
            style={{
              marginTop: "auto",
              paddingTop: 8,
              display: "flex",
              gap: 6,
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontSize: 10,
                padding: "3px 9px",
                borderRadius: 999,
                background: "rgba(34,197,94,0.12)",
                color: "#22c55e",
              }}
            >
              💰 Savings
            </span>
            <span
              style={{
                fontSize: 10,
                padding: "3px 9px",
                borderRadius: 999,
                background: "rgba(56,189,248,0.12)",
                color: "#38bdf8",
              }}
            >
              📈 Volatility
            </span>
            <span
              style={{
                fontSize: 10,
                padding: "3px 9px",
                borderRadius: 999,
                background: "rgba(168,85,247,0.12)",
                color: "#a855f7",
              }}
            >
              🏃 Runway
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HealthScoreCard;

