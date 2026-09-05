// src/components/PortfolioCard.jsx
// Manual investment portfolio tracker.
// Users record their own holdings; no live market data is fetched.
// Clearly labelled as a manual tracker throughout.
import React, { useState, useEffect, useCallback } from "react";
import { api } from "../api/client";

// ─── Investment type options ──────────────────────────────────────────────
const INVESTMENT_TYPES = [
  "Mutual Fund",
  "Stocks",
  "Fixed Deposit",
  "Gold",
  "Real Estate",
  "Crypto",
  "PPF / EPF",
  "Bonds",
  "Other",
];

const TYPE_ICONS = {
  "Mutual Fund": "📊",
  Stocks: "📈",
  "Fixed Deposit": "🏦",
  Gold: "🥇",
  "Real Estate": "🏠",
  Crypto: "₿",
  "PPF / EPF": "🛡️",
  Bonds: "📄",
  Other: "💼",
};

// ─── Helpers ──────────────────────────────────────────────────────────────
const fmtINR = (v) => {
  const n = Number(v) || 0;
  if (Math.abs(n) >= 1_00_000) return `₹${(n / 1_00_000).toFixed(2)}L`;
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
};

const fmtDate = (v) => {
  if (!v) return "—";
  return new Date(v).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const toDateInput = (v) => {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
};

// ─── Empty form factory ───────────────────────────────────────────────────
const emptyForm = () => ({
  name: "",
  type: "Mutual Fund",
  amountInvested: "",
  currentValue: "",
  investedOn: new Date().toISOString().slice(0, 10),
  notes: "",
});

// ─── Inline input style (matches existing card inputs) ────────────────────
const inputStyle = {
  width: "100%",
  padding: "8px 10px",
  margin: "5px 0",
  backgroundColor: "var(--bg-elevated-soft)",
  border: "1px solid var(--border-subtle)",
  color: "var(--text)",
  borderRadius: 8,
  fontSize: 13,
  boxSizing: "border-box",
};

// ─── Add / Edit Modal ─────────────────────────────────────────────────────
function InvestmentModal({ mode, initial, onSave, onClose, saving, error }) {
  const [form, setForm] = useState(initial || emptyForm());

  // Keep form in sync when initial changes (edit opens with existing data)
  useEffect(() => {
    setForm(initial || emptyForm());
  }, [initial]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  const overlayStyle = {
    position: "fixed", inset: 0, zIndex: 5000,
    background: "rgba(0,0,0,0.65)", display: "flex",
    justifyContent: "center", alignItems: "center", padding: 16,
  };
  const modalStyle = {
    backgroundColor: "#1e1e1e", borderRadius: 12, padding: 20,
    width: "min(480px, 96vw)", maxHeight: "90vh", overflowY: "auto",
    border: "1px solid #333", color: "#fff",
  };

  return (
    <div style={overlayStyle} onMouseDown={onClose}>
      <div style={modalStyle} onMouseDown={(e) => e.stopPropagation()}>
        <h3 style={{ margin: "0 0 16px 0", fontSize: 15, fontWeight: 800 }}>
          {mode === "edit" ? "✏️ Edit Investment" : "➕ Add Investment"}
        </h3>
        {error && (
          <div style={{ color: "#ef4444", fontSize: 12, marginBottom: 10, padding: "8px 10px", background: "rgba(239,68,68,0.1)", borderRadius: 8 }}>
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <label style={{ fontSize: 11, color: "var(--text-soft)" }}>Investment name *</label>
          <input style={inputStyle} value={form.name} onChange={(e) => set("name", e.target.value)}
            placeholder="e.g. HDFC Top 100 Fund" required />

          <label style={{ fontSize: 11, color: "var(--text-soft)", marginTop: 6, display: "block" }}>Type</label>
          <select style={inputStyle} value={form.type} onChange={(e) => set("type", e.target.value)}>
            {INVESTMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 2 }}>
            <div>
              <label style={{ fontSize: 11, color: "var(--text-soft)" }}>Amount invested (₹) *</label>
              <input style={inputStyle} type="number" min="0" step="0.01"
                value={form.amountInvested} onChange={(e) => set("amountInvested", e.target.value)}
                placeholder="e.g. 50000" required />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--text-soft)" }}>Current value (₹) *</label>
              <input style={inputStyle} type="number" min="0" step="0.01"
                value={form.currentValue} onChange={(e) => set("currentValue", e.target.value)}
                placeholder="e.g. 58000" required />
            </div>
          </div>

          <label style={{ fontSize: 11, color: "var(--text-soft)", marginTop: 6, display: "block" }}>Investment date *</label>
          <input style={inputStyle} type="date" value={form.investedOn}
            onChange={(e) => set("investedOn", e.target.value)} required />

          <label style={{ fontSize: 11, color: "var(--text-soft)", marginTop: 6, display: "block" }}>Notes (optional)</label>
          <textarea style={{ ...inputStyle, minHeight: 64, resize: "vertical" }}
            value={form.notes} onChange={(e) => set("notes", e.target.value)}
            placeholder="e.g. SIP started, growth fund" />

          <div style={{ fontSize: 11, color: "var(--text-subtle)", marginTop: 8, fontStyle: "italic" }}>
            ⚠️ Manual tracker only — enter values yourself. No live market data.
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <button type="button" onClick={onClose}
              style={{ flex: 1, padding: "9px", borderRadius: 8, border: "1px solid #444", background: "#333", color: "#fff", cursor: "pointer", fontWeight: 700 }}>
              Cancel
            </button>
            <button type="submit" disabled={saving}
              style={{ flex: 1, padding: "9px", borderRadius: 8, border: "none", background: saving ? "#555" : "#00d084", color: "#000", cursor: saving ? "not-allowed" : "pointer", fontWeight: 700 }}>
              {saving ? "Saving…" : mode === "edit" ? "Update" : "Add Investment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────
const PortfolioCard = () => {
  const [investments, setInvestments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal state
  const [modalMode, setModalMode] = useState(null);   // null | "add" | "edit"
  const [editTarget, setEditTarget] = useState(null); // investment object being edited
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // ── Fetch ───────────────────────────────────────────────────────────
  const fetchInvestments = useCallback(async () => {
    try {
      const res = await api.get("/investments");
      setInvestments(res.data || []);
      setError(null);
    } catch (err) {
      console.error("fetchInvestments error", err);
      setError("Failed to load investments.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchInvestments(); }, [fetchInvestments]);

  // ── Aggregate totals ─────────────────────────────────────────────────
  const totalInvested    = investments.reduce((s, i) => s + (Number(i.amountInvested) || 0), 0);
  const totalCurrentVal  = investments.reduce((s, i) => s + (Number(i.currentValue) || 0), 0);
  const totalGainLoss    = totalCurrentVal - totalInvested;
  const gainLossPct      = totalInvested > 0
    ? ((totalGainLoss / totalInvested) * 100)
    : 0;
  const isGain = totalGainLoss >= 0;

  // ── CRUD handlers ────────────────────────────────────────────────────
  const handleSave = async (form) => {
    setSaving(true);
    setFormError("");
    try {
      const payload = {
        name: form.name,
        type: form.type,
        amountInvested: Number(form.amountInvested),
        currentValue: Number(form.currentValue),
        investedOn: form.investedOn,
        notes: form.notes,
      };

      if (modalMode === "edit" && editTarget) {
        await api.patch(`/investments/${editTarget._id}`, payload);
      } else {
        await api.post("/investments", payload);
      }

      setModalMode(null);
      setEditTarget(null);
      await fetchInvestments();
    } catch (err) {
      setFormError(err?.response?.data?.message || "Failed to save. Please check all fields.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (inv) => {
    try {
      await api.delete(`/investments/${inv._id}`);
      setInvestments((prev) => prev.filter((i) => i._id !== inv._id));
    } catch (err) {
      console.error("deleteInvestment error", err);
    }
  };

  const openEdit = (inv) => {
    setFormError("");
    setEditTarget(inv);
    setModalMode("edit");
  };

  const closeModal = () => {
    if (saving) return;
    setModalMode(null);
    setEditTarget(null);
    setFormError("");
  };

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <>
      {/* Modal */}
      {modalMode && (
        <InvestmentModal
          mode={modalMode}
          initial={modalMode === "edit" && editTarget ? {
            name: editTarget.name,
            type: editTarget.type || "Other",
            amountInvested: String(editTarget.amountInvested ?? ""),
            currentValue: String(editTarget.currentValue ?? ""),
            investedOn: toDateInput(editTarget.investedOn),
            notes: editTarget.notes || "",
          } : undefined}
          onSave={handleSave}
          onClose={closeModal}
          saving={saving}
          error={formError}
        />
      )}

      <div className="card">
        {/* Header */}
        <div className="card-header">
          <div>
            <div className="card-title">Investments</div>
            <div style={{ fontSize: 12, color: "var(--text-soft)" }}>
              Manual portfolio tracker
            </div>
          </div>
          <button
            className="btn-ghost btn"
            style={{ fontSize: 11 }}
            onClick={() => { setFormError(""); setModalMode("add"); }}
            type="button"
          >
            + Add
          </button>
        </div>

        {/* Loading / error */}
        {loading && (
          <div style={{ fontSize: 12, color: "var(--text-subtle)", padding: "8px 0" }}>Loading…</div>
        )}
        {error && !loading && (
          <div style={{ fontSize: 12, color: "#ef4444", padding: "8px 0" }}>{error}</div>
        )}

        {/* Empty state */}
        {!loading && !error && investments.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">📈</div>
            <div className="empty-state-title">No investments yet</div>
            <p className="empty-state-text">
              Track your mutual funds, stocks, FDs, gold, and more manually.
            </p>
            <button
              onClick={() => { setFormError(""); setModalMode("add"); }}
              style={{ marginTop: 10, padding: "8px 18px", borderRadius: 8, border: "none", background: "#00d084", color: "#000", cursor: "pointer", fontWeight: 700, fontSize: 12 }}
            >
              + Start Tracking
            </button>
          </div>
        )}

        {/* Summary row */}
        {!loading && investments.length > 0 && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
              <div style={{ fontSize: 11 }}>
                <div style={{ color: "var(--text-subtle)", marginBottom: 2 }}>Invested</div>
                <div style={{ fontWeight: 700, color: "var(--text)" }}>{fmtINR(totalInvested)}</div>
              </div>
              <div style={{ fontSize: 11 }}>
                <div style={{ color: "var(--text-subtle)", marginBottom: 2 }}>Current</div>
                <div style={{ fontWeight: 700, color: "var(--text)" }}>{fmtINR(totalCurrentVal)}</div>
              </div>
              <div style={{ fontSize: 11 }}>
                <div style={{ color: "var(--text-subtle)", marginBottom: 2 }}>Gain / Loss</div>
                <div style={{ fontWeight: 700, color: isGain ? "#22c55e" : "#f97373" }}>
                  {isGain ? "+" : "−"}{fmtINR(Math.abs(totalGainLoss))}
                  {totalInvested > 0 && (
                    <span style={{ fontSize: 10, marginLeft: 4 }}>
                      ({isGain ? "+" : "−"}{Math.abs(gainLossPct).toFixed(1)}%)
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Individual investment rows */}
            <div className="card-scroll" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {investments.map((inv) => {
                const gl = (Number(inv.currentValue) || 0) - (Number(inv.amountInvested) || 0);
                const glPct = inv.amountInvested > 0 ? (gl / inv.amountInvested) * 100 : 0;
                const pos = gl >= 0;
                return (
                  <div
                    key={inv._id}
                    style={{ padding: "9px 10px", borderRadius: 10, background: "rgba(15,23,42,0.85)", border: "1px solid var(--border-subtle)", fontSize: 12 }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {TYPE_ICONS[inv.type] || "💼"} {inv.name}
                        </div>
                        <div style={{ color: "var(--text-subtle)", fontSize: 11, marginTop: 2 }}>
                          {inv.type} · {fmtDate(inv.investedOn)}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        <button
                          onClick={() => openEdit(inv)}
                          style={{ background: "rgba(56,189,248,0.12)", border: "1px solid rgba(56,189,248,0.3)", color: "#7dd3fc", borderRadius: 6, cursor: "pointer", fontSize: 11, padding: "2px 7px" }}
                          title="Edit"
                        >✏️</button>
                        <button
                          onClick={() => handleDelete(inv)}
                          style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5", borderRadius: 6, cursor: "pointer", fontSize: 11, padding: "2px 7px" }}
                          title="Delete"
                        >🗑</button>
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginTop: 8 }}>
                      <div>
                        <div style={{ fontSize: 10, color: "var(--text-subtle)" }}>Invested</div>
                        <div style={{ fontWeight: 600 }}>{fmtINR(inv.amountInvested)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: "var(--text-subtle)" }}>Current</div>
                        <div style={{ fontWeight: 600 }}>{fmtINR(inv.currentValue)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: "var(--text-subtle)" }}>P&amp;L</div>
                        <div style={{ fontWeight: 700, color: pos ? "#22c55e" : "#f97373" }}>
                          {pos ? "+" : "−"}{fmtINR(Math.abs(gl))}
                          {inv.amountInvested > 0 && (
                            <span style={{ fontSize: 9, marginLeft: 3 }}>
                              ({pos ? "+" : "−"}{Math.abs(glPct).toFixed(1)}%)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {inv.notes && (
                      <div style={{ fontSize: 11, color: "var(--text-subtle)", marginTop: 6, fontStyle: "italic" }}>
                        {inv.notes}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ fontSize: 10, color: "var(--text-subtle)", marginTop: 10, fontStyle: "italic" }}>
              ⚠️ Manual tracker — values entered by you. No live market data.
            </div>
          </>
        )}
      </div>
    </>
  );
};

export default PortfolioCard;
