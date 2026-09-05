// backend/controllers/transactionController.js
import Transaction from "../models/Transaction.js";
import { runAgentPipeline } from "../utils/agentRunner.js";
import { categorize } from "../services/categorizer.js";

export const addTransaction = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      amount,
      category,
      merchant,
      date,
      channel,
      rawText,
      status,
      type,
    } = req.body;

    if (amount == null || !date) {
      return res.status(400).json({ message: "Amount and date required" });
    }

    // Auto-categorize if category is missing, unspecified, or placeholder
    const finalCategory =
      !category ||
      category === "Uncategorized" ||
      category === "Voice Added" ||
      category === "" ||
      category === "Others"
        ? categorize({ merchant: merchant || "", transcript: rawText || "" }).category
        : category;

    // Derive the correct transaction type.
    // Rule: if the category is a known income category the type MUST be "income",
    // regardless of what the frontend sent.  This guards against callers (e.g. Voice
    // Add) that hardcode type="expense" even for income-category transactions.
    const INCOME_CATS = new Set([
      "income", "salary", "freelance", "freelance payment", "stipend", "bonus",
      "refund", "cashback", "credit", "deposit", "interest", "dividend",
      "payout", "commission", "consulting", "wages", "payroll",
    ]);
    const catLower = (finalCategory || "").toLowerCase().trim();
    const resolvedType = INCOME_CATS.has(catLower)
      ? "income"
      : (type === "income" ? "income" : "expense");

    const tx = await Transaction.create({
      userId,
      amount,
      category: finalCategory,
      merchant,
      type: resolvedType,
      date: new Date(date),
      channel,
      rawText,
      status,
    });

    const token = req.headers.authorization?.split(" ")[1] || "";
    if (token) {
      runAgentPipeline({ userToken: token, goal: "Refresh spending insights for the latest transaction" });
    }

    res.status(201).json(tx);
  } catch (err) {
    console.error("addTransaction error", err);
    res.status(500).json({ message: "Failed to add transaction" });
  }
};

export const getTransactions = async (req, res) => {
  try {
    const userId = req.user._id;
    const { from, to, limit = 100 } = req.query;

    const query = { userId };
    if (from || to) {
      query.date = {};
      if (from) query.date.$gte = new Date(from);
      if (to) query.date.$lte = new Date(to);
    }

    const txs = await Transaction.find(query)
      .sort({ date: -1 })
      .limit(Number(limit));

    res.json(txs);
  } catch (err) {
    console.error("getTransactions error", err);
    res.status(500).json({ message: "Failed to fetch transactions" });
  }
};

export const deleteTransaction = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const deleted = await Transaction.findOneAndDelete({
      _id: id,
      userId
    });

    if (!deleted) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    res.json({ message: "Transaction deleted" });
  } catch (err) {
    console.error("deleteTransaction error", err);
    res.status(500).json({ message: "Failed to delete transaction" });
  }
};

export const updateTransaction = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;
    const { merchant, amount, category, date, type } = req.body;

    if (!merchant || merchant.trim().length === 0) {
      return res.status(400).json({ message: "Merchant name is required" });
    }

    // Accept any finite, non-negative amount (including income credits stored as positive numbers).
    // Zero amounts are rejected — a ₹0 transaction has no financial meaning.
    if (amount == null || !Number.isFinite(Number(amount)) || Number(amount) <= 0) {
      return res.status(400).json({ message: "Amount must be a positive number" });
    }

    const updated = await Transaction.findOneAndUpdate(
      { _id: id, userId },
      {
        merchant: merchant.trim(),
        amount: Number(amount),
        category: category || "Uncategorized",
        type: type || "expense",
        date: date ? new Date(date) : new Date(),
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    res.json(updated);
  } catch (err) {
    console.error("updateTransaction error", err);
    res.status(500).json({ message: "Failed to update transaction" });
  }
};
