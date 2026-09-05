/**
 * Receipt OCR Processor for FinTrack
 *
 * Uses Tesseract.js to extract text from receipt images,
 * then parses merchant name, amount, date, and raw text
 * using regex patterns tuned for Indian receipt formats.
 *
 * Reuses the existing categorizer service for merchant→category mapping.
 */

import { createWorker } from "tesseract.js";
import { categorize } from "./categorizer.js";
import { logger } from "../utils/logger.js";

// ─── Regex Patterns ─────────────────────────────────────────────────────────

/** Indian mobile number (optional on receipts) */
const MOBILE_RE = /(\+?91[-\s]?)?[6-9]\d{9}/;

/** GSTIN (15 chars: 2 state + 10 PAN + 3 entity + 1 check) */
const GSTIN_RE = /\b\d{2}[A-Z]{5}\d{4}[A-Z]{1}\d[Z]{1}[A-Z\d]{1}\b/;

/** Bill / Invoice numbers */
const BILL_NO_RE = /(?:bill|invoice|receipt|order|ticket|challan)\s*(?:no|#|:|\.)?\s*([A-Za-z0-9/-]{4,20})/i;

/** Amount patterns:
 *  - "Total: ₹1,234.56" or "Total: Rs 1,234.56"
 *  - "1,234.56" as standalone
 *  - "Amount: 1234"
 *  - "Grand Total: 1234.56"
 *  Captures net amount (ignoring tax line items)
 */
const AMOUNT_RE = /(?:total|amount|grand\s*total|net|payable|due|balance|paid|rs\.?|₹)\s*:?\s*[₹rs.\s]*(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)/i;

/** Fallback: any standalone currency amount */
const STANDALONE_AMOUNT_RE = /(?:₹|rs\.?|inr)\s*(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)/i;

/** Simple number (for when currency symbol is missing) */
const PLAIN_AMOUNT_RE = /\b(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)\b/;

/** Date patterns — supports DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, "12 Mar 2024", etc. */
const DATE_RE = /\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2}|\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{2,4})\b/i;

/** First line heuristic — often contains merchant/store name */
const MERCHANT_FIRST_LINE_RE = /^([A-Za-z0-9\s&.,'-]+)/;

/** Common merchant keywords in receipt header */
const STORE_KEYWORDS = [
  "store", "mart", "shop", "restaurant", "hotel", "cafe", "hospital",
  "pharmacy", "clinic", "salon", "studio", "bazaar", "retail", "traders",
  "solutions", "services", "enterprises", "industries", "pvt", "ltd",
  "limited", "private", "company", "agency", "outlet", "d mart", "dmart",
  "big basket", "zepto", "blinkit", "instamart", "reliance", "tata",
  "amazon", "flipkart", "myntra", "nykaa", "swiggy", "zomato",
  "uber", "ola", "airtel", "jio", "kfc", "mcdonald", "pizza hut",
  "domino", "subway", "starbucks", "cafe coffee day",
];

/** Lines to ignore (noise) */
const NOISE_LINES = [
  /gst|tax|cgst|sgst|igst|cess|invoice|receipt|bill/i,
  /total|amount|change|cash|card|upi|payment/i,
  /phone|mobile|email|web|www|\.com/i,
  /thank|welcome|visit|again|save|environment/i,
  /\d{10,}/, // long numbers
  /^[^a-zA-Z]+$/, // no letters
  /^.{1,2}$/, // too short
];

// ─── Confidence Scoring ─────────────────────────────────────────────────────

/**
 * Estimate OCR confidence level based on how many fields were extracted
 * and the quality of matches.
 *
 * @param {Object} parsed
 * @param {number} ocrProgress - Tesseract progress (0-1)
 * @returns {{ confidence: 'high'|'medium'|'low', score: number, issues: string[] }}
 */
function calculateConfidence(parsed, ocrProgress = 0.5) {
  const issues = [];
  let score = 0;

  // Merchant presence (0-30 pts)
  if (parsed.merchant && parsed.merchant.length > 2) {
    score += 30;
  } else {
    issues.push("Merchant name not clearly detected");
  }

  // Amount (0-30 pts)
  if (parsed.amount != null && parsed.amount > 0) {
    score += 30;
  } else {
    issues.push("Amount not detected");
  }

  // Date (0-20 pts)
  if (parsed.date) {
    score += 20;
  } else {
    issues.push("Date not detected");
  }

  // OCR engine confidence (0-20 pts)
  score += Math.round(ocrProgress * 20);

  const confidence =
    score >= 75 ? "high" :
    score >= 50 ? "medium" :
    "low";

  return { confidence, score, issues };
}

// ─── Text Parsing Engine ───────────────────────────────────────────────────

/**
 * Parse raw OCR text into structured receipt data.
 *
 * @param {string} rawText - The full text extracted by Tesseract
 * @returns {Object} { merchant, amount, date, rawText, category }
 */
function parseReceiptText(rawText) {
  if (!rawText || rawText.trim().length === 0) {
    return { merchant: null, amount: null, date: null, rawText: "", category: null };
  }

  const lines = rawText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // ── Extract Date ─────────────────────────────────────────────────────────
  let date = null;
  for (const line of lines) {
    const match = line.match(DATE_RE);
    if (match) {
      date = parseDateString(match[1]);
      if (date) break;
    }
  }

  // ── Extract Amount ───────────────────────────────────────────────────────
  let amount = null;
  for (const line of lines) {
    const match = line.match(AMOUNT_RE);
    if (match) {
      const parsed = parseAmount(match[1]);
      if (parsed > 0) {
        amount = Math.max(amount || 0, parsed);
        // Don't break — keep looking for "grand total" which is usually last
      }
    }
  }

  // Fallback: look for standalone currency amount
  if (amount == null) {
    for (const line of lines) {
      const match = line.match(STANDALONE_AMOUNT_RE);
      if (match) {
        const parsed = parseAmount(match[1]);
        if (parsed > 0) {
          amount = parsed;
          break;
        }
      }
    }
  }

  // Fallback: look for any number that looks like an amount
  if (amount == null) {
    for (const line of lines) {
      const numbers = [...line.matchAll(PLAIN_AMOUNT_RE)];
      for (const n of numbers) {
        const parsed = parseAmount(n[1]);
        // Accept amounts between ₹1 and ₹10,00,000
        if (parsed >= 1 && parsed <= 1000000) {
          amount = parsed;
        }
      }
      if (amount != null) break;
    }
  }

  // ── Extract Merchant ─────────────────────────────────────────────────────
  let merchant = null;
  const nonNoiseLines = lines.filter(
    (line) => !NOISE_LINES.some((re) => re.test(line))
  );

  // Strategy 1: First non-noise line (often the store name)
  if (nonNoiseLines.length > 0) {
    const first = nonNoiseLines[0].replace(/^[\d\s#]+/, "").trim();
    if (first.length >= 3 && first.length < 60) {
      merchant = first;
    }
  }

  // Strategy 2: Look for a line containing known store keywords
  if (!merchant || merchant.length < 3) {
    for (const line of nonNoiseLines) {
      const lower = line.toLowerCase();
      for (const keyword of STORE_KEYWORDS) {
        if (lower.includes(keyword) && line.length < 60) {
          merchant = line.replace(/^[\d\s#]+/, "").trim();
          break;
        }
      }
      if (merchant) break;
    }
  }

  // Strategy 3: First line of the entire text (header)
  if (!merchant) {
    const firstLine = lines[0]?.replace(/^[\d\s#]+/, "").trim();
    if (firstLine && firstLine.length >= 3 && firstLine.length < 60) {
      merchant = firstLine;
    }
  }

  // Clean up merchant name
  if (merchant) {
    merchant = merchant
      .replace(/\s+/g, " ")
      .replace(/[^\w\s&.,'-]/g, "")
      .trim();
    // Remove common prefixes
    merchant = merchant.replace(/^(thank you|welcome to|shopping at)\s+/i, "").trim();

    // Strip customer/person names from merchant field.
    // Receipts often include "Store Name Customer Name" on the same line.
    // Remove trailing words that look like personal names (not company suffixes).
    // Common pattern: "Company Name Pvt Ltd [Customer Name]" or "Store Name [Customer Name]"
    const companySuffixes = /(pvt|private|limited|ltd|inc|corp|llc|enterprises|industries|solutions|services|traders|retail)\s*\.?$/i;
    const hasCompanySuffix = companySuffixes.test(merchant);

    if (hasCompanySuffix) {
      // Strip everything after the company suffix, keeping the suffix
      const match = merchant.match(/^(.+?(?:pvt|private|limited|ltd|inc|corp|llc|enterprises|industries|solutions|services|traders|retail)\s*\.?)/i);
      if (match) {
        merchant = match[1].trim();
      }
    } else {
      // If no company suffix found, try to detect and remove likely person names
      // at the end. Person names are typically 2-3 capitalized words at the end.
      // Heuristic: if the last word is a common name token (not a store keyword),
      // check if removing the last 1-2 words improves the merchant name.
      const words = merchant.split(/\s+/);
      if (words.length > 2) {
        // Check if last 1-2 words look like a person name (all alpha, >=3 chars each)
        const lastName = words[words.length - 1];
        const secondLastName = words.length > 2 ? words[words.length - 2] : null;

        const isPersonName = (w) => /^[A-Z][a-z]{2,}$/.test(w) && !STORE_KEYWORDS.some(k => w.toLowerCase().includes(k));

        if (isPersonName(lastName) && (!secondLastName || isPersonName(secondLastName))) {
          // Remove trailing person name(s)
          const merchantWords = words.filter((w, i) => {
            if (i >= words.length - (secondLastName && isPersonName(secondLastName) ? 2 : 1)) {
              return false;
            }
            return true;
          });
          if (merchantWords.length >= 2) {
            merchant = merchantWords.join(" ");
          }
        }
      }
    }
  }

  // ── Determine Category ───────────────────────────────────────────────────
  let category = null;
  if (merchant) {
    const catResult = categorize({ merchant, transcript: rawText });
    category = catResult.category;
  }

  return {
    merchant: merchant || null,
    amount: amount != null ? Math.round(amount * 100) / 100 : null,
    date: date ? date.toISOString() : null,
    rawText: rawText.trim(),
    category,
  };
}

// ─── Helper Functions ───────────────────────────────────────────────────────

/**
 * Parse amount string like "1,234.56" → 1234.56
 */
function parseAmount(str) {
  if (!str) return null;
  const cleaned = str.replace(/[₹,\s]/g, "").trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Parse various date formats into a Date object.
 * Returns null if parsing fails.
 *
 * IMPORTANT: Uses Date.UTC() for all constructions so that date-only values
 * like "20 July 2026" are stored as 2026-07-20T00:00:00.000Z — not shifted
 * by the server timezone (IST +5:30 would otherwise produce 2026-07-19T18:30Z,
 * causing July 20 to display as July 19 in the UI).
 */
function parseDateString(str) {
  if (!str) return null;

  // Normalize separators
  const cleaned = str.trim();

  // Try DD/MM/YYYY or DD-MM-YYYY
  const dmy = cleaned.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (dmy) {
    let [, day, month, year] = dmy;
    day = parseInt(day);
    month = parseInt(month) - 1;
    year = parseInt(year);
    if (year < 100) year += 2000;
    const d = new Date(Date.UTC(year, month, day));
    if (!isNaN(d.getTime())) return d;
  }

  // Try YYYY-MM-DD
  const ymd = cleaned.match(/^(\d{2,4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (ymd) {
    let [, year, month, day] = ymd;
    day = parseInt(day);
    month = parseInt(month) - 1;
    year = parseInt(year);
    const d = new Date(Date.UTC(year, month, day));
    if (!isNaN(d.getTime())) return d;
  }

  // Try "12 Mar 2024" or "12 March 2024"
  const textDate = cleaned.match(
    /^(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{2,4})$/i
  );
  if (textDate) {
    const months = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
    };
    const day = parseInt(textDate[1]);
    const month = months[textDate[2].toLowerCase().slice(0, 3)];
    let year = parseInt(textDate[3]);
    if (year < 100) year += 2000;
    if (month !== undefined) {
      const d = new Date(Date.UTC(year, month, day));
      if (!isNaN(d.getTime())) return d;
    }
  }

  return null;
}

// ─── Main OCR Pipeline ─────────────────────────────────────────────────────

/**
 * Process a receipt image buffer and extract structured data.
 *
 * @param {Buffer} imageBuffer - The raw image data
 * @param {string} [mimeType] - MIME type hint (e.g., "image/png", "application/pdf")
 * @returns {Promise<Object>} { merchant, amount, date, category, rawText, confidence, score, issues }
 */
export async function processReceipt(imageBuffer, mimeType = "image/png") {
  logger.info(`Processing receipt (${mimeType}, ${(imageBuffer.length / 1024).toFixed(1)} KB)`);

  let worker;

  try {
    // ── Initialize Tesseract Worker ──────────────────────────────────────
    worker = await createWorker("eng", 1, {
      logger: (m) => {
        if (m.status === "recognizing text") {
          // We track progress for confidence scoring later
        }
      },
    });

    // Set page segmentation mode to auto
    await worker.setParameters({
      tessedit_pageseg_mode: "3", // Fully automatic page segmentation
    });

    // ── Run OCR ──────────────────────────────────────────────────────────
    const { data } = await worker.recognize(imageBuffer);
    const rawText = data.text || "";
    const ocrConfidence = data.confidence || 0; // Tesseract gives 0-100

    logger.info(`OCR complete: ${rawText.length} chars, confidence=${ocrConfidence}`);

    // ── Parse text ───────────────────────────────────────────────────────
    const parsed = parseReceiptText(rawText);

    // ── Calculate confidence ─────────────────────────────────────────────
    const { confidence, score, issues } = calculateConfidence(
      parsed,
      ocrConfidence / 100
    );

    const result = {
      ...parsed,
      confidence,
      score,
      issues,
    };

    logger.info(
      `Receipt parsed: merchant="${result.merchant}", amount=${result.amount}, ` +
      `date=${result.date}, category=${result.category}, confidence=${confidence}`
    );

    return result;
  } catch (error) {
    logger.error(`OCR processing failed: ${error.message}`);
    throw new Error(`Receipt OCR failed: ${error.message}`);
  } finally {
    // Always clean up the worker
    if (worker) {
      try {
        await worker.terminate();
      } catch (e) {
        logger.warn(`Worker cleanup issue: ${e.message}`);
      }
    }
  }
}

/**
 * Process a base64-encoded image.
 *
 * @param {string} base64String - Base64 encoded image (with or without data URI prefix)
 * @param {string} mimeType - MIME type
 * @returns {Promise<Object>} Parsed receipt data
 */
export async function processReceiptBase64(base64String, mimeType = "image/png") {
  // Strip data URI prefix if present
  const stripped = base64String.replace(/^data:image\/[a-z]+;base64,/, "");
  const buffer = Buffer.from(stripped, "base64");
  return processReceipt(buffer, mimeType);
}

export default {
  processReceipt,
  processReceiptBase64,
  parseReceiptText,
};

