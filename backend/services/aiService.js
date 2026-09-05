// backend/services/aiService.js

// Pure JS "AI-style" insights. Easy to swap with real LLM later.

// Centralized income category keywords — ANY tx with these categories is treated as income
// regardless of its `type` field. This prevents Income/Salary from leaking into expense analytics.
const INCOME_CATEGORIES = new Set([
  "salary", "income", "freelance", "freelance payment", "stipend", "bonus",
  "refund", "cashback", "credit", "deposit", "interest", "dividend",
  "payout", "commission", "consulting", "wages", "payroll"
]);

const isExpense = (tx) => {
  // Category-based guard: income categories are NEVER expenses
  const cat = (tx.category || "").toLowerCase().trim();
  if (INCOME_CATEGORIES.has(cat)) return false;
  // Type-based check
  if (tx.type) return tx.type === "expense";
  return Number(tx.amount) < 0;
};

const isIncome = (tx) => !isExpense(tx);

export const getSpendingInsights = (user, transactions) => {
  if (!transactions || transactions.length === 0) {
    return {
      summary: "No transactions in this window.",
      totals: { spent: 0, income: 0 },
      byCategory: [],
      // Show a window-scoped nudge even when there are no transactions —
      // better than the generic "Add transactions" fallback.
      smartNudges: [
        "No transactions recorded in this selected window. Add income or expense transactions to see your cash-flow position."
      ]
    };
  }

  let spent = 0;
  let income = 0;

  const byCategoryMap = new Map();
  const categoryTxCount = new Map(); // count of transactions per category
  const allExpenseTxns = [];

  for (const tx of transactions) {
    const amt = Math.abs(Number(tx.amount) || 0);
    if (isExpense(tx)) {
      spent += amt;
      allExpenseTxns.push({ ...tx.toObject?.() || tx, absAmount: amt });

      const cat = tx.category || "Uncategorized";
      const prev = byCategoryMap.get(cat) || 0;
      byCategoryMap.set(cat, prev + Math.abs(amt));
      categoryTxCount.set(cat, (categoryTxCount.get(cat) || 0) + 1);
    }
    else {
      income += amt;
    }
  }

  const byCategory = Array.from(byCategoryMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const surplus = income - spent;

  const smartNudges = [];

  if (surplus > 0) {
    // Use toFixed(2) then strip trailing ".00" only — keeps ₹23,200 clean but shows ₹21,195.18 with decimals.
    const surplusStr = surplus % 1 === 0
      ? Math.round(surplus).toLocaleString("en-IN")
      : surplus.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    smartNudges.push(
      `You have a net cash-flow surplus of ₹${surplusStr} in this window. Review upcoming bills and planned expenses before allocating the surplus.`
    );
  } else if (income > 0) {
    const deficitAmt = Math.abs(surplus);
    const deficitStr = deficitAmt % 1 === 0
      ? Math.round(deficitAmt).toLocaleString("en-IN")
      : deficitAmt.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    smartNudges.push(
      `You have a net cash-flow deficit of ₹${deficitStr} in this window. Review your expenses and upcoming bills.`
    );
  } else {
    smartNudges.push(
      "No income recorded in this selected window. Add income transactions to calculate your cash-flow position."
    );
  }

  if (byCategory[0]) {
    const topPct = spent > 0 ? Math.round((byCategory[0].value / spent) * 100) : 0;
    // Only fire the category nudge when there is enough data to be meaningful.
    // A single tiny transaction should not generate a "consider setting a limit" warning.
    // Require: at least 2 expense transactions AND total spend ≥ ₹200.
    const hasEnoughData = allExpenseTxns.length >= 2 && spent >= 200;
    if (hasEnoughData) {
      smartNudges.push(
        `${byCategory[0].name} is your largest spending category at ₹${Math.round(byCategory[0].value).toLocaleString("en-IN")} (${topPct}% of spending in this window). Consider setting a spending limit for this category.`
      );
    } else if (allExpenseTxns.length === 1) {
      // Single transaction — give a lighter, non-prescriptive insight
      smartNudges.push(
        `Your only recorded expense this period is ₹${Math.round(byCategory[0].value).toLocaleString("en-IN")} in ${byCategory[0].name}.`
      );
    }
  }

  // Detect repeat high-spend category
  if (byCategory.length >= 2) {
    const second = byCategory[1];
    const secondPct = spent > 0 ? Math.round((second.value / spent) * 100) : 0;
    if (secondPct >= 20) {
      smartNudges.push(
        `${second.name} is your second-largest category at ${secondPct}% of spend. Two categories are absorbing ${Math.round((byCategory[0].value + second.value) / spent * 100)}% of your total.`
      );
    }
  }

  // Unusual single-transaction detection.
  // Requires ≥ 3 expense transactions so the baseline average is meaningful.
  // Uses a leave-one-out approach: the average is computed from all OTHER
  // expense transactions (excluding the candidate), preventing self-referential
  // inflation that would suppress genuine outliers in small datasets.
  if (allExpenseTxns.length >= 3) {
    // Sort descending by amount so we test the largest transaction first.
    const sortedExpenses = [...allExpenseTxns].sort((a, b) => b.absAmount - a.absAmount);
    const top = sortedExpenses[0];

    // Compute average of the remaining transactions (leave-one-out)
    const othersTotal = sortedExpenses.slice(1).reduce((s, t) => s + t.absAmount, 0);
    const othersCount = sortedExpenses.length - 1;
    const othersAvg   = othersCount > 0 ? othersTotal / othersCount : 0;

    // Fire the unusual-spend nudge only when the transaction is genuinely
    // at least 5× the leave-one-out average — this ensures the displayed
    // "5×" claim is always supported by the actual data.
    if (othersAvg > 0 && top.absAmount >= othersAvg * 5) {
      const multiplier = Math.round(top.absAmount / othersAvg);
      smartNudges.push(
        `Unusual spend detected: ₹${Math.round(top.absAmount).toLocaleString("en-IN")} at ${top.merchant || top.category} is ${multiplier}× your average transaction (excluding this one). Review whether this was a planned purchase.`
      );
    }
  } else if (allExpenseTxns.length >= 1) {
    // Insufficient sample for anomaly detection — surface the largest expense
    // as a simple informational note without claiming it's "unusual".
    const topExp = allExpenseTxns.reduce((m, t) => t.absAmount > m.absAmount ? t : m, allExpenseTxns[0]);
    if (topExp.absAmount > 0) {
      smartNudges.push(
        `Your largest expense this period is ₹${Math.round(topExp.absAmount).toLocaleString("en-IN")} at ${topExp.merchant || topExp.category}.`
      );
    }
  }

  // Recurring small transactions adding up
  const frequentCategories = [...categoryTxCount.entries()]
    .filter(([, count]) => count >= 5)
    .sort((a, b) => b[1] - a[1]);
  if (frequentCategories.length > 0) {
    const [freqCat, freqCount] = frequentCategories[0];
    smartNudges.push(
      `${freqCat} has ${freqCount} transactions — frequent small spends add up quickly. Set a weekly limit to stay in control.`
    );
  }

  return {
    user: { id: user._id, name: user.name, email: user.email },
    window: { count: transactions.length },
    totals: { spent, income, surplus },
    byCategory,
    smartNudges,
    // additional data useful for roasting
    _raw: { allExpenseTxns, categoryTxCount: Object.fromEntries(categoryTxCount) }
  };
};

/**
 * Generate a personalized, data-driven roast based on the user's real transaction data.
 * Uses a TWO-TIER system:
 *   TIER 1 (Priority): Always roasts the latest expense transaction first.
 *     Builds 100+ templates organized by merchant, category, amount, and trend.
 *   TIER 2 (Fallback): If no matching template for latest tx, uses overall historical patterns.
 * Every roast computed from fresh MongoDB data — never cached.
 * Tracks last used template to avoid immediate repetition.
 *
 * @param {Array} transactions - Array of user transaction documents (sorted by createdAt desc)
 * @param {number} [lastRoastIndex] - Index of last roast to avoid immediate repeat
 * @returns {Object} { roast, suggestions, roastData }
 */
export const generateRoast = (transactions, lastRoastIndex = -1) => {
  // Edge case: no transactions
  if (!transactions || transactions.length === 0) {
    return {
      roast: "You have zero transactions. I can't roast what doesn't exist. Go touch some grass... and some money.",
      suggestions: [
        "Add a transaction to see what I really think about your spending.",
        "Start tracking your expenses — your future self will thank you."
      ],
      roastData: null,
      roastIndex: 0
    };
  }

// ── Compute ALL analytics from scratch every time ───────────────────────
  // Use shared isExpense() helper that checks both type and income-category guard
  const expenses = transactions.filter(t => isExpense(t));
  const incomeTxs = transactions.filter(t => !isExpense(t));

  if (expenses.length === 0) {
    return {
      roast: "You only have income transactions. Are you a robot? Go buy something so I can judge you.",
      suggestions: [
        "Add some expenses to unlock the roast feature.",
        "Treat yourself — responsibly."
      ],
      roastData: { expenseCount: 0, incomeCount: incomeTxs.length },
      roastIndex: 1
    };
  }

  const totalSpent = expenses.reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0);
  const totalIncome = incomeTxs.reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0);
  const surplus = totalIncome - totalSpent;
  const spendRate = totalIncome > 0 ? Math.round((totalSpent / totalIncome) * 100) : 0;

  // Category breakdown (expenses only)
  const catMap = new Map();
  const catTxCount = new Map();
  for (const tx of expenses) {
    const cat = tx.category || "Others";
    const amt = Math.abs(Number(tx.amount) || 0);
    catMap.set(cat, (catMap.get(cat) || 0) + amt);
    catTxCount.set(cat, (catTxCount.get(cat) || 0) + 1);
  }

  const sortedCats = Array.from(catMap.entries())
    .map(([name, value]) => ({ name, value, count: catTxCount.get(name) || 0 }))
    .sort((a, b) => b.value - a.value);

  const topCategory = sortedCats[0];
  const topCategoryPct = totalSpent > 0 ? Math.round((topCategory.value / totalSpent) * 100) : 0;
  const secondCategory = sortedCats[1];

  // Averages & extremes
  const avgTxSize = Math.round(totalSpent / expenses.length);
  const medianTx = [...expenses].sort((a, b) => Math.abs(Number(a.amount)) - Math.abs(Number(b.amount)))[Math.floor(expenses.length / 2)];
  const medianAmt = Math.round(Math.abs(Number(medianTx?.amount) || 0));

  const largestTx = expenses.reduce((max, tx) => {
    const amt = Math.abs(Number(tx.amount) || 0);
    return amt > (max.amount || 0) ? { merchant: tx.merchant || "Unknown", amount: amt, category: tx.category, date: tx.date } : max;
  }, { amount: 0 });

  const smallestTx = expenses.reduce((min, tx) => {
    const amt = Math.abs(Number(tx.amount) || 0);
    return amt > 0 && (amt < (min.amount || Infinity)) ? { merchant: tx.merchant || "Unknown", amount: amt, category: tx.category } : min;
  }, { amount: 0 });

  const mostFreqCat = sortedCats.reduce((max, c) => c.count > (max.count || 0) ? c : max, { count: 0 });
  const unusualExpenses = expenses.filter(t => Math.abs(Number(t.amount) || 0) > avgTxSize * 2);
  const hugeExpenses = expenses.filter(t => Math.abs(Number(t.amount) || 0) > avgTxSize * 5);

  // Merchant frequency
  const merchantCount = new Map();
  for (const tx of expenses) {
    const m = (tx.merchant || "Unknown").toLowerCase();
    merchantCount.set(m, (merchantCount.get(m) || 0) + 1);
  }
  const topMerchant = Array.from(merchantCount.entries()).sort((a, b) => b[1] - a[1])[0];

  // Flags
  const isOverspending = topCategoryPct > 40;
  const isSpendingAllIncome = totalIncome > 0 && spendRate > 90;
  const hasSavings = totalIncome > 0 && spendRate < 70;
  const frequentCatTxns = sortedCats.filter(c => c.count > 5);
  const hasRepeatedMerchant = topMerchant && topMerchant[1] > 3;
  const hasManyTxns = expenses.length > 15;
  const hasLowAvg = avgTxSize < 500;
  const hasHighAvg = avgTxSize > 5000;

  // ═══════════════════════════════════════════════════════════════════════
  // TIER 1: Always analyze and roast the latest transaction first
  // ═══════════════════════════════════════════════════════════════════════
  const latestExpense = expenses[0]; // sorted by createdAt desc
  const latestCategory = latestExpense ? (latestExpense.category || "Others") : null;
  const latestMerchant = latestExpense ? (latestExpense.merchant || "").toLowerCase().trim() : "";
  const latestAmount = latestExpense ? Math.abs(Number(latestExpense.amount) || 0) : 0;
  const isTinyTx = latestAmount >= 0 && latestAmount <= 300;
  const isMediumTx = latestAmount > 300 && latestAmount <= 5000;
  const isLargeTx = latestAmount > 5000;
  const isHugeTx = latestAmount > 20000;
  // Is this tx unusually large compared to user's avg?
  const isUnusuallyLarge = avgTxSize > 0 && latestAmount > avgTxSize * 3;

  // Helper: pick the next roast index from a pool using sequential cycling.
  // Sequential cycling (0 → 1 → 2 → ... → N-1 → 0) guarantees:
  //   - First click always shows index 0 (most specific template).
  //   - Every subsequent click shows the NEXT entry — never the same one twice
  //     in a row, never skipping entries, cycling back after all are shown.
  // avoidIdx = -1 means "first click", returns 0.
  // avoidIdx = N means "return (N+1) % poolLength".
  const pickRoastIndex = (pool, avoidIdx) => {
    if (!pool || pool.length === 0) return -1;
    if (pool.length === 1) return 0;
    // First click (avoidIdx === -1) → always start at index 0
    if (avoidIdx === -1) return 0;
    // Sequential: next index after avoidIdx, wrapping around
    return (avoidIdx + 1) % pool.length;
  };

  // ── Build roast pool from latest transaction ──────────────────────────
  const latestCatPool = [];

  // ═════════════════════════════════════════════════════════════════════
  // MERCHANT-SPECIFIC ROASTS (14 merchants × 3-7 templates each)
  // ═════════════════════════════════════════════════════════════════════

  // ━━ UBER ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (latestMerchant.includes("uber")) {
    latestCatPool.push(
      { template: `Uber for ₹${latestAmount.toLocaleString()}! Walking is free, but I guess your legs are on strike.`, pattern: "uber_legs" },
      { template: `Another Uber ride? At this point, you should just buy the car. The driver's getting paid more than your savings account earns in interest.`, pattern: "uber_buycar" },
      { template: `₹${latestAmount.toLocaleString()} on Uber. You know what else costs ₹${latestAmount.toLocaleString()}? A month of metro pass. Just saying.`, pattern: "uber_metro" },
      { template: `Uber ride detected. Your driver knows your office, your home, and your go-to late-night snack spot. That's more than your friends know.`, pattern: "uber_driver" },
      { template: `You spent ₹${latestAmount.toLocaleString()} on an Uber. I hope the AC was worth the subscription fee you're paying to your bank's "insufficient funds" department.`, pattern: "uber_ac" }
    );
  }

  // ━━ OLA ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (latestMerchant.includes("ola")) {
    latestCatPool.push(
      { template: `Ola for ₹${latestAmount.toLocaleString()}! Your 2-wheeler in the parking lot is feeling neglected. Go say sorry to it.`, pattern: "ola_2wheeler" },
      { template: `₹${latestAmount.toLocaleString()} on Ola. You could have bought a nice pair of shoes for that. But you chose to sit in traffic instead. Interesting life choices.`, pattern: "ola_shoes" },
      { template: `Ola ride! Your wallet is crying but at least you're not walking. Priorities, am I right?`, pattern: "ola_priorities" }
    );
  }

  // ━━ SWIGGY ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (latestMerchant.includes("swiggy")) {
    latestCatPool.push(
      { template: `Swiggy for ₹${latestAmount.toLocaleString()}! Your kitchen is like a vacation home — you visit it occasionally but never actually use it.`, pattern: "swiggy_kitchen" },
      { template: `₹${latestAmount.toLocaleString()} on Swiggy. You could have cooked 5 meals for that. But no, you chose convenience over your bank balance. Classic.`, pattern: "swiggy_cook" },
      { template: `Swiggy order incoming! Your delivery partner is basically your personal chef at this point. You should at least learn their name.`, pattern: "swiggy_chef" },
      { template: `Another Swiggy order? The only thing being delivered here is regret, with a side of french fries.`, pattern: "swiggy_regret" }
    );
  }

  // ━━ ZOMATO ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (latestMerchant.includes("zomato")) {
    latestCatPool.push(
      { template: `Zomato for ₹${latestAmount.toLocaleString()}! Your gold membership is paying off — for Zomato. Your savings account? Not so much.`, pattern: "zomato_gold" },
      { template: `₹${latestAmount.toLocaleString()} on Zomato. That's not food, that's a convenience tax you pay for being too tired to boil water.`, pattern: "zomato_tax" },
      { template: `Zomato order! You're not ordering food, you're ordering a break from adulting. I respect the hustle but your wallet doesn't.`, pattern: "zomato_adulting" }
    );
  }

  // ━━ MCDONALD'S ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (latestMerchant.includes("mcdonald") || latestMerchant.includes("mcdonald's")) {
    latestCatPool.push(
      { template: `McDonald's for ₹${latestAmount.toLocaleString()}! I'm lovin' it — said your stomach. Your arteries and wallet disagree in a group chat.`, pattern: "mcd_lovin" },
      { template: `₹${latestAmount.toLocaleString()} at McDonald's. That's a lot of McFlurry's. And a lot of "I'll start my diet tomorrow."`, pattern: "mcd_diet" },
      { template: `McDonald's again? At this point, you should just buy stock in them. At least then you'd get some returns on all this investment.`, pattern: "mcd_stock" },
      { template: `You spent ₹${latestAmount.toLocaleString()} at McDonald's. Ronald McDonald is funding his retirement thanks to you.`, pattern: "mcd_ronald" }
    );
  }

  // ━━ KFC ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (latestMerchant.includes("kfc")) {
    latestCatPool.push(
      { template: `KFC for ₹${latestAmount.toLocaleString()}! Finger lickin' good — and wallet emptyin' bad.`, pattern: "kfc_finger" },
      { template: `₹${latestAmount.toLocaleString()} at KFC. That chicken better have been raised by a Michelin-star farmer for that price.`, pattern: "kfc_chicken" },
      { template: `KFC bucket detected. The Colonel is proud. Your nutritionist is disappointed. Your bank account is in shock.`, pattern: "kfc_colonel" },
      { template: `₹${latestAmount.toLocaleString()} on KFC. You didn't just buy food — you bought a deep-fried apology to your savings account.`, pattern: "kfc_apology" },
      { template: `KFC again? At ₹${latestAmount.toLocaleString()} a visit, the Colonel has a second home funded by you. Congratulations on this achievement.`, pattern: "kfc_secondhome" }
    );
  }

  // ━━ STARBUCKS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (latestMerchant.includes("starbucks")) {
    latestCatPool.push(
      { template: `Starbucks for ₹${latestAmount.toLocaleString()}! You paid ₹${latestAmount.toLocaleString()} for a drink you could make at home for ₹10. But the aesthetic, right?`, pattern: "sbux_aesthetic" },
      { template: `₹${latestAmount.toLocaleString()} at Starbucks. That's not coffee, that's a liquid status symbol. Hope your name was spelled right on the cup.`, pattern: "sbux_name" },
      { template: `Starbucks again? Your pumpkin spice latte habit is now a line item in the budget. Between "rent" and "food," there's "coffee that costs more than both combined."`, pattern: "sbux_budget" }
    );
  }

  // ━━ AMAZON ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (latestMerchant.includes("amazon")) {
    latestCatPool.push(
      { template: `Amazon for ₹${latestAmount.toLocaleString()}! Your package delivery person knows your schedule better than your own family does.`, pattern: "amz_delivery" },
      { template: `₹${latestAmount.toLocaleString()} on Amazon. Jeff Bezos just added another zero to his yacht fund. You're basically a co-owner at this point.`, pattern: "amz_bezos" },
      { template: `Amazon purchase detected! The "Buy Now" button is your toxic trait and we both know it.`, pattern: "amz_toxic" },
      { template: `You spent ₹${latestAmount.toLocaleString()} on Amazon. Was it something you needed? Or something that gave you 3 seconds of dopamine followed by a lifetime of "why did I buy this?"`, pattern: "amz_dopamine" },
      { template: `Another Amazon order! Your mailbox should start paying rent at this rate. It's seen more action than your social calendar.`, pattern: "amz_rent" }
    );
  }

  // ━━ FLIPKART ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (latestMerchant.includes("flipkart")) {
    latestCatPool.push(
      { template: `Flipkart for ₹${latestAmount.toLocaleString()}! Big Billion Days is every day for you, isn't it?`, pattern: "flip_billion" },
      { template: `₹${latestAmount.toLocaleString()} on Flipkart. I hope whatever you bought comes with a side of financial regret — free of cost, of course.`, pattern: "flip_regret" },
      { template: `Flipkart order! You're keeping the Indian e-commerce industry alive single-handedly. The economy thanks you.`, pattern: "flip_economy" }
    );
  }

  // ━━ MYNTRA ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (latestMerchant.includes("myntra")) {
    latestCatPool.push(
      { template: `Myntra for ₹${latestAmount.toLocaleString()}! New clothes for the wardrobe, new holes in the wallet. Balanced, as all things should be.`, pattern: "myntra_balanced" },
      { template: `₹${latestAmount.toLocaleString()} on Myntra. Your closet is starting a union. It needs more space and better working conditions.`, pattern: "myntra_closet" },
      { template: `Myntra haul! You're not shopping, you're curating a museum of "I have nothing to wear" with ₹${latestAmount.toLocaleString()} worth of exhibits.`, pattern: "myntra_museum" }
    );
  }

  // ━━ AIRTEL ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (latestMerchant.includes("airtel")) {
    latestCatPool.push(
      { template: `Airtel for ₹${latestAmount.toLocaleString()}! You paid to stay connected. Too bad your bank account and your savings aren't connected anymore.`, pattern: "airtel_connected" },
      { template: `₹${latestAmount.toLocaleString()} on Airtel. 5G speeds, ₹${latestAmount.toLocaleString()} bills. At least you can stream your sorrows in high definition.`, pattern: "airtel_5g" },
      { template: `Airtel recharge! The most expensive thing in India isn't gold or petrol — it's staying connected. ₹${latestAmount.toLocaleString()} for the privilege of receiving OTPs.`, pattern: "airtel_otp" }
    );
  }

  // ━━ JIO ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (latestMerchant.includes("jio")) {
    latestCatPool.push(
      { template: `Jio for ₹${latestAmount.toLocaleString()}! Reliance Jio — making data affordable and your bank account lighter since 2016.`, pattern: "jio_data" },
      { template: `₹${latestAmount.toLocaleString()} on Jio. Unlimited data, limited money. Mukesh bhai thanks you for your contribution.`, pattern: "jio_mukesh" },
      { template: `Jio recharge! Your phone has more data than your bank account has balance. Let that sink in.`, pattern: "jio_data_vs_balance" }
    );
  }

  // ━━ NETFLIX ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (latestMerchant.includes("netflix")) {
    latestCatPool.push(
      { template: `Netflix for ₹${latestAmount.toLocaleString()}! You're paying for the privilege of scrolling through titles for 45 minutes and watching nothing.`, pattern: "netflix_scroll" },
      { template: `₹${latestAmount.toLocaleString()} on Netflix. That's ₹${latestAmount.toLocaleString()} to watch the same show you've already seen 3 times. Comfort viewing has a price.`, pattern: "netflix_rerun" },
      { template: `Netflix subscription! You're not paying for content, you're paying to avoid social interaction. Money well spent, honestly.`, pattern: "netflix_avoid" }
    );
  }

  // ━━ SPOTIFY ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (latestMerchant.includes("spotify")) {
    latestCatPool.push(
      { template: `Spotify for ₹${latestAmount.toLocaleString()}! You're paying for music you could get for free with ads. But ads are beneath you, I forgot you're premium.`, pattern: "spotify_premium" },
      { template: `₹${latestAmount.toLocaleString()} on Spotify. Your playlist is fire but your bank account is on life support. At least you have good taste in something.`, pattern: "spotify_playlist" },
      { template: `Spotify subscription! You're paying for the ability to skip songs you chose to play. The irony is not lost on me.`, pattern: "spotify_skip" }
    );
  }

  // ═════════════════════════════════════════════════════════════════════
  // CATEGORY-SPECIFIC ROASTS (when merchant doesn't match)
  // ═════════════════════════════════════════════════════════════════════

  // ━━ SHOPPING ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (latestCatPool.length === 0 && (latestCategory === "Shopping" || latestMerchant.includes("nykaa") || latestMerchant.includes("ajio") || latestMerchant.includes("meesho") || latestMerchant.includes("croma") || latestMerchant.includes("reliance"))) {
    latestCatPool.push(
      { template: `Shopping for ₹${latestAmount.toLocaleString()}! Your wallet is crying but your dopamine is thriving. The eternal trade-off.`, pattern: "shop_dopamine" },
      { template: `₹${latestAmount.toLocaleString()} on shopping. Your closet doors are sweating nervously. They're running out of hangers.`, pattern: "shop_closet" },
      { template: `Another shopping spree? The "Add to Cart" button is the most dangerous thing in your life right now.`, pattern: "shop_cart" },
      { template: `You spent ₹${latestAmount.toLocaleString()} shopping. If retail therapy was a prescription, you'd be overdosing.`, pattern: "shop_therapy" },
      { template: `Shopping again! Your bank account called. It wants a break from all this "treat yourself" nonsense.`, pattern: "shop_break" },
      { template: `₹${latestAmount.toLocaleString()} on shopping! You're not buying things, you're buying the illusion of happiness. And it's working. Kinda.`, pattern: "shop_happiness" }
    );
  }

  // ━━ FOOD & DINING ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (latestCatPool.length === 0 && (latestCategory === "Food & Dining" || latestMerchant.includes("pizza") || latestMerchant.includes("burger") || latestMerchant.includes("cafe") || latestMerchant.includes("restaurant") || latestMerchant.includes("dining") || latestMerchant.includes("dosa") || latestMerchant.includes("biryani") || latestMerchant.includes("canteen"))) {
    latestCatPool.push(
      { template: `Food for ₹${latestAmount.toLocaleString()}! Your stomach is happy but your wallet is filing for divorce.`, pattern: "food_divorce" },
      { template: `Eating out again? You could have cooked a feast for ₹${latestAmount.toLocaleString()}. But no, you chose the easy way. The bank account is judging.`, pattern: "food_cook" },
      { template: `₹${latestAmount.toLocaleString()} on food! I'm not saying you're a foodie, but your spending says otherwise. And your waistline, probably.`, pattern: "food_foodie" },
      { template: `You spent ₹${latestAmount.toLocaleString()} eating out. The convenience fee of life is getting expensive. Maybe learn to boil an egg?`, pattern: "food_egg" },
      { template: `Food & Dining: where happiness meets bankruptcy. ₹${latestAmount.toLocaleString()} for a meal that lasts 20 minutes and regret that lasts a week.`, pattern: "food_regret_week" },
      { template: `₹${latestAmount.toLocaleString()} on food delivery. Your kitchen must feel like a museum — visited occasionally but never truly lived in.`, pattern: "food_museum" }
    );
  }

  // ━━ BILLS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (latestCatPool.length === 0 && (latestCategory === "Bills" || latestMerchant.includes("act") || latestMerchant.includes("tata") || latestMerchant.includes("electricity") || latestMerchant.includes("water") || latestMerchant.includes("broadband") || latestMerchant.includes("recharge") || latestMerchant.includes("gas") || latestMerchant.includes("lpg"))) {
    latestCatPool.push(
      { template: `Bills paid: ₹${latestAmount.toLocaleString()}! Congratulations, you're a functioning adult. Here's a participation trophy. It costs ₹${latestAmount.toLocaleString()}.`, pattern: "bills_trophy" },
      { template: `₹${latestAmount.toLocaleString()} on bills. The government thanks you for your contribution to the nation's GDP. You're basically a philanthropist.`, pattern: "bills_gdp" },
      { template: `Bill payment detected! That's the sound of your money leaving with a polite "thank you" and zero intention of ever coming back.`, pattern: "bills_goodbye" },
      { template: `You paid ₹${latestAmount.toLocaleString()} in bills. Being an adult is expensive. The worst part? You have to do it again next month.`, pattern: "bills_adult_again" },
      { template: `Bills! The only subscription you can't cancel. ₹${latestAmount.toLocaleString()} for the privilege of having electricity and internet. Modern life, baby.`, pattern: "bills_modern" }
    );
  }

  // ━━ TRANSPORT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (latestCatPool.length === 0 && (latestCategory === "Transport" || latestMerchant.includes("rapido") || latestMerchant.includes("metro") || latestMerchant.includes("taxi") || latestMerchant.includes("cab") || latestMerchant.includes("petrol") || latestMerchant.includes("fuel") || latestMerchant.includes("bus") || latestMerchant.includes("auto") || latestMerchant.includes("indrive"))) {
    latestCatPool.push(
      { template: `Transport for ₹${latestAmount.toLocaleString()}! Walking is free, you know. Your legs are not just for decoration.`, pattern: "trans_legs" },
      { template: `₹${latestAmount.toLocaleString()} on transport! At this rate, you could have bought a car. Well, maybe a cycle. Definitely a good cycle.`, pattern: "trans_cycle" },
      { template: `You spent ₹${latestAmount.toLocaleString()} on travel. Your carbon footprint isn't the only thing growing — your expenses are too.`, pattern: "trans_carbon" },
      { template: `Transport expense! You're funding the oil industry at this point. Single-handedly keeping petrol prices high.`, pattern: "trans_oil" },
      { template: `₹${latestAmount.toLocaleString()} getting from point A to point B. At this rate, teleportation can't come soon enough.`, pattern: "trans_teleport" }
    );
  }

  // ━━ HEALTH ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (latestCatPool.length === 0 && (latestCategory === "Health" || latestMerchant.includes("apollo") || latestMerchant.includes("medplus") || latestMerchant.includes("pharmacy") || latestMerchant.includes("hospital") || latestMerchant.includes("doctor") || latestMerchant.includes("clinic") || latestMerchant.includes("medical") || latestMerchant.includes("practo") || latestMerchant.includes("1mg") || latestMerchant.includes("netmeds") || latestMerchant.includes("chemist") || latestMerchant.includes("wellness"))) {
    latestCatPool.push(
      { template: `Health expense: ₹${latestAmount.toLocaleString()}! Being healthy is expensive. Being unhealthy is more expensive. You can't win, so just laugh through the pain.`, pattern: "health_cantwin" },
      { template: `₹${latestAmount.toLocaleString()} at the pharmacy. The only place where you pay a lot and leave feeling worse about life. At least you got free health advice you won't follow.`, pattern: "health_pharmacy" },
      { template: `Medical expense! Your body is a temple — a very expensive temple with a donation box at every organ.`, pattern: "health_temple" },
      { template: `Doctor visit: ₹${latestAmount.toLocaleString()} for someone to tell you to eat better, sleep more, and exercise. Groundbreaking advice. Worth every rupee.`, pattern: "health_doctor" },
      { template: `₹${latestAmount.toLocaleString()} on healthcare. Hope you're okay. Your wallet definitely isn't though. It's on life support.`, pattern: "health_wallet" }
    );
  }

  // ━━ INCOME ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (latestCatPool.length === 0 && (latestCategory === "Income" || latestMerchant.includes("salary") || latestMerchant.includes("payroll") || latestMerchant.includes("stipend") || latestMerchant.includes("freelance") || latestMerchant.includes("bonus") || latestMerchant.includes("refund") || latestMerchant.includes("cashback") || latestMerchant.includes("credit"))) {
    latestCatPool.push(
      { template: `Salary credited: ₹${latestAmount.toLocaleString()}! Quick, hide it before your spending brain wakes up and ruins everything in 48 hours.`, pattern: "income_hide" },
      { template: `₹${latestAmount.toLocaleString()} incoming! Look at you, making money. You're basically a functioning member of society. Don't let it go to your head. Or your wallet.`, pattern: "income_func" },
      { template: `Money came in! Give it 3 days max before it's gone. I know you. You know you. Let's not pretend otherwise.`, pattern: "income_3days" },
      { template: `Income detected! The circle of life: earn, spend, regret, repeat. You're excelling at step 2.`, pattern: "income_circle" }
    );
  }

  // ━━ ENTERTAINMENT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (latestCatPool.length === 0 && (latestCategory === "Entertainment" || latestMerchant.includes("prime") || latestMerchant.includes("hotstar") || latestMerchant.includes("disney") || latestMerchant.includes("youtube") || latestMerchant.includes("sony") || latestMerchant.includes("zee5") || latestMerchant.includes("voot"))) {
    latestCatPool.push(
      { template: `Entertainment for ₹${latestAmount.toLocaleString()}! You're paying for the privilege of procrastinating on your goals. Respect the dedication.`, pattern: "ent_procrastinate" },
      { template: `₹${latestAmount.toLocaleString()} on streaming. That's a lot of content you'll "definitely watch this weekend" and never do.`, pattern: "ent_watchlist" },
      { template: `Entertainment expense! You could have bought a book, learned a skill, or started a hobby. But you chose to watch strangers live better lives than you. Cool.`, pattern: "ent_skill" },
      { template: `₹${latestAmount.toLocaleString()} for entertainment. I hope your screen time is at least impressive enough to brag about.`, pattern: "ent_screentime" }
    );
  }

  // ━━ GROCERIES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (latestCatPool.length === 0 && (latestCategory === "Groceries" || latestMerchant.includes("dmart") || latestMerchant.includes("d mart") || latestMerchant.includes("big basket") || latestMerchant.includes("zepto") || latestMerchant.includes("blinkit") || latestMerchant.includes("instamart") || latestMerchant.includes("provision") || latestMerchant.includes("vegetable") || latestMerchant.includes("bakery"))) {
    latestCatPool.push(
      { template: `Groceries for ₹${latestAmount.toLocaleString()}! Adulting level: unlocked. You bought food to cook at home. Your kitchen doesn't know what to do with itself.`, pattern: "grocer_adult" },
      { template: `₹${latestAmount.toLocaleString()} on groceries. That's a lot of vegetables you're going to watch rot in the fridge while you order Swiggy.`, pattern: "grocer_rot" },
      { template: `Grocery run! You spent ₹${latestAmount.toLocaleString()} on healthy food. By Friday you'll be ordering pizza. I've seen this movie before.`, pattern: "grocer_pizza" },
      { template: `₹${latestAmount.toLocaleString()} at the grocery store. The health kick is real. Let's see how long it lasts. My bet is 3 days.`, pattern: "grocer_healthkick" }
    );
  }

  // ━━ TRAVEL ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (latestCatPool.length === 0 && (latestCategory === "Travel" || latestMerchant.includes("flight") || latestMerchant.includes("hotel") || latestMerchant.includes("booking") || latestMerchant.includes("makemytrip") || latestMerchant.includes("goibibo") || latestMerchant.includes("ixigo") || latestMerchant.includes("oyo") || latestMerchant.includes("airbnb") || latestMerchant.includes("resort") || latestMerchant.includes("holiday") || latestMerchant.includes("vacation"))) {
    latestCatPool.push(
      { template: `Travel for ₹${latestAmount.toLocaleString()}! You're investing in memories they said. Your bank account calls it "unrecoverable expenditure."`, pattern: "trav_memories" },
      { template: `₹${latestAmount.toLocaleString()} on travel! The wanderlust is real. The wallet? Not so much. But YOLO, right?`, pattern: "trav_yolo" },
      { template: `Travel booking! You're planning an escape from your financial reality. I hope the destination is worth the debt.`, pattern: "trav_escape" }
    );
  }

  // ━━ INVESTMENT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (latestCatPool.length === 0 && (latestCategory === "Investment" || latestMerchant.includes("zerodha") || latestMerchant.includes("groww") || latestMerchant.includes("upstox") || latestMerchant.includes("mutual") || latestMerchant.includes("stock") || latestMerchant.includes("sip") || latestMerchant.includes("nps") || latestMerchant.includes("ppf") || latestMerchant.includes("fd") || latestMerchant.includes("bonds"))) {
    latestCatPool.push(
      { template: `Investment of ₹${latestAmount.toLocaleString()}! Look at you, being financially responsible. Are you sure you're using the right app?`, pattern: "inv_resp" },
      { template: `₹${latestAmount.toLocaleString()} invested! Someone's been reading personal finance blogs. Your future self is doing a happy dance. Your current self is eating maggi. Balanced.`, pattern: "inv_maggi" },
      { template: `Investment detected! I was going to roast you but honestly — you're making better life choices than 90% of people here. Well done.`, pattern: "inv_well_done" }
    );
  }

  // ━━ EDUCATION ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (latestCatPool.length === 0 && (latestCategory === "Education" || latestMerchant.includes("udemy") || latestMerchant.includes("coursera") || latestMerchant.includes("unacademy") || latestMerchant.includes("byjus") || latestMerchant.includes("vedantu") || latestMerchant.includes("skillshare") || latestMerchant.includes("course") || latestMerchant.includes("tution") || latestMerchant.includes("tuition") || latestMerchant.includes("fee") || latestMerchant.includes("school") || latestMerchant.includes("college") || latestMerchant.includes("exam"))) {
    latestCatPool.push(
      { template: `Education for ₹${latestAmount.toLocaleString()}! Investing in yourself they said. Now you're educated AND broke. Double whammy.`, pattern: "edu_broke" },
      { template: `₹${latestAmount.toLocaleString()} on learning! Knowledge is power. And apparently, it's also expensive. Hope the ROI is better than your last Amazon purchase.`, pattern: "edu_roi" },
      { template: `Course purchase! You're one of those "I'll learn this and change my life" people. I respect the hustle. Let's see if you finish it though.`, pattern: "edu_hustle" }
    );
  }

  // ═════════════════════════════════════════════════════════════════════
  // SPECIAL PATTERNS (add more templates based on amount/trend)
  // ═════════════════════════════════════════════════════════════════════

  // ━━ UNUSUALLY LARGE PURCHASE (> 3x user's avg) ━━━━━━━━━━━━━━━━━━━━━━━
  if (isUnusuallyLarge && latestCatPool.length < 6) {
    latestCatPool.push(
      { template: `₹${latestAmount.toLocaleString()} on ONE thing?! That's ${Math.round(latestAmount / avgTxSize)}x your normal spend. What happened? Did you accidentally buy the store?`, pattern: "large_x_times" },
      { template: `Hold up! ₹${latestAmount.toLocaleString()} in a single transaction! Your usual spend is ₹${avgTxSize.toLocaleString()}. This is not a purchase, this is a STATEMENT.`, pattern: "large_statement" },
      { template: `Whoa there! ₹${latestAmount.toLocaleString()} is ${Math.round(latestAmount / avgTxSize)}x your average transaction. That's not "treating yourself" — that's a full-blown celebration.`, pattern: "large_celebration" },
      { template: `₹${latestAmount.toLocaleString()} at once! Your card is calling for a therapy session after this swipe. I hope it was worth the credit card bill.`, pattern: "large_therapy" },
      { template: `A transaction of ₹${latestAmount.toLocaleString()} when you normally spend ₹${avgTxSize.toLocaleString()}! That's not a purchase, that's an event. Did you at least get a receipt that looks like a novel?`, pattern: "large_event" }
    );
  }

  // ━━ HUGE (> ₹20k) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (isHugeTx && latestCatPool.length < 6) {
    latestCatPool.push(
      { template: `₹${latestAmount.toLocaleString()}! That's not a purchase, that's a life event. I hope it came with a lifetime warranty and a farewell party for your money.`, pattern: "huge_lifeevent" },
      { template: `₹${latestAmount.toLocaleString()} in one go! Did you buy the entire store or just everything inside it? At this rate, your card needs its own financial advisor.`, pattern: "huge_store" },
      { template: `₹${latestAmount.toLocaleString()}!!! That's it. That's the tweet. Your bank account is speechless too.`, pattern: "huge_speechless" },
      { template: `A ₹${latestAmount.toLocaleString()} transaction?! You're not spending money, you're relocating it. Permanently.`, pattern: "huge_relocate" }
    );
  }

  // ━━ TINY / FUNNY (₹50–₹300) — light-hearted, never savage ━━━━━━━━━━━━
  if (isTinyTx && latestCatPool.length < 4) {
    latestCatPool.push(
      { template: `₹${latestAmount.toLocaleString()} for ${latestMerchant || "something"}? That's not even pocket change, that's couch cushion money. Your bank account didn't even blink.`, pattern: "tiny_couch" },
      { template: `₹${latestAmount.toLocaleString()} spent! At this rate, you'll be a millionaire spender in about 10,000 more transactions. Slow and steady wins the race — to broke.`, pattern: "tiny_10000" },
      { template: `A tiny ₹${latestAmount.toLocaleString()} expense! Like a financial mosquito bite — barely noticeable until there's 50 of them.`, pattern: "tiny_mosquito" },
      { template: `₹${latestAmount.toLocaleString()}! That's not a transaction, that's a micro-payment. You're basically paying in emotional support at this point.`, pattern: "tiny_micro" }
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // TIER 2 (Fallback): Historical overall spending analysis
  // ═══════════════════════════════════════════════════════════════════════
  const historicalPool = [];

  // ━━ Top Category Dominance ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (topCategoryPct > 50) {
    historicalPool.push({ template: `${topCategory.name} ate ${topCategoryPct}% of your wallet. It's not a category, it's a black hole. And your money is the light that never escapes.`, pattern: "hist_cat_blackhole" });
    historicalPool.push({ template: `${topCategoryPct}% on ${topCategory.name}. ${topCategory.name} isn't a category for you, it's a lifestyle. Your 401k just sighed.`, pattern: "hist_cat_lifestyle" });
    historicalPool.push({ template: `Are you and ${topCategory.name} exclusive? Because ₹${topCategory.value.toLocaleString()} says you're in a committed relationship.`, pattern: "hist_cat_exclusive" });
    historicalPool.push({ template: `You: "I'll diversify my spending." Also you: ${topCategoryPct}% on ${topCategory.name}. Sure, Jan.`, pattern: "hist_cat_jan" });
  } else if (topCategoryPct > 35) {
    historicalPool.push({ template: `${topCategory.name} dominates ${topCategoryPct}% of your spending. The rest is just noise. And regret. Mostly regret.`, pattern: "hist_cat_noise" });
    historicalPool.push({ template: `You dropped ₹${topCategory.value.toLocaleString()} on ${topCategory.name}. That's not budgeting, that's having an expensive hobby.`, pattern: "hist_cat_hobby" });
    historicalPool.push({ template: `${topCategoryPct}% of your money goes to ${topCategory.name}. The other ${100 - topCategoryPct}% is just there for emotional support.`, pattern: "hist_cat_support" });
  } else {
    historicalPool.push({ template: `${topCategory.name} leads at ${topCategoryPct}%. Your spending is as diversified as a mutual fund. Too bad this isn't an investment.`, pattern: "hist_cat_diverse" });
    historicalPool.push({ template: `Your spending is spread out nicely. Financially prudent? Or pathologically indecisive? The roast committee is split.`, pattern: "hist_cat_indecisive" });
    historicalPool.push({ template: `You spend across ${sortedCats.length} categories. Very "diversified portfolio" energy. If only your savings were as balanced.`, pattern: "hist_cat_balanced" });
  }

  // ━━ Income Burn ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (totalIncome > 0 && isSpendingAllIncome) {
    historicalPool.push({ template: `You're spending ${spendRate}% of your income. Your retirement plan is just "win the lottery." Hope you've bought a ticket.`, pattern: "hist_burn_lottery" });
    historicalPool.push({ template: `Your bank account is a hotel — money visits briefly, enjoys the stay, and leaves without checking out.`, pattern: "hist_burn_hotel" });
    historicalPool.push({ template: `You earn ₹${totalIncome.toLocaleString()} and spend ₹${totalSpent.toLocaleString()}. That's ${spendRate}%. The math isn't mathing, bestie.`, pattern: "hist_burn_math" });
  } else if (totalIncome > 0 && spendRate > 80) {
    historicalPool.push({ template: `${spendRate}% of your income goes to spending. The remaining ${100 - spendRate}% is just pocket fluff — there for emotional comfort.`, pattern: "hist_burn_fluff" });
    historicalPool.push({ template: `You save ${100 - spendRate}% of your income. That's like ordering a full meal and leaving one fry. Technically restraint?`, pattern: "hist_burn_fry" });
  } else if (totalIncome > 0 && hasSavings) {
    historicalPool.push({ template: `You save ${100 - spendRate}% of your income. Are you sure you're a millennial? That level of responsibility is suspicious.`, pattern: "hist_save_millennial" });
  }

  // ━━ Surplus / Deficit ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (totalIncome > 0 && surplus < 0) {
    historicalPool.push({ template: `You're in the red by ₹${Math.abs(surplus).toLocaleString()}. Your financial strategy is "hope for the best, ignore the rest."`, pattern: "hist_def_hope" });
    historicalPool.push({ template: `Negative cashflow: ₹${Math.abs(surplus).toLocaleString()}. The definition of insanity is spending more than you earn. Welcome to the asylum.`, pattern: "hist_def_insane" });
  } else if (totalIncome > 0 && surplus > totalIncome * 0.3) {
    historicalPool.push({ template: `You save ${Math.round((surplus / totalIncome) * 100)}% of your income. Are you a responsible adult? In this economy? On MY app? Get out.`, pattern: "hist_surplus_adult" });
  } else if (totalIncome > 0 && surplus > 0) {
    historicalPool.push({ template: `Modest surplus of ₹${surplus.toLocaleString()}. Not bad. Not great either. You're the "average student" of personal finance.`, pattern: "hist_surplus_avg" });
  }

// ━━ Shopping (historical) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const shopCat = sortedCats.find(c => c.name === "Shopping");
  if (shopCat && shopCat.value > 5000) {
    historicalPool.push({ template: `₹${shopCat.value.toLocaleString()} on shopping overall! You're not buying things, you're collecting regrets with price tags.`, pattern: "hist_shop_regret" });
    historicalPool.push({ template: `₹${shopCat.value.toLocaleString()} on shopping. That's not retail therapy, that's retail chemotherapy for your savings account.`, pattern: "hist_shop_chemo" });
  }

  // ━━ Food (historical) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const foodCat = sortedCats.find(c => c.name === "Food & Dining");
  if (foodCat && foodCat.value > totalSpent * 0.3) {
    historicalPool.push({ template: `${Math.round((foodCat.value / totalSpent) * 100)}% of your total goes to food! Your kitchen is a museum, not a cooking space.`, pattern: "hist_food_museum" });
    historicalPool.push({ template: `You've spent ₹${foodCat.value.toLocaleString()} on food overall. You're not a foodie, you're a financial disaster with good taste.`, pattern: "hist_food_disaster" });
  }

  // ━━ Transport (historical) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const transCat = sortedCats.find(c => c.name === "Transport");
  if (transCat && transCat.count > 5) {
    historicalPool.push({ template: `${transCat.count} total transport trips! Are you a commuter or just allergic to staying in one place for more than 2 hours?`, pattern: "hist_trans_commuter" });
  }
  if (transCat && transCat.value > 10000) {
    historicalPool.push({ template: `₹${transCat.value.toLocaleString()} on transport overall! You could have bought a used car. Or a very good bicycle. Or 1000 bus tickets.`, pattern: "hist_trans_total" });
  }

  // ━━ Health (historical) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const healthCat = sortedCats.find(c => c.name === "Health");
  if (healthCat && healthCat.value > 3000) {
    historicalPool.push({ template: `₹${healthCat.value.toLocaleString()} on health. Your body is a temple — with a very expensive donation box at every organ.`, pattern: "hist_health_temple" });
    historicalPool.push({ template: `Health expenses: ₹${healthCat.value.toLocaleString()}. The irony of spending money to stay alive while your bank account slowly dies.`, pattern: "hist_health_irony" });
  }

  // ━━ Merchant frequency ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (hasRepeatedMerchant && topMerchant) {
    const merName = topMerchant[0].charAt(0).toUpperCase() + topMerchant[0].slice(1);
    const merCount = topMerchant[1];
    historicalPool.push({ template: `You visited ${merName} ${merCount} times! Do they have a seat with your name on it? A loyalty card? A shrine?`, pattern: "hist_freq_shrine" });
    historicalPool.push({ template: `${merCount} transactions at ${merName}. That's not loyalty, that's a pattern. And patterns need intervention.`, pattern: "hist_freq_intervention" });
  }

  // ━━ Volume ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (hasManyTxns) {
    historicalPool.push({ template: `${expenses.length} total swipes! Your card is getting more action than a Bollywood hero in a dance number.`, pattern: "hist_vol_bolly" });
    historicalPool.push({ template: `₹${totalSpent.toLocaleString()} spread over ${expenses.length} transactions. That's roughly ₹${Math.round(totalSpent / expenses.length).toLocaleString()} per "I deserve this."`, pattern: "hist_vol_deserve" });
  } else {
    historicalPool.push({ template: `Only ${expenses.length} expenses total. Either you're very intentional or you have the spending personality of a monk.`, pattern: "hist_vol_monk" });
  }

  // ━━ Large expenses (historical) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (hugeExpenses.length > 0) {
    historicalPool.push({ template: `You have ${hugeExpenses.length} transactions over 5x your normal. That's not "living your best life" — that's a shopping spree with amnesia.`, pattern: "hist_huge_amnesia" });
  }
  if (largestTx.amount > 0) {
    historicalPool.push({ template: `Your biggest flex: ₹${largestTx.amount.toLocaleString()} at ${largestTx.merchant || "somewhere"}. Your bank account saw it coming but couldn't stop it.`, pattern: "hist_largest_flex" });
  }

  // ━━ Avg tx size ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (hasHighAvg) {
    historicalPool.push({ template: `Your average transaction is ₹${avgTxSize.toLocaleString()}. Do you only emerge from your cave for "significant" purchases? Define significant.`, pattern: "hist_avg_high" });
  }
  if (hasLowAvg) {
    historicalPool.push({ template: `Your average is ₹${avgTxSize}. Death by a thousand paper cuts — each tiny, but together? Your bank account is bleeding out.`, pattern: "hist_avg_low" });
  }

  // ━━ Generic ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  historicalPool.push({ template: `Total damage: ₹${totalSpent.toLocaleString()}. Poof. Gone. Like Houdini, but with more regret and less applause.`, pattern: "hist_gen_poof" });
  historicalPool.push({ template: `You've spent ₹${totalSpent.toLocaleString()}. You're not "managing money" — you're giving it a temporary shelter before it leaves forever.`, pattern: "hist_gen_shelter" });
  historicalPool.push({ template: `I analyzed your spending. The economy is booming thanks to you. You're basically a one-person stimulus package.`, pattern: "hist_gen_stimulus" });
  historicalPool.push({ template: `₹${totalSpent.toLocaleString()} total spent. You're the reason "vibe-cession" is a word. The economy vibes, you cess... ion.`, pattern: "hist_gen_vibe" });

  // ── Decide which pool ─────────────────────────────────────────────────
  let poolToUse;
  let usedLatestCategory;
  let usedMerchant;
  let usedIsLarge;
  let usedIsTiny;

  // Always prefer latest transaction pool if we have templates
  if (latestCatPool.length > 0) {
    poolToUse = latestCatPool;
    usedLatestCategory = latestCategory;
    usedMerchant = latestMerchant;
    usedIsLarge = isHugeTx || isUnusuallyLarge;
    usedIsTiny = isTinyTx;
  } else {
    // Fallback to historical
    poolToUse = historicalPool;
    usedLatestCategory = null;
    usedMerchant = null;
    usedIsLarge = false;
    usedIsTiny = false;
  }

  // ── Pick a roast avoiding the last one used ──
  const chosenIndex = pickRoastIndex(poolToUse, lastRoastIndex);
  const roast = poolToUse[chosenIndex]?.template || "I analyzed your spending. You're definitely something.";

  // ── Dynamic suggestions based on the same analysis ─────────────────────
  const suggestions = [];
  const usedCat = usedLatestCategory || (topCategory ? topCategory.name : null);

  // Suggestion 1: Category-specific
  if (usedCat === "Shopping" || (usedMerchant && (usedMerchant.includes("amazon") || usedMerchant.includes("flipkart") || usedMerchant.includes("myntra") || usedMerchant.includes("nykaa")))) {
    suggestions.push(`Wait 24 hours before any online purchase. Impulse buying adds 20-30% to your monthly spend. Set a ₹${Math.round(latestAmount * 0.7).toLocaleString()} cap for your next shopping trip.`);
    suggestions.push(`Unsubscribe from marketing emails. If you don't see the sale, you won't be tempted.`);
  } else if (usedCat === "Food & Dining" || (usedMerchant && (usedMerchant.includes("swiggy") || usedMerchant.includes("zomato") || usedMerchant.includes("mcdonald") || usedMerchant.includes("kfc") || usedMerchant.includes("starbucks")))) {
    suggestions.push(`Try cooking 3 more meals at home this week. Even basic meals cost 70% less than ordering in.`);
    suggestions.push(`Set a weekly eating-out budget of ₹${Math.round((latestAmount < 500 ? 2000 : latestAmount * 3)).toLocaleString()} and stick to it. Your wallet (and waistline) will thank you.`);
  } else if (usedCat === "Bills" || (usedMerchant && (usedMerchant.includes("airtel") || usedMerchant.includes("jio")))) {
    suggestions.push(`Review your current plan vs actual data usage. You might save ₹${Math.round(latestAmount * 0.25).toLocaleString()}-${Math.round(latestAmount * 0.4).toLocaleString()} per month on a cheaper plan.`);
    suggestions.push(`Negotiate your bills annually. Loyalty discounts exist — you just have to ask.`);
  } else if (usedCat === "Transport" || (usedMerchant && (usedMerchant.includes("uber") || usedMerchant.includes("ola")))) {
    suggestions.push(`Try public transport or walking for short trips (< 3 km). Even 2 fewer cab rides per week saves ₹${Math.min(500, Math.round(latestAmount * 2)).toLocaleString()}+ monthly.`);
    suggestions.push(`Compare Uber vs Ola rates before booking. Surge pricing can cost 2x more — schedule rides during off-peak hours.`);
  } else if (usedCat === "Health") {
    suggestions.push(`Preventive health checkups cost a fraction of reactive treatments. Build a health fund of ₹${Math.max(5000, Math.round(latestAmount * 2)).toLocaleString()} for medical emergencies.`);
    suggestions.push(`Check if your insurance covers pharmacy purchases. You might be paying for things that should be free.`);
  } else if (usedCat === "Income" || usedCat === "Salary") {
    suggestions.push(`Auto-invest 20-30% of your income the day it hits your account. "Pay yourself first" is a cliché because it works.`);
    suggestions.push(`Build a 6-month emergency fund. Start with 1 month's expenses = ₹${Math.round(totalSpent / (expenses.length || 1) * 30).toLocaleString()}.`);
  } else if (usedIsLarge || usedIsTiny) {
    suggestions.push(`Large purchases need a 48-hour cooling-off period. Ask yourself: "Will I care about this in 30 days?"`);
    suggestions.push(`Review your larger transactions at the end of each month. ${hugeExpenses.length > 0 ? `You had ${hugeExpenses.length} unusually large ones.` : `Even 1 unchecked splurge can skew a month's budget.`}`);
  } else if (usedCat === "Entertainment" || (usedMerchant && (usedMerchant.includes("netflix") || usedMerchant.includes("prime") || usedMerchant.includes("spotify")))) {
    suggestions.push(`Rotate streaming subscriptions instead of keeping all active. You don't need Netflix AND Prime AND Hotstar simultaneously.`);
    suggestions.push(`Use free trials strategically — one weekend per platform per month covers what you actually want to watch.`);
  } else if (usedCat === "Groceries") {
    suggestions.push(`Plan meals for the week before grocery shopping. Impulse purchases add 30% to your bill. Stick to the list.`);
    suggestions.push(`Buy staples (rice, dal, oil) in bulk. You save 15-20% on per-unit costs.`);
  } else if (usedCat === "Travel") {
    suggestions.push(`Set a travel fund with automatic monthly deposits. ₹${Math.max(1000, Math.round(totalSpent * 0.1)).toLocaleString()}/month adds up to a real vacation.`);
    suggestions.push(`Book flights 6-8 weeks in advance for best prices. Last-minute bookings cost 40% more on average.`);
  } else if (usedCat === "Investment") {
    suggestions.push(`Consistent SIPs beat timing the market. Even ₹${Math.min(5000, Math.round(totalSpent * 0.15)).toLocaleString()}/month in an index fund compounds significantly over 5 years.`);
    suggestions.push(`Diversify across equity, debt, and gold. Don't put all your eggs in one basket.`);
  } else if (usedCat === "Education") {
    suggestions.push(`Finish what you started. The ROI on incomplete courses is zero. Dedicate 30 minutes daily to complete your current course.`);
    suggestions.push(`Check free alternatives on YouTube before paying for courses. Many skills are learnable for free.`);
  } else {
    // Generic fallback
    if (topCategoryPct > 35) {
      suggestions.push(`Cut your ${topCategory.name} spend by 20%. A hard budget of ₹${Math.round(topCategory.value * 0.8).toLocaleString()} will save you ₹${Math.round(topCategory.value * 0.2).toLocaleString()}.`);
    } else {
      suggestions.push(`Your spending is fairly balanced. Monitor ${topCategory.name} (${topCategoryPct}%) monthly for budget creep.`);
    }
    if (totalIncome > 0 && spendRate < 70) {
      suggestions.push(`Great savings rate of ${100 - spendRate}%! Auto-invest this into an index fund or PPF for long-term growth.`);
    } else if (totalIncome > 0) {
      suggestions.push(`Bring your spend rate from ${spendRate}% down to 70%. Cut ${topCategory.name} by 15% to start.`);
    } else {
      suggestions.push(`Track your income alongside expenses. Even small savings add up over time.`);
    }
  }

  // ── Roast data ──────────────────────────────────────────────────────────
  const roastData = {
    summary: {
      totalSpent,
      totalIncome,
      expenseCount: expenses.length,
      incomeCount: incomeTxs.length,
      avgTransactionSize: avgTxSize,
      medianTransactionSize: medianAmt,
      largestTransaction: largestTx,
      smallestTransaction: smallestTx.amount > 0 ? smallestTx : null,
      spendRate: totalIncome > 0 ? spendRate : null,
      latestTransaction: latestExpense ? {
        merchant: latestExpense.merchant,
        amount: Math.abs(Number(latestExpense.amount) || 0),
        category: latestExpense.category,
        date: latestExpense.date
      } : null
    },
    categoryBreakdown: sortedCats.map(c => ({
      name: c.name,
      amount: c.value,
      percentage: totalSpent > 0 ? Math.round((c.value / totalSpent) * 100) : 0,
      transactionCount: c.count
    })),
    flags: {
      isOverspending,
      isSpendingAllIncome,
      topCategoryDominancePct: topCategoryPct,
      unusualExpenseCount: unusualExpenses.length,
      hugeExpenseCount: hugeExpenses.length,
      mostFrequentCategory: mostFreqCat.name ? { name: mostFreqCat.name, count: mostFreqCat.count } : null,
      mostFrequentMerchant: topMerchant ? { name: topMerchant[0], count: topMerchant[1] } : null,
      usedLatestTransaction: latestCatPool.length > 0
    },
    roastPattern: poolToUse[chosenIndex]?.pattern || "unknown",
    roastIndex: chosenIndex,
    totalPoolSize: poolToUse.length,
    generatedAt: new Date().toISOString()
  };

  return { roast, suggestions, roastData, roastIndex: chosenIndex };
};
