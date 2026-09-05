/**
 * AI Budget Explainer Service
 *
 * Generates human-readable explanations for AI budget recommendations using
 * Gemini 1.5 Flash (when GEMINI_API_KEY is set) or a rule-based fallback.
 *
 * This service ONLY explains — it NEVER generates or modifies budget values.
 * The statistical algorithm in budgetRecommender.js remains the sole source of truth.
 *
 * Environment variables:
 *   GEMINI_API_KEY (optional) — Google AI Studio API key for Gemini
 *   GEMINI_MODEL (optional, default: "gemini-1.5-flash")
 */

import { logger } from "../utils/logger.js";

// ─── Gemini Integration ───────────────────────────────────────────────────

let genAI = null;
let geminiAvailable = false;

try {
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()) {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY.trim());
    geminiAvailable = true;
    logger.info("🤖 Gemini AI Explainer: available (gemini-1.5-flash)");
  } else {
    logger.info("🧠 AI Explainer: GEMINI_API_KEY not set — using rule-based fallback");
  }
} catch (err) {
  logger.warn(`⚠️ Gemini SDK not available: ${err.message}. Using rule-based fallback.`);
}

/**
 * Generate an explanation for a single budget category.
 *
 * @param {Object} item - A single budget recommendation item (from statistical engine)
 *   { category, currentSpend, monthlyAvg, recommendedLimit, transactionCount,
 *     confidence, message, isVolatile }
 * @param {Object} [context] - Optional broader context
 *   { totalSpend, totalBudget, topCategory, monthsInWindow }
 * @returns {Promise<{ explanation: string, behavior: string, patterns: string[],
 *                     suggestions: string[], source: "gemini"|"rule" }>}
 */
export async function explainCategory(item, context = {}) {
  if (geminiAvailable) {
    try {
      return await explainWithGemini(item, context);
    } catch (err) {
      logger.warn(`Gemini explanation failed for ${item.category}: ${err.message}. Falling back.`);
      return explainWithRules(item, context);
    }
  }
  return explainWithRules(item, context);
}

// ─── Gemini-based Explanation ──────────────────────────────────────────

async function explainWithGemini(item, context) {
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || "gemini-1.5-flash",
  });

  const prompt = buildGeminiPrompt(item, context);
  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text().trim();

  return parseGeminiResponse(text, item);
}

function buildGeminiPrompt(item, context) {
  // Determine the spending label based on the window
  const lookbackDays = context.lookbackDays || 90;
  const windowLabel =
    lookbackDays <= 7
      ? "7-day window (projected monthly)"
      : lookbackDays <= 30
        ? "30-day (monthly)"
        : "90-day average monthly";
  const avgLabel =
    lookbackDays <= 7
      ? "Projected monthly spending (extrapolated from 7 days)"
      : lookbackDays <= 30
        ? "Recent monthly spending"
        : "Average monthly spending (90-day basis)";

  return `You are a friendly, practical financial coach. Explain this budget recommendation in plain, actionable language.

BUDGET DATA (from statistical engine — these values are definitive):
- Category: ${item.category}
- Window: last ${lookbackDays} days
- Raw spending in window: ₹${(item.windowSpend || item.currentSpend || 0).toLocaleString("en-IN")}
- ${avgLabel}: ₹${(item.monthlyAvg || 0).toLocaleString("en-IN")}/month
- Recommended monthly budget: ₹${(item.recommendedLimit || 0).toLocaleString("en-IN")}
- Budget usage: ${item.recommendedLimit > 0 ? Math.round((item.monthlyAvg || 0) / item.recommendedLimit * 100) : 0}% of monthly limit
- Transaction count in window: ${item.transactionCount || 0}
- Confidence: ${item.confidence || "low"}
- Algorithm message: "${item.message || ""}"
- Volatile pattern: ${item.isVolatile ? "Yes (spending varies significantly month-to-month)" : "No (stable spending pattern)"}

${context.totalBudget ? `Total monthly budget across all categories: ₹${context.totalBudget.toLocaleString("en-IN")}` : ""}
${context.topCategory ? `Top spending category: ${context.topCategory}` : ""}

INSTRUCTIONS (CRITICAL — follow exactly):
1. EXPLAIN (1-2 sentences): Why this monthly budget was recommended. Reference the ${windowLabel} data above. Use correct terminology — do NOT call projected spending "recent average" for 7-day windows.
2. BEHAVIOR (1 sentence): Summarize the spending habit using the monthly-normalised figure.
3. PATTERNS (1-2 items): Flag overspending (compare monthly avg vs monthly limit), unusual patterns, or notable trends.
4. SUGGESTIONS (1-2 items): Practical, specific money-saving tips consistent with the numbers above.

RULES:
- NEVER generate or suggest different budget amounts. The recommended limit above is final.
- All comparisons must use the monthly-normalised figure vs the monthly budget limit.
- Use Indian Rupee (₹) formatting with commas.
- Be conversational but not overly casual.
- Keep total response under 150 words.
- If confidence is "low", acknowledge limited data.

Respond in this EXACT JSON format (no markdown, no code fences):
{
  "explanation": "...",
  "behavior": "...",
  "patterns": ["...", "..."],
  "suggestions": ["...", "..."]
}`;
}

function parseGeminiResponse(text, item) {
  // Try to parse as JSON
  try {
    // Strip any markdown code fences if present
    let cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return {
      explanation: parsed.explanation || `Based on your ₹${(item.monthlyAvg || 0).toLocaleString("en-IN")} monthly average, we recommend a budget of ₹${(item.recommendedLimit || 0).toLocaleString("en-IN")}.`,
      behavior: parsed.behavior || `You've had ${item.transactionCount || 0} transactions in this category.`,
      patterns: Array.isArray(parsed.patterns) && parsed.patterns.length > 0 ? parsed.patterns : ["Stable spending pattern."],
      suggestions: Array.isArray(parsed.suggestions) && parsed.suggestions.length > 0 ? parsed.suggestions : ["Track this category monthly to stay within budget."],
      source: "gemini",
    };
  } catch {
    // If JSON parsing fails, extract insights from raw text
    return extractInsightsFromText(text, item);
  }
}

function extractInsightsFromText(text, item) {
  // Fallback parsing: extract sections from Gemini's plain text response
  const lines = text.split("\n").filter(l => l.trim());
  const explanation = lines.find(l => l.toLowerCase().includes("explain") || l.toLowerCase().includes("budget")) ||
    `Based on your ₹${(item.monthlyAvg || 0).toLocaleString("en-IN")} monthly average, we recommend ₹${(item.recommendedLimit || 0).toLocaleString("en-IN")}.`;
  const behavior = lines.find(l => l.toLowerCase().includes("behavior") || l.toLowerCase().includes("spend") || l.toLowerCase().includes("habit")) ||
    `You've spent ₹${(item.currentSpend || 0).toLocaleString("en-IN")} this month.`;
  const patternLines = lines.filter(l => l.toLowerCase().includes("pattern") || l.toLowerCase().includes("overspend") || l.toLowerCase().includes("unusual") || l.toLowerCase().includes("trend"));
  const suggestionLines = lines.filter(l => l.toLowerCase().includes("suggest") || l.toLowerCase().includes("tip") || l.toLowerCase().includes("try") || l.toLowerCase().includes("consider"));

  return {
    explanation: explanation.replace(/^(explanation|explain):\s*/i, "").trim(),
    behavior: behavior.replace(/^(behavior):\s*/i, "").trim(),
    patterns: patternLines.length > 0
      ? patternLines.map(l => l.replace(/^(pattern|trend|flag):\s*/i, "").trim())
      : item.isVolatile
        ? ["Spending varies significantly month to month."]
        : ["Spending pattern is stable."],
    suggestions: suggestionLines.length > 0
      ? suggestionLines.map(l => l.replace(/^(suggestion|tip|action):\s*/i, "").trim())
      : item.isVolatile
        ? ["Set aside a buffer for months with higher spending in this category."]
        : [`Try to stay within the ₹${(item.recommendedLimit || 0).toLocaleString("en-IN")} limit by tracking weekly.`],
    source: "gemini",
  };
}

// ─── Rule-based Fallback Explanation ─────────────────────────────────────

function explainWithRules(item, context) {
  const { category, monthlyAvg, recommendedLimit, transactionCount, confidence, message, isVolatile } = item;

  // windowSpend = raw total in the selected window (e.g. ₹2,005 over 90 days)
  // monthlyAvg  = normalised monthly rate (always comparable to recommendedLimit)
  const windowSpend = item.windowSpend ?? item.currentSpend ?? 0;
  const limit = recommendedLimit || 0;
  const avg = monthlyAvg || 0;

  // lookbackDays from context tells us the window, so we can use correct terminology.
  const lookbackDays = context.lookbackDays || 90;
  const avgLabel =
    lookbackDays <= 7
      ? "Projected monthly spending"
      : lookbackDays <= 30
        ? "Monthly spending"
        : "Avg monthly spending";

  // ALL comparisons use monthlyAvg vs recommendedLimit (both monthly units).
  const pctUsed = limit > 0 ? Math.round((avg / limit) * 100) : 0;
  const exceeded = avg > limit ? Math.round(avg - limit) : 0;

  // ── Explanation (algorithm-based) ──────────────────────────────────
  let explanation;
  if (limit <= 0 && avg <= 0) {
    explanation = `No recent spending in ${category}. Set a manual budget to track proactively.`;
  } else if (limit <= 0) {
    explanation = `Your ${avgLabel.toLowerCase()} is ₹${avg.toLocaleString("en-IN")}. Apply a budget to track this category.`;
  } else if (confidence === "low") {
    explanation = `Based on limited recent data (${avgLabel.toLowerCase()}: ₹${avg.toLocaleString("en-IN")}/mo), the algorithm recommends ₹${limit.toLocaleString("en-IN")}/month as a starting budget.`;
  } else if (isVolatile) {
    const p75 = Math.round(avg * 1.3);
    explanation = `Spending varies significantly month-to-month. The algorithm uses the 75th percentile (≈ ₹${p75.toLocaleString("en-IN")}) to set a buffer of ₹${limit.toLocaleString("en-IN")}/month for high-spend months.`;
  } else {
    const saved = Math.max(0, avg - limit);
    const reductionPct = avg > 0 ? Math.round((saved / avg) * 100) : 0;
    if (saved > 0) {
      explanation = `Your ${avgLabel.toLowerCase()} is ₹${avg.toLocaleString("en-IN")}. The algorithm applies a ${reductionPct}% reduction to recommend ₹${limit.toLocaleString("en-IN")}/month, targeting ₹${saved.toLocaleString("en-IN")} in monthly savings.`;
    } else {
      explanation = `Your ${avgLabel.toLowerCase()} is ₹${avg.toLocaleString("en-IN")}/mo. The recommended budget of ₹${limit.toLocaleString("en-IN")} aligns with your normalised spending rate.`;
    }
  }

  // ── Pattern (uses pctUsed = monthlyAvg / limit — same units) ───────
  let pattern;
  if (exceeded > 0) {
    pattern = `⚠️ ${avgLabel} (₹${avg.toLocaleString("en-IN")}) exceeds monthly budget by ₹${exceeded.toLocaleString("en-IN")} (${pctUsed}% of ₹${limit.toLocaleString("en-IN")} limit).`;
  } else if (pctUsed >= 80) {
    pattern = `⚠️ ${avgLabel} is at ${pctUsed}% of ₹${limit.toLocaleString("en-IN")} monthly limit — close to exceeding.`;
  } else if (pctUsed > 0 && pctUsed < 50) {
    pattern = `✅ ${avgLabel} is ${pctUsed}% of ₹${limit.toLocaleString("en-IN")} monthly budget — well under limit.`;
  } else if (pctUsed > 0) {
    pattern = `📊 ${avgLabel} is ${pctUsed}% of ₹${limit.toLocaleString("en-IN")} monthly budget.`;
  } else {
    const txInfo = transactionCount
      ? `${transactionCount} transaction${transactionCount !== 1 ? "s" : ""} in the last ${lookbackDays} days`
      : `No transactions in the last ${lookbackDays} days`;
    pattern = `📋 ${txInfo}. ${avgLabel}: ₹${avg.toLocaleString("en-IN")}/mo.`;
  }
  if (isVolatile && !pattern.includes("varies")) {
    pattern += ` 📈 Volatile pattern — expect month-to-month fluctuations.`;
  }

  // ── Suggestion (mathematically grounded from avg vs limit) ─────────
  let suggestion;
  if (exceeded > 0) {
    // Target: bring monthly spending to within the limit
    const suggestedReduction = exceeded + Math.round(limit * 0.1);
    const targetSpend = Math.max(0, Math.round(avg - suggestedReduction));
    suggestion = `To stay within the ₹${limit.toLocaleString("en-IN")}/month budget, reduce ${category.toLowerCase()} spending by approximately ₹${suggestedReduction.toLocaleString("en-IN")}/month (target: ₹${targetSpend.toLocaleString("en-IN")}/mo).`;
  } else if (pctUsed >= 80) {
    const headroom = Math.round(limit - avg);
    suggestion = `₹${headroom.toLocaleString("en-IN")}/month remaining before hitting the limit. Monitor closely to stay under ₹${limit.toLocaleString("en-IN")}.`;
  } else if (limit > 0 && avg > 0) {
    const headroom = Math.round(limit - avg);
    suggestion = `₹${headroom.toLocaleString("en-IN")}/month under budget. If you save half that headroom (₹${Math.round(headroom * 0.5).toLocaleString("en-IN")}), you'll end each month ₹${Math.round(headroom * 0.5).toLocaleString("en-IN")} below the ₹${limit.toLocaleString("en-IN")} limit.`;
  } else {
    suggestion = `Log transactions in ${category} so the algorithm can recommend a personalised monthly limit.`;
  }

  return {
    explanation,
    behavior: "",
    patterns: [pattern],
    suggestions: [suggestion],
    source: "rule",
  };
}

export default { explainCategory };

