import Transaction from "../models/Transaction.js";
import { getSpendingInsights } from "../services/aiService.js";

// ─── Income category guard (mirrors aiService.js) ────────────────────────
const INCOME_CATEGORIES = new Set([
  "salary", "income", "freelance", "freelance payment", "stipend", "bonus",
  "refund", "cashback", "credit", "deposit", "interest", "dividend",
  "payout", "commission", "consulting", "wages", "payroll"
]);
const isExpenseTx = (tx) => {
  const cat = (tx.category || "").toLowerCase().trim();
  if (INCOME_CATEGORIES.has(cat)) return false;
  if (tx.type) return tx.type === "expense";
  return Number(tx.amount) < 0;
};

// ─── Category name aliases ────────────────────────────────────────────────
// Maps spoken words → canonical category names used in the database.
const CAT_ALIASES = {
  food: "Food & Dining", dining: "Food & Dining", eating: "Food & Dining",
  restaurant: "Food & Dining", meals: "Food & Dining", lunch: "Food & Dining",
  dinner: "Food & Dining", breakfast: "Food & Dining",
  shop: "Shopping", shopping: "Shopping", clothes: "Shopping",
  transport: "Transport", travel: "Travel", commute: "Transport",
  uber: "Transport", ola: "Transport", cab: "Transport", taxi: "Transport",
  health: "Health", medical: "Health", medicine: "Health", doctor: "Health",
  pharmacy: "Health", hospital: "Health",
  bill: "Bills", bills: "Bills", utility: "Bills", utilities: "Bills",
  internet: "Bills", phone: "Bills", recharge: "Bills",
  rent: "Housing", housing: "Housing",
  entertainment: "Entertainment", netflix: "Entertainment", amazon: "Entertainment",
  streaming: "Entertainment", movies: "Entertainment", fun: "Entertainment",
  education: "Education", course: "Education", school: "Education",
  college: "Education", tuition: "Education",
  grocery: "Groceries", groceries: "Groceries", vegetables: "Groceries",
  invest: "Investment", investment: "Investment", sip: "Investment",
  mutual: "Investment", stocks: "Investment",
};

// ─── Extract a category from a question ──────────────────────────────────
// Returns { categoryName, rawWord } or null if not detected.
const extractCategory = (normalized, byCategory) => {
  // Try alias lookup first (word-boundary match)
  const words = normalized.replace(/[?.,!]/g, "").split(/\s+/);
  for (const word of words) {
    if (CAT_ALIASES[word]) {
      return { categoryName: CAT_ALIASES[word], rawWord: word };
    }
  }
  // Try bigram (two-word) alias match
  for (let i = 0; i < words.length - 1; i++) {
    const bigram = `${words[i]} ${words[i + 1]}`;
    if (CAT_ALIASES[bigram]) {
      return { categoryName: CAT_ALIASES[bigram], rawWord: bigram };
    }
  }
  // Try partial match against known categories
  if (byCategory) {
    for (const { name } of byCategory) {
      if (normalized.includes(name.toLowerCase())) {
        return { categoryName: name, rawWord: name.toLowerCase() };
      }
    }
  }
  return null;
};

// ─── Extract a merchant name from a question ─────────────────────────────
// "how much did i spend on kfc" → "kfc"
// "how much did i spend at amazon" → "amazon"
const extractMerchant = (normalized) => {
  const m = normalized.match(/(?:at|on|for)\s+([a-z0-9 &+'-]+?)(?:\s*\?.*)?$/);
  if (m) {
    const candidate = m[1].trim();
    // Filter out generic words that aren't merchants
    const genericWords = new Set([
      "food","shopping","health","transport","travel","bills","rent",
      "entertainment","education","groceries","investment","dining",
      "eating","everything","anything","stuff","things"
    ]);
    if (!genericWords.has(candidate)) return candidate;
  }
  return null;
};

// ─── Generic summary builder (used as final fallback) ────────────────────
const createSummary = (insights, expenseTxs) => {
  const { totals, byCategory, smartNudges } = insights;
  if (!totals) return "No transaction data available yet.";
  const spent = totals.spent || 0;
  const income = totals.income || 0;
  const surplus = totals.surplus || 0;
  const topCategory = byCategory?.[0]?.name || "your top category";
  const topAmt = byCategory?.[0]?.value || 0;
  return (
    `Total spent: ₹${spent.toLocaleString("en-IN")}` +
    (income > 0 ? ` | Income: ₹${income.toLocaleString("en-IN")} | Surplus: ₹${surplus.toLocaleString("en-IN")}` : "") +
    `. Top category: ${topCategory} (₹${topAmt.toLocaleString("en-IN")}). ` +
    (smartNudges?.[0] || "Keep tracking to get smarter advice.")
  );
};

// ─── Main handler ─────────────────────────────────────────────────────────
export const askAssistant = async (req, res) => {
  try {
    const userId = req.user._id;
    const { message } = req.body;
    if (!message || typeof message !== "string") {
      return res.status(400).json({ message: "Message is required" });
    }

    const { from, to } = req.query;
    const query = { userId };
    if (from || to) {
      query.date = {};
      if (from) query.date.$gte = new Date(from);
      if (to) query.date.$lte = new Date(to);
    }

    const transactions = await Transaction.find(query).sort({ date: -1 });
    const insights = getSpendingInsights(req.user, transactions);
    const normalized = message.toLowerCase().trim();

    const { totals, byCategory, smartNudges } = insights;
    const spent = totals?.spent || 0;
    const income = totals?.income || 0;
    const surplus = totals?.surplus || 0;
    const expenseTxs = transactions.filter(isExpenseTx);
    const totalSpend = expenseTxs.reduce((s, tx) => s + Math.abs(Number(tx.amount) || 0), 0);

    let reply;

    // ════════════════════════════════════════════════════════════════════
    // INTENT DETECTION — most specific checks FIRST
    // ════════════════════════════════════════════════════════════════════

    // ── 1. Recent transactions ───────────────────────────────────────────
    if (/recent|latest|last\s+\d+|show.*transaction|my transactions/i.test(normalized)) {
      const count = Math.min(5, transactions.length);
      if (count === 0) {
        reply = "You don't have any transactions yet. Start by adding one!";
      } else {
        const list = transactions.slice(0, count).map((tx, i) =>
          `${i + 1}. ${tx.merchant || "Unknown"} — ₹${Math.abs(Number(tx.amount) || 0).toLocaleString("en-IN")} (${tx.category || "Uncategorized"})`
        ).join("\n");
        reply = `Your ${count} most recent transactions:\n${list}`;
      }
    }

    // ── 2. Highest / top / biggest spending category ─────────────────────
    else if (/highest|most|top|biggest|largest|maximum/.test(normalized) && /categor|spend|spent/.test(normalized)) {
      if (byCategory?.length > 0) {
        const top = byCategory[0];
        const pct = totalSpend > 0 ? Math.round((top.value / totalSpend) * 100) : 0;
        reply = `Your highest spending category is ${top.name} at ₹${top.value.toLocaleString("en-IN")} (${pct}% of total).`;
        if (byCategory[1]) {
          reply += ` Second highest: ${byCategory[1].name} at ₹${byCategory[1].value.toLocaleString("en-IN")}.`;
        }
      } else {
        reply = "No spending data available yet.";
      }
    }

    // ── 3. Spending on a specific MERCHANT ──────────────────────────────
    //    "how much did I spend on KFC", "KFC spending", "spent at Amazon"
    else if (
      /(?:spend|spent|expense|cost|how much).*(?:at|on|for)\s+[a-z]/i.test(normalized) ||
      /(?:at|on|for)\s+[a-z].*(?:spend|spent)/i.test(normalized)
    ) {
      const catResult = extractCategory(normalized, byCategory);
      const merchantRaw = extractMerchant(normalized);

      // Try merchant match FIRST (more specific than category)
      if (merchantRaw) {
        const matchingTxs = expenseTxs.filter(tx =>
          (tx.merchant || "").toLowerCase().includes(merchantRaw)
        );
        if (matchingTxs.length > 0) {
          const total = matchingTxs.reduce((s, tx) => s + Math.abs(Number(tx.amount) || 0), 0);
          const merchant = matchingTxs[0].merchant || merchantRaw;
          reply = `Your ${merchant} spending is ₹${total.toLocaleString("en-IN")} across ${matchingTxs.length} transaction${matchingTxs.length > 1 ? "s" : ""}.`;
        } else if (catResult) {
          // Merchant not found — try the category
          const catData = byCategory?.find(c => c.name === catResult.categoryName);
          if (catData) {
            const catTxCount = expenseTxs.filter(t => t.category === catResult.categoryName).length;
            reply = `You spent ₹${catData.value.toLocaleString("en-IN")} on ${catData.name} across ${catTxCount} transaction${catTxCount !== 1 ? "s" : ""}.`;
          } else {
            reply = `No spending found for "${merchantRaw}". Your categories: ${(byCategory || []).map(c => c.name).join(", ") || "none yet"}.`;
          }
        } else {
          reply = `I couldn't find any transactions for "${merchantRaw}". Your categories are: ${(byCategory || []).map(c => c.name).join(", ") || "none yet"}.`;
        }
      } else if (catResult) {
        // Category match
        const catData = byCategory?.find(c => c.name === catResult.categoryName);
        if (catData) {
          const catTxCount = expenseTxs.filter(t => t.category === catResult.categoryName).length;
          reply = `You spent ₹${catData.value.toLocaleString("en-IN")} on ${catData.name} across ${catTxCount} transaction${catTxCount !== 1 ? "s" : ""}.`;
        } else {
          reply = `No spending found for "${catResult.rawWord}". Your categories: ${(byCategory || []).map(c => c.name).join(", ") || "none yet"}.`;
        }
      } else {
        // Fall through to total
        reply = totalSpend === 0
          ? "You haven't recorded any expenses yet."
          : `Total spending: ₹${totalSpend.toLocaleString("en-IN")} across ${expenseTxs.length} transactions.`;
      }
    }

    // ── 4. Category spending: "how much on food", "food spending" ────────
    else if (
      /(?:spend|spent|expense|how much).*(?:food|shop|transport|health|bill|entertain|edu|grocer|invest|travel|rent|housing)/i.test(normalized) ||
      /(?:food|shop|transport|health|bill|entertain|edu|grocer|invest|travel|rent|housing).*(?:spend|spent|expense|cost)/i.test(normalized) ||
      /(?:food|shopping|transport|health|bills|entertainment|education|groceries|investment|travel|housing)\s+(?:total|amount|spend)/i.test(normalized)
    ) {
      const catResult = extractCategory(normalized, byCategory);
      if (catResult) {
        const catData = byCategory?.find(c => c.name === catResult.categoryName);
        if (catData) {
          const catTxCount = expenseTxs.filter(t => t.category === catResult.categoryName).length;
          const pct = totalSpend > 0 ? Math.round((catData.value / totalSpend) * 100) : 0;
          reply = `You spent ₹${catData.value.toLocaleString("en-IN")} on ${catData.name} (${catTxCount} transaction${catTxCount !== 1 ? "s" : ""}, ${pct}% of total spend).`;
        } else {
          reply = `No spending found for ${catResult.rawWord}. Your categories: ${(byCategory || []).map(c => c.name).join(", ") || "none yet"}.`;
        }
      } else {
        reply = `Total spending: ₹${totalSpend.toLocaleString("en-IN")}.`;
      }
    }

    // ── 5. Total / overall spending ──────────────────────────────────────
    else if (/how much.*(?:spend|spent|expense|total)|total.*(?:spend|spent|expense)/.test(normalized)) {
      if (totalSpend === 0) {
        reply = "You haven't recorded any expenses yet.";
      } else {
        const top = byCategory?.[0];
        reply = `Total spending: ₹${totalSpend.toLocaleString("en-IN")} across ${expenseTxs.length} transactions.`;
        if (top) {
          const pct = Math.round((top.value / totalSpend) * 100);
          reply += ` Top category: ${top.name} at ₹${top.value.toLocaleString("en-IN")} (${pct}%).`;
        }
      }
    }

    // ── 6. Income ─────────────────────────────────────────────────────────
    else if (/income|salary|earn|earned|inflow/.test(normalized)) {
      if (income === 0) {
        reply = "No income transactions found. Add a transaction with type 'Income' to track your earnings.";
      } else {
        const incomeTxs = transactions.filter(tx => !isExpenseTx(tx));
        reply = `Your total income is ₹${income.toLocaleString("en-IN")} across ${incomeTxs.length} transaction${incomeTxs.length !== 1 ? "s" : ""}.`;
        if (surplus < 0) reply += ` You are spending ₹${Math.abs(surplus).toLocaleString("en-IN")} more than you earn.`;
        else reply += ` Net surplus: ₹${surplus.toLocaleString("en-IN")}.`;
      }
    }

    // ── 7. Savings / surplus ─────────────────────────────────────────────
    else if (/sav|surplus|net position|how much.*left|money.*left/.test(normalized)) {
      if (income === 0) {
        reply = "No income recorded yet, so I can't calculate savings. Add an income transaction to see your net surplus.";
      } else if (surplus >= 0) {
        const pct = income > 0 ? Math.round((surplus / income) * 100) : 0;
        reply = `You have a net surplus of ₹${surplus.toLocaleString("en-IN")} — that's ${pct}% of your income. ${pct > 20 ? "Great savings rate!" : "Consider setting a monthly savings target."}`;
      } else {
        reply = `You have a net deficit of ₹${Math.abs(surplus).toLocaleString("en-IN")}. Spending exceeds income by that amount.`;
      }
    }

    // ── 8. Budget ─────────────────────────────────────────────────────────
    else if (/budget|limit|plan/.test(normalized)) {
      const cats = byCategory || [];
      if (cats.length === 0) {
        reply = "No transaction data yet. Add some expenses to get a budget recommendation.";
      } else {
        const lines = cats.slice(0, 4).map(cat => {
          const limit = Math.max(100, Math.round(cat.value * 1.15));
          return `${cat.name}: ₹${limit.toLocaleString("en-IN")}`;
        });
        reply = `Suggested budget based on current spending:\n${lines.join("\n")}\nUse the Smart Budget Planner for detailed recommendations.`;
      }
    }

    // ── 9. Forecast / next month ─────────────────────────────────────────
    else if (/forecast|predict|next month|projection/.test(normalized)) {
      reply = totalSpend === 0
        ? "No spending data yet for a forecast."
        : `If your habits continue, next month's spend will be around ₹${Math.round(totalSpend * 1.05).toLocaleString("en-IN")}. Keep an eye on ${byCategory?.[0]?.name || "your top category"}.`;
    }

    // ── 10. Advice / management / reduce / save ───────────────────────────
    // Catches: "how can I manage my expenses", "how to reduce expenses",
    //          "how can I save money", "how to control spending", etc.
    else if (/manage|improve|control|organis|organiz|reduc|cut down|lower|minimise|minimize|save|where can i|suggestion|tip|advice|help/.test(normalized)) {
      if (totalSpend === 0) {
        reply = "Add some transactions first and I'll give you personalised advice based on your actual spending.";
      } else {
        const cats = byCategory || [];

        // Build category-specific advice from actual data
        const lines = [];

        // Top spending category — most impactful to cut
        if (cats[0]) {
          const top = cats[0];
          const topPct = Math.round((top.value / totalSpend) * 100);
          const suggestedCut = Math.round(top.value * 0.8);
          lines.push(`1. **${top.name}** is your biggest expense at ₹${top.value.toLocaleString("en-IN")} (${topPct}% of total). A 20% reduction saves ₹${Math.round(top.value * 0.2).toLocaleString("en-IN")}/month — target ₹${suggestedCut.toLocaleString("en-IN")}.`);
        }

        // Second category
        if (cats[1]) {
          const second = cats[1];
          const secondPct = Math.round((second.value / totalSpend) * 100);
          lines.push(`2. **${second.name}** (${secondPct}%) is your second-largest at ₹${second.value.toLocaleString("en-IN")}. Even a 15% cut saves ₹${Math.round(second.value * 0.15).toLocaleString("en-IN")}.`);
        }

        // Income vs spending gap
        if (income > 0) {
          const savingsRate = Math.round(((income - totalSpend) / income) * 100);
          if (savingsRate < 20) {
            lines.push(`3. You're saving only ${Math.max(0, savingsRate)}% of your income. Aim for 20%+ — set aside ₹${Math.round(income * 0.2).toLocaleString("en-IN")} automatically on payday.`);
          } else {
            lines.push(`3. Your savings rate is ${savingsRate}% — solid. Automate ₹${Math.round(income * savingsRate / 100).toLocaleString("en-IN")}/month into a separate account so it doesn't get spent.`);
          }
        } else {
          lines.push(`3. No income recorded yet. Add your salary/income transactions to see your true savings rate and get more accurate advice.`);
        }

        // Largest single transaction warning
        const largest = expenseTxs.reduce((max, tx) => {
          const amt = Math.abs(Number(tx.amount) || 0);
          return amt > (max.amount || 0) ? { merchant: tx.merchant, amount: amt, category: tx.category } : max;
        }, { amount: 0 });
        if (largest.amount > totalSpend * 0.3) {
          lines.push(`4. Your largest single expense was ₹${largest.amount.toLocaleString("en-IN")} at ${largest.merchant || largest.category || "unknown"}. Large one-off purchases are often optional — pause before the next one.`);
        }

        // Nudge from smart insights if available
        if (smartNudges?.[0] && !lines.some(l => l.includes(smartNudges[0].slice(0, 20)))) {
          lines.push(`💡 ${smartNudges[0]}`);
        }

        reply = `Here's how to manage your expenses based on your actual spending:\n\n${lines.join("\n\n")}`;
      }
    }

    // ── 11. Roast ─────────────────────────────────────────────────────────
    else if (/roast/.test(normalized)) {
      reply = totalSpend === 0
        ? "Nothing to roast yet — add some expenses!"
        : `You spent ₹${totalSpend.toLocaleString("en-IN")} recently. If this is your new normal, your wallet might file for divorce.`;
    }

    // ── 12. Default: generic summary ─────────────────────────────────────
    else {
      reply = createSummary(insights, expenseTxs);
    }

    res.json({ reply, insights });
  } catch (err) {
    console.error("askAssistant error", err);
    res.status(500).json({ message: "Assistant failed to answer your request." });
  }
};
