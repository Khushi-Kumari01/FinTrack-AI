// src/pages/AgentConsole.jsx
// Shows live evidence of the Python multi-agent pipeline execution.
// Data comes from GET /api/agent-log — the in-memory ring buffer filled
// by agentRunner.js when the Python subprocess writes to stdout/stderr.
import React, { useState, useEffect, useRef } from "react";
import { api } from "../api/client";

const PIPELINE_STEPS = [
  {
    agent: "PlannerAgent",
    role: "Goal decomposition",
    detail: "Receives a natural-language goal and maps it to a sequence of analysis steps (fetch transactions, get insights, detect anomalies, etc.).",
    color: "#38bdf8",
  },
  {
    agent: "AnalyzerAgent",
    role: "Data analysis",
    detail: "Executes the plan steps: fetches real transaction data from the FinTrack backend via BankTool, computes insights, detects spending patterns.",
    color: "#a855f7",
  },
  {
    agent: "ExecutorAgent",
    role: "Action dispatch",
    detail: "Acts on analyzer output: schedules recurring review reminders, logs anomaly alerts, and records the run to agent memory.",
    color: "#22c55e",
  },
];

const AgentConsole = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);

  const fetchLogs = async () => {
    try {
      const res = await api.get("/agent-log");
      setLogs(res.data || []);
      setError(null);
    } catch (err) {
      setError("Could not fetch agent logs — is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    // Poll every 5 seconds so new agent runs show up automatically
    intervalRef.current = setInterval(fetchLogs, 5000);
    return () => clearInterval(intervalRef.current);
  }, []);

  return (
    <div className="grid-2">
      {/* Left: Pipeline Architecture */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Multi-Agent Pipeline</div>
            <div style={{ fontSize: 12, color: "var(--text-soft)" }}>
              Triggered automatically after each transaction
            </div>
          </div>
          <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 999, background: "rgba(34,197,94,0.12)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.25)" }}>
            Live
          </span>
        </div>

        <ol style={{ paddingLeft: 18, fontSize: 12, margin: 0, display: "flex", flexDirection: "column", gap: 14 }}>
          {PIPELINE_STEPS.map((s, i) => (
            <li key={i} style={{ lineHeight: 1.5 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: s.color, flexShrink: 0, display: "inline-block" }} />
                <strong style={{ color: s.color }}>{s.agent}</strong>
                <span style={{ fontSize: 10, color: "var(--text-subtle)", padding: "1px 7px", borderRadius: 999, background: "rgba(148,163,184,0.1)", border: "1px solid var(--border-subtle)" }}>
                  {s.role}
                </span>
              </div>
              <div style={{ color: "var(--text-soft)", paddingLeft: 18 }}>{s.detail}</div>
            </li>
          ))}
        </ol>

        <div style={{ marginTop: 16, padding: "10px 12px", borderRadius: 10, background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.18)", fontSize: 11, color: "var(--text-soft)", lineHeight: 1.5 }}>
          <strong style={{ color: "#4ade80" }}>How it works:</strong> When you add a transaction via any method (manual, voice, receipt scan, PDF), the Node.js backend spawns <code>agent_main.py --goal "..."</code> as a detached subprocess. The agent authenticates against the API with your JWT, fetches your real financial data, runs analysis, and logs results here.
        </div>
      </div>

      {/* Right: Live Agent Log */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Agent execution log</div>
            <div style={{ fontSize: 12, color: "var(--text-soft)" }}>
              Live output from the Python pipeline (last 100 lines)
            </div>
          </div>
          <button
            className="btn-ghost btn"
            style={{ fontSize: 11 }}
            onClick={fetchLogs}
            type="button"
          >
            ↻ Refresh
          </button>
        </div>

        {loading && (
          <div style={{ color: "var(--text-subtle)", fontSize: 12, padding: "12px 0" }}>Loading logs…</div>
        )}

        {error && (
          <div style={{ color: "#ef4444", fontSize: 12, padding: "8px 12px", background: "rgba(239,68,68,0.08)", borderRadius: 8, border: "1px solid rgba(239,68,68,0.2)" }}>
            ⚠️ {error}
          </div>
        )}

        {!loading && !error && logs.length === 0 && (
          <div style={{ color: "var(--text-subtle)", fontSize: 12, padding: "16px 0", textAlign: "center" }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>🤖</div>
            No agent activity yet. Add a transaction to trigger the pipeline.
          </div>
        )}

        {logs.length > 0 && (
          <div
            style={{
              maxHeight: 340, overflowY: "auto", fontSize: 11,
              fontFamily: "monospace", display: "flex", flexDirection: "column", gap: 3,
              background: "rgba(0,0,0,0.2)", borderRadius: 8, padding: "10px 12px",
              border: "1px solid var(--border-subtle)",
            }}
          >
            {logs.slice().reverse().map((entry, i) => (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <span style={{ color: "var(--text-subtle)", flexShrink: 0, fontSize: 10 }}>
                  {entry.ts ? new Date(entry.ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : ""}
                </span>
                <span style={{ color: entry.line?.startsWith("ERROR") ? "#f87171" : "var(--text-soft)", wordBreak: "break-all" }}>
                  {entry.line}
                </span>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 8, fontSize: 10, color: "var(--text-subtle)" }}>
          Auto-refreshes every 5 seconds • Showing newest first
        </div>
      </div>
    </div>
  );
};

export default AgentConsole;
