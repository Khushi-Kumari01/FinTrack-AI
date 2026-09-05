import mongoose from "mongoose";

const goalSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    targetAmount: { type: Number, required: true },
    currentAmount: { type: Number, default: 0 },
    deadline: { type: Date },
    category: { type: String, default: "Savings" },
    description: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model("Goal", goalSchema);
