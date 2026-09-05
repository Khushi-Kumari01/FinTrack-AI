import { bulkInsertTransactions } from "./transactionProcessor.js";

export const importSMSService = async (user, messages) => {
  // For now: very dumb parser. Real life: regexes on SMS format.
  const txs = [];

  for (const msg of messages) {
    // Example: "Rs.420 spent at Swiggy on Food"
    const match = msg.match(/Rs\.?(\d+).+at\s+([A-Za-z ]+)/i);
    if (!match) continue;

    const amount = -parseFloat(match[1]);
    const merchant = match[2].trim();
    txs.push({
      date: new Date(),
      merchant,
      category: "Uncategorized",
      amount
    });
  }

  return bulkInsertTransactions(user, txs);
};
export function parseSMS(text) {
  const amountMatch = text.match(/(?:Rs\.?|INR)\s?(\d+\.?\d*)/i);
  const merchantMatch = text.match(/at\s([A-Za-z0-9 &-_]+)/i);
  const upiMatch = text.match(/UPI:\s([a-zA-Z0-9@]+)/i);

  return {
    amount: amountMatch ? parseFloat(amountMatch[1]) : null,
    merchant: merchantMatch ? merchantMatch[1] : "Unknown",
    channel: upiMatch ? `UPI • ${upiMatch[1]}` : "SMS",
    raw: text
  };
}
