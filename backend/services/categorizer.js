/**
 * Centralized Categorization Engine for FinTrack
 *
 * Maps merchant names / spoken keywords to predefined categories.
 * Extensible — just add entries to KEYWORD_MAP or CATEGORY_ALIASES.
 *
 * Usage:
 *   import { categorize } from "./services/categorizer.js";
 *   const result = categorize({ merchant: "Uber", transcript: "taxi 500" });
 *   // => { category: "Transport", confidence: "high", method: "keyword" }
 */

// ─── Keyword-to-Category Mapping ───────────────────────────────────────────
// Each entry maps an array of triggers (lowercase) to a canonical category.
// Uses partial-string matching (case-insensitive via .includes()).
// The first match wins, so order matters: put more specific matches first.
const KEYWORD_MAP = [
  // ── Food & Dining ──
  // Most extensive list: major QSR chains, coffee shops, online food delivery
  { keywords: [
    "kfc", "mcdonald", "mcdonald's", "burger king", "domino", "domino's",
    "pizza hut", "subway", "starbucks", "cafe coffee day", "ccd",
    "chai point", "swiggy", "zomato", "restaurant", "dining", "food",
    "cafe", "eat", "pizza", "burger", "coffee", "dosa", "biryani",
    "lunch", "dinner", "breakfast", "snack", "mess", "canteen"
  ], category: "Food & Dining" },

  // ── Shopping ──
  // Major Indian e-commerce + electronics + fashion
  { keywords: [
    "amazon", "flipkart", "myntra", "ajio", "nykaa", "meesho",
    "croma", "reliance digital", "shopping", "mall", "store",
    "retail", "lifestyle", "westside", "pantaloons", "shoppers stop",
    "tata cliq", "snapdeal", "shop", "bazaar"
  ], category: "Shopping" },

  // ── Transport ──
  { keywords: [
    "uber", "ola", "rapido", "metro", "bmts", "bmtc", "yulu",
    "redbus", "irctc", "taxi", "bus", "petrol", "fuel", "indrive",
    "cab", "auto", "rickshaw", "toll", "parking", "train", "flight"
  ], category: "Transport" },

  // ── Health ──
  { keywords: [
    "apollo pharmacy", "medplus", "1mg", "netmeds", "apollo hospital",
    "fortis", "manipal hospital", "practo", "pharmacy", "hospital",
    "medicine", "doctor", "clinic", "medical", "health", "diagnostic",
    "chemist", "drug", "wellness", "ayurveda"
  ], category: "Health" },

  // ── Bills & Utilities ──
  { keywords: [
    "airtel", "jio", "act fibernet", "actfibernet", "bescom", "bwssb",
    "tata play", "lpg", "electricity", "water", "gas", "bill",
    "utility", "broadband", "recharge", "dth", "wifi", "internet",
    "mobile recharge", "phone bill"
  ], category: "Bills" },

  // ── Income ──
  { keywords: [
    "salary", "payroll", "stipend", "bonus", "freelance payment",
    "refund", "cashback", "credit", "income", "deposit", "interest",
    "dividend", "payout", "commission", "consulting", "wages"
  ], category: "Income" },

  // ── Housing / Rent ──
  { keywords: ["rent", "housing", "maintenance", "society", "flat", "mortgage", "property"], category: "Housing" },

  // ── Entertainment ──
  { keywords: [
    "netflix", "prime", "prime video", "hotstar", "disney+", "disney",
    "spotify", "youtube", "youtube music", "entertainment", "movie",
    "cinema", "game", "gaming", "concert", "streaming", "music",
    "sony liv", "zee5", "voot", "jio cinema"
  ], category: "Entertainment" },

  // ── Education ──
  { keywords: [
    "course", "tution", "tuition", "fee", "education", "school",
    "college", "university", "class", "training", "udemy", "coursera",
    "unacademy", "byjus", "vedantu", "skillshare", "exam"
  ], category: "Education" },

  // ── Travel ──
  { keywords: [
    "flight", "hotel", "travel", "trip", "booking", "holiday",
    "vacation", "stay", "airbnb", "makemytrip", "goibibo", "ixigo",
    "oyo", "treebo", "resort"
  ], category: "Travel" },

  // ── Groceries ──
  { keywords: [
    "grocery", "d mart", "dmart", "big basket", "zepto", "blinkit",
    "instamart", "provision", "vegetable", "fruit", "milk", "dairy",
    "butcher", "meat", "fish", "bakery", "provision store"
  ], category: "Groceries" },

  // ── Investments ──
  { keywords: [
    "mutual fund", "mf", "stock", "share", "investment", "invest",
    "sip", "zerodha", "groww", "angel broking", "upstox", "kite",
    "nps", "ppf", "epf", "fixed deposit", "fd", "bonds"
  ], category: "Investment" },
];

// ─── Spoken Category Aliases ───────────────────────────────────────────────
// If the user explicitly says a category name in their speech, it overrides
// merchant-based guessing. E.g., "Transport Uber 500" → category = Transport
const CATEGORY_ALIASES = {
  transport: "Transport",
  travelling: "Transport",
  travel: "Travel",
  food: "Food & Dining",
  dining: "Food & Dining",
  eating: "Food & Dining",
  restaurant: "Food & Dining",
  rent: "Housing",
  housing: "Housing",
  health: "Health",
  medical: "Health",
  medicine: "Health",
  shopping: "Shopping",
  income: "Income",
  salary: "Income",
  wages: "Income",
  stipend: "Income",
  paycheck: "Income",
  payroll: "Income",
  earnings: "Income",
  earned: "Income",
  commission: "Income",
  bonus: "Income",
  refund: "Income",
  cashback: "Income",
  dividend: "Income",
  interest: "Income",
  allowance: "Income",
  "pocket money": "Income",
  bills: "Bills",
  utilities: "Bills",
  entertainment: "Entertainment",
  fun: "Entertainment",
  education: "Education",
  grocery: "Groceries",
  groceries: "Groceries",
  investment: "Investment",
  invest: "Investment",
};

// ─── Income-intent phrases (multi-word context signals) ────────────────────
// Phrases that indicate money was RECEIVED by the user (income), not spent.
// Checked before single-word alias matching for better context sensitivity.
const INCOME_PHRASES = [
  "salary credited", "salary received", "salary paid",
  "paycheck received", "pay check received",
  "payment received", "received payment",
  "money received", "amount received",
  "amount credited", "credit received",
  "got paid", "got salary", "got bonus", "got my salary", "got my paycheck",
  "got my stipend", "got my wages",
  "bonus received", "bonus credited",
  "commission received", "commission credited",
  "refund received", "refund credited",
  "cashback received",
  "freelance received", "freelance payment received",
  "interest received", "dividend received",
  "rent received", "rental income",
  "reimbursement received", "incentive received",
  "income received", "earnings received",
  "salary credit",
  "pocket money",
  "i received", "received salary", "received bonus", "received income",
  "received stipend", "received payment", "received my salary",
  "received my paycheck", "received my wages",
  "i got", "i earned",
];

// ─── Expense-intent overrides ─────────────────────────────────────────────
// If these phrases are present, the speaker is PAYING someone (not receiving).
// Overrides income keyword matching even for words like "salary".
const EXPENSE_OVERRIDE_PHRASES = [
  "i paid", "paid for", "paid to", "paid salary to", "payment made", "payment sent",
  "salary payment made", "salary payment", "salary paid to",
  "transferred to", "sent to", "given to", "gave to", "bought",
  "spent on", "paid my", "i spent", "paying salary", "paying out",
  "credit card bill", "credit card payment",
];

// ─── Single-word income signals that require NO other context ──────────────
// These standalone words in a transcript classify as income UNLESS expense
// intent is detected first.
const INCOME_SINGLE_WORDS = new Set([
  "received", "got", "credited", "earning", "earnings",
  "allowance", "pocketmoney", "pocket-money",
]);

// ─── Ambiguous words that are income ONLY when paired with amount patterns ─
// "credit" alone = Bills (credit card); "credit" + amount in certain contexts = Income.
// We handle this by putting "credit card" in EXPENSE_OVERRIDE_PHRASES above.

// ─── Categorization Result ────────────────────────────────────────────────

/**
 * @typedef {Object} CategorizationResult
 * @property {string} category - The determined category
 * @property {"high"|"medium"|"low"} confidence - How confident the match is
 * @property {"spoken_override"|"keyword"|"fallback"} method - How category was determined
 */

// ─── Public API ───────────────────────────────────────────────────────────

/**
 * Categorize a transaction from merchant name and/or transcript.
 *
 * Priority:
 *   1. If transcript contains a known category alias → spoken override
 *   2. If merchant name matches a keyword → keyword match
 *   3. Fallback → "Others"
 *
 * @param {Object} params
 * @param {string} [params.merchant] - Merchant name (e.g., "Uber", "Swiggy")
 * @param {string} [params.transcript] - Full speech transcript (optional, allows spoken override)
 * @param {string} [params.suggestedCategory] - If caller already has a hint for category
 * @returns {CategorizationResult}
 */
export function categorize({ merchant = "", transcript = "", suggestedCategory } = {}) {
  const lowerMerchant = (merchant || "").toLowerCase().trim();
  const lowerTranscript = (transcript || "").toLowerCase().trim();
  const lowerSuggested = (suggestedCategory || "").toLowerCase().trim();

  // ── Priority 0: Detect expense-intent context ──
  // If the user says "I paid", "sent to", etc., they are spending — not receiving.
  // This prevents "I paid 25000 for salary" from being classified as Income.
  const isExpenseIntent = EXPENSE_OVERRIDE_PHRASES.some(p => lowerTranscript.includes(p));

  // ── Priority 1: Income phrase detection (multi-word, context-aware) ──
  // Check before single-word alias matching so "payment received" → Income
  // even though "payment" alone is not an alias.
  if (!isExpenseIntent) {
    for (const phrase of INCOME_PHRASES) {
      if (lowerTranscript.includes(phrase)) {
        return {
          category: "Income",
          confidence: "high",
          method: "spoken_override",
        };
      }
    }
  }

  // ── Priority 1b: Single-word income signals (standalone) ──
  // Words like "received", "got", "credited" on their own indicate income
  // UNLESS a specific non-income merchant or expense-intent overrides.
  if (!isExpenseIntent) {
    const txWords = lowerTranscript.split(/\s+/);
    for (const word of txWords) {
      if (INCOME_SINGLE_WORDS.has(word)) {
        return {
          category: "Income",
          confidence: "medium",
          method: "spoken_override",
        };
      }
    }
  }

  // ── Priority 2: Spoken category override (single-word alias) ──
  // Check if user explicitly said a category name in their speech.
  const wordsInTranscript = lowerTranscript.split(/\s+/);
  for (const word of wordsInTranscript) {
    const mapped = CATEGORY_ALIASES[word];
    if (mapped) {
      // Skip income aliases if expense intent is detected
      if (isExpenseIntent && mapped === "Income") continue;
      return {
        category: CATEGORY_ALIASES[word],
        confidence: "high",
        method: "spoken_override",
      };
    }
  }

  // Also check the full transcript as a multi-word alias
  if (CATEGORY_ALIASES[lowerTranscript]) {
    return {
      category: CATEGORY_ALIASES[lowerTranscript],
      confidence: "high",
      method: "spoken_override",
    };
  }

  // ── Priority 2: Suggested category (if already provided and valid) ──
  if (lowerSuggested && isKnownCategory(lowerSuggested)) {
    return {
      category: suggestedCategory,
      confidence: "medium",
      method: "keyword",
    };
  }

  // ── Priority 3: Merchant keyword match ──
  for (const entry of KEYWORD_MAP) {
    // Check if any keyword is found in the merchant name
    for (const keyword of entry.keywords) {
      if (lowerMerchant.includes(keyword)) {
        // Skip income category if expense intent is detected
        if (isExpenseIntent && entry.category === "Income") continue;
        return {
          category: entry.category,
          confidence: "high",
          method: "keyword",
        };
      }
    }

    // Also check transcript for keywords (for cases like "Taxi 500" with no merchant)
    if (lowerTranscript) {
      for (const keyword of entry.keywords) {
        if (lowerTranscript.includes(keyword)) {
          if (isExpenseIntent && entry.category === "Income") continue;
          return {
            category: entry.category,
            confidence: "high",
            method: "keyword",
          };
        }
      }
    }
  }

  // ── Priority 4: Fallback ──
  return {
    category: "Others",
    confidence: "low",
    method: "fallback",
  };
}

/**
 * Validate if a string is a known category name.
 * @param {string} name
 * @returns {boolean}
 */
export function isKnownCategory(name) {
  const lower = name.toLowerCase();
  const known = new Set([
    ...Object.values(CATEGORY_ALIASES).map((v) => v.toLowerCase()),
    ...KEYWORD_MAP.map((e) => e.category.toLowerCase()),
  ]);
  return known.has(lower) || lower === "others";
}

/**
 * Get all known categories (useful for dropdowns / validation).
 * @returns {string[]}
 */
export function getAllCategories() {
  const set = new Set([
    ...Object.values(CATEGORY_ALIASES),
    ...KEYWORD_MAP.map((e) => e.category),
    "Others",
  ]);
  return [...set].sort();
}

