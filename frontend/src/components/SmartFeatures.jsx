// src/components/SmartFeatures.jsx
import React, { useState, useRef } from "react";
import ReceiptScanner from "./ReceiptScanner";
import { api } from "../api/client";

const SmartFeatures = ({ onVoiceAdd }) => {
  const [roast, setRoast] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  // ─── Client-side Categorization (fallback if backend unavailable) ────────
  // Mirror of backend/services/categorizer.js — keep in sync!
  const CATEGORY_KEYWORDS = [
    // Food & Dining
    { keywords: [
      "kfc", "mcdonald", "mcdonald's", "burger king", "domino", "domino's",
      "pizza hut", "subway", "starbucks", "cafe coffee day", "ccd",
      "chai point", "swiggy", "zomato", "restaurant", "dining", "food",
      "cafe", "eat", "pizza", "burger", "coffee", "dosa", "biryani",
      "lunch", "dinner", "breakfast", "snack", "mess", "canteen"
    ], category: "Food & Dining" },

    // Shopping
    { keywords: [
      "amazon", "flipkart", "myntra", "ajio", "nykaa", "meesho",
      "croma", "reliance digital", "shopping", "mall", "store",
      "retail", "lifestyle", "westside", "pantaloons", "shoppers stop",
      "tata cliq", "snapdeal", "shop", "bazaar"
    ], category: "Shopping" },

    // Transport
    { keywords: [
      "uber", "ola", "rapido", "metro", "bmts", "bmtc", "yulu",
      "redbus", "irctc", "taxi", "bus", "petrol", "fuel", "indrive",
      "cab", "auto", "rickshaw", "toll", "parking", "train", "flight"
    ], category: "Transport" },

    // Health
    { keywords: [
      "apollo pharmacy", "medplus", "1mg", "netmeds", "apollo hospital",
      "fortis", "manipal hospital", "practo", "pharmacy", "hospital",
      "medicine", "doctor", "clinic", "medical", "health", "diagnostic",
      "chemist", "drug", "wellness", "ayurveda"
    ], category: "Health" },

    // Bills & Utilities
    { keywords: [
      "airtel", "jio", "act fibernet", "actfibernet", "bescom", "bwssb",
      "tata play", "lpg", "electricity", "water", "gas", "bill",
      "utility", "broadband", "recharge", "dth", "wifi", "internet",
      "mobile recharge", "phone bill"
    ], category: "Bills" },

    // Income
    { keywords: [
      "salary", "payroll", "stipend", "bonus", "freelance payment",
      "refund", "cashback", "credit", "income", "deposit", "interest",
      "dividend", "payout", "commission", "consulting", "wages"
    ], category: "Income" },

    // Housing
    { keywords: ["rent", "housing", "maintenance", "society", "flat", "mortgage", "property"], category: "Housing" },

    // Entertainment
    { keywords: [
      "netflix", "prime", "prime video", "hotstar", "disney+", "disney",
      "spotify", "youtube", "youtube music", "entertainment", "movie",
      "cinema", "game", "gaming", "concert", "streaming", "music",
      "sony liv", "zee5", "voot", "jio cinema"
    ], category: "Entertainment" },

    // Education
    { keywords: [
      "course", "tution", "tuition", "fee", "education", "school",
      "college", "university", "class", "training", "udemy", "coursera",
      "unacademy", "byjus", "vedantu", "skillshare", "exam"
    ], category: "Education" },

    // Travel
    { keywords: [
      "flight", "hotel", "travel", "trip", "booking", "holiday",
      "vacation", "stay", "airbnb", "makemytrip", "goibibo", "ixigo",
      "oyo", "treebo", "resort"
    ], category: "Travel" },

    // Groceries
    { keywords: [
      "grocery", "d mart", "dmart", "big basket", "zepto", "blinkit",
      "instamart", "provision", "vegetable", "fruit", "milk", "dairy",
      "butcher", "meat", "fish", "bakery", "provision store"
    ], category: "Groceries" },

    // Investments
    { keywords: [
      "mutual fund", "mf", "stock", "share", "investment", "invest",
      "sip", "zerodha", "groww", "angel broking", "upstox", "kite",
      "nps", "ppf", "epf", "fixed deposit", "fd", "bonds"
    ], category: "Investment" },
  ];

  const CATEGORY_ALIASES = {
    transport: "Transport", travelling: "Transport", travel: "Travel",
    food: "Food & Dining", dining: "Food & Dining", eating: "Food & Dining",
    restaurant: "Food & Dining",
    rent: "Housing", housing: "Housing",
    health: "Health", medical: "Health", medicine: "Health",
    shopping: "Shopping",
    income: "Income", salary: "Income",
    wages: "Income", stipend: "Income", paycheck: "Income", payroll: "Income",
    earnings: "Income", earned: "Income", commission: "Income",
    bonus: "Income", refund: "Income", cashback: "Income",
    dividend: "Income", interest: "Income", allowance: "Income",
    bill: "Bills", bills: "Bills", utilities: "Bills",
    entertainment: "Entertainment", fun: "Entertainment",
    education: "Education",
    grocery: "Groceries", groceries: "Groceries",
    investment: "Investment", invest: "Investment",
  };

  // ─── Income intent phrases ───────────────────────────────────────────────
  // Detect multi-word income signals BEFORE single-word alias matching.
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
    "salary credit", "pocket money",
    "i received", "received salary", "received bonus", "received income",
    "received stipend", "received payment", "received my salary",
    "received my paycheck", "received my wages",
    "i got", "i earned",
  ];

  // ─── Expense-intent phrases that OVERRIDE income keyword matches ──────────
  const EXPENSE_OVERRIDE_PHRASES = [
    "i paid", "paid for", "paid to", "paid salary to", "payment made", "payment sent",
    "salary payment made", "salary payment", "salary paid to",
    "transferred to", "sent to", "given to", "gave to", "bought",
    "spent on", "paid my", "i spent", "paying salary", "paying out",
    "credit card bill", "credit card payment",
  ];

  // ─── Single-word income signals ──────────────────────────────────────────
  const INCOME_SINGLE_WORDS = new Set([
    "received", "got", "credited", "earnings", "allowance",
  ]);

  const clientSideCategorize = (merchant, transcript) => {
    const lowerMerchant = (merchant || "").toLowerCase();
    const lowerTranscript = (transcript || "").toLowerCase();

    // Priority 0: expense intent override
    const isExpenseIntent = EXPENSE_OVERRIDE_PHRASES.some(p => lowerTranscript.includes(p));

    // Priority 1: Multi-word income phrases
    if (!isExpenseIntent) {
      for (const phrase of INCOME_PHRASES) {
        if (lowerTranscript.includes(phrase)) return "Income";
      }
    }

    // Priority 1b: Single-word income signals
    if (!isExpenseIntent) {
      const words = lowerTranscript.split(/\s+/);
      for (const word of words) {
        if (INCOME_SINGLE_WORDS.has(word)) return "Income";
      }
    }

    // Priority 2: Spoken category override (single-word alias)
    const words = lowerTranscript.split(/\s+/);
    for (const word of words) {
      const mapped = CATEGORY_ALIASES[word];
      if (mapped) {
        if (isExpenseIntent && mapped === "Income") continue;
        return mapped;
      }
    }

    // Priority 3: Merchant + transcript keyword match
    for (const entry of CATEGORY_KEYWORDS) {
      for (const keyword of entry.keywords) {
        if (lowerMerchant.includes(keyword) || lowerTranscript.includes(keyword)) {
          if (isExpenseIntent && entry.category === "Income") continue;
          return entry.category;
        }
      }
    }

    return "Others";
  };

  // ─── Extract merchant from transcript ──────────────────────────────────
  // Handles: "Taxi 5000", "Uber 6000", "Spent 500 on Uber", "uber 500", "500 uber"
  const extractMerchantAndAmount = (text) => {
    const lower = text.toLowerCase().trim();

    // Try "spent/gave/paid [amount] on [merchant]" pattern
    const spentOnMatch = lower.match(/(?:spent|gave|paid|for)\s+(\d+(?:,\d{3})*(?:\.\d{1,2})?)\s+(?:on|for|to|at|in)\s+(.+)/);
    if (spentOnMatch) {
      return { amount: spentOnMatch[1], merchant: spentOnMatch[2].trim() };
    }

    // Try "[merchant] [amount]" pattern (e.g., "taxi 5000", "uber 6000")
    const merchantFirst = lower.match(/^([a-z\s]+?)\s+(\d+(?:,\d{3})*(?:\.\d{1,2})?)$/);
    if (merchantFirst) {
      const merchant = merchantFirst[1].trim();
      // Filter out common filler words at the start
      const cleaned = merchant.replace(/^(spent|gave|paid|for|add|put)\s+/i, "").trim();
      return { amount: merchantFirst[2], merchant: cleaned || merchant };
    }

    // Try "[amount] [merchant]" pattern (e.g., "500 taxi", "6000 uber")
    const amountFirst = lower.match(/^(\d+(?:,\d{3})*(?:\.\d{1,2})?)\s+(.+)/);
    if (amountFirst) {
      const merchant = amountFirst[2].trim().replace(/^(on|for|to|at|in|rupees)\s+/i, "").trim();
      return { amount: amountFirst[1], merchant };
    }

    // Extract any number as amount and whatever remains as merchant
    const anyAmount = lower.match(/(\d+(?:,\d{3})*(?:\.\d{1,2})?)/);
    if (anyAmount) {
      const rest = lower.replace(anyAmount[0], "").replace(/(?:rs|rupees|inr|₹)\s*/i, "").trim();
      const cleaned = rest.replace(/^(spent|on|for|to|at|in|paid|gave)\s+/i, "").trim();
      if (cleaned) {
        return { amount: anyAmount[1], merchant: cleaned };
      }
    }

    return null;
  };

  // ─── Voice UI state (replaces all alert / window.confirm calls) ──────────
  // status: null | "listening" | "error" | "confirm" | "saving"
  const [voiceUI, setVoiceUI] = useState(null);
  // voiceUI shape when status === "confirm":
  //   { status: "confirm", merchant, amount, category, transcript }
  // voiceUI shape when status === "error":
  //   { status: "error", message, examples? }

  const dismissVoiceUI = () => setVoiceUI(null);

  // ─── VOICE RECOGNITION LOGIC ───────────────────────────────────────────
  const handleVoiceCommand = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceUI({
        status: "error",
        message: "Your browser does not support Voice Recognition.",
        hint: "Try Chrome or Edge on desktop, or Chrome on Android.",
      });
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.start();
    setIsListening(true);
    setVoiceUI(null);

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript.toLowerCase();
      setIsListening(false);
      processVoiceCommand(transcript);
    };

    recognition.onerror = () => {
      setIsListening(false);
      setVoiceUI({
        status: "error",
        message: "Could not hear you clearly.",
        hint: "Make sure your microphone is enabled and try again.",
      });
    };
  };

  const processVoiceCommand = async (text) => {
    const extracted = extractMerchantAndAmount(text);

    if (!extracted) {
      setVoiceUI({
        status: "error",
        message: `Could not understand "${text}".`,
        hint: null,
        examples: ['"Taxi 500"', '"Uber 6000"', '"Spent 500 on Uber"', '"Swiggy 300"', '"Salary 50000"'],
      });
      return;
    }

    const amount = extracted.amount.replace(/,/g, "");
    const merchantRaw = extracted.merchant;
    const merchant = merchantRaw.charAt(0).toUpperCase() + merchantRaw.slice(1);

    // Try to get category from backend first
    let category = "Others";
    try {
      const { data } = await api.post("/categorize", { merchant: merchantRaw, transcript: text });
      category = data.category;
    } catch {
      // Fallback to client-side categorization
      category = clientSideCategorize(merchantRaw, text);
    }

    // Determine if we have a CONFIDENT extraction:
    // - amount must be a valid positive number
    // - merchant must be non-empty and not a generic filler word
    const amountNum = parseFloat(amount);
    const GENERIC_WORDS = new Set(["something","stuff","things","it","this","that","there","here","some","money","cash","amount"]);
    const merchantWords = merchant.toLowerCase().split(/\s+/);
    const isGenericMerchant = merchantWords.every(w => GENERIC_WORDS.has(w));
    const isConfident = Number.isFinite(amountNum) && amountNum > 0 && merchant.trim().length > 0 && !isGenericMerchant;

    if (isConfident) {
      // Auto-save immediately — no manual confirmation needed.
      setVoiceUI({ status: "saving", merchant, amount, category });
      try {
        await onVoiceAdd({ merchant, amount, category });
        // Show a brief success state for 3 seconds then dismiss
        setVoiceUI({ status: "success", merchant, amount, category });
        setTimeout(() => setVoiceUI(null), 3000);
      } catch (err) {
        console.error("Auto-save voice transaction error:", err);
        // On error, fall back to the confirm UI so the user can try manually
        setVoiceUI({ status: "confirm", merchant, amount, category });
      }
    } else {
      // Ambiguous extraction — show confirm UI and ask user to review
      setVoiceUI({
        status: "confirm",
        merchant,
        amount,
        category,
        ambiguousReason: !Number.isFinite(amountNum) || amountNum <= 0
          ? "Amount unclear — please review before saving."
          : "Merchant unclear — please review before saving.",
      });
    }
  };

  // --- RECEIPT SCANNER (Opens the new ReceiptScanner component) ---
  const handleScanClick = () => {
    setShowScanner(true);
  };

const handleScannerSave = async (transaction) => {
    // ReceiptScanner already saved the transaction to the backend via /api/receipt/save.
    // Call onVoiceAdd with skipSave=true to refresh the dashboard (no double-save).
    if (onVoiceAdd) {
      await onVoiceAdd(transaction, true);
    }
  };

  const handleScannerClose = () => {
    setShowScanner(false);
  };

// State for suggestions (displayed after roast)
  const [suggestions, setSuggestions] = useState([]);
  // Track last roast index to avoid immediate repetition across clicks
  const lastRoastIndexRef = useRef(-1);

  // --- ROAST LOGIC (Data-driven from backend /api/roast) ---
  // Never cache — always fetches fresh transaction data from MongoDB every click
  const handleRoastClick = async () => {
    setLoading(true);
    setRoast(null);
    setSuggestions([]);
    try {
      // Cache-bust via timestamp + lastIdx to guarantee fresh MongoDB query + dedup every click
      const { data } = await api.get("/roast", {
        params: { _t: Date.now(), lastIdx: lastRoastIndexRef.current },
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
        },
      });
      setRoast(data.roast);
      setSuggestions(data.suggestions || []);
      // Save the index of the returned roast so next click avoids repeating it
      if (typeof data.roastIndex === 'number') {
        lastRoastIndexRef.current = data.roastIndex;
      }
    } catch (err) {
      console.error("Roast fetch failed", err);
      setRoast("Failed to connect to the roast server. Is the backend running?");
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  // --- STYLES (use CSS variables for light/dark mode support) ---
  const cardStyle = {
    background: "var(--bg-elevated)",
    border: "1px solid var(--border-subtle)", borderRadius: "12px", padding: "20px", marginBottom: "20px",
    boxShadow: "var(--shadow-soft)",
    color: "var(--text)"
  };
  const btnStyle = {
    flex: 1, padding: "12px", borderRadius: "8px", border: "1px solid var(--border-subtle)",
    backgroundColor: "var(--bg-elevated-soft)", color: "var(--text)", cursor: "pointer", fontWeight: "600",
    display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", minWidth: "120px"
  };

  return (
    <div style={cardStyle}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px'}}>
        <h3 style={{margin: 0, color: 'var(--text)'}}>✨ Gen Z Mode</h3>
        <span style={{fontSize: '12px', background: '#00d084', color: 'black', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold'}}>BETA</span>
      </div>

      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
        {/* Voice Button */}
        <button onClick={handleVoiceCommand} style={{...btnStyle, borderColor: isListening ? '#00d084' : '#555'}}>
            {isListening ? "🔴 Listening..." : "🎤 Voice Add"}
        </button>

        {/* Scan Receipt Button - Opens ReceiptScanner modal */}
        <button onClick={handleScanClick} style={{...btnStyle, borderColor: '#555'}}>
            📸 Scan Receipt
        </button>

        {/* Roast Button */}
        <button onClick={handleRoastClick} style={{...btnStyle, background: "linear-gradient(90deg, #ff416c, #ff4b2b)", color: "white", border: "none"}}>
            🔥 Roast My Spending
        </button>
      </div>

      {/* Receipt Scanner Modal */}
      {showScanner && (
        <ReceiptScanner
          onClose={handleScannerClose}
          onSave={handleScannerSave}
        />
      )}

      {/* ── Inline Voice UI (replaces alert + window.confirm) ─────────── */}
      {voiceUI && (
        <div style={{
          marginTop: 12,
          padding: "12px 14px",
          borderRadius: 10,
          fontSize: 13,
          lineHeight: 1.55,
          border: `1px solid ${voiceUI.status === "error" ? "rgba(239,68,68,0.3)" : "rgba(34,197,94,0.3)"}`,
          background: voiceUI.status === "error" ? "rgba(239,68,68,0.08)" : "rgba(34,197,94,0.08)",
          color: "var(--text)",
        }}>
          {/* ERROR STATE */}
          {voiceUI.status === "error" && (
            <>
              <div style={{ fontWeight: 700, color: "#f87171", marginBottom: 4 }}>
                ⚠️ {voiceUI.message}
              </div>
              {voiceUI.hint && (
                <div style={{ color: "var(--text-soft)", fontSize: 12 }}>{voiceUI.hint}</div>
              )}
              {voiceUI.examples && (
                <div style={{ marginTop: 6, color: "var(--text-soft)", fontSize: 12 }}>
                  <div style={{ marginBottom: 3, fontWeight: 600 }}>Try saying:</div>
                  {voiceUI.examples.map((e, i) => (
                    <div key={i} style={{ paddingLeft: 8 }}>• {e}</div>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={dismissVoiceUI}
                style={{
                  marginTop: 10, padding: "5px 14px", borderRadius: 8,
                  border: "1px solid rgba(148,163,184,0.3)", background: "rgba(148,163,184,0.1)",
                  color: "var(--text-soft)", cursor: "pointer", fontSize: 12, fontWeight: 600,
                }}
              >
                Dismiss
              </button>
            </>
          )}

          {/* CONFIRM STATE */}
          {voiceUI.status === "confirm" && (
            <>
              <div style={{ fontWeight: 700, color: "#4ade80", marginBottom: 6 }}>
                🎤 Confirm transaction
                {voiceUI.ambiguousReason && (
                  <span style={{ fontWeight: 400, fontSize: 11, color: "#fbbf24", marginLeft: 8 }}>
                    ⚠️ {voiceUI.ambiguousReason}
                  </span>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 13, color: "var(--text-soft)" }}>
                <div><span style={{ color: "var(--text)", fontWeight: 600 }}>Merchant:</span> {voiceUI.merchant}</div>
                <div><span style={{ color: "var(--text)", fontWeight: 600 }}>Amount:</span> ₹{Number(voiceUI.amount).toLocaleString("en-IN")}</div>
                <div><span style={{ color: "var(--text)", fontWeight: 600 }}>Category:</span> {voiceUI.category}</div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => {
                    dismissVoiceUI();
                    onVoiceAdd({ merchant: voiceUI.merchant, amount: voiceUI.amount, category: voiceUI.category });
                  }}
                  style={{
                    padding: "7px 18px", borderRadius: 8, border: "none",
                    background: "#00d084", color: "#000", cursor: "pointer",
                    fontSize: 12, fontWeight: 700,
                  }}
                >
                  ✅ Add Transaction
                </button>
                <button
                  type="button"
                  onClick={dismissVoiceUI}
                  style={{
                    padding: "7px 14px", borderRadius: 8,
                    border: "1px solid rgba(148,163,184,0.3)", background: "rgba(148,163,184,0.08)",
                    color: "var(--text-soft)", cursor: "pointer", fontSize: 12, fontWeight: 600,
                  }}
                >
                  Cancel
                </button>
              </div>
            </>
          )}

          {/* SAVING STATE */}
          {voiceUI.status === "saving" && (
            <div style={{ fontWeight: 600, color: "#4ade80", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid #4ade80", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
              Saving {voiceUI.merchant} ₹{Number(voiceUI.amount).toLocaleString("en-IN")}…
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {/* SUCCESS STATE */}
          {voiceUI.status === "success" && (
            <div style={{ fontWeight: 700, color: "#4ade80", fontSize: 14 }}>
              ✓ Added ₹{Number(voiceUI.amount).toLocaleString("en-IN")} {voiceUI.merchant} — {voiceUI.category}
            </div>
          )}
        </div>
      )}

      {/* Loading State for Roast */}
      {loading && (
          <p style={{marginTop: "15px", color: "#00d084", textAlign: 'center', fontWeight: 'bold'}}>
             ⚡ Analyzing...
          </p>
      )}

      {/* Roast Result */}
      {roast && !loading && (
        <div style={{ marginTop: "15px", padding: "15px", background: "rgba(255, 75, 43, 0.1)", borderLeft: "4px solid #ff4b2b", borderRadius: "4px" }}>
            <p style={{ margin: 0, color: "#ff9a9e", fontWeight: "bold", fontSize: '12px' }}>AI SAVAGE MODE:</p>
            <p style={{ margin: "5px 0 0 0", color: "#fff", fontSize: '16px', fontStyle: 'italic' }}>"{roast}"</p>
            {suggestions.length > 0 && (
              <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
                <p style={{ margin: 0, color: "#00d084", fontWeight: "bold", fontSize: '12px' }}>💡 ACTIONABLE SUGGESTIONS:</p>
                <ul style={{ margin: "8px 0 0 0", paddingLeft: "18px", color: "#ccc", fontSize: '13px', lineHeight: '1.6' }}>
                  {suggestions.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
        </div>
      )}
    </div>
  );
};

export default SmartFeatures;

