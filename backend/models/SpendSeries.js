import mongoose from "mongoose";

const spendSeriesSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    series: {
      type: [
        {
          month: { type: String, default: "" },
          amount: { type: Number, default: 0 },
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

export default mongoose.model("SpendSeries", spendSeriesSchema);

