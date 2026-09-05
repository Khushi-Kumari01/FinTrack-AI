/**
 * Receipt Controller — Handles receipt scanning/upload OCR processing.
 *
 * POST /api/receipt/process
 *   Accepts: { image: "<base64>" } OR { image: "<base64>", mimeType: "image/png" }
 *   Returns: { merchant, amount, date, category, rawText, confidence, score, issues }
 *
 * POST /api/receipt/save
 *   Accepts: { merchant, amount, date, category }
 *   Returns: { transaction } from Transaction model
 *   Reuses the existing addTransaction logic.
 */

import { processReceiptBase64 } from "../services/receiptProcessor.js";
import Transaction from "../models/Transaction.js";
import { categorize } from "../services/categorizer.js";
import { runAgentPipeline } from "../utils/agentRunner.js";
import { logger } from "../utils/logger.js";

/**
 * Process a receipt image and extract structured data.
 */
export const processReceipt = async (req, res) => {
  try {
    const { image, mimeType } = req.body;

    if (!image) {
      return res.status(400).json({
        message: "No image provided. Send a base64-encoded image in the 'image' field.",
      });
    }

    // Validate image size (max 10MB)
    const estimatedSize = Math.ceil((image.length * 3) / 4);
    if (estimatedSize > 10 * 1024 * 1024) {
      return res.status(413).json({
        message: "Image too large. Maximum size is 10MB.",
      });
    }

    const result = await processReceiptBase64(
      image,
      mimeType || "image/png"
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error(`processReceipt error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: "Failed to process receipt. Please try again or enter details manually.",
      error: error.message,
      data: {
        merchant: null,
        amount: null,
        date: null,
        category: null,
        rawText: null,
        confidence: "low",
        score: 0,
        issues: [error.message],
      },
    });
  }
};

/**
 * Save a scanned/verified receipt as a transaction.
 * Reuses the existing categorization and transaction creation logic.
 */
export const saveReceiptTransaction = async (req, res) => {
  try {
    const userId = req.user._id;
    const { merchant, amount, date, category, rawText } = req.body;

    // Validate required fields
    if (!amount || amount <= 0) {
      return res.status(400).json({
        message: "A valid amount is required.",
      });
    }

    if (!merchant || merchant.trim().length === 0) {
      return res.status(400).json({
        message: "Merchant name is required.",
      });
    }

    // Auto-categorize if category not provided or is placeholder
    const finalCategory =
      !category ||
      category === "Uncategorized" ||
      category === "Others" ||
      category === ""
        ? categorize({ merchant: merchant || "", transcript: rawText || "" }).category
        : category;

    // Parse or default date to now
    const txDate = date ? new Date(date) : new Date();
    if (isNaN(txDate.getTime())) {
      // If date parsing failed, use current date
      txDate.setTime(Date.now());
    }

    const transaction = await Transaction.create({
      userId,
      amount: Number(amount),
      category: finalCategory,
      merchant: merchant.trim(),
      type: "expense",
      date: txDate,
      channel: "Receipt Scan",
      rawText: rawText || "",
      status: "cleared",
    });

    // Trigger background agent pipeline for insights refresh.
    // runAgentPipeline() is synchronous (returns boolean, not a Promise) —
    // do NOT call .catch() on it, that would throw TypeError.
    const token = req.headers.authorization?.split(" ")[1] || "";
    if (token) {
      runAgentPipeline({
        userToken: token,
        goal: "Refresh spending insights for the latest receipt scan transaction",
      });
    }

    logger.info(
      `Receipt saved: user=${userId}, merchant="${merchant}", amount=${amount}, category=${finalCategory}`
    );

    res.status(201).json({
      success: true,
      transaction,
    });
  } catch (error) {
    logger.error(`saveReceiptTransaction error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: "Failed to save receipt transaction.",
    });
  }
};

