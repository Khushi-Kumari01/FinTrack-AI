/**
 * AI Budget Recommender for FinTrack
 *
 * Analyzes real transaction data to generate smart monthly budget limits
 * per spending category. Uses statistical methods (average, percentile)
 * rather than fixed rules — adapts to each user's spending patterns.
 *
 * Key logic:
 * 1. Fetch expense transactions from the last N days (default: 90)
 * 2. Group by category, compute average monthly spend
 * 3. Recommend 90% of average as budget (encourages 10% reduction)
 * 4. For volatile categories (high day-to-day variance), recommend
 *    85% of the 75th percentile to be more conservative
 * 5. Exclude income categories — they should not have budgets
 * 6. Include categories the user spent in, plus known categories with
 *    $0 spend (to help them set proactive budgets)
 */

import Transaction from "../models/Transaction.js";
import { getAllCategories } from "./categorizer.js";

// ─── Constants ────────────────────────────────────────────────────────────

/** Categories that should never get a spending budget */
const INCOME_CATEGORIES = new Set([
  "Income", "Salary",
]);

/** Default lookback period for analyzing spend patterns */
const DEFAULT_LOOKBACK_DAYS = 90;

/**
 * Generate AI budget recommendations for a user.
 *
 * @param {string} userId - MongoDB ObjectId of the user
 * @param {Object} [options]
 * @param {number} [options.lookbackDays=90] - Days of transaction history to analyze
 * @param {number} [options.reductionFactor=0.9] - Fraction of avg spend to recommend (0-1)
 * @returns {Promise<Array<{ category, currentSpend, recommendedLimit, transactionCount, monthlyAvg, confidence, message }>>}
 */
export async function generateRecommendations(userId, options = {}) {
  const {
    lookbackDays = DEFAULT_LOOKBACK_DAYS,
    reductionFactor = 0.9,
  } = options;

  // ── 1. Fetch transactions ────────────────────────────────────────────
  const fromDate = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);

  const transactions = await Transaction.find({
    userId,
    date: { $gte: fromDate },
  }).sort({ date: 1 }).lean();

  // ── 2. Separate expense vs income ────────────────────────────────────
  const expenseTxs = transactions.filter((t) => {
    const cat = (t.category || "").toLowerCase().trim();
    if (INCOME_CATEGORIES.has(t.category)) return false;
    if (t.type === "income") return false;
    if (INCOME_CATEGORIES.has(cat)) return false;
    return true;
  });

  // ── 3. Calculate the actual day span for the window ─────────────────
  // Using calendar-month arithmetic (e.g. month-diff + 1) can count 4 months
  // for a 90-day window that crosses a month boundary, producing a monthly
  // average that is too low (₹2,000 / 4 = ₹500 instead of the correct
  // ₹2,000 / 90 * 30 ≈ ₹667).  Use the real elapsed days instead.
  const now = new Date();
  const daysInWindow = Math.max(
    1,
    Math.round((now.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000))
  );

  // ── 4. Group by category AND by calendar month ───────────────────────
  // We track both individual amounts (for percentile) and monthly totals
  // (for volatility). Volatility must be measured from month-to-month
  // variation, not from individual transaction amounts vs monthly average
  // (those are incomparable units and inflate CV with sparse data).
  const categoryMap = new Map(); // category -> { total, txCount, amounts[], monthlyTotals{} }

  for (const tx of expenseTxs) {
    const cat = tx.category || "Others";
    const amt = Math.abs(Number(tx.amount) || 0);
    // Month key for volatility bucketing (e.g. "2026-08")
    const d = new Date(tx.date);
    const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

    if (!categoryMap.has(cat)) {
      categoryMap.set(cat, { total: 0, txCount: 0, amounts: [], monthlyTotals: {} });
    }

    const entry = categoryMap.get(cat);
    entry.total += amt;
    entry.txCount += 1;
    entry.amounts.push(amt);
    entry.monthlyTotals[mKey] = (entry.monthlyTotals[mKey] || 0) + amt;
  }

  // ── 5. Build recommendations ─────────────────────────────────────────
  const recommendations = [];

  for (const [category, data] of categoryMap.entries()) {
    // monthlyAvg: normalise the raw window total to a 30-day equivalent.
    // Formula: (total_in_window / daysInWindow) * 30
    // Example: ₹2,000 over 90 days → (2000 / 90) * 30 = ₹666.67/month
    const monthlyAvg = (data.total / daysInWindow) * 30;

    // Sort amounts for percentile calculation
    data.amounts.sort((a, b) => a - b);
    const p75Index = Math.floor(data.amounts.length * 0.75);
    const p75Value = data.amounts[p75Index] || monthlyAvg;

    // ── Volatility: compare MONTHLY totals, not individual tx amounts ──
    // With only 1 transaction in the window, or all spend in one month,
    // CV would be artificially 0 or 2+ depending on the computation.
    // We need ≥ 2 calendar months with spending to make a meaningful
    // volatility assessment. If insufficient months, treat as stable.
    const monthlyTotalValues = Object.values(data.monthlyTotals || {});
    let isVolatile = false;

    if (monthlyTotalValues.length >= 2) {
      const mMean = monthlyTotalValues.reduce((s, v) => s + v, 0) / monthlyTotalValues.length;
      const mVariance = monthlyTotalValues.reduce((s, v) => s + Math.pow(v - mMean, 2), 0) / monthlyTotalValues.length;
      const mStdDev = Math.sqrt(mVariance);
      const mCV = mMean > 0 ? mStdDev / mMean : 0;
      isVolatile = mCV > 0.5; // >50% CV across months = genuinely volatile
    }
    // With 0 or 1 month of data, isVolatile stays false — use stable formula

    // Generate recommended limit
    let recommendedLimit;
    let confidence;
    let message;

    if (monthlyAvg <= 0) {
      recommendedLimit = 0;
      confidence = "low";
      message = "No recent spending in this category.";
    } else {
      // For volatile categories, use 75th percentile of MONTHLY TOTALS
      // (more conservative for high-variance months).
      // For stable categories, use reductionFactor of monthly average.
      if (isVolatile) {
        // p75 of monthly totals: sort monthly totals, take 75th percentile
        const sortedMonthlyTotals = [...monthlyTotalValues].sort((a, b) => a - b);
        const p75MonthIdx = Math.floor(sortedMonthlyTotals.length * 0.75);
        const p75Monthly = sortedMonthlyTotals[p75MonthIdx] || monthlyAvg;
        recommendedLimit = Math.round(p75Monthly * 0.85);
        confidence = "medium";
        message = `Volatile spending pattern. Budget based on 75th percentile of monthly totals.`;
      } else {
        recommendedLimit = Math.round(monthlyAvg * reductionFactor);
        confidence = "high";
        message = `Based on average monthly spend of ₹${Math.round(monthlyAvg).toLocaleString()}.`;
      }

      // Ensure minimum sensible limit of ₹100
      recommendedLimit = Math.max(100, recommendedLimit);
    }

    // windowSpend: raw total spent in the selected window (e.g. ₹2,005 over 90 days).
    // monthlyAvg:  normalised monthly rate (windowSpend / daysInWindow * 30).
    // The recommended limit is always a MONTHLY figure, so all comparisons
    // (% used, over/remaining) must use monthlyAvg vs recommendedLimit — never
    // windowSpend vs recommendedLimit, which would compare different time bases.
    const recentSpend = expenseTxs
      .filter((t) => (t.category || "Others") === category && new Date(t.date) >= fromDate)
      .reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0);

    const windowSpendRounded = Math.round(recentSpend);
    const monthlyAvgRounded = Math.round(monthlyAvg);

    recommendations.push({
      category,
      // windowSpend: the actual amount spent in the selected time window.
      windowSpend: windowSpendRounded,
      // currentSpend kept as alias = windowSpend so legacy code paths still work.
      currentSpend: windowSpendRounded,
      monthlyAvg: monthlyAvgRounded,
      recommendedLimit,
      transactionCount: data.txCount,
      confidence,
      message,
      isVolatile,
    });
  }

  // ── 6. Include known categories with zero spend ──────────────────────
  const allKnownCategories = getAllCategories().filter(
    (c) => !INCOME_CATEGORIES.has(c)
  );

  for (const cat of allKnownCategories) {
    if (!categoryMap.has(cat)) {
      recommendations.push({
        category: cat,
        windowSpend: 0,
        currentSpend: 0,
        monthlyAvg: 0,
        recommendedLimit: 0,
        transactionCount: 0,
        confidence: "low",
        message: "No spending data. Set a manual budget to track proactively.",
        isVolatile: false,
      });
    }
  }

  // ── 7. Sort: categories with spend first, then alphabetically ────────
  recommendations.sort((a, b) => {
    if (a.currentSpend > 0 && b.currentSpend === 0) return -1;
    if (a.currentSpend === 0 && b.currentSpend > 0) return 1;
    return a.category.localeCompare(b.category);
  });

  return recommendations;
}

/**
 * Apply recommendations as actual Budget documents in MongoDB.
 *
 * Checks if each budget already exists with the same limit — if all are
 * unchanged, returns { results: [], isUpToDate: true } to avoid redundant saves.
 *
 * @param {string} userId - MongoDB ObjectId
 * @param {Array<{category: string, limit: number}>} budgetsToApply
 * @returns {Promise<{results: Array, isUpToDate: boolean}>}
 */
export async function applyRecommendations(userId, budgetsToApply) {
  const Budget = (await import("../models/Budget.js")).default;
  const results = [];
  let anyChanged = false;

  for (const { category, limit } of budgetsToApply) {
    const safeLimit = Math.max(0, Math.round(limit));

    // Check if budget already exists with the same limit
    const existing = await Budget.findOne({ userId, category });

    if (existing && existing.limit === safeLimit) {
      // Budget unchanged — still push it to results for return consistency
      results.push(existing);
      continue;
    }

    anyChanged = true;

    // Upsert: update existing budget or create new one
    const budget = await Budget.findOneAndUpdate(
      { userId, category },
      {
        userId,
        category,
        limit: safeLimit,
        period: "monthly",
        startDate: existing ? existing.startDate : new Date(),
      },
      { upsert: true, new: true, runValidators: true }
    );
    results.push(budget);
  }

  return { results, isUpToDate: !anyChanged };
}

export default {
  generateRecommendations,
  applyRecommendations,
};

