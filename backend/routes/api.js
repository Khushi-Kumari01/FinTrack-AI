// backend/routes/api.js
import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";

import { register, login, me, verifyEmail, resendVerification, forgotPassword, resetPassword } from "../controllers/authController.js";
import {
  addTransaction,
  getTransactions,
  deleteTransaction,
  updateTransaction,
} from "../controllers/transactionController.js";
import {
  importFromCSV,
  importFromSMS,
  importFromUPI,
} from "../controllers/importController.js";
import { getInsights, getRoast } from "../controllers/insightController.js";
import { askAssistant } from "../controllers/assistantController.js";
import categorizeRouter from "./categorize.js";
import paymentRouter from "./razorpayService.js";
import {
  getBudgets,
  createBudget,
  getBills,
  createBill,
  deleteBill,
  getGoals,
  createGoal,
  updateGoal,
  deleteGoal,
  getSubscriptions,
  createSubscription,
  deleteSubscription,
  updateSubscription,
  getAutomations,
  createAutomation,
  updateAutomation,
  deleteAutomation,
} from "../controllers/userDataController.js";
import {
  getAiRecommendations,
  postApplyRecommendations,
  postAiExplain,
} from "../controllers/budgetController.js";

import {
  getSpendChartSeries,
  getCashflowChartSeries,
  getHealthSummary,
  getForecast,
  getPortfolioSummary,
  getGoalSuggestions,
  getAutomationsRules,
} from "../controllers/dashboardSummaryController.js";

import { getDashboardAnalytics } from "../controllers/dashboardAnalyticsController.js";
import { getAgentLog } from "../utils/agentRunner.js";
import {
  getInvestments,
  createInvestment,
  updateInvestment,
  deleteInvestment,
} from "../controllers/investmentController.js";

const router = express.Router();
// Health
router.get("/health", (req, res) => {
  res.json({ status: "ok", service: "fintrack-backend" });
});

// Auth
router.post("/auth/register", register);
router.post("/auth/login", login);
router.get("/auth/me", authMiddleware, me);
router.get("/auth/verify-email", verifyEmail);
router.post("/auth/resend-verification", resendVerification);
router.post("/auth/forgot-password", forgotPassword);
router.post("/auth/reset-password", resetPassword);

// Transactions
router.post("/transactions", authMiddleware, addTransaction);
router.get("/transactions", authMiddleware, getTransactions);
router.patch("/transactions/:id", authMiddleware, updateTransaction);
router.delete("/transactions/:id", authMiddleware, deleteTransaction);

// Imports
router.post("/import/csv", authMiddleware, importFromCSV);
router.post("/import/sms", authMiddleware, importFromSMS);
router.post("/import/upi", authMiddleware, importFromUPI);

// Insights (used by agent + frontend)
router.get("/insights", authMiddleware, getInsights);

// Roast My Spending — data-driven, no hardcoded responses
router.get("/roast", authMiddleware, getRoast);

// Categorization (used by Voice Add / Receipt Scan)
router.use("/categorize", categorizeRouter);

// Receipt Scanner (OCR + Save)
import receiptRouter from "./receipt.js";
router.use("/receipt", receiptRouter);

// Payments
router.use("/payment", paymentRouter);

// Budgets
router.get("/budgets", authMiddleware, getBudgets);
router.post("/budgets", authMiddleware, createBudget);

// AI Budget Recommendations — live from transaction data
router.get("/budgets/ai-recommend", authMiddleware, getAiRecommendations);
router.post("/budgets/apply-recommendations", authMiddleware, postApplyRecommendations);

// AI Budget Explanations — Gemini-powered human-readable insights
router.post("/budgets/ai-explain", authMiddleware, postAiExplain);

// Bills
router.get("/bills", authMiddleware, getBills);
router.post("/bills", authMiddleware, createBill);
router.delete("/bills/:id", authMiddleware, deleteBill);

// Goals
router.get("/goals", authMiddleware, getGoals);
router.post("/goals", authMiddleware, createGoal);
router.patch("/goals/:id", authMiddleware, updateGoal);
router.delete("/goals/:id", authMiddleware, deleteGoal);

// Subscriptions
router.get("/subscriptions", authMiddleware, getSubscriptions);
router.post("/subscriptions", authMiddleware, createSubscription);
router.patch("/subscriptions/:id", authMiddleware, updateSubscription);
router.delete("/subscriptions/:id", authMiddleware, deleteSubscription);

// Automations
router.get("/automations", authMiddleware, getAutomations);
router.post("/automations", authMiddleware, createAutomation);
router.patch("/automations/:id", authMiddleware, updateAutomation);
router.delete("/automations/:id", authMiddleware, deleteAutomation);

// Assistant
router.post("/assistant/ask", authMiddleware, askAssistant);

// Dashboard widgets
router.get("/health-summary", authMiddleware, getHealthSummary);
router.get("/forecast", authMiddleware, getForecast);
router.get("/portfolio-summary", authMiddleware, getPortfolioSummary);
router.get("/goal-suggestions", authMiddleware, getGoalSuggestions);
router.get("/automation-rules", authMiddleware, getAutomationsRules);

// Investments — manual portfolio tracker
router.get("/investments", authMiddleware, getInvestments);
router.post("/investments", authMiddleware, createInvestment);
router.patch("/investments/:id", authMiddleware, updateInvestment);
router.delete("/investments/:id", authMiddleware, deleteInvestment);

// Transaction-live analytics for dashboard cards/charts
router.get("/dashboard-analytics", authMiddleware, getDashboardAnalytics);

// Agent log — returns the last N lines from the background agent pipeline
// Used by AgentConsole to show real execution evidence
router.get("/agent-log", authMiddleware, (req, res) => {
  res.json(getAgentLog());
});

// Legacy chart series (may be cached). Dashboard now prefers /dashboard-analytics.
router.get("/spend-series", authMiddleware, getSpendChartSeries);
router.get("/cashflow-series", authMiddleware, getCashflowChartSeries);

export default router;

