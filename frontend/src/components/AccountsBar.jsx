// src/components/AccountsBar.jsx
import React from "react";

const AccountsBar = ({ accounts, activeId, onChange }) => {
  return (
    <div
      className="card"
      style={{ padding: "10px 12px", marginBottom: 10, borderRadius: 14 }}
    >
      <div
        style={{
          fontSize: 11,
          color: "var(--text-subtle)",
          marginBottom: 6,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
        }}
      >
        Linked accounts
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {accounts.map((acc) => (
          <button
            key={acc.id}
            type="button"
            onClick={() => onChange(acc.id)}
            className="btn-ghost btn"
            style={{
              fontSize: 11,
              padding: "4px 10px",
              borderColor:
                acc.id === activeId ? "rgba(34,197,94,0.6)" : "var(--border-subtle)",
              background:
                acc.id === activeId
                  ? "rgba(34,197,94,0.16)"
                  : "rgba(15,23,42,0.85)",
            }}
          >
{acc.bank} • {acc.masked}
          </button>
        ))}
      </div>
    </div>
  );
};

export default AccountsBar;
