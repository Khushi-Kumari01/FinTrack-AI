// backend/controllers/importController.js
import Transaction from "../models/Transaction.js";
import {
  parseCSVTransactions,
  parseSMSTransactions,
  parseUPITransactions
} from "../services/importParsers.js";

const INCOME_CATS_LOWER = new Set([
  "income", "salary", "freelance", "stipend", "bonus", "refund",
  "cashback", "credit", "deposit", "interest", "dividend",
  "payout", "commission", "consulting", "wages", "payroll",
]);

const bulkInsert = async (userId, txs, res) => {
  if (!txs || !Array.isArray(txs) || txs.length === 0) {
    return res.status(400).json({ message: "No transactions to import" });
  }

  const docs = txs.map((tx) => {
    // Preserve the type from the parser if provided; otherwise infer from
    // category keyword so income transactions are never stored as expenses.
    const catLower = (tx.category || "").toLowerCase().trim();
    const inferredType = INCOME_CATS_LOWER.has(catLower) ? "income" : "expense";
    const type = tx.type === "income" || tx.type === "expense"
      ? tx.type          // trust explicit type from parser
      : inferredType;    // fall back to category-based inference

    return {
      userId,
      amount: Math.abs(Number(tx.amount) || 0), // always store positive
      category: tx.category || "Uncategorized",
      merchant: tx.merchant || "Unknown",
      type,
      date: tx.date ? new Date(tx.date) : new Date(),
      channel: tx.channel || "Auto-import",
      rawText: tx.rawText || "",
      status: tx.status || "cleared",
    };
  });

  await Transaction.insertMany(docs);
  return res.json({ message: "Transactions imported", count: docs.length });
};

export const importFromCSV = async (req, res) => {
  try {
    const userId = req.user._id;
    const { csv } = req.body; // string or already parsed

    const txs = parseCSVTransactions(csv);
    await bulkInsert(userId, txs, res);
  } catch (err) {
    console.error("importFromCSV error", err);
    res.status(500).json({ message: "CSV import failed" });
  }
};

export const importFromSMS = async (req, res) => {
  try {
    const userId = req.user._id;
    const { messages } = req.body; // array of SMS text lines

    const txs = parseSMSTransactions(messages || []);
    await bulkInsert(userId, txs, res);
  } catch (err) {
    console.error("importFromSMS error", err);
    res.status(500).json({ message: "SMS import failed" });
  }
};

export const importFromUPI = async (req, res) => {
  try {
    const userId = req.user._id;
    const { upiRecords } = req.body; // array of UPI payloads

    const txs = parseUPITransactions(upiRecords || []);
    await bulkInsert(userId, txs, res);
  } catch (err) {
    console.error("importFromUPI error", err);
    res.status(500).json({ message: "UPI import failed" });
  }
};
