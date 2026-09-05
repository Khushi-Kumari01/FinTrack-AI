// src/components/SubscriptionsPanel.jsx
import React, { useState } from "react";
import { api } from "../api/client";

const inputStyle = {
  width: "100%", padding: "8px 10px", margin: "6px 0",
  backgroundColor: "var(--bg-elevated-soft)", border: "1px solid var(--border-subtle)",
  color: "var(--text)", borderRadius: 8, fontSize: 13, boxSizing: "border-box",
};

const FREQUENCIES = ["Daily", "Weekly", "Monthly", "Yearly"];

const SubscriptionsPanel = ({ subs, onSubsChange }) => {
  // Add form state
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", amount: "", frequency: "Monthly" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Edit state — which subscription is being edited inline
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", amount: "", frequency: "Monthly" });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  const hasSubs = Array.isArray(subs) && subs.length > 0;

  // ── Add ──────────────────────────────────────────────────────────────
  const handleAdd = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) { setError("Name is required."); return; }
    const amt = parseFloat(form.amount);
    if (!Number.isFinite(amt) || amt <= 0) { setError("Enter a valid amount."); return; }

    setSaving(true);
    try {
      const res = await api.post("/subscriptions", {
        name: form.name.trim(),
        amount: amt,
        frequency: form.frequency,
        category: "Subscriptions",
      });
      if (onSubsChange) {
        onSubsChange((prev) => [
          ...(prev || []),
          {
            id: res.data._id?.toString(),
            _id: res.data._id,
            name: res.data.name,
            amount: Number(res.data.amount),
            frequency: res.data.frequency || "Monthly",
            lastUsed: res.data.lastUsed ? new Date(res.data.lastUsed).toLocaleDateString("en-IN") : "—",
          },
        ]);
      }
      setForm({ name: "", amount: "", frequency: "Monthly" });
      setShowForm(false);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to add subscription.");
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────
  const handleDelete = async (sub) => {
    const id = sub._id || sub.id;
    try {
      await api.delete(`/subscriptions/${id}`);
      if (onSubsChange) {
        onSubsChange((prev) => (prev || []).filter((s) => (s._id || s.id) !== id));
      }
    } catch (err) {
      console.error("Delete subscription error:", err);
    }
  };

  // ── Open Edit ─────────────────────────────────────────────────────────
  const openEdit = (sub) => {
    setEditId(sub._id || sub.id);
    setEditForm({
      name: sub.name || "",
      amount: String(sub.amount || ""),
      frequency: sub.frequency || "Monthly",
    });
    setEditError("");
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditError("");
  };

  // ── Save Edit ─────────────────────────────────────────────────────────
  const handleEditSave = async (e, sub) => {
    e.preventDefault();
    setEditError("");
    if (!editForm.name.trim()) { setEditError("Name is required."); return; }
    const amt = parseFloat(editForm.amount);
    if (!Number.isFinite(amt) || amt <= 0) { setEditError("Enter a valid amount."); return; }

    const id = sub._id || sub.id;
    setEditSaving(true);
    try {
      const res = await api.patch(`/subscriptions/${id}`, {
        name: editForm.name.trim(),
        amount: amt,
        frequency: editForm.frequency,
      });
      if (onSubsChange) {
        onSubsChange((prev) =>
          (prev || []).map((s) =>
            (s._id || s.id) === id
              ? { ...s, name: res.data.name, amount: Number(res.data.amount), frequency: res.data.frequency || "Monthly" }
              : s
          )
        );
      }
      setEditId(null);
    } catch (err) {
      setEditError(err?.response?.data?.message || "Failed to update subscription.");
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <div className="card subs-card">
      <div className="card-header">
        <div>
          <div className="card-title">Subscriptions</div>
          <div style={{ fontSize: 12, color: "var(--text-soft)" }}>Spot recurring charges</div>
        </div>
        <button
          className="btn-ghost btn"
          style={{ fontSize: 11 }}
          onClick={() => { setShowForm((s) => !s); setError(""); }}
          type="button"
        >
          {showForm ? "✕ Cancel" : "+ Add"}
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <form onSubmit={handleAdd} style={{ marginBottom: 12, padding: "12px", background: "rgba(15,23,42,0.6)", borderRadius: 10, border: "1px solid var(--border-subtle)" }}>
          {error && <div style={{ color: "#ef4444", fontSize: 12, marginBottom: 6 }}>{error}</div>}
          <input
            style={inputStyle}
            placeholder="Service name (e.g. Netflix)"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <input
            style={inputStyle}
            type="number"
            placeholder="Amount (₹)"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            min="1"
            step="0.01"
            required
          />
          <select
            style={inputStyle}
            value={form.frequency}
            onChange={(e) => setForm({ ...form, frequency: e.target.value })}
          >
            {FREQUENCIES.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          <button
            type="submit"
            disabled={saving}
            style={{ marginTop: 10, width: "100%", padding: "9px", borderRadius: 8, border: "none", background: "#00d084", color: "#000", fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}
          >
            {saving ? "Saving…" : "Save Subscription"}
          </button>
        </form>
      )}

      {/* List */}
      {!hasSubs ? (
        <div className="empty-state" style={{ flex: 1 }}>
          <div className="empty-state-icon">🔁</div>
          <div className="empty-state-title">No subscriptions tracked</div>
          <p className="empty-state-text">Add recurring services to monitor them and avoid unnoticed charges.</p>
        </div>
      ) : (
        <div className="grid card-scroll" style={{ gap: 8 }}>
          {subs.map((s) => {
            const id = s._id || s.id;
            const isEditing = editId === id;

            return (
              <div
                key={id}
                style={{ fontSize: 12, padding: "8px 10px", borderRadius: 12, background: "rgba(15,23,42,0.9)", border: "1px solid var(--border-subtle)" }}
              >
                {isEditing ? (
                  /* ── Inline Edit Form ── */
                  <form onSubmit={(e) => handleEditSave(e, s)}>
                    {editError && <div style={{ color: "#ef4444", fontSize: 11, marginBottom: 6 }}>{editError}</div>}
                    <input
                      style={{ ...inputStyle, margin: "4px 0" }}
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      placeholder="Service name"
                      required
                    />
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                      <input
                        style={{ ...inputStyle, margin: "4px 0" }}
                        type="number"
                        value={editForm.amount}
                        onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                        placeholder="Amount (₹)"
                        min="1"
                        step="0.01"
                        required
                      />
                      <select
                        style={{ ...inputStyle, margin: "4px 0" }}
                        value={editForm.frequency}
                        onChange={(e) => setEditForm({ ...editForm, frequency: e.target.value })}
                      >
                        {FREQUENCIES.map((f) => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </div>
                    <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                      <button
                        type="submit"
                        disabled={editSaving}
                        style={{ flex: 1, padding: "7px", borderRadius: 8, border: "none", background: "#00d084", color: "#000", fontWeight: 700, cursor: editSaving ? "not-allowed" : "pointer", opacity: editSaving ? 0.7 : 1, fontSize: 12 }}
                      >
                        {editSaving ? "Saving…" : "Save"}
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        style={{ flex: 1, padding: "7px", borderRadius: 8, border: "1px solid #444", background: "#333", color: "#fff", cursor: "pointer", fontSize: 12 }}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  /* ── Display Row ── */
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</div>
                      <div style={{ fontSize: 11, color: "var(--text-subtle)", marginTop: 1 }}>
                        {s.frequency} • Added {s.lastUsed}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 12, textAlign: "right" }}>
                        ₹{Number(s.monthlyAmount ?? s.amount).toLocaleString("en-IN")}
                        <span style={{ fontSize: 10, color: "var(--text-subtle)" }}>/mo</span>
                        {s.frequency !== "Monthly" && (
                          <div style={{ fontSize: 10, color: "var(--text-subtle)", fontWeight: 400 }}>
                            ₹{Number(s.amount).toLocaleString("en-IN")}/{(s.frequency || "Monthly").toLowerCase()}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => openEdit(s)}
                        style={{ background: "rgba(56,189,248,0.12)", border: "1px solid rgba(56,189,248,0.3)", color: "#7dd3fc", borderRadius: 6, cursor: "pointer", fontSize: 11, padding: "2px 7px" }}
                        title="Edit subscription"
                      >
                        ✏️
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(s)}
                        style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5", borderRadius: 6, cursor: "pointer", fontSize: 11, padding: "2px 7px" }}
                        title="Delete subscription"
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SubscriptionsPanel;
