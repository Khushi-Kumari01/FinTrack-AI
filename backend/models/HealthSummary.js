import mongoose from "mongoose";

const healthSummarySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    score: { type: Number, default: 0 },
    // Array of { emoji: string, text: string }
    summary: {
      type: [
        {
          emoji: { type: String, default: "" },
          text: { type: String, default: "" },
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

export default mongoose.model("HealthSummary", healthSummarySchema);

