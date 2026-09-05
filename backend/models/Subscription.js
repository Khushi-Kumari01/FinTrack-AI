import mongoose from "mongoose";

const subscriptionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true },
    amount: { type: Number, required: true },
    frequency: { type: String, enum: ["Daily", "Weekly", "Monthly", "Yearly"], default: "Monthly" },
    lastUsed: { type: Date },
    nextBillingDate: { type: Date },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    category: { type: String, default: "Subscriptions" },
  },
  { timestamps: true }
);

export default mongoose.model("Subscription", subscriptionSchema);
