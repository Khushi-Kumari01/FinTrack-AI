import mongoose from "mongoose";

const automationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    description: { type: String },
    type: {
      type: String,
      enum: [
        "savings-sweep",
        "budget-alert",
        "investment",
        "custom",
        "savings-fixed-amount",
        "savings-income-arrival",
        "savings-round-up",
        "savings-below-spending-limit",
      ],
      default: "savings-fixed-amount",
    },
    amount: { type: Number },
    frequency: { type: String, enum: ["daily", "weekly", "monthly"], default: "monthly" },
    enabled: { type: Boolean, default: true },
    lastRun: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model("Automation", automationSchema);
