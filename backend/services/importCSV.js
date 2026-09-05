import { bulkInsertTransactions } from "./transactionProcessor.js";

export const importCSVService = async (user, csvText) => {
  if (!csvText) return 0;

  const lines = csvText.split(/\r?\n/).filter(Boolean);
  const txs = [];

  for (const line of lines.slice(1)) {
    const [date, merchant, category, amountStr] = line.split(",");
    const amount = parseFloat(amountStr || "0");
    if (!amount) continue;

    txs.push({ date, merchant, category, amount });
  }

  return bulkInsertTransactions(user, txs);
};
