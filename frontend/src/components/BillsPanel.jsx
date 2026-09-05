// src/components/BillsPanel.jsx
import React, { useState, useMemo } from "react";
import { api } from "../api/client";

const inputStyle = {
  width: "100%", padding: "8px 10px", margin: "6px 0",
  backgroundColor: "var(--bg-elevated-soft)", border: "1px solid var(--border-subtle)",
  color: "var(--text)", borderRadius: 8, fontSize: 13, boxSizing: "border-box",
};

// ─── Date helpers ──────────────────────────────────────────────────────────
// dueDate is stored as a string (e.g. "2026-08-20" or "20/08/2026").
// Parse it safely; return null if the string is empty or invalid.
const parseDueDate = (raw) => {
  if (!raw) return null;
  // Normalise dd/mm/yyyy → yyyy-mm-dd so Date() parses it correctly.
  const normalised = raw.includes("/")
    ? raw.split("/").reverse().join("-")   // "20/08/2026" → "2026-08-20"
    : raw;
  const d = new Date(normalised);
  return isNaN(d.getTime()) ? null : d;
};

/**
 * Given a stored due date and a frequency, return the NEXT upcoming due date
 * relative to today.  If the due date hasn't passed yet, return it as-is.
 * If it has passed, advance it by the recurrence period until it is >= today.
 *
 * This ensures a monthly bill stored as "21/08/2026" shows "21/09/2026" after
 * the August date passes, rather than being permanently overdue.
 */
const getEffectiveDueDate = (raw, frequency) => {
  const stored = parseDueDate(raw);
  if (!stored) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const freq = (frequency || "Monthly").toLowerCase();

  // One-time bills never advance — they stay as stored and can be overdue
  if (freq === "once" || freq === "one-time") return stored;

  // Advance the stored date until it is >= today
  let d = new Date(stored);
  let safetyLimit = 0; // prevent infinite loops on malformed data
  while (d < today && safetyLimit < 1000) {
    if (freq === "daily")        d.setDate(d.getDate() + 1);
    else if (freq === "weekly")  d.setDate(d.getDate() + 7);
    else if (freq === "yearly")  d.setFullYear(d.getFullYear() + 1);
    else                         d.setMonth(d.getMonth() + 1); // monthly (default)
    safetyLimit++;
  }
  return d;
};

const isOverdue = (dueDate) => {
  if (!dueDate) return false;
  const now = new Date();
  now.setHours(0, 0, 0, 0); // compare date-only
  return dueDate < now;
};

const fmtDue = (d) => {
  if (!d) return "No due date";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

// Days until due (negative = overdue)
const daysUntil = (dueDate) => {
  if (!dueDate) return Infinity;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((dueDate.getTime() - now.getTime()) / 86400000);
};

const BillsPanel = ({ bills, onBillsChange }) => {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", amount: "", dueDate: "", frequency: "Monthly", autoPay: false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const hasBills = Array.isArray(bills) && bills.length > 0;

  // ── Sort bills using the EFFECTIVE due date (advances past overdue recurrences).
  // One-time bills remain overdue; recurring bills advance to next occurrence.
  const sortedBills = useMemo(() => {
    if (!hasBills) return [];
    return [...bills].sort((a, b) => {
      const da = getEffectiveDueDate(a.due, a.frequency);
      const db = getEffectiveDueDate(b.due, b.frequency);
      // No date → always last
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return da.getTime() - db.getTime(); // ascending: overdue first, then soonest upcoming
    });
  }, [bills, hasBills]);

  const handleAdd = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) { setError("Name is required."); return; }
    const amt = parseFloat(form.amount);
    if (!Number.isFinite(amt) || amt <= 0) { setError("Enter a valid amount."); return; }

    setSaving(true);
    try {
      const res = await api.post("/bills", {
        name: form.name.trim(),
        amount: amt,
        dueDate: form.dueDate || "",
        autoPay: form.autoPay,
        frequency: form.frequency,
        category: "Bills",
      });
      if (onBillsChange) {
        onBillsChange((prev) => [
          ...(prev || []),
          {
            id: res.data._id?.toString(),
            _id: res.data._id,
            name: res.data.name,
            amount: Number(res.data.amount),
            due: res.data.dueDate || "",
            autoPay: !!res.data.autoPay,
            frequency: res.data.frequency || "Monthly",
          },
        ]);
      }
      setForm({ name: "", amount: "", dueDate: "", frequency: "Monthly", autoPay: false });
      setShowForm(false);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to add bill.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (bill) => {
    const id = bill._id || bill.id;
    try {
      await api.delete(`/bills/${id}`);
      if (onBillsChange) {
        onBillsChange((prev) => (prev || []).filter((b) => (b._id || b.id) !== id));
      }
    } catch (err) {
      console.error("Delete bill error:", err);
    }
  };

  return (
    <div className="card bills-card">
      <div className="card-header">
        <div>
          <div className="card-title">Upcoming bills</div>
          <div style={{ fontSize: 12, color: "var(--text-soft)" }}>Don't miss due dates</div>
        </div>
        <button
          className="btn-ghost btn"
          style={{ fontSize: 11 }}
          onClick={() => { setShowForm((s) => !s); setError(""); }}
          type="button"
        >
          {showForm ? "✕ Cancel" : "+ Add Bill"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} style={{ marginBottom: 12, padding: "12px", background: "rgba(15,23,42,0.6)", borderRadius: 10, border: "1px solid var(--border-subtle)" }}>
          {error && <div style={{ color: "#ef4444", fontSize: 12, marginBottom: 6 }}>{error}</div>}
          <input
            style={inputStyle}
            placeholder="Bill name (e.g. Airtel broadband)"
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
          <input
            style={inputStyle}
            type="date"
            value={form.dueDate}
            onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
          />
          <select
            style={inputStyle}
            value={form.frequency}
            onChange={(e) => setForm({ ...form, frequency: e.target.value })}
          >
            <option value="Monthly">Monthly</option>
            <option value="Weekly">Weekly</option>
            <option value="Yearly">Yearly</option>
            <option value="Once">One-time</option>
          </select>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-soft)", marginTop: 4 }}>
            <input
              type="checkbox"
              checked={form.autoPay}
              onChange={(e) => setForm({ ...form, autoPay: e.target.checked })}
            />
            Auto-pay enabled
          </label>
          <button
            type="submit"
            disabled={saving}
            style={{ marginTop: 10, width: "100%", padding: "9px", borderRadius: 8, border: "none", background: "#00d084", color: "#000", fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}
          >
            {saving ? "Saving…" : "Save Bill"}
          </button>
        </form>
      )}

      {!hasBills ? (
        <div className="empty-state" style={{ flex: 1 }}>
          <div className="empty-state-icon">📅</div>
          <div className="empty-state-title">No upcoming bills.</div>
          <p className="empty-state-text">Add recurring bills and never miss a due date.</p>
        </div>
      ) : (
        <div className="grid card-scroll" style={{ gap: 10 }}>
          {sortedBills.map((b) => {
            const dueDate = getEffectiveDueDate(b.due, b.frequency);
            const overdue = isOverdue(dueDate);
            const days = daysUntil(dueDate);
            const dueSoon = !overdue && days !== Infinity && days <= 7;
            const dueToday = days === 0;

            return (
              <div
                key={b._id || b.id}
                style={{
                  padding: 8, borderRadius: 12,
                  background: overdue ? "rgba(239,68,68,0.07)" : "rgba(15,23,42,0.85)",
                  border: `1px solid ${overdue ? "rgba(239,68,68,0.35)" : "var(--border-subtle)"}`,
                  fontSize: 12,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, alignItems: "center" }}>
                  <span style={{ fontWeight: 600 }}>{b.name}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontWeight: 500 }}>₹{Number(b.amount).toLocaleString("en-IN")}</span>
                    <button
                      type="button"
                      onClick={() => handleDelete(b)}
                      style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5", borderRadius: 6, cursor: "pointer", fontSize: 11, padding: "2px 7px" }}
                      title="Delete bill"
                    >
                      🗑
                    </button>
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-subtle)", alignItems: "center" }}>
                  <span>
                    {dueDate ? (
                      <>
                        {dueToday ? (
                          <span style={{ color: "#f97316", fontWeight: 700 }}>Due today</span>
                        ) : (
                          <>Due {fmtDue(dueDate)}</>
                        )}
                        {overdue && !dueToday && (
                          <span style={{
                            marginLeft: 6, padding: "1px 6px", borderRadius: 999,
                            background: "rgba(239,68,68,0.18)", color: "#f87171",
                            fontWeight: 700, fontSize: 10,
                          }}>
                            OVERDUE {Math.abs(days)}d
                          </span>
                        )}
                        {dueSoon && !overdue && !dueToday && (
                          <span style={{
                            marginLeft: 6, padding: "1px 6px", borderRadius: 999,
                            background: "rgba(245,158,11,0.18)", color: "#fbbf24",
                            fontWeight: 700, fontSize: 10,
                          }}>
                            DUE IN {days}d
                          </span>
                        )}
                      </>
                    ) : (
                      "No due date"
                    )}
                    {b.frequency ? ` • ${b.frequency}` : ""}
                  </span>
                  <span>{b.autoPay ? "Auto-pay ON" : "Manual"}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default BillsPanel;
