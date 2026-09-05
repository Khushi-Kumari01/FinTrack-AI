import express from "express";
import { categorize } from "../services/categorizer.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

/**
 * POST /api/categorize
 *
 * Auto-categorize a transaction based on merchant name and/or speech transcript.
 * This is used by the Voice Add and Receipt Scan features to get the correct category
 * before saving to MongoDB.
 *
 * Request body:
 *   { merchant: "Uber", transcript: "Uber 6000" }
 *
 * Response:
 *   { category: "Transport", confidence: "high", method: "keyword" }
 */
router.post("/", authMiddleware, (req, res) => {
  try {
    const { merchant, transcript } = req.body;

    if (!merchant && !transcript) {
      return res.status(400).json({
        message: "Provide at least 'merchant' or 'transcript' for categorization.",
      });
    }

    const result = categorize({ merchant: merchant || "", transcript: transcript || "" });

    res.json(result);
  } catch (err) {
    console.error("categorize error:", err);
    res.status(500).json({ message: "Categorization failed" });
  }
});

export default router;

