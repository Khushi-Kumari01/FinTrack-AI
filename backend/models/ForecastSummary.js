import mongoose from "mongoose";

const forecastSummarySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    expected: { type: Number, default: 0 },
    delta: { type: Number, default: 0 },
    note: { type: String, default: "" },
  },
  { timestamps: true }
);

export default mongoose.model("ForecastSummary", forecastSummarySchema);

