import mongoose from "mongoose";

const budgetSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    category: { type: String, required: true },
    limit: { type: Number, required: true },
    period: { type: String, enum: ["monthly", "weekly", "yearly"], default: "monthly" },
    startDate: { type: Date, default: () => new Date() },
  },
  { timestamps: true }
);

export default mongoose.model("Budget", budgetSchema);
