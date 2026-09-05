import mongoose from "mongoose";

const goalSuggestionsSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    suggestions: {
      type: [
        {
          title: { type: String, default: "" },
          description: { type: String, default: "" },
          eta: { type: String, default: "" },
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

export default mongoose.model("GoalSuggestions", goalSuggestionsSchema);

