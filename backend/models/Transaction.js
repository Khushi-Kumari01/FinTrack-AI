// backend/models/Transaction.js
import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    amount: { type: Number, required: true },
    category: { type: String, default: "Uncategorized" },
    merchant: { type: String, default: "Unknown" },
    type: { type: String, enum: ["expense", "income"], default: "expense" },
    date: { type: Date, required: true },

    // From where the transaction came (UPI, Card, SMS parsed, Manual, etc.)
    channel: { type: String, default: "Manual" },

    // Raw text (e.g. original SMS line) if imported automatically
    rawText: { type: String },

    status: { type: String, default: "cleared" }
  },
  { timestamps: true }
);

const Transaction = mongoose.model("Transaction", transactionSchema);
export default Transaction;
