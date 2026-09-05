import mongoose from "mongoose";

const billSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true },
    amount: { type: Number, required: true },
    dueDate: { type: String, default: "" },
    autoPay: { type: Boolean, default: false },
    category: { type: String, default: "Bills" },
    frequency: { type: String, enum: ["Monthly", "Weekly", "Yearly", "Once"], default: "Monthly" },
  },
  { timestamps: true }
);

export default mongoose.model("Bill", billSchema);
