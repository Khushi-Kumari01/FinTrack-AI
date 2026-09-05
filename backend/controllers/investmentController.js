/**
 * Investment Controller — manual portfolio CRUD.
 *
 * GET    /api/investments         — list all investments for the user
 * POST   /api/investments         — create a new investment entry
 * PATCH  /api/investments/:id     — update an existing entry (e.g. refresh current value)
 * DELETE /api/investments/:id     — delete an entry
 *
 * All values are user-supplied; no live market prices are fetched.
 */

import Investment from "../models/Investment.js";

// ─── Helpers ─────────────────────────────────────────────────────────────

const safePositive = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

// ─── GET /api/investments ─────────────────────────────────────────────────

export const getInvestments = async (req, res) => {
  try {
    const userId = req.user._id;
    const investments = await Investment.find({ userId }).sort({ investedOn: -1 });
    res.json(investments);
  } catch (err) {
    console.error("getInvestments error", err);
    res.status(500).json({ message: "Failed to fetch investments" });
  }
};

// ─── POST /api/investments ────────────────────────────────────────────────

export const createInvestment = async (req, res) => {
  try {
    const userId = req.user._id;
    const { name, type, amountInvested, currentValue, investedOn, notes } = req.body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ message: "Investment name is required." });
    }

    const invested = safePositive(amountInvested);
    if (invested == null) {
      return res.status(400).json({ message: "Amount invested must be a non-negative number." });
    }

    const current = safePositive(currentValue);
    if (current == null) {
      return res.status(400).json({ message: "Current value must be a non-negative number." });
    }

    if (!investedOn) {
      return res.status(400).json({ message: "Investment date is required." });
    }
    const date = new Date(investedOn);
    if (isNaN(date.getTime())) {
      return res.status(400).json({ message: "Investment date is invalid." });
    }

    const investment = await Investment.create({
      userId,
      name: name.trim(),
      type: type || "Other",
      amountInvested: invested,
      currentValue: current,
      investedOn: date,
      notes: notes?.trim() || "",
    });

    res.status(201).json(investment);
  } catch (err) {
    console.error("createInvestment error", err);
    res.status(500).json({ message: "Failed to create investment" });
  }
};

// ─── PATCH /api/investments/:id ───────────────────────────────────────────

export const updateInvestment = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;
    const { name, type, amountInvested, currentValue, investedOn, notes } = req.body;

    const updates = {};

    if (name !== undefined) {
      if (!name || typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ message: "Investment name is required." });
      }
      updates.name = name.trim();
    }

    if (type !== undefined) updates.type = type;

    if (amountInvested !== undefined) {
      const invested = safePositive(amountInvested);
      if (invested == null) {
        return res.status(400).json({ message: "Amount invested must be a non-negative number." });
      }
      updates.amountInvested = invested;
    }

    if (currentValue !== undefined) {
      const current = safePositive(currentValue);
      if (current == null) {
        return res.status(400).json({ message: "Current value must be a non-negative number." });
      }
      updates.currentValue = current;
    }

    if (investedOn !== undefined) {
      const date = new Date(investedOn);
      if (isNaN(date.getTime())) {
        return res.status(400).json({ message: "Investment date is invalid." });
      }
      updates.investedOn = date;
    }

    if (notes !== undefined) updates.notes = notes?.trim() || "";

    const investment = await Investment.findOneAndUpdate(
      { _id: id, userId },
      { $set: updates },
      { new: true }
    );

    if (!investment) {
      return res.status(404).json({ message: "Investment not found." });
    }

    res.json(investment);
  } catch (err) {
    console.error("updateInvestment error", err);
    res.status(500).json({ message: "Failed to update investment" });
  }
};

// ─── DELETE /api/investments/:id ──────────────────────────────────────────

export const deleteInvestment = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const deleted = await Investment.findOneAndDelete({ _id: id, userId });
    if (!deleted) {
      return res.status(404).json({ message: "Investment not found." });
    }

    res.json({ message: "Investment deleted." });
  } catch (err) {
    console.error("deleteInvestment error", err);
    res.status(500).json({ message: "Failed to delete investment" });
  }
};
