import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

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

function toISODateValue(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export default function GoalModalInner({
  open,
  mode,
  initial,
  onClose,
  onSubmit,
  loading = false,
  errorMessage,
}) {
  const isEdit = mode === "edit";

  const categories = useMemo(
    () => [
      "Savings",
      "Emergency",
      "Education",
      "Home",
      "Retirement",
      "Investments",
      "Health",
      "Other",
    ],
    []
  );

  const [form, setForm] = useState({
    title: "",
    targetAmount: "",
    currentAmount: "",
    deadline: "",
    category: "Savings",
    description: "",
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
      targetAmount:
        initial?.targetAmount != null ? String(initial.targetAmount) : "",
      currentAmount:
        initial?.currentAmount != null ? String(initial.currentAmount) : "",
      deadline: toISODateValue(initial?.deadline),
      category: initial?.category ?? "Savings",
      description: initial?.description ?? "",
    });
  }, [open, initial]);

  const validation = useMemo(() => {
    const errors = {};

    const title = form.title?.trim();
    if (!title) errors.title = "Goal name is required.";

    const target = Number(form.targetAmount);
    if (!Number.isFinite(target) || target <= 0)
      errors.targetAmount =
        "Target amount must be a valid number greater than 0.";

    const current = Number(form.currentAmount);
    if (!Number.isFinite(current) || current < 0)
      errors.currentAmount =
        "Current saved amount must be a valid non-negative number.";

    if (form.deadline) {
      const d = new Date(form.deadline);
      if (Number.isNaN(d.getTime())) errors.deadline = "Invalid date.";
    }

    if (!form.category?.trim()) errors.category = "Category is required.";

    return errors;
  }, [form]);

  const canSubmit = Object.keys(validation).length === 0;

  const handleSubmit = (e) => {
    e.preventDefault();
    setTouched(true);
    if (!canSubmit) return;

    onSubmit({
      title: form.title.trim(),
      targetAmount: Number(form.targetAmount),
      currentAmount: Number(form.currentAmount),
      deadline: form.deadline ? new Date(form.deadline).toISOString() : null,
      category: form.category,
      description:
        form.description?.trim() ? form.description.trim() : undefined,
    });
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

  const modal = (
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
              <div style={{ fontSize: 16, fontWeight: 800 }}>
                {isEdit ? "Edit Goal" : "New Goal"}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-soft)", marginTop: 4 }}>
                {isEdit
                  ? "Update details and track your progress."
                  : "Create a goal and start tracking progress."}
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
          <label style={labelStyle}>Goal name</label>
          <input
            style={inputStyle}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            onBlur={() => setTouched(true)}
            placeholder="e.g. Emergency fund"
          />
          {touched && validation.title && (
            <div style={{ color: "#fb7185", fontSize: 12 }}>{validation.title}</div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Target amount</label>
              <input
                type="number"
                step="0.01"
                style={inputStyle}
                value={form.targetAmount}
                onChange={(e) => setForm({ ...form, targetAmount: e.target.value })}
                onBlur={() => setTouched(true)}
                placeholder="e.g. 100000"
              />
              {touched && validation.targetAmount && (
                <div style={{ color: "#fb7185", fontSize: 12 }}>
                  {validation.targetAmount}
                </div>
              )}
            </div>

            <div>
              <label style={labelStyle}>Current saved amount</label>
              <input
                type="number"
                step="0.01"
                style={inputStyle}
                value={form.currentAmount}
                onChange={(e) =>
                  setForm({ ...form, currentAmount: e.target.value })
                }
                onBlur={() => setTouched(true)}
                placeholder="e.g. 25000"
              />
              {touched && validation.currentAmount && (
                <div style={{ color: "#fb7185", fontSize: 12 }}>
                  {validation.currentAmount}
                </div>
              )}
            </div>
          </div>

          <label style={labelStyle}>Target date (optional)</label>
          <input
            type="date"
            style={inputStyle}
            value={form.deadline}
            onChange={(e) => setForm({ ...form, deadline: e.target.value })}
            onBlur={() => setTouched(true)}
          />
          {touched && validation.deadline && (
            <div style={{ color: "#fb7185", fontSize: 12 }}>{validation.deadline}</div>
          )}

          <label style={labelStyle}>Category</label>
          <select
            style={inputStyle}
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            onBlur={() => setTouched(true)}
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {touched && validation.category && (
            <div style={{ color: "#fb7185", fontSize: 12 }}>{validation.category}</div>
          )}

          <label style={labelStyle}>Notes (optional)</label>
          <textarea
            style={{ ...inputStyle, minHeight: 110, resize: "vertical" }}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Add any notes about this goal..."
          />

          {errorMessage && (
            <div style={{ marginTop: 10, color: "#fb7185", fontSize: 12 }}>
              {errorMessage}
            </div>
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
  );

  return createPortal(modal, document.body);
}

