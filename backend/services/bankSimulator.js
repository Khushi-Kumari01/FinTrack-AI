// backend/services/bankSimulator.js
import Transaction from "../models/Transaction.js";
import { logger } from "../utils/logger.js";

const demoMerchants = ["Swiggy", "Zomato", "Uber", "Rapido", "Amazon", "Flipkart"];

export const seedDemoTransactionsForUser = async (userId) => {
  const existing = await Transaction.findOne({ userId });
  if (existing) return; // don't spam

  const now = new Date();
  const docs = [];

  for (let i = 0; i < 20; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);

    const amount = -(100 + Math.round(Math.random() * 1500));
    const merchant =
      demoMerchants[Math.floor(Math.random() * demoMerchants.length)];

    docs.push({
      userId,
      amount,
      category: "Demo",
      merchant,
      date: d,
      channel: "Simulator",
      status: "cleared"
    });
  }

  await Transaction.insertMany(docs);
  logger.info(`💾 Seeded ${docs.length} demo transactions for ${userId}`);
};
