/**
 * Receipt Routes — Receipt scanning, OCR processing, and saving.
 *
 * POST /api/receipt/process  — Process a receipt image via OCR
 * POST /api/receipt/save     — Save a verified receipt as a transaction
 */

import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import {
  processReceipt,
  saveReceiptTransaction,
} from "../controllers/receiptController.js";

const router = express.Router();

// All receipt routes require authentication
router.use(authMiddleware);

/**
 * @route   POST /api/receipt/process
 * @desc    Process a receipt image and extract merchant/amount/date/category
 * @access  Private
 * @body    { image: "<base64>", mimeType: "image/png" }
 * @returns { success, data: { merchant, amount, date, category, rawText, confidence, score, issues } }
 */
router.post("/process", processReceipt);

/**
 * @route   POST /api/receipt/save
 * @desc    Save a verified receipt as a transaction
 * @access  Private
 * @body    { merchant, amount, date, category, rawText }
 * @returns { success, transaction }
 */
router.post("/save", saveReceiptTransaction);

export default router;

