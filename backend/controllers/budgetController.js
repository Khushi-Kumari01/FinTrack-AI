/**
 * Budget Controller — AI Budget Recommendations & Application
 *
 * GET  /api/budgets/ai-recommend       — Generate AI recommendations from live transactions
 * POST /api/budgets/apply-recommendations  — Save recommended budgets to MongoDB
 */

import { generateRecommendations, applyRecommendations } from "../services/budgetRecommender.js";
import { explainCategory } from "../services/aiExplainer.js";
import { logger } from "../utils/logger.js";

/**
 * GET /api/budgets/ai-recommend
 *
 * Generates AI-recommended monthly budget limits based on the user's
 * real transaction history. All calculations are dynamic — no hardcoded values.
 *
 * Query params:
 *   - lookbackDays (optional, default: 90) — how far back to analyze
 *   - reductionFactor (optional, default: 0.9) — fraction of avg to recommend
 */
export const getAiRecommendations = async (req, res) => {
  try {
    const userId = req.user._id;
    const lookbackDays = req.query.lookbackDays
      ? Math.max(1, Math.min(365, parseInt(req.query.lookbackDays) || 90))
      : 90;
    const reductionFactor = req.query.reductionFactor
      ? Math.max(0.5, Math.min(1.0, parseFloat(req.query.reductionFactor) || 0.9))
      : 0.9;

    logger.info(
      `Generating AI budget recommendations for user=${userId}, lookbackDays=${lookbackDays}`
    );

    const recommendations = await generateRecommendations(userId, {
      lookbackDays,
      reductionFactor,
    });

    // Strip internal fields for response
    const safe = recommendations.map((r) => ({
      category: r.category,
      windowSpend: r.windowSpend,
      currentSpend: r.currentSpend,   // alias = windowSpend, kept for compat
      monthlyAvg: r.monthlyAvg,
      recommendedLimit: r.recommendedLimit,
      transactionCount: r.transactionCount,
      confidence: r.confidence,
      message: r.message,
      isVolatile: r.isVolatile,
    }));

    res.json({
      success: true,
      recommendations: safe,
      meta: {
        lookbackDays,
        reductionFactor,
        totalCategories: safe.length,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error(`getAiRecommendations error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: "Failed to generate AI budget recommendations.",
    });
  }
};

/**
 * POST /api/budgets/apply-recommendations
 *
 * Takes an array of { category, limit } pairs and creates/updates
 * Budget documents in MongoDB for the authenticated user.
 *
 * Body: { budgets: [{ category: "Food & Dining", limit: 5000 }, ...] }
 */
export const postApplyRecommendations = async (req, res) => {
  try {
    const userId = req.user._id;
    const { budgets } = req.body;

    if (!budgets || !Array.isArray(budgets) || budgets.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Provide a 'budgets' array with { category, limit } objects.",
      });
    }

    // Validate each entry
    const validBudgets = [];
    const errors = [];

    for (let i = 0; i < budgets.length; i++) {
      const b = budgets[i];
      if (!b.category || typeof b.category !== "string") {
        errors.push(`Entry ${i}: missing or invalid 'category'`);
        continue;
      }
      if (b.limit == null || isNaN(Number(b.limit)) || Number(b.limit) < 0) {
        errors.push(`Entry ${i} ("${b.category}"): invalid 'limit'`);
        continue;
      }
      validBudgets.push({
        category: b.category.trim(),
        limit: Math.round(Number(b.limit)),
      });
    }

    if (validBudgets.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid budget entries to apply.",
        errors,
      });
    }

    logger.info(
      `Applying ${validBudgets.length} budgets for user=${userId} (${errors.length} errors)`
    );

    const { results: budgetResults, isUpToDate } = await applyRecommendations(userId, validBudgets);

    res.json({
      success: true,
      applied: budgetResults.length,
      isUpToDate,
      errors: errors.length > 0 ? errors : undefined,
      budgets: budgetResults.map((b) => ({
        category: b.category,
        limit: b.limit,
        period: b.period,
      })),
    });
  } catch (error) {
    logger.error(`postApplyRecommendations error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: "Failed to apply budget recommendations.",
    });
  }
};

/**
 * POST /api/budgets/ai-explain
 *
 * Takes budget recommendation items and generates AI-powered human-readable
 * explanations for each category. Uses Gemini 1.5 Flash when available,
 * falls back to rule-based explanations.
 *
 * Body: { recommendations: [...budgetRecommendationItems] }
 * The recommendations must come from the statistical engine (budgetRecommender.js)
 * — this endpoint only explains, never modifies budget values.
 */
export const postAiExplain = async (req, res) => {
  try {
    const { recommendations } = req.body;

    if (!recommendations || !Array.isArray(recommendations) || recommendations.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Provide a 'recommendations' array with budget data.",
      });
    }

    // Compute overall context for richer explanations
    const totalSpend = recommendations.reduce((s, r) => s + (r.monthlyAvg || 0), 0);
    const totalBudget = recommendations.reduce((s, r) => s + (r.recommendedLimit || 0), 0);
    const topCategory = recommendations
      .filter((r) => r.monthlyAvg > 0)
      .sort((a, b) => (b.monthlyAvg || 0) - (a.monthlyAvg || 0))[0]?.category || null;

    // lookbackDays passed by frontend so explainer can use window-appropriate terminology
    const lookbackDays = Number(req.body.lookbackDays) || 90;
    const context = { totalSpend, totalBudget, topCategory, lookbackDays };

    // Generate explanations for each category in parallel
    const results = await Promise.all(
      recommendations.map(async (item) => {
        const explanation = await explainCategory(item, context);
        return {
          category: item.category,
          explanation: explanation.explanation,
          behavior: explanation.behavior,
          patterns: explanation.patterns,
          suggestions: explanation.suggestions,
          source: explanation.source,
        };
      })
    );

    res.json({
      success: true,
      explanations: results,
      source: results[0]?.source || "rule",
    });
  } catch (error) {
    logger.error(`postAiExplain error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: "Failed to generate AI explanations.",
    });
  }
};

