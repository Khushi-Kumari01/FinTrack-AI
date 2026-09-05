import mongoose from "mongoose";

const portfolioSummarySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    total: { type: Number, default: 0 },
    gainPct: { type: Number, default: 0 },
    breakdown: {
      type: [
        {
          label: { type: String, default: "" },
          percent: { type: Number, default: 0 },
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

export default mongoose.model("PortfolioSummary", portfolioSummarySchema);

