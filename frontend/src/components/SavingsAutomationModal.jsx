import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

// Reuse the exact same modal visual style as GoalModal
const overlayStyle = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 9999,
  background: "rgba(0,0,0,0.6)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  padding: 12,
};

const modalStyle = {
  backgroundColor: "#1e1e1e",
  borderRadius: 12,
  padding: 20,
  width: 560,
  maxWidth: "600px",
  minWidth: 320,
  maxHeight: "90vh",
  overflowY: "auto",
  border: "1px solid #333",
  color: "#fff",
};

const inputStyle = {
  width: "100%",
  padding: "10px",
  margin: "8px 0",
  backgroundColor: "#2a2a2a",
  border: "1px solid #444",
  color: "white",
  borderRadius: 8,
};

const labelStyle = {
  fontSize: 12,
  color: "var(--text-soft)",
  marginTop: 10,
  marginBottom: 4,
};

const btnBase = {
  padding: "10px 16px",
  borderRadius: 8,
  cursor: "pointer",
  border: "none",
  fontWeight: "bold",
};

const ruleTypeOptions = [
  {
    value: "savings-fixed-amount",
    label: "Save fixed amount",
    help: "Daily / Weekly / Monthly",
  },
  {
    value: "savings-income-arrival",
    label: "Save when income arrives",
    help: "Move money automatically",
  },
  {
    value: "savings-round-up",
    label: "Round-up spare change",
    help: "Save the change from purchases",
  },
  {
    value: "savings-below-spending-limit",
    label: "Save if spending is below a limit",
    help: "Monthly spending cap",
  },
];

function toISODateValue(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export default function SavingsAutomationModal({
  open,
  mode,
  initial,
  onClose,
  onSubmit,
  loading = false,
  errorMessage,
}) {
  const isEdit = mode === "edit";
  const [form, setForm] = useState({
    title: "",
    description: "",
    type: "savings-fixed-amount",
    enabled: true,
    amount: "",
    frequency: "monthly",
    limit: "",
  });

  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setTouched(false);

    setForm({
      title: initial?.title ?? "",
      description: initial?.description ?? "",
      type: initial?.type ?? "savings-fixed-amount",
      enabled: typeof initial?.enabled === "boolean" ? initial.enabled : true,
      amount: initial?.amount != null ? String(initial.amount) : "",
      frequency: initial?.frequency ?? "monthly",
      limit: initial?.limit != null ? String(initial.limit) : "",
    });
  }, [open, initial]);

  const validation = useMemo(() => {
    const errors = {};

    const title = (form.title || "").trim();
    if (!title) errors.title = "Rule name is required.";

    if (form.type === "savings-fixed-amount") {
      const a = Number(form.amount);
      if (!Number.isFinite(a) || a < 0) errors.amount = "Amount must be a valid non-negative number.";

      if (!["daily", "weekly", "monthly"].includes(form.frequency))
        errors.frequency = "Frequency is required.";
    }

    if (form.type === "savings-below-spending-limit") {
      const l = Number(form.limit);
      if (!Number.isFinite(l) || l < 0) errors.limit = "Spending limit must be a valid non-negative number.";

      if (!["daily", "weekly", "monthly"].includes(form.frequency))
        errors.frequency = "Frequency is required.";
    }

    // For other types, amount/limit are optional and ignored.
    return errors;
  }, [form]);

  const canSubmit = Object.keys(validation).length === 0;

  const handleSubmit = (e) => {
    e.preventDefault();
    setTouched(true);
    if (!canSubmit) return;

    const payload = {
      title: form.title.trim(),
      description: form.description?.trim() ? form.description.trim() : "",
      type: form.type,
      enabled: !!form.enabled,
    };

    if (form.type === "savings-fixed-amount") {
      payload.amount = Number(form.amount);
      payload.frequency = form.frequency;
    }

    if (form.type === "savings-below-spending-limit") {
      payload.limit = Number(form.limit);
      payload.frequency = form.frequency;
    }

    if (form.type === "savings-income-arrival") {
      // Keep frequency in payload so backend can store a valid enum if needed.
      payload.frequency = form.frequency || "monthly";
      // Optional percentage: if provided, store as amount (e.g. 20 = 20% of income)
      const pct = Number(form.amount);
      if (Number.isFinite(pct) && pct > 0 && pct <= 100) {
        payload.amount = pct;
      }
    }

    if (form.type === "savings-round-up") {
      // nothing extra
    }

    onSubmit(payload);
  };

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    createPortal(
      (
        <div style={overlayStyle} onMouseDown={onClose}>
          <div style={modalStyle} onMouseDown={(e) => e.stopPropagation()}>
            <div
              style={{
                position: "sticky",
                top: 0,
                background: "#1e1e1e",
                paddingBottom: 10,
                zIndex: 1,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800 }}>{isEdit ? "Edit Rule" : "New Rule"}</div>
                  <div style={{ fontSize: 12, color: "var(--text-soft)", marginTop: 4 }}>
                    {isEdit ? "Update your automation details." : "Create an automation rule to save automatically."}
                  </div>
                </div>
                <button
                  type="button"
                  style={{
                    ...btnBase,
                    background: "transparent",
                    border: "1px solid #444",
                    color: "#fff",
                    padding: "6px 10px",
                  }}
                  onClick={onClose}
                  disabled={loading}
                >
                  ✕
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} style={{ paddingBottom: 8 }}>
              <label style={labelStyle}>Rule name</label>
              <input
                style={inputStyle}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                onBlur={() => setTouched(true)}
                placeholder="e.g. Daily fixed savings"
              />
              {touched && validation.title && <div style={{ color: "#fb7185", fontSize: 12 }}>{validation.title}</div>}

              <label style={labelStyle}>Rule type</label>
              <select
                style={inputStyle}
                value={form.type}
                onChange={(e) =>
                  setForm({
                    ...form,
                    type: e.target.value,
                    // keep existing values; only required fields will be validated
                    frequency:
                      e.target.value === "savings-below-spending-limit" || e.target.value === "savings-fixed-amount"
                        ? form.frequency || "monthly"
                        : form.frequency || "monthly",
                  })
                }
                onBlur={() => setTouched(true)}
              >
                {ruleTypeOptions.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>

              {form.type === "savings-fixed-amount" && (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <label style={labelStyle}>Amount</label>
                      <input
                        type="number"
                        step="0.01"
                        style={inputStyle}
                        value={form.amount}
                        onChange={(e) => setForm({ ...form, amount: e.target.value })}
                        onBlur={() => setTouched(true)}
                        placeholder="e.g. 500"
                      />
                      {touched && validation.amount && <div style={{ color: "#fb7185", fontSize: 12 }}>{validation.amount}</div>}
                    </div>
                    <div>
                      <label style={labelStyle}>Frequency</label>
                      <select
                        style={inputStyle}
                        value={form.frequency}
                        onChange={(e) => setForm({ ...form, frequency: e.target.value })}
                        onBlur={() => setTouched(true)}
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                      {touched && validation.frequency && (
                        <div style={{ color: "#fb7185", fontSize: 12 }}>{validation.frequency}</div>
                      )}
                    </div>
                  </div>
                </>
              )}



      {form.type === "savings-income-arrival" && (
                <>
                  <label style={labelStyle}>Save percentage of income (optional)</label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <input
                        type="number"
                        step="1"
                        min="1"
                        max="100"
                        style={inputStyle}
                        value={form.amount}
                        onChange={(e) => setForm({ ...form, amount: e.target.value })}
                        placeholder="e.g. 20 (= 20%)"
                      />
                      <div style={{ fontSize: 10, color: "var(--text-subtle)", marginTop: 4 }}>
                        Leave blank to trigger manually
                      </div>
                    </div>
                    <div>
                      <select
                        style={inputStyle}
                        value={form.frequency}
                        onChange={(e) => setForm({ ...form, frequency: e.target.value })}
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              {form.type === "savings-round-up" && (
                <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-soft)" }}>
                  This rule rounds up spare change automatically.
                </div>
              )}

              {form.type === "savings-below-spending-limit" && (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <label style={labelStyle}>Monthly spending limit</label>
                      <input
                        type="number"
                        step="0.01"
                        style={inputStyle}
                        value={form.limit}
                        onChange={(e) => setForm({ ...form, limit: e.target.value })}
                        onBlur={() => setTouched(true)}
                        placeholder="e.g. 30000"
                      />
                      {touched && validation.limit && <div style={{ color: "#fb7185", fontSize: 12 }}>{validation.limit}</div>}
                    </div>
                    <div>
                      <label style={labelStyle}>Frequency</label>
                      <select
                        style={inputStyle}
                        value={form.frequency}
                        onChange={(e) => setForm({ ...form, frequency: e.target.value })}
                        onBlur={() => setTouched(true)}
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                      {touched && validation.frequency && (
                        <div style={{ color: "#fb7185", fontSize: 12 }}>{validation.frequency}</div>
                      )}
                    </div>
                  </div>
                </>
              )}

              <label style={labelStyle}>Description (optional)</label>
              <textarea
                style={{ ...inputStyle, minHeight: 95, resize: "vertical" }}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Add a short note..."
              />

              <label style={labelStyle}>Enabled</label>
              <select
                style={inputStyle}
                value={form.enabled ? "true" : "false"}
                onChange={(e) => setForm({ ...form, enabled: e.target.value === "true" })}
              >
                <option value="true">On</option>
                <option value="false">Off</option>
              </select>

              {errorMessage && (
                <div style={{ marginTop: 10, color: "#fb7185", fontSize: 12 }}>{errorMessage}</div>
              )}

              <div
                style={{
                  position: "sticky",
                  bottom: 0,
                  background: "#1e1e1e",
                  paddingTop: 12,
                  paddingBottom: 6,
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  zIndex: 1,
                }}
              >
                <button
                  type="button"
                  style={{
                    ...btnBase,
                    background: "#333",
                    color: "#fff",
                    opacity: loading ? 0.7 : 1,
                    flex: 1,
                  }}
                  onClick={onClose}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    ...btnBase,
                    background: "#00d084",
                    color: "#000",
                    opacity: loading ? 0.7 : 1,
                    flex: 1,
                  }}
                  disabled={loading}
                >
                  {loading ? "Saving..." : isEdit ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ),
      document.body
    )
  );
}

