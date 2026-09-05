// src/components/TransactionTable.jsx
import React, { useState } from "react";

const CONFIRM_DELETE_STYLE = {
  overlay: {
    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.7)", display: "flex",
    justifyContent: "center", alignItems: "center", zIndex: 3000,
  },
  box: {
    backgroundColor: "#1e1e1e", padding: "24px", borderRadius: "12px",
    maxWidth: "400px", width: "90%", border: "1px solid #444",
    color: "#fff", textAlign: "center",
  },
  btnRow: {
    display: "flex", gap: "12px", justifyContent: "center", marginTop: "20px",
  },
  cancel: {
    padding: "10px 24px", borderRadius: "8px", border: "1px solid #555",
    backgroundColor: "#333", color: "#fff", cursor: "pointer", fontWeight: "600",
  },
  confirm: {
    padding: "10px 24px", borderRadius: "8px", border: "none",
    backgroundColor: "#e74c3c", color: "#fff", cursor: "pointer", fontWeight: "700",
  },
};

const ACTION_BTN = {
  background: "none", border: "none", cursor: "pointer",
  fontSize: "14px", padding: "4px 8px", borderRadius: "4px",
  transition: "background 0.2s",
};

const TransactionTable = ({ rows, onEdit, onDelete }) => {
  const [deleteTarget, setDeleteTarget] = useState(null);

  const handleDeleteClick = (tx) => {
    setDeleteTarget(tx);
  };

  const handleConfirmDelete = () => {
    if (deleteTarget && onDelete) {
      onDelete(deleteTarget.id);
    }
    setDeleteTarget(null);
  };

  const hasRows = Array.isArray(rows) && rows.length > 0;

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">Recent transactions</div>
          <div style={{ fontSize: 12, color: "var(--text-soft)" }}>
            Latest activity across all accounts
          </div>
        </div>
      </div>

      {!hasRows ? (
        <div className="empty-state" style={{ flex: 1 }}>
          <div className="empty-state-icon">📭</div>
          <div className="empty-state-title">No transactions yet</div>
          <p className="empty-state-text">
            Add your first transaction via the “+ Add Transaction” button to see activity here.
          </p>
        </div>
      ) : (
<div className="table-scroll">
          <table className="table transaction-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Merchant</th>
                <th>Category</th>
                <th>Amount</th>
                <th>Channel</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((tx) => (
                <tr key={tx.id} className="transaction-row">
                  <td style={{ whiteSpace: "nowrap" }}>{tx.date}</td>
                  <td style={{ maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tx.merchant}</td>
                  <td>
                    <span className="badge badge-info" style={{ whiteSpace: "nowrap", display: "inline-block", maxWidth: "140px", overflow: "hidden", textOverflow: "ellipsis" }}>{tx.category}</span>
                  </td>
<td style={{ whiteSpace: "nowrap", color: tx.type === "income" ? "#22c55e" : "#f97373" }}>
                    {tx.type === "income" ? "+" : "-"}₹{Math.abs(tx.amount).toLocaleString()}
                  </td>
                  <td style={{ color: "var(--text-soft)" }}>{tx.channel}</td>
                  <td>
                    <span
                      className={
                        tx.status === "cleared"
                          ? "badge badge-success"
                          : "badge badge-warning"
                      }
                    >
                      {tx.status}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                      <button
                        onClick={() => onEdit && onEdit(tx)}
                        style={{ ...ACTION_BTN, color: "#f39c12" }}
                        title="Edit transaction"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDeleteClick(tx)}
                        style={{ ...ACTION_BTN, color: "#e74c3c" }}
                        title="Delete transaction"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteTarget && (
        <div style={CONFIRM_DELETE_STYLE.overlay} onClick={() => setDeleteTarget(null)}>
          <div style={CONFIRM_DELETE_STYLE.box} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: "40px", marginBottom: "12px" }}>🗑️</div>
            <h3 style={{ margin: "0 0 8px 0" }}>Delete Transaction</h3>
            <p style={{ color: "#aaa", margin: 0, fontSize: "14px" }}>
              Are you sure you want to delete this transaction?
            </p>
            <div style={{
              marginTop: "12px", padding: "10px", backgroundColor: "#2a2a2a",
              borderRadius: "8px", textAlign: "left", fontSize: "13px",
            }}>
<div style={{ color: deleteTarget.type === "income" ? "#22c55e" : "#f97373" }}>
                <strong>Merchant:</strong> {deleteTarget.merchant}
              </div>
              <div style={{ color: deleteTarget.type === "income" ? "#22c55e" : "#f97373" }}>
                <strong>Amount:</strong>{" "}
                {deleteTarget.type === "income" ? "+" : "-"}₹
                {Math.abs(deleteTarget.amount).toLocaleString()}
              </div>
              <div><strong>Category:</strong> {deleteTarget.category}</div>
            </div>
            <p style={{ color: "#e74c3c", fontSize: "12px", marginTop: "8px" }}>
              This action cannot be undone.
            </p>
            <div style={CONFIRM_DELETE_STYLE.btnRow}>
              <button onClick={() => setDeleteTarget(null)} style={CONFIRM_DELETE_STYLE.cancel}>
                Cancel
              </button>
              <button onClick={handleConfirmDelete} style={CONFIRM_DELETE_STYLE.confirm}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TransactionTable;

