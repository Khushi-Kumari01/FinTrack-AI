import Transaction from "../models/Transaction.js";
import Budget from "../models/Budget.js";
import Bill from "../models/Bill.js";
import Goal from "../models/Goal.js";
import Subscription from "../models/Subscription.js";
import Automation from "../models/Automation.js";
import ForecastSummary from "../models/ForecastSummary.js";
import HealthSummary from "../models/HealthSummary.js";
import PortfolioSummary from "../models/PortfolioSummary.js";
import GoalSuggestions from "../models/GoalSuggestions.js";
import SpendSeries from "../models/SpendSeries.js";
import CashflowSeries from "../models/CashflowSeries.js";

const ensureOrCreate = async (Model, userId, defaults) => {
  let doc = await Model.findOne({ userId });
  if (!doc) {
    doc = await Model.create({ userId, ...defaults });
  }
  return doc;
};

const monthKey = (d) => {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return months[d.getMonth()];
};

export const getSpendChartSeries = async (req, res) => {
  try {
    const userId = req.user._id;

    const doc = await ensureOrCreate(
      SpendSeries,
      userId,
      {
        series: [],
      }
    );

    if (doc.series?.length) return res.json(doc.series);

    // Derive from transactions if empty
    const txs = await Transaction.find({ userId, type: "expense" });
    const totalsByMonth = new Map();
    for (const t of txs) {
      if (!t.date) continue;
      const key = monthKey(new Date(t.date));
      totalsByMonth.set(key, (totalsByMonth.get(key) || 0) + (t.amount || 0));
    }

    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const series = months.slice(0, 4).map((m) => ({ month: m, amount: totalsByMonth.get(m) || 0 }));

    doc.series = series;
    await doc.save();

    res.json(series);
  } catch (err) {
    console.error("getSpendChartSeries error", err);
    res.status(500).json({ message: "Failed to fetch spend chart" });
  }
};

export const getCashflowChartSeries = async (req, res) => {
  try {
    const userId = req.user._id;

    const doc = await ensureOrCreate(CashflowSeries, userId, { series: [] });
    if (doc.series?.length) return res.json(doc.series);

    // Derive from transactions: group by day-of-month for the current month
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const txs = await Transaction.find({ userId, date: { $gte: start, $lte: end } });

    const inflowByDay = new Map();
    const outflowByDay = new Map();

    for (const t of txs) {
      if (!t.date) continue;
      const day = String(new Date(t.date).getDate());
      if (t.type === "income") inflowByDay.set(day, (inflowByDay.get(day) || 0) + (t.amount || 0));
      else outflowByDay.set(day, (outflowByDay.get(day) || 0) + (t.amount || 0));
    }

    const days = ["1", "5", "10", "15", "20", "25"];
    const series = days.map((d) => ({
      day: d,
      inflow: inflowByDay.get(d) || 0,
      outflow: outflowByDay.get(d) || 0,
    }));

    doc.series = series;
    await doc.save();

    res.json(series);
  } catch (err) {
    console.error("getCashflowChartSeries error", err);
    res.status(500).json({ message: "Failed to fetch cashflow chart" });
  }
};

export const getHealthSummary = async (req, res) => {
  try {
    const userId = req.user._id;

    // Always recompute from live data — never short-circuit on a cached document,
    // since transactions change frequently and the cached score would be stale.
    const [txs, subs] = await Promise.all([
      Transaction.find({ userId }),
      Subscription.find({ userId }),
    ]);

    const income = txs.filter((t) => t.type === "income").reduce((a, t) => a + (t.amount || 0), 0);
    const expense = txs.filter((t) => t.type !== "income").reduce((a, t) => a + (t.amount || 0), 0);
    const surplus = income - expense;
    const savingsRate = income > 0 ? ((surplus) / income) * 100 : 0;
    const score = Math.max(0, Math.min(100, Math.round(60 + savingsRate * 0.4)));

    const subscriptionTotal = subs.reduce((a, s) => a + (s.amount || 0), 0);

    const summary = [];
    if (income > 0) {
      summary.push({ emoji: "✅", text: "Health score based on your income, expenses, and savings rate." });
      if (surplus > 0) summary.push({ emoji: "💰", text: "Net positive cashflow." });
      if (savingsRate <= 0) summary.push({ emoji: "🧯", text: "Your spending is consuming all of your income." });
    } else {
      summary.push({ emoji: "ℹ️", text: "No income recorded. Score reflects spending patterns only." });
      if (expense > 0) summary.push({ emoji: "🧯", text: "Only expenses detected — add income transactions for a full picture." });
    }
    if (subscriptionTotal > 0) {
      summary.push({ emoji: "⚠️", text: `Recurring subscriptions: ₹${Math.round(subscriptionTotal).toLocaleString("en-IN")}/mo detected.` });
    }

    // Write-through so cached value stays in sync (best-effort, non-fatal if it fails).
    try {
      const doc = await ensureOrCreate(HealthSummary, userId, { score, summary });
      doc.score = score;
      doc.summary = summary;
      await doc.save();
    } catch (_) { /* non-fatal */ }

    res.json({ score, summary });
  } catch (err) {
    console.error("getHealthSummary error", err);
    res.status(500).json({ message: "Failed to fetch health summary" });
  }
};

export const getForecast = async (req, res) => {
  try {
    const userId = req.user._id;
    const now = new Date();

    // Current month: from the 1st up to today (inclusive).
    const startThis = new Date(now.getFullYear(), now.getMonth(), 1);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    // Previous complete calendar month.
    const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    const [thisTx, prevTx] = await Promise.all([
      Transaction.find({ userId, type: "expense", date: { $gte: startThis, $lte: today } }),
      Transaction.find({ userId, type: "expense", date: { $gte: prevStart, $lte: prevEnd } }),
    ]);

    const spentThis = thisTx.reduce((a, t) => a + (t.amount || 0), 0);
    const spentPrev = prevTx.reduce((a, t) => a + (t.amount || 0), 0);

// Days elapsed in the current month (1..today) and total days in the current month.
    const daysElapsedThis = now.getDate();
    const daysInThisMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    // Normalize the current month's partial spend to a full-month equivalent
    // so it is comparable to a complete previous month.
    const spentThisNormalized =
      daysElapsedThis > 0 ? (spentThis / daysElapsedThis) * daysInThisMonth : 0;

    // Next-month forecast from the user's real history: simple, explainable
    // average of the two most recent full-month-equivalent spending amounts
    // (previous complete month + current month normalized to a full month).
    const candidates = [];
    if (spentPrev > 0) candidates.push(spentPrev);
    if (spentThisNormalized > 0) candidates.push(spentThisNormalized);

    const expectedBase =
      candidates.length > 0
        ? candidates.reduce((s, n) => s + n, 0) / candidates.length
        : 0;

    const expected = Math.round(expectedBase);

    // Delta "vs last month" against the SAME baseline used by the forecast
    // (the previous complete calendar month), so the percentage is meaningful.
    const delta = spentPrev > 0 ? Math.round(((expected - spentPrev) / spentPrev) * 100) : 0;

    const result = {
      expected,
      delta,
      note:
        "Next-month forecast from your previous month's actuals and current month's spend normalized to a full month.",
    };

    // Keep the cached summary in sync (never stale) so any other consumers
    // reading ForecastSummary get the same live result. We never short-circuit
    // on it, so the forecast is always computed from live transaction data.
    try {
      await ForecastSummary.findOneAndUpdate(
        { userId },
        { $set: result },
        { upsert: true, new: true }
      );
    } catch (e) {
      console.error("ForecastSummary cache update skipped:", e.message || e);
    }

    res.json(result);
  } catch (err) {
    console.error("getForecast error", err);
    res.status(500).json({ message: "Failed to fetch forecast" });
  }
};

export const getPortfolioSummary = async (req, res) => {
  try {
    const userId = req.user._id;

    // Always recompute from live data — do NOT use the cached document as a
    // short-circuit. The PortfolioSummary model is used only as a write-through
    // store so any future consumers reading it directly get fresh values.
    const [goals, txs] = await Promise.all([
      Goal.find({ userId }),
      Transaction.find({ userId }),
    ]);

    const income = txs.filter((t) => t.type === "income").reduce((a, t) => a + (t.amount || 0), 0);
    const expense = txs.filter((t) => t.type !== "income").reduce((a, t) => a + (t.amount || 0), 0);
    const surplus = income - expense;

    // total = sum of all goal currentAmounts (user-tracked savings/investments) + net surplus
    const invested = goals.reduce((a, g) => a + (g.currentAmount || 0), 0);
    const total = Math.max(0, Math.round(invested + Math.max(0, surplus)));

    // gainPct: only meaningful if there's actual tracked investment progress.
    // We do NOT hardcode a return percentage — that would be fake financial data.
    // Show 0 to indicate we have no real brokerage data.
    const gainPct = 0;

    // breakdown derived from goal categories if available, else empty
    // (do NOT hardcode fake percentages when there are no goals)
    let breakdown = [];
    if (goals.length > 0) {
      const catMap = new Map();
      for (const g of goals) {
        const cat = g.category || "Savings";
        catMap.set(cat, (catMap.get(cat) || 0) + (g.currentAmount || 0));
      }
      const catTotal = Array.from(catMap.values()).reduce((a, v) => a + v, 0) || 1;
      breakdown = Array.from(catMap.entries()).map(([label, val]) => ({
        label,
        percent: Math.round((val / catTotal) * 100),
      }));
    }
    // breakdown stays [] when there are no goals — PortfolioCard renders its empty state

    const result = { total, gainPct, breakdown };

    // Write-through to model (best-effort)
    try {
      await PortfolioSummary.findOneAndUpdate(
        { userId },
        { $set: result },
        { upsert: true, new: true }
      );
    } catch (e) {
      // Non-fatal — live result is still returned
    }

    res.json(result);
  } catch (err) {
    console.error("getPortfolioSummary error", err);
    res.status(500).json({ message: "Failed to fetch portfolio summary" });
  }
};

const roundINR = (n) => Math.round(n || 0);

const addMonths = (months) => {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
};

export const getGoalSuggestions = async (req, res) => {
  try {
    const userId = req.user._id;

    // Compute live from real data — no caching, so suggestions stay in sync
    // with the user's actual transactions and goals.
    const [txs, existingGoals] = await Promise.all([
      Transaction.find({ userId }),
      Goal.find({ userId }),
    ]);

// Identify COMPLETE calendar months of spend history. A calendar month is only "complete"
    // when it is strictly between the earliest and latest dated months (i.e. fully covered by the
    // observed period). A partial month at either end of the span (e.g. a ~19-day window spanning
    // part of July and part of August) must NEVER be treated as a full month for averaging.
    const dated = txs.filter((t) => t.date).map((t) => new Date(t.date));
    const completeMonthSpends = [];
    if (dated.length) {
      let minT = Infinity;
      let maxT = -Infinity;
      for (const d of dated) {
        const t = d.getTime();
        if (t < minT) minT = t;
        if (t > maxT) maxT = t;
      }
      const minD = new Date(minT);
      const maxD = new Date(maxT);

      // Group expense totals by calendar month.
      const byMonth = new Map();
      for (const t of txs) {
        if (t.type === "income" || !t.date) continue;
        const dt = new Date(t.date);
        const key = `${dt.getFullYear()}-${dt.getMonth()}`;
        byMonth.set(key, (byMonth.get(key) || 0) + (t.amount || 0));
      }

      // Iterate months strictly between the earliest and latest months - those are complete.
      const cursor = new Date(minD.getFullYear(), minD.getMonth() + 1, 1);
      const endCursor = new Date(maxD.getFullYear(), maxD.getMonth(), 1);
      while (cursor < endCursor) {
        const key = `${cursor.getFullYear()}-${cursor.getMonth()}`;
        if (byMonth.has(key)) completeMonthSpends.push(byMonth.get(key));
        cursor.setMonth(cursor.getMonth() + 1);
      }
    }

    // Only claim a true "average monthly" figure when we have at least one COMPLETE calendar
    // month. Otherwise we report the observed spend over the available window and label it
    // honestly (never call a partial-period total a monthly average).
    const hasEnoughForAverage = completeMonthSpends.length > 0 && dated.length >= 3;

    const totalIncome = txs
      .filter((t) => t.type === "income")
      .reduce((a, t) => a + (t.amount || 0), 0);

    // Explicitly exclude both income-type AND income-category transactions
    // so "Income" or "Salary" category expenses never inflate spending totals.
    const INCOME_CATS_LOWER = new Set([
      "income", "salary", "freelance", "stipend", "bonus", "refund",
      "cashback", "credit", "deposit", "interest", "dividend",
      "payout", "commission", "consulting", "wages", "payroll",
    ]);
    const totalExpense = txs
      .filter((t) => {
        if (t.type === "income") return false;
        const cat = (t.category || "").toLowerCase().trim();
        if (INCOME_CATS_LOWER.has(cat)) return false;
        return true;
      })
      .reduce((a, t) => a + (t.amount || 0), 0);

    // When we have complete months, the monthly average is the mean of those complete months.
    // Otherwise fall back to the observed total across the available (partial) period.
    const avgMonthlyExpense = completeMonthSpends.length
      ? completeMonthSpends.reduce((a, n) => a + n, 0) / completeMonthSpends.length
      : totalExpense;
    const avgMonthlyIncome = totalIncome;

    const hasIncome = totalIncome > 0;
    const hasExpense = totalExpense > 0;

    const existingCategories = new Set(
      existingGoals.map((g) => (g.category || "").toLowerCase())
    );
    const existingTitles = new Set(
      existingGoals.map((g) => (g.title || "").toLowerCase())
    );

    // Not enough data: no transactions at all.
    if (!hasIncome && !hasExpense) {
      return res.json([]);
    }

    const suggestions = [];

    // 1. Emergency fund — sized to a reliable monthly spend figure.
    // We only generate this when there is SUFFICIENT complete-month data to estimate a
    // trustworthy monthly average. With only a partial period (e.g. ~19 days), scaling the
    // observed total by a 3–6 month buffer would fabricate an unreliable target, so we skip it
    // entirely and let the user know more history is needed (no invented ₹target in the form).
    if (hasExpense && hasEnoughForAverage && !existingCategories.has("emergency")) {
      const bufferMonths = hasIncome ? 6 : 3;
      const target = roundINR(avgMonthlyExpense * bufferMonths);
      const etaMonths = bufferMonths + Math.max(3, Math.round(bufferMonths / 2));
      const incomeHint = hasIncome
        ? ` A ${bufferMonths}-month safety net would be ₹${target.toLocaleString()}.`
        : ` A ${bufferMonths}-month buffer of ₹${target.toLocaleString()} is recommended (income data not available).`;
      suggestions.push({
        title: "Emergency fund",
        description: `Your average monthly spend is ₹${roundINR(avgMonthlyExpense).toLocaleString()}.${incomeHint}`,
        targetAmount: target,
        currentAmount: 0,
        category: "Emergency",
        eta: `${etaMonths} months`,
        deadline: addMonths(etaMonths),
      });
    } else if (hasExpense) {
      // Not enough complete-month history: surface an honest note instead of an unreliable
      // emergency-fund target, so the user knows why no ₹3-month buffer was proposed.
      suggestions.push({
        title: "Emergency fund",
        description: `Observed spend is ₹${roundINR(avgMonthlyExpense).toLocaleString()} over the available partial period; more complete-month data is needed to estimate a reliable monthly average.`,
        targetAmount: 0,
        currentAmount: 0,
        category: "Emergency",
        eta: null,
        deadline: null,
      });
    }

    // 2. Savings target — only from real positive surplus (never invented income).
    if (hasIncome && !existingTitles.has("savings")) {
      const surplus = avgMonthlyIncome - avgMonthlyExpense;
      if (surplus > 0) {
        const target = roundINR(surplus * 6);
        suggestions.push({
          title: "Savings target",
          description: `You save about ₹${roundINR(surplus).toLocaleString()} per month. A 6-month savings goal of ₹${target.toLocaleString()} is achievable from your surplus.`,
          targetAmount: target,
          currentAmount: 0,
          category: "Savings",
          eta: "6 months",
          deadline: addMonths(6),
        });
      }
    }

    // 3. First savings goal — only when the user has no goals yet.
    if (!existingGoals.length) {
      const starter = hasExpense ? roundINR(avgMonthlyExpense * 0.5) : 5000;
      suggestions.push({
        title: "Start your first savings goal",
        description: hasIncome
          ? "Kick off a savings habit with a target sized to your monthly capacity."
          : "A starter target based on your spending patterns (income data not available).",
        targetAmount: Math.max(1000, starter),
        currentAmount: 0,
        category: "Savings",
        eta: "3 months",
        deadline: addMonths(3),
      });
    }

    // 4. Short-term planned expense from the largest EXPENSE category.
    // Explicitly exclude income categories to avoid "Your largest spending category is Income"
    if (hasExpense && suggestions.length < 3) {
      const INCOME_CATS = new Set([
        "income", "salary", "freelance", "stipend", "bonus", "refund",
        "cashback", "credit", "deposit", "interest", "dividend",
        "payout", "commission", "consulting", "wages", "payroll",
      ]);
      const byCat = new Map();
      for (const t of txs) {
        // Skip income transactions by type OR by category name
        if (t.type === "income") continue;
        const cat = t.category || "Other";
        if (INCOME_CATS.has(cat.toLowerCase().trim())) continue;
        byCat.set(cat, (byCat.get(cat) || 0) + (t.amount || 0));
      }
      const top = [...byCat.entries()].sort((a, b) => b[1] - a[1])[0];
      if (top && top[1] >= avgMonthlyExpense * 0.3) {
        const target = roundINR(top[1] * 1.2);
        suggestions.push({
          title: `${top[0]} fund`,
          description: `Your largest spending category is ${top[0]} (~₹${roundINR(top[1]).toLocaleString()}). A dedicated fund helps you plan this expense.`,
          targetAmount: target,
          currentAmount: 0,
          category: "Other",
          eta: "6 months",
          deadline: addMonths(6),
        });
      }
    }

    const out = suggestions.slice(0, 3).map((s, i) => ({ ...s, id: i + 1 }));
    res.json(out);
  } catch (err) {
    console.error("getGoalSuggestions error", err);
    res.status(500).json({ message: "Failed to fetch goal suggestions" });
  }
};

export const getAutomationsRules = async (req, res) => {
  try {
    const userId = req.user._id;
    const automations = await Automation.find({ userId });
    const rules = automations.map((a, idx) => ({
      id: a._id?.toString?.() || idx + 1,
      title: a.title,
      description: a.description || "",
      enabled: a.enabled,
    }));
    res.json(rules);
  } catch (err) {
    console.error("getAutomationsRules error", err);
    res.status(500).json({ message: "Failed to fetch automation rules" });
  }
};

export const getDashboardWidgets = async (req, res) => {
  // Convenience endpoint to reduce frontend calls (optional usage)
  try {
    const userId = req.user._id;

    const [budgets, bills, goals, subs, automations] = await Promise.all([
      Budget.find({ userId }),
      Bill.find({ userId }),
      Goal.find({ userId }),
      Subscription.find({ userId }),
      Automation.find({ userId }),
    ]);

    res.json({ budgets, bills, goals, subs, automations });
  } catch (err) {
    console.error("getDashboardWidgets error", err);
    res.status(500).json({ message: "Failed" });
  }
};

