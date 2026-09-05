import Transaction from "../models/Transaction.js";

export const bulkInsertTransactions = async (user, txs) => {
  if (!Array.isArray(txs) || !txs.length) return 0;

  const docs = txs.map((t) => ({
    user: user._id,
    date: t.date ? new Date(t.date) : new Date(),
    merchant: t.merchant || "Unknown",
    category: t.category || "Uncategorized",
    amount: t.amount,
    type: t.type || (t.amount >= 0 ? "credit" : "debit"),
    status: t.status || "cleared"
  }));

  const result = await Transaction.insertMany(docs);
  return result.length;
};
