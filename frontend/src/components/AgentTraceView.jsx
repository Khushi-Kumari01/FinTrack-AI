// src/components/AgentTraceView.jsx
import React from "react";

const AgentTraceView = ({ steps }) => {
  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">Agent reasoning trace</div>
      </div>
      <ol style={{ paddingLeft: 18, fontSize: 12, margin: 0 }}>
        {steps.map((s, idx) => (
          <li key={idx} style={{ marginBottom: 6 }}>
            <strong>{s.name}:</strong> {s.detail}
          </li>
        ))}
      </ol>
    </div>
  );
};

export default AgentTraceView;
