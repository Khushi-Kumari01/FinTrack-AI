import mongoose from "mongoose";
import Transaction from "../models/Transaction.js";
import Budget from "../models/Budget.js";
import Subscription from "../models/Subscription.js";

// Centralized income category keywords — ANY tx with these categories is treated as income
// regardless of its `type` field. This prevents Income/Salary from leaking into expense analytics.
const INCOME_CATEGORIES = new Set([
  "salary", "income", "freelance", "freelance payment", "stipend", "bonus",
  "refund", "cashback", "credit", "deposit", "interest", "dividend",
  "payout", "commission", "consulting", "wages", "payroll"
]);

const isExpense = (tx) => {
  const cat = (tx.category || "").toLowerCase().trim();
  if (INCOME_CATEGORIES.has(cat)) return false;
  if (tx.type) return tx.type === "expense";
  return Number(tx.amount) < 0;
};

const monthNames = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const monthKey = (d) => monthNames[d.getMonth()];

const safeNumber = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

const toISODateInput = (d) => {
  const dt = d instanceof Date ? d : new Date(d);
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

export const getDashboardAnalytics = async (req, res) => {
  try {
    const userId = req.user._id;

    const { from, to } = req.query;

    // Default: last 30 days for totals/breakdown/forecast inputs.
    const now = new Date();
    const defaultFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const fromDate = from ? new Date(from) : defaultFrom;
    const toDate = to ? new Date(to) : now;

    const query = {
      userId,
      date: {
        $gte: fromDate,
        $lte: toDate,
      },
    };

    // Also fetch ALL-TIME expense transactions for the Monthly Burn chart so it always
    // shows the full Jan–Dec history regardless of the selected time window.
    const [txs, allTimeTxs, budgets, subscriptions] = await Promise.all([
      Transaction.find(query).sort({ date: 1 }),
      Transaction.find({ userId, type: "expense" }).select("date amount category type").lean(),
      Budget.find({ userId }),
      Subscription.find({ userId }),
    ]);

    const expenseTxs = txs.filter((t) => isExpense(t));
    const incomeTxs = txs.filter((t) => !isExpense(t));

    const incomeTotal = incomeTxs.reduce((a, t) => a + Math.abs(safeNumber(t.amount)), 0);
    const expenseTotal = expenseTxs.reduce((a, t) => a + Math.abs(safeNumber(t.amount)), 0);
    const surplus = incomeTotal - expenseTotal;

    // Category breakdown: expense only (pie chart)
    const byCategoryMap = new Map();
    for (const t of expenseTxs) {
      const key = t.category || "Uncategorized";
      byCategoryMap.set(key, (byCategoryMap.get(key) || 0) + Math.abs(safeNumber(t.amount)));
    }

    const categoryTotals = Array.from(byCategoryMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const denom = categoryTotals.reduce((a, x) => a + x.value, 0) || 1;
    const categoryBreakdownPie = categoryTotals.map((c) => ({
      name: c.name,
      value: c.value,
      percent: Math.round((c.value / denom) * 100),
    }));

    const categoryBreakdownForChart = categoryBreakdownPie.length
      ? categoryBreakdownPie
      : [];  // return empty array — UI components handle the empty state themselves

    // Monthly burn (windowed) — used only for context; kept for meta.
    // spendSeriesAllTime — ALL-TIME Jan–Dec chart so the Monthly Burn card always
    // shows real historical data regardless of the 7d/30d/90d time window.
    const allTimeSpendByMonth = new Map(monthNames.map((m) => [m, 0]));
    for (const t of allTimeTxs) {
      if (!t.date) continue;
      // Re-check isExpense against the lean doc
      const cat = (t.category || "").toLowerCase().trim();
      const isExpenseLean = !INCOME_CATEGORIES.has(cat) && t.type !== "income";
      if (!isExpenseLean) continue;
      const d = new Date(t.date);
      const key = monthKey(d);
      allTimeSpendByMonth.set(key, (allTimeSpendByMonth.get(key) || 0) + safeNumber(t.amount));
    }
    const spendSeriesAllTime = monthNames.map((month) => ({
      month,
      amount: allTimeSpendByMonth.get(month) || 0,
    }));

    // Window-aware spendSeries:
    //   7d / 30d  → daily buckets with key = "DD/MM"  (dataKey: "day")
    //   90d       → monthly buckets covering only the selected window months (dataKey: "month")
    //
    // _winDays: approximate span used only to decide daily vs monthly aggregation.
    // Using ceiling here prevents the branch from flipping to "monthly" on a 30d
    // window just because the request arrived shortly after midnight (diff = 29.01d
    // → Math.round = 29 would still be ≤31, so this is belt-and-suspenders safety).
    const _winDays = Math.ceil((toDate.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000)) || 1;

    let spendSeries;
    if (_winDays <= 31) {
      // ── Daily buckets: one entry per calendar day in [fromDate, toDate] ──
      const spendByDay = new Map();
      // Pre-fill every day in the window with 0 so zero days are included
      const dayCursor = new Date(fromDate);
      while (dayCursor <= toDate) {
        const key = `${String(dayCursor.getDate()).padStart(2, "0")}/${String(dayCursor.getMonth() + 1).padStart(2, "0")}`;
        spendByDay.set(key, 0);
        dayCursor.setDate(dayCursor.getDate() + 1);
      }
      for (const t of expenseTxs) {
        if (!t.date) continue;
        const d = new Date(t.date);
        const key = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (spendByDay.has(key)) {
          spendByDay.set(key, spendByDay.get(key) + safeNumber(t.amount));
        }
      }
      spendSeries = Array.from(spendByDay.entries()).map(([day, amount]) => ({ day, amount }));
    } else {
      // ── Monthly buckets: only the months touched by the selected window ──
      // Walk the window month by month so we get May/Jun/Jul/Aug for a 90d window.
      const monthSet = new Map(); // "Mmm YYYY" → 0 initially (for ordering)
      const mCursor = new Date(fromDate.getFullYear(), fromDate.getMonth(), 1);
      const mEnd    = new Date(toDate.getFullYear(),   toDate.getMonth(),   1);
      while (mCursor <= mEnd) {
        const label = monthNames[mCursor.getMonth()]; // "Jan"…"Dec"
        // Use "Mmm" as key — month name is enough for display; store in insertion order
        if (!monthSet.has(label)) monthSet.set(label, 0);
        mCursor.setMonth(mCursor.getMonth() + 1);
      }
      for (const t of expenseTxs) {
        if (!t.date) continue;
        const key = monthKey(new Date(t.date));
        if (monthSet.has(key)) {
          monthSet.set(key, monthSet.get(key) + safeNumber(t.amount));
        }
      }
      spendSeries = Array.from(monthSet.entries()).map(([month, amount]) => ({ month, amount }));
    }

    // Cashflow timeline: day buckets within the filtered date range
    // Use all transactions within the from/to window, bucketed by day
    const inflowByDay = new Map();
    const outflowByDay = new Map();

    for (const t of txs) {
      if (!t.date) continue;
      const d = new Date(t.date);
      const day = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!isExpense(t)) {
        inflowByDay.set(day, (inflowByDay.get(day) || 0) + Math.abs(safeNumber(t.amount)));
      } else {
        outflowByDay.set(day, (outflowByDay.get(day) || 0) + Math.abs(safeNumber(t.amount)));
      }
    }

    // Generate daily buckets from fromDate to toDate
    const cashflowSeries = [];
    const cursor = new Date(fromDate);
    while (cursor <= toDate) {
      const dayKey = `${String(cursor.getDate()).padStart(2, "0")}/${String(cursor.getMonth() + 1).padStart(2, "0")}`;
      cashflowSeries.push({
        day: dayKey,
        inflow: inflowByDay.get(dayKey) || 0,
        outflow: outflowByDay.get(dayKey) || 0,
      });
      cursor.setDate(cursor.getDate() + 1);
    }


// Health: compute a deterministic snapshot from live totals.
    const savingsRate = incomeTotal > 0 ? ((surplus) / incomeTotal) * 100 : 0;
    // Volatility-ish proxy: variance of daily surplus for expenses/income within the window
    const byDay = new Map();
    for (const t of txs) {
      if (!t.date) continue;
      const d = new Date(t.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      byDay.set(key, (byDay.get(key) || 0) + (!isExpense(t) ? safeNumber(t.amount) : -safeNumber(t.amount)));
    }
    const dailySurplus = Array.from(byDay.values());
    const mean = dailySurplus.length ? dailySurplus.reduce((a, x) => a + x, 0) / dailySurplus.length : 0;
    const variance = dailySurplus.length
      ? dailySurplus.reduce((a, x) => a + Math.pow(x - mean, 2), 0) / dailySurplus.length
      : 0;
    const volatilityPenalty = Math.min(20, Math.round(Math.sqrt(variance) / 100));

    const score = Math.max(
      0,
      Math.min(100, Math.round(60 + savingsRate * 0.4 - volatilityPenalty))
    );


    const subscriptionTotal = subscriptions.reduce((a, s) => a + safeNumber(s.amount), 0);

    // Build health summary bullets based on what data is actually available.
    const summary = [];
    if (incomeTotal > 0) {
      // We have income data — score is meaningful.
      summary.push({ emoji: "✅", text: "Health score based on your income, expenses, and spending volatility." });
      if (surplus > 0) summary.push({ emoji: "💰", text: "Net positive cashflow in the selected window." });
      if (savingsRate <= 0) summary.push({ emoji: "🧯", text: "Your spending is consuming all of your income." });
    } else {
      // No income recorded — base score of 60 minus volatility penalty only.
      summary.push({ emoji: "ℹ️", text: "No income recorded in this window. Score reflects spending patterns only (base 60, adjusted for volatility)." });
      if (expenseTotal > 0) summary.push({ emoji: "🧯", text: "Only expenses detected — add income transactions to get a full health picture." });
    }
    if (subscriptionTotal > 0) summary.push({ emoji: "⚠️", text: `Recurring subscriptions: ₹${Math.round(subscriptionTotal).toLocaleString("en-IN")}/mo detected.` });

// Forecast: next-month spend forecast based on the user's COMPLETE calendar months only.
    // We deliberately do NOT normalize a partial current month to a full month, because a
    // single one-off expense (e.g. a large "Others" purchase) would otherwise be extrapolated
    // across the whole month and inflate the forecast far above realistic spend.
    //
    // Formula: expected = average of the most recent COMPLETE calendar months' actual spend
    // (expense-only). With only one complete month of history, the forecast equals that month.

    // Gather the user's complete calendar months (up to 3 back) for a stable average.
    const completeMonthRanges = [];
    for (let i = 1; i <= 3; i++) {
      const ms = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const me = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
      completeMonthRanges.push({ start: ms, end: me });
    }

    const monthTxGroups = await Promise.all(
      completeMonthRanges.map(({ start, end }) =>
        Transaction.find({ userId, date: { $gte: start, $lte: end } })
      )
    );

    const completeMonthSpends = monthTxGroups.map((txs) =>
      txs.filter((t) => isExpense(t)).reduce((a, t) => a + safeNumber(t.amount), 0)
    );

    // Only use months with real spend; ignore empty months so a quiet month doesn't drag the
    // forecast to zero.
    const candidates = completeMonthSpends.filter((n) => n > 0);
    const expectedBase =
      candidates.length > 0
        ? candidates.reduce((s, n) => s + n, 0) / candidates.length
        : 0;
    const expected = Math.round(expectedBase);

    // "vs last month" against the most recent COMPLETE calendar month.
    const prevCompleteSpend = completeMonthSpends.find((n) => n > 0) || 0;
    const delta =
      prevCompleteSpend > 0
        ? Math.round(((expected - prevCompleteSpend) / prevCompleteSpend) * 100)
        : 0;

    const note =
      "Forecast is the average of your recent complete months' actual spend (no partial-month extrapolation).";

    // windowDays: the exact number of calendar days in the selected window.
    // This is passed to the frontend so CashflowChart can compute Avg Daily
    // correctly (total / windowDays).
    //
    // IMPORTANT: Do NOT use Math.round((toDate - fromDate) / 86400000) here.
    // That formula is sensitive to the exact time-of-day when the request arrives.
    // Example: if the server receives the request at 00:14 (14 mins past midnight),
    // the diff for a 7-day window is only 6.01 days → rounds to 6 → gives
    // avgDailyExpense = ₹700/6 = ₹116.67 instead of the correct ₹700/7 = ₹100.
    //
    // The correct denominator is always exactly the number of daily buckets produced
    // by the cashflow cursor loop — which runs from fromDate (midnight N-1 days ago)
    // to toDate (now) and always yields exactly N entries.
    const windowDays = cashflowSeries.length || 1;

    return res.json({
      // totals
      totals: {
        income: incomeTotal,
        spent: expenseTotal,
        surplus,
      },

      // breakdown
      categoryBreakdown: categoryBreakdownForChart,

      // charts
      spendSeries,
      spendSeriesAllTime,   // ← all-time monthly burn (always full Jan–Dec history)
      cashflowSeries,

      // health
      health: { score, summary },

      // forecast
      forecast: { expected, delta, note, completedMonthsUsed: candidates.length },

      // extra for future UI
      meta: {
        from: toISODateInput(fromDate),
        to: toISODateInput(toDate),
        txCount: txs.length,
        windowDays,
      },

      // budget/card support (optional)
      budgets,
    });
  } catch (err) {
    console.error("getDashboardAnalytics error", err);
    res.status(500).json({ message: "Failed to fetch dashboard analytics" });
  }
};

