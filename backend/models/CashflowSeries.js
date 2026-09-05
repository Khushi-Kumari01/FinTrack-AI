import mongoose from "mongoose";

const cashflowSeriesSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    series: {
      type: [
        {
          day: { type: String, default: "" },
          inflow: { type: Number, default: 0 },
          outflow: { type: Number, default: 0 },
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

export default mongoose.model("CashflowSeries", cashflowSeriesSchema);

