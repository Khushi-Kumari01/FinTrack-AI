// backend/utils/logger.js
import morgan from "morgan";

const level = process.env.NODE_ENV === "production" ? "info" : "debug";

export const logger = {
  info: (...args) => console.log("[INFO]", ...args),
  error: (...args) => console.error("[ERROR]", ...args),
  warn: (...args) => console.warn("[WARN]", ...args),
  debug: (...args) => {
    if (level === "debug") console.log("[DEBUG]", ...args);
  }
};

export const httpLogger = morgan("tiny");
