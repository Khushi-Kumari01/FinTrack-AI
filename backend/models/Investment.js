import mongoose from "mongoose";

/**
 * Investment — manual portfolio entry.
 * Users record investments themselves; no live market data is fetched.
 * gain/loss is calculated on read from (currentValue - amountInvested).
 */
const investmentSchema = new mongoose.Schema(
  {
    userId:        { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    name:          { type: String, required: true },           // e.g. "HDFC Mutual Fund"
    type:          {                                            // asset class
      type: String,
      enum: ["Mutual Fund", "Stocks", "Fixed Deposit", "Gold", "Real Estate", "Crypto", "PPF / EPF", "Bonds", "Other"],
      default: "Other",
    },
    amountInvested: { type: Number, required: true, min: 0 },  // what you put in
    currentValue:   { type: Number, required: true, min: 0 },  // today's value (manual entry)
    investedOn:     { type: Date, required: true },             // investment date
    notes:          { type: String, default: "" },
  },
  { timestamps: true }
);

export default mongoose.model("Investment", investmentSchema);
