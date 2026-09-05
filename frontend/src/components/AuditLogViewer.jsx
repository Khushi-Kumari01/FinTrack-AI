// src/components/AuditLogViewer.jsx
import React from "react";

const AuditLogViewer = ({ events }) => {
  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">Agent events</div>
      </div>
      <div
        style={{
          maxHeight: 260,
          overflowY: "auto",
          fontSize: 12,
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        {events.map((e) => (
          <div key={e.id}>
            <span
              style={{
                fontFamily: "monospace",
                fontSize: 11,
                color: "var(--text-subtle)",
              }}
            >
              {e.timestamp}
            </span>{" "}
            <span>{e.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AuditLogViewer;
