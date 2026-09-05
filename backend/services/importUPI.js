/**
 * Advanced Regex Service to parse Indian Bank SMS formats
 */
const parseSMS = (smsText) => {
    // 1. Normalize text
    const text = smsText.toLowerCase();
    
    // 2. Patterns for different banks/UPI
    // Matches: "Rs. 500", "INR 500", "Debited by 500"
    const amountRegex = /(?:rs\.?|inr)\s*([\d,]+(?:\.\d{2})?)/i;
    
    // Matches: "at STARBUCKS", "to ZOMATO", "VPA uber@okaxis"
    const merchantRegex = /(?:at|to|vpa)\s+([a-zA-Z0-9\s\._]+?)(?:\s|on|ref|bal)/i;

    // 3. Extract Amount
    const amountMatch = text.match(amountRegex);
    let amount = 0;
    if (amountMatch) {
        amount = parseFloat(amountMatch[1].replace(/,/g, ''));
    }

    // 4. Extract Merchant
    let merchant = "Unknown Merchant";
    const merchantMatch = text.match(merchantRegex);
    if (merchantMatch) {
        merchant = merchantMatch[1].trim().toUpperCase();
    }

    // 5. Determine Type (Debit vs Credit)
    const type = text.includes("credited") || text.includes("received") ? "income" : "expense";

    // 6. Basic Auto-Categorization
    let category = "Others";
    if (merchant.includes("ZOMATO") || merchant.includes("SWIGGY") || merchant.includes("RESTAURANT")) category = "Food & Dining";
    if (merchant.includes("UBER") || merchant.includes("OLA") || merchant.includes("PETROL")) category = "Transport";
    if (merchant.includes("AMAZON") || merchant.includes("FLIPKART")) category = "Shopping";
    if (merchant.includes("SALARY")) category = "Salary";

    if (amount === 0) return null; // Invalid parse

    return {
        amount,
        merchant,
        type,
        category,
        channel: 'SMS',
        originalSMS: smsText,
        date: new Date()
    };
};

module.exports = { parseSMS };