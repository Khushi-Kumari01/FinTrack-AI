// backend/services/importParsers.js

// CSV: simple and already okay
export const parseCSVTransactions = (csvString) => {
  if (!csvString || typeof csvString !== "string") return [];

  const lines = csvString
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length <= 1) return [];

  const [headerLine, ...rows] = lines;
  const headers = headerLine.split(",").map((h) => h.trim().toLowerCase());
  const idx = (name) => headers.indexOf(name);

  const out = [];
  for (const row of rows) {
    const cols = row.split(",").map((c) => c.trim());
    out.push({
      date: cols[idx("date")] || new Date().toISOString(),
      amount: Number(cols[idx("amount")] || 0),
      merchant: cols[idx("merchant")] || "Unknown",
      category: cols[idx("category")] || "Uncategorized",
      channel: cols[idx("channel")] || "CSV"
    });
  }
  return out;
};

// SMS: tuned for common Indian bank messages
export const parseSMSTransactions = (messages) => {
  if (!Array.isArray(messages)) return [];

  const out = [];

  // Examples handled:
  // "Rs.420.00 debited from a/c XXXX1234 on 23-11-2025 at SWIGGY. Avl bal ..."
  // "INR 215.00 spent on your HDFC Bank Debit Card ending 1234 at UBER on 24-11-25."
  const regex =
    /(?:INR|Rs\.?|₹)\s*([\d,]+\.?\d*)\s*(?:debited|spent|purchased|withdrawn).*?(?:at|in)\s+([A-Za-z0-9 &\-]+?)(?:\.| on|$)/i;

  for (const raw of messages) {
    if (typeof raw !== "string") continue;

    const m = regex.exec(raw);
    if (!m) continue;

    const amount = Number(m[1].replace(/,/g, ""));
    const merchant = m[2].trim();

    out.push({
      amount: -Math.abs(amount),
      merchant,
      category: "Auto-SMS",
      channel: "SMS",
      rawText: raw
    });
  }

  return out;
};

// UPI: handle generic records like { amount, to, note, time, type }
export const parseUPITransactions = (records) => {
  if (!Array.isArray(records)) return [];

  return records.map((r) => {
    const amt = Number(r.amount || 0);
    const isCredit = (r.type || "").toLowerCase() === "credit";
    return {
      amount: isCredit ? Math.abs(amt) : -Math.abs(amt),
      merchant: r.to || r.merchant || "UPI",
      category: r.category || "UPI",
      date: r.time || new Date().toISOString(),
      channel: "UPI",
      rawText: r.note || ""
    };
  });
};
