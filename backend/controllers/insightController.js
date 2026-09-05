// backend/controllers/insightController.js
import Transaction from "../models/Transaction.js";
import { getSpendingInsights, generateRoast } from "../services/aiService.js";

export const getInsights = async (req, res) => {
  try {
    const userId = req.user._id;

    const { from, to } = req.query;
    const query = { userId };
    if (from || to) {
      query.date = {};
      if (from) query.date.$gte = new Date(from);
      if (to) query.date.$lte = new Date(to);
    }

    const transactions = await Transaction.find(query);
    const insights = getSpendingInsights(req.user, transactions);

    res.json(insights);
  } catch (err) {
    console.error("getInsights error", err);
    res.status(500).json({ message: "Failed to generate insights" });
  }
};

/**
 * GET /api/roast
 * Fetches the logged-in user's transactions from MongoDB in real-time,
 * computes personalized roast + suggestions from actual data.
 * No caching — every request hits MongoDB fresh.
 * Tracks last roast index to avoid immediate repetition.
 * No hardcoded/demo responses — every roast is data-driven.
 */
export const getRoast = async (req, res) => {
  try {
    const userId = req.user._id;

    const { from, to, lastIdx } = req.query;
    const query = { userId };
    if (from || to) {
      query.date = {};
      if (from) query.date.$gte = new Date(from);
      if (to) query.date.$lte = new Date(to);
    }

    // Fetch ALL transactions fresh from MongoDB every time — no caching
    // Sort by createdAt desc so the latest transaction is always first for roast priority
    const transactions = await Transaction.find(query).sort({ createdAt: -1 }).lean();
    // Fix: use Number(lastIdx) with an explicit NaN check instead of `parseInt || -1`.
    // `parseInt("0") || -1` evaluates to -1 because 0 is falsy — this caused the
    // roast to always reset to index 0 on every click after the first.
    const parsedIdx = parseInt(lastIdx, 10);
    const lastRoastIndex = Number.isFinite(parsedIdx) ? parsedIdx : -1;
    const result = generateRoast(transactions, lastRoastIndex);

    // Anti-cache headers to guarantee fresh data every click
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate, private, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Surrogate-Control': 'no-store',
      'X-Roast-Generated': new Date().toISOString(),
    });

    res.json(result);
  } catch (err) {
    console.error("getRoast error", err);
    res.status(500).json({ message: "Failed to generate roast" });
  }
};
