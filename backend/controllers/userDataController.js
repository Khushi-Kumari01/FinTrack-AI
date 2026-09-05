import Budget from "../models/Budget.js";
import Bill from "../models/Bill.js";
import Goal from "../models/Goal.js";
import Subscription from "../models/Subscription.js";
import Automation from "../models/Automation.js";

// ===== BUDGETS =====
export const getBudgets = async (req, res) => {
  try {
    const userId = req.user._id;
    const budgets = await Budget.find({ userId });
    res.json(budgets);
  } catch (err) {
    console.error("getBudgets error", err);
    res.status(500).json({ message: "Failed to fetch budgets" });
  }
};

export const createBudget = async (req, res) => {
  try {
    const userId = req.user._id;
    const { category, limit, period } = req.body;

    const budget = await Budget.create({
      userId,
      category,
      limit,
      period: period || "monthly",
    });

    res.status(201).json(budget);
  } catch (err) {
    console.error("createBudget error", err);
    res.status(500).json({ message: "Failed to create budget" });
  }
};

// ===== BILLS =====
export const getBills = async (req, res) => {
  try {
    const userId = req.user._id;
    const bills = await Bill.find({ userId });
    res.json(bills);
  } catch (err) {
    console.error("getBills error", err);
    res.status(500).json({ message: "Failed to fetch bills" });
  }
};

export const createBill = async (req, res) => {
  try {
    const userId = req.user._id;
    const { name, amount, dueDate, autoPay, category, frequency } = req.body;

    const bill = await Bill.create({
      userId,
      name,
      amount,
      dueDate,
      autoPay: autoPay || false,
      category: category || "Bills",
      frequency: frequency || "Monthly",
    });

    res.status(201).json(bill);
  } catch (err) {
    console.error("createBill error", err);
    res.status(500).json({ message: "Failed to create bill" });
  }
};

export const deleteBill = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;
    const deleted = await Bill.findOneAndDelete({ _id: id, userId });
    if (!deleted) return res.status(404).json({ message: "Bill not found" });
    res.json({ message: "Bill deleted" });
  } catch (err) {
    console.error("deleteBill error", err);
    res.status(500).json({ message: "Failed to delete bill" });
  }
};

// ===== GOALS =====
const parsePositiveNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

export const getGoals = async (req, res) => {
  try {
    const userId = req.user._id;
    const goals = await Goal.find({ userId }).sort({ createdAt: -1 });
    res.json(goals);
  } catch (err) {
    console.error("getGoals error", err);
    res.status(500).json({ message: "Failed to fetch goals" });
  }
};

export const createGoal = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      title,
      targetAmount,
      currentAmount,
      deadline,
      category,
      description,
    } = req.body;

    if (!title || typeof title !== "string" || !title.trim()) {
      return res.status(400).json({ message: "Goal name is required" });
    }

    const target = parsePositiveNumber(targetAmount);
    if (target == null || target <= 0) {
      return res.status(400).json({ message: "Target amount must be a positive number greater than 0" });
    }

    const current = parsePositiveNumber(currentAmount);

    const goal = await Goal.create({
      userId,
      title: title.trim(),
      targetAmount: target,
      currentAmount: current == null ? 0 : current,
      deadline: deadline ? new Date(deadline) : null,
      category: category || "Savings",
      description,
    });

    res.status(201).json(goal);
  } catch (err) {
    console.error("createGoal error", err);
    res.status(500).json({ message: "Failed to create goal" });
  }
};

export const updateGoal = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;
    const {
      title,
      targetAmount,
      currentAmount,
      deadline,
      category,
      description,
    } = req.body;

    const updates = {};
    if (title !== undefined) {
      if (!title || typeof title !== "string" || !title.trim()) {
        return res.status(400).json({ message: "Goal name is required" });
      }
      updates.title = title.trim();
    }

    if (targetAmount !== undefined) {
      const target = parsePositiveNumber(targetAmount);
      if (target == null || target <= 0) {
        return res.status(400).json({ message: "Target amount must be a positive number greater than 0" });
      }
      updates.targetAmount = target;
    }

    if (currentAmount !== undefined) {
      const current = parsePositiveNumber(currentAmount);
      if (current == null) {
        return res.status(400).json({ message: "Current saved amount must be a valid non-negative number" });
      }
      updates.currentAmount = current;
    }

    if (deadline !== undefined) {
      updates.deadline = deadline ? new Date(deadline) : null;
    }

    if (category !== undefined) {
      updates.category = category || "Savings";
    }

    if (description !== undefined) {
      updates.description = description;
    }

    const goal = await Goal.findOneAndUpdate({ _id: id, userId }, { $set: updates }, { new: true });

    if (!goal) {
      return res.status(404).json({ message: "Goal not found" });
    }

    res.json(goal);
  } catch (err) {
    console.error("updateGoal error", err);
    res.status(500).json({ message: "Failed to update goal" });
  }
};

export const deleteGoal = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const deleted = await Goal.findOneAndDelete({ _id: id, userId });
    if (!deleted) {
      return res.status(404).json({ message: "Goal not found" });
    }

    res.json({ message: "Goal deleted" });
  } catch (err) {
    console.error("deleteGoal error", err);
    res.status(500).json({ message: "Failed to delete goal" });
  }
};

// ===== SUBSCRIPTIONS =====
export const getSubscriptions = async (req, res) => {
  try {
    const userId = req.user._id;
    const subs = await Subscription.find({ userId });
    res.json(subs);
  } catch (err) {
    console.error("getSubscriptions error", err);
    res.status(500).json({ message: "Failed to fetch subscriptions" });
  }
};

export const createSubscription = async (req, res) => {
  try {
    const userId = req.user._id;
    const { name, amount, frequency, category } = req.body;

    const sub = await Subscription.create({
      userId,
      name,
      amount,
      frequency: frequency || "Monthly",
      category: category || "Subscriptions",
      status: "active",
      lastUsed: new Date(),
    });

    res.status(201).json(sub);
  } catch (err) {
    console.error("createSubscription error", err);
    res.status(500).json({ message: "Failed to create subscription" });
  }
};

export const deleteSubscription = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;
    const deleted = await Subscription.findOneAndDelete({ _id: id, userId });
    if (!deleted) return res.status(404).json({ message: "Subscription not found" });
    res.json({ message: "Subscription deleted" });
  } catch (err) {
    console.error("deleteSubscription error", err);
    res.status(500).json({ message: "Failed to delete subscription" });
  }
};

export const updateSubscription = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;
    const { name, amount, frequency } = req.body;

    const updates = {};

    if (name !== undefined) {
      if (!name || typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ message: "Service name is required." });
      }
      updates.name = name.trim();
    }

    if (amount !== undefined) {
      const n = Number(amount);
      if (!Number.isFinite(n) || n <= 0) {
        return res.status(400).json({ message: "Amount must be a positive number." });
      }
      updates.amount = n;
    }

    if (frequency !== undefined) {
      const valid = ["Daily", "Weekly", "Monthly", "Yearly"];
      if (!valid.includes(frequency)) {
        return res.status(400).json({ message: "Invalid frequency." });
      }
      updates.frequency = frequency;
    }

    const sub = await Subscription.findOneAndUpdate(
      { _id: id, userId },
      { $set: updates },
      { new: true }
    );

    if (!sub) return res.status(404).json({ message: "Subscription not found" });

    res.json(sub);
  } catch (err) {
    console.error("updateSubscription error", err);
    res.status(500).json({ message: "Failed to update subscription" });
  }
};

// ===== AUTOMATIONS =====
const parseNonNegativeNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

// Validation for rule-specific fields
// Supported requirements (frontend will send these):
// - savings-fixed-amount: { amount, frequency }
// - savings-income-arrival: no amount/frequency required (optional frequency)
// - savings-round-up: no amount required
// - savings-below-spending-limit: { limit, frequency }

const validateAutomationPayload = (body, mode = "create") => {
  const errors = {};

  const { title, description, type, enabled, amount, frequency, limit } = body || {};

  if (title !== undefined) {
    if (typeof title !== "string" || !title.trim()) {
      errors.title = "Rule name is required.";
    }
  }

  if (enabled !== undefined) {
    if (typeof enabled !== "boolean") {
      errors.enabled = "Enabled must be a boolean.";
    }
  }

  const allowedTypes = [
    "savings-fixed-amount",
    "savings-income-arrival",
    "savings-round-up",
    "savings-below-spending-limit",
  ];

  if (type !== undefined) {
    if (!allowedTypes.includes(type)) {
      errors.type = "Invalid rule type.";
    }
  }

  const allowedFreq = ["daily", "weekly", "monthly"];
  if (frequency !== undefined) {
    if (!allowedFreq.includes(frequency)) {
      errors.frequency = "Invalid frequency.";
    }
  }

  // Fixed amount rule
  if (type === "savings-fixed-amount") {
    if (mode === "create" || amount !== undefined) {
      const a = parseNonNegativeNumber(amount);
      if (a == null) errors.amount = "Amount must be a valid non-negative number.";
    }
    if (mode === "create" || frequency !== undefined) {
      if (!allowedFreq.includes(frequency)) errors.frequency = "Frequency is required.";
    }
  }

  // Income arrival
  if (type === "savings-income-arrival") {
    // amount/limit not required
    // frequency optional but if present must be valid
  }

  // Round-up
  if (type === "savings-round-up") {
    // nothing extra
  }

  // Below spending limit rule
  if (type === "savings-below-spending-limit") {
    if (mode === "create" || limit !== undefined) {
      const l = parseNonNegativeNumber(limit);
      if (l == null) errors.limit = "Spending limit must be a valid non-negative number.";
    }
    if (mode === "create" || frequency !== undefined) {
      if (!allowedFreq.includes(frequency)) errors.frequency = "Frequency is required.";
    }
  }

  return errors;
};

export const getAutomations = async (req, res) => {
  try {
    const userId = req.user._id;
    const automations = await Automation.find({ userId }).sort({ createdAt: -1 });
    res.json(automations);
  } catch (err) {
    console.error("getAutomations error", err);
    res.status(500).json({ message: "Failed to fetch automations" });
  }
};

export const createAutomation = async (req, res) => {
  try {
    const userId = req.user._id;
    const payload = req.body || {};

    const errors = validateAutomationPayload(payload, "create");
    if (Object.keys(errors).length) return res.status(400).json({ message: "Validation failed", errors });

    const {
      title,
      description,
      type,
      amount,
      frequency,
      enabled,
      limit,
    } = payload;

    const automation = await Automation.create({
      userId,
      title: title.trim(),
      description: description || "",
      type: type || "savings-fixed-amount",
      amount: type === "savings-fixed-amount" ? amount : undefined,
      frequency: frequency || "monthly",

      enabled: enabled !== false,
      lastRun: undefined,
      ...(type === "savings-below-spending-limit" ? { amount: limit } : {}),
    });


    res.status(201).json(automation);
  } catch (err) {
    console.error("createAutomation error", err);
    res.status(500).json({ message: "Failed to create automation" });
  }
};

export const updateAutomation = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;
    const payload = req.body || {};

    const existing = await Automation.findOne({ _id: id, userId });
    if (!existing) return res.status(404).json({ message: "Automation not found" });

    const merged = {
      ...existing.toObject(),
      ...payload,
      // allow mapping from UI back into schema for type-dependent values
      type: payload.type ?? existing.type,
    };

    const errors = validateAutomationPayload(merged, "update");
    if (Object.keys(errors).length) return res.status(400).json({ message: "Validation failed", errors });

    const {
      title,
      description,
      type,
      amount,
      frequency,
      enabled,
      limit,
    } = payload;

    const updates = {};
    if (title !== undefined) updates.title = title.trim();
    if (description !== undefined) updates.description = description || "";
    if (type !== undefined) updates.type = type;
    if (enabled !== undefined) updates.enabled = enabled;
    if (frequency !== undefined) updates.frequency = frequency;

    // Map rule-specific numeric fields into schema's `amount`.
    if (type === "savings-fixed-amount" && amount !== undefined) {
      const a = parseNonNegativeNumber(amount);
      if (a == null) return res.status(400).json({ message: "Validation failed", errors: { amount: "Amount must be a valid non-negative number." } });
      updates.amount = a;
    }

    if (type === "savings-below-spending-limit" && limit !== undefined) {
      const l = parseNonNegativeNumber(limit);
      if (l == null) return res.status(400).json({ message: "Validation failed", errors: { limit: "Spending limit must be a valid non-negative number." } });
      updates.amount = l;
    }


    const automation = await Automation.findOneAndUpdate(
      { _id: id, userId },
      { $set: updates },
      { new: true }
    );

    res.json(automation);
  } catch (err) {
    console.error("updateAutomation error", err);
    res.status(500).json({ message: "Failed to update automation" });
  }
};

export const deleteAutomation = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const deleted = await Automation.findOneAndDelete({ _id: id, userId });
    if (!deleted) return res.status(404).json({ message: "Automation not found" });

    res.json({ message: "Automation deleted" });
  } catch (err) {
    console.error("deleteAutomation error", err);
    res.status(500).json({ message: "Failed to delete automation" });
  }
};

