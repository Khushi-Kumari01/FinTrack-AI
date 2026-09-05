#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Seed realistic sample data for the currently logged-in user.
 *
 * Usage (recommended):
 *   node backend/scripts/seed-sample-data.js --token <JWT>
 *
 * Usage (fallback):
 *   node backend/scripts/seed-sample-data.js --userId <MONGODB_USER_ID> --mongoUri <MONGODB_URI>
 *
 * Notes:
 * - Preferred approach uses API endpoints so the “current logged-in user” is respected.
 * - The task asks for Goals, Budgets, Bills, Subscriptions, Portfolio, Automations.
 *   Portfolio is derived by dashboardSummaryController from Goals + Transactions.
 *   This script also seeds Transactions so charts/health/forecast/portfolio have realistic values.
 */

import "dotenv/config";
import fetch from "node-fetch";
import mongoose from "mongoose";

import User from "../models/User.js";
import Budget from "../models/Budget.js";
import Bill from "../models/Bill.js";
import Goal from "../models/Goal.js";
import Subscription from "../models/Subscription.js";
import Automation from "../models/Automation.js";
import Transaction from "../models/Transaction.js";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:5000";

const getArg = (name) => {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
};

const hasFlag = (name) => process.argv.includes(`--${name}`);

const token = getArg("token");
const userIdArg = getArg("userId");
const mongoUri = getArg("mongoUri") || process.env.MONGODB_URI;

const requireMongoUri = () => {
  const uri = process.env.MONGODB_URI || mongoUri;
  if (!uri) {
    console.error("MONGODB_URI is not set. Add it to backend/.env (or provide --mongoUri) and re-run.");
    process.exit(1);
  }
  return uri;
};

const autoSeedFromBackendDB = () => {
  // If the user doesn't have MONGODB_URI set, we can't connect.
};

const force = hasFlag("force");

const mode = token ? "api" : "models";

const seedSize = {
  budgets: 5,
  goals: 4,
  bills: 4,
  subscriptions: 5,
  automations: 3,
  transactions: 80,
};

const authHeader = token ? { Authorization: `Bearer ${token}` } : {};

const api = async (path, options = {}) => {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(authHeader || {}),
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${path} failed: ${res.status} ${res.statusText}. ${text}`);
  }
  const data = await res.json().catch(() => null);
  return data;
};

const randInt = (min, max) => Math.floor(min + Math.random() * (max - min + 1));
const randFrom = (arr) => arr[Math.floor(Math.random() * arr.length)];

const fmtISO = (d) => d.toISOString().slice(0, 10);

const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
};

const monthsAgo = (n) => {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d;
};

const buildSample = (userId) => {
  // Budgets
  const budgets = [
    { category: "Groceries", limit: 32000, period: "monthly" },
    { category: "Dining", limit: 9000, period: "monthly" },
    { category: "Utilities", limit: 7500, period: "monthly" },
    { category: "Transport", limit: 6000, period: "monthly" },
    { category: "Shopping", limit: 12000, period: "monthly" },
  ];

  // Goals
  const now = new Date();
  const goals = [
    {
      title: "Emergency Fund",
      targetAmount: 150000,
      currentAmount: 42000,
      deadline: new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()),
      category: "Savings",
      description: "Keep 6–9 months of essentials covered. Based on your cashflow trend.",
    },
    {
      title: "Home Renovation",
      targetAmount: 250000,
      currentAmount: 68000,
      deadline: new Date(now.getFullYear() + 2, now.getMonth(), now.getDate()),
      category: "Housing",
      description: "Plan phased upgrades and keep spending controlled.",
    },
    {
      title: "Vacation",
      targetAmount: 90000,
      currentAmount: 29000,
      deadline: new Date(now.getFullYear() + 1, now.getMonth() + 6, now.getDate()),
      category: "Travel",
      description: "Save steadily for a comfortable trip without credit-card debt.",
    },
    {
      title: "Long-term Investing",
      targetAmount: 400000,
      currentAmount: 120000,
      deadline: new Date(now.getFullYear() + 3, now.getMonth(), now.getDate()),
      category: "Investing",
      description: "Automatic contributions from surplus and periodic rebalancing.",
    },
  ];

  // Bills
  const bills = [
    { name: "Rent", amount: 28000, dueDate: fmtISO(monthsAgo(0)), autoPay: true, category: "Housing" },
    { name: "Electricity", amount: 3200, dueDate: fmtISO(daysAgo(randInt(1, 10))), autoPay: true, category: "Utilities" },
    { name: "Internet", amount: 1800, dueDate: fmtISO(daysAgo(randInt(1, 10))), autoPay: true, category: "Utilities" },
    { name: "Gym Membership", amount: 2400, dueDate: fmtISO(daysAgo(randInt(5, 15))), autoPay: false, category: "Health" },
  ];

  // Subscriptions
  const subscriptions = [
    { name: "Netflix", amount: 800, frequency: "Monthly", status: "active", category: "Subscriptions" },
    { name: "Spotify", amount: 450, frequency: "Monthly", status: "active", category: "Subscriptions" },
    { name: "Cloud Storage", amount: 399, frequency: "Monthly", status: "active", category: "Subscriptions" },
    { name: "News App", amount: 299, frequency: "Monthly", status: "active", category: "Subscriptions" },
    { name: "Gym App", amount: 199, frequency: "Monthly", status: "inactive", category: "Health" },
  ].map((s) => {
    const lastUsed = daysAgo(randInt(10, 40));
    const nextBillingDate = daysAgo(-randInt(0, 20));
    return { ...s, lastUsed, nextBillingDate };
  });

  // Automations
  const automations = [
    {
      title: "Savings Sweep",
      description: "If monthly surplus is positive, move a portion into savings goals.",
      type: "savings-sweep",
      amount: 12000,
      frequency: "monthly",
      enabled: true,
    },
    {
      title: "Budget Alert",
      description: "Notify if any budget category is projected to exceed its limit.",
      type: "budget-alert",
      amount: 0,
      frequency: "monthly",
      enabled: true,
    },
    {
      title: "Investment Reminder",
      description: "Custom rule to remind investing contributions every month.",
      type: "investment",
      amount: 8000,
      frequency: "monthly",
      enabled: true,
    },
  ];

  // Transactions (seed realistic expense/income over last ~4 months)
  const merchants = [
    "BigBasket",
    "FreshMart",
    "Zara",
    "Decathlon",
    "Uber",
    "OLA",
    "Domino's",
    "Swiggy",
    "Amazon",
    "McDonald's",
    "Metro Cash & Carry",
    "Fuel Station",
    "Local Grocer",
    "City Cinema",
  ];

  const expenseCategories = [
    "Groceries",
    "Dining",
    "Transport",
    "Utilities",
    "Shopping",
    "Health",
    "Entertainment",
  ];

  const incomeSources = ["Salary", "Freelance", "Interest"];

  const transactions = [];

  // Income every ~month
  for (const m of [0, 1, 2, 3]) {
    const base = monthsAgo(m);
    const payDate = new Date(base.getFullYear(), base.getMonth(), randInt(2, 6));
    const salary = randInt(90000, 130000);
    transactions.push({
      userId,
      amount: salary,
      category: "Salary",
      merchant: randFrom(incomeSources),
      type: "income",
      date: payDate,
      channel: "Bank",
      rawText: "Monthly salary credit",
      status: "cleared",
    });

    if (Math.random() < 0.55) {
      transactions.push({
        userId,
        amount: randInt(6000, 22000),
        category: "Freelance",
        merchant: "Client",
        type: "income",
        date: new Date(base.getFullYear(), base.getMonth(), randInt(8, 20)),
        channel: "UPI",
        rawText: "Project payment",
        status: "cleared",
      });
    }
  }

  // Expenses daily-ish
  const start = daysAgo(120);
  const end = new Date();
  let cursor = new Date(start);
  while (cursor <= end) {
    // 0–3 expenses per day
    const n = randInt(0, 3);
    for (let i = 0; i < n; i++) {
      const expense = randInt(120, 4200);
      const merchant = randFrom(merchants);
      const category = randFrom(expenseCategories);
      transactions.push({
        userId,
        amount: expense,
        category,
        merchant,
        type: "expense",
        date: new Date(cursor),
        channel: randInt(0, 1) === 0 ? "Card" : "UPI",
        rawText: `${category} purchase at ${merchant}`,
        status: "cleared",
      });
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  // Add a few known bills/subscription-like expenses for realism
  const billLike = [
    { name: "Rent", amount: 28000, category: "Housing" },
    { name: "Electricity", amount: 3200, category: "Utilities" },
    { name: "Internet", amount: 1800, category: "Utilities" },
    { name: "Netflix", amount: 800, category: "Subscriptions" },
  ];
  for (const m of [0, 1, 2, 3]) {
    const base = monthsAgo(m);
    for (const b of billLike) {
      transactions.push({
        userId,
        amount: b.amount,
        category: b.category,
        merchant: b.name,
        type: "expense",
        date: new Date(base.getFullYear(), base.getMonth(), randInt(2, 18)),
        channel: "AutoPay",
        rawText: `${b.name} payment`,
        status: "cleared",
      });
    }
  }

  return { budgets, goals, bills, subscriptions, automations, transactions };
};

const truncateExisting = async (userId) => {
  // We keep it simple: delete only the collections relevant to the dashboard widgets.
  await Promise.all([
    Budget.deleteMany({ userId }),
    Bill.deleteMany({ userId }),
    Goal.deleteMany({ userId }),
    Subscription.deleteMany({ userId }),
    Automation.deleteMany({ userId }),
    Transaction.deleteMany({ userId }),
  ]);
};

const upsertViaDirectModels = async (userId, sample) => {
  // Fallback for when token is not provided.
  // (Not used in the recommended flow, but useful.)
  await Promise.all([
    Budget.insertMany(sample.budgets.map((b) => ({ ...b, userId }))),
    Goal.insertMany(
      sample.goals.map((g) => ({
        userId,
        title: g.title,
        targetAmount: g.targetAmount,
        currentAmount: g.currentAmount,
        deadline: g.deadline,
        category: g.category,
        description: g.description,
      }))
    ),
    Bill.insertMany(sample.bills.map((b) => ({ ...b, userId }))),
    Subscription.insertMany(
      sample.subscriptions.map((s) => ({
        userId,
        name: s.name,
        amount: s.amount,
        frequency: s.frequency,
        lastUsed: s.lastUsed,
        nextBillingDate: s.nextBillingDate,
        status: s.status,
        category: s.category,
      }))
    ),
    Automation.insertMany(
      sample.automations.map((a) => ({
        userId,
        title: a.title,
        description: a.description,
        type: a.type,
        amount: a.amount,
        frequency: a.frequency,
        enabled: a.enabled,
      }))
    ),
    Transaction.insertMany(sample.transactions),
  ]);
};

const upsertViaApi = async (sample) => {
  // Use endpoints so “current logged-in user” is respected.
  // We still delete duplicates if --force is enabled.

  const createBudget = async (b) => api("/api/budgets", { method: "POST", body: JSON.stringify(b) });
  const createGoal = async (g) =>
    api("/api/goals", {
      method: "POST",
      body: JSON.stringify({
        title: g.title,
        targetAmount: g.targetAmount,
        deadline: g.deadline,
        category: g.category,
        description: g.description,
        // API createGoal initializes currentAmount to 0; we patch it by direct model write for realism.
      }),
    });
  const createBill = async (b) => api("/api/bills", { method: "POST", body: JSON.stringify(b) });
  const createSubscription = async (s) =>
    api("/api/subscriptions", {
      method: "POST",
      body: JSON.stringify({
        name: s.name,
        amount: s.amount,
        frequency: s.frequency,
        category: s.category,
      }),
    });
  const createAutomation = async (a) =>
    api("/api/automations", {
      method: "POST",
      body: JSON.stringify({
        title: a.title,
        description: a.description,
        type: a.type,
        amount: a.amount,
        frequency: a.frequency,
        enabled: a.enabled,
      }),
    });

  for (const b of sample.budgets) await createBudget({ category: b.category, limit: b.limit, period: b.period });
  for (const g of sample.goals) await createGoal(g);
  for (const b of sample.bills) await createBill({ name: b.name, amount: b.amount, dueDate: b.dueDate, autoPay: b.autoPay, category: b.category });
  for (const s of sample.subscriptions) await createSubscription(s);
  for (const a of sample.automations) await createAutomation(a);

  // Patch goal currentAmount to be realistic.
  // API createGoal always creates currentAmount:0, so we overwrite with model updates.
  await Promise.all(
    sample.goals.map(async (g) => {
      await Goal.updateOne({ userId: sample.userId, title: g.title }, { currentAmount: g.currentAmount });
    })
  );

  // Patch subscriptions extra fields that API doesn’t fully accept (it sets lastUsed to now).
  await Promise.all(
    sample.subscriptions.map(async (s) => {
      await Subscription.updateOne(
        { userId: sample.userId, name: s.name },
        { nextBillingDate: s.nextBillingDate, lastUsed: s.lastUsed, status: s.status }
      );
    })
  );
};

const seedTransactionsViaDirectModel = async (userId, sample) => {
  // There is no dedicated API for bulk transactions; seed via model for speed.
  await Transaction.insertMany(sample.transactions);
};

const verifyDashboardWidgets = async () => {
  // We’ll just call the dashboard endpoints the UI uses.
  // - Budgets, Bills, Goals, Subscriptions, Automations
  // - Spend/Cashflow chart series
  // - Health score
  // - Forecast
  // - Portfolio summary
  // - Goal suggestions
  // - Automation rules

  const calls = [
    api("/api/budgets", { method: "GET" }),
    api("/api/bills", { method: "GET" }),
    api("/api/goals", { method: "GET" }),
    api("/api/subscriptions", { method: "GET" }),
    api("/api/automations", { method: "GET" }),
    api("/api/spend-chart-series", { method: "GET" }),
    api("/api/cashflow-chart-series", { method: "GET" }),
    api("/api/health-summary", { method: "GET" }),
    api("/api/forecast", { method: "GET" }),
    api("/api/portfolio-summary", { method: "GET" }),
    api("/api/goal-suggestions", { method: "GET" }),
    api("/api/automations-rules", { method: "GET" }),
  ];

  const results = await Promise.allSettled(calls);
  const report = results.map((r, idx) => ({
    idx,
    ok: r.status === "fulfilled",
    reason: r.status === "rejected" ? String(r.reason?.message || r.reason) : undefined,
    value: r.status === "fulfilled" ? r.value : undefined,
  }));
  return report;
};

const main = async () => {
  const resolvedMongoUri = requireMongoUri();

  let resolvedUserId;

  if (token) {
    // Decode JWT payload to get the userId.
    await mongoose.connect(resolvedMongoUri, { serverSelectionTimeoutMS: 15000 });

    const decoded = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString("utf8"));
    resolvedUserId = new mongoose.Types.ObjectId(decoded.id);
  } else {
    // Auto-pick first existing user if none is provided.
    await mongoose.connect(resolvedMongoUri, { serverSelectionTimeoutMS: 15000 });

    if (userIdArg) {
      resolvedUserId = new mongoose.Types.ObjectId(userIdArg);
    } else {
      const firstUser = await User.findOne({}).select("_id");
      if (!firstUser) {
        console.error("No users found in MongoDB. Register a user first, then re-run seed.");
        process.exit(1);
      }
      resolvedUserId = firstUser._id;
    }
  }





  const userExists = await User.findById(resolvedUserId).select("_id");
  if (!userExists) {
    console.error(`User ${resolvedUserId.toString()} not found in MongoDB.`);
    process.exit(1);
  }

  if (force) {
    console.log(`--force enabled: truncating existing data for user ${resolvedUserId}`);
    await truncateExisting(resolvedUserId);
  }

  const sample = buildSample(resolvedUserId);
  sample.userId = resolvedUserId; // for internal patching

  if (token) {
    console.log("Seeding budgets, goals, bills, subscriptions, automations via API...");
    await upsertViaApi(sample);

    // Seed transactions directly (needed for charts/health/forecast/portfolio derivations)
    console.log(`Seeding ${sample.transactions.length} transactions...`);
    await Transaction.insertMany(sample.transactions);
  } else {
    console.log("Seeding everything via direct Mongoose models (no token)...");
    await upsertViaDirectModels(resolvedUserId, sample);
  }

  // Verify dashboard endpoints
  console.log("Verifying dashboard widgets via API...");
  let report;
  try {
    report = await verifyDashboardWidgets();
  } catch (e) {
    console.error("Verification failed", e);
    report = [{ ok: false, reason: String(e?.message || e) }];
  }

  // Print a compact verification summary
  console.log("\n=== Dashboard verification summary ===");
  report.forEach((r) => {
    const tag = r.ok ? "OK" : "FAIL";
    const msg = r.ok ? "received" : `error: ${r.reason}`;
    console.log(`[${tag}] call #${r.idx}: ${msg}`);
  });

  await mongoose.disconnect();
  console.log("\nDone.");
};

main().catch((e) => {
  console.error("Seed script error:", e);
  process.exit(1);
});

