// backend/services/scheduler.js
import cron from "node-cron";
import { logger } from "../utils/logger.js";
// import { seedDemoTransactionsForUser } from "./bankSimulator.js";

export const scheduler = {
  start() {
    // Example cron: log heartbeat every minute
    cron.schedule("* * * * *", () => {
      logger.debug("⏱ Scheduler heartbeat");
    });

    logger.info("✅ Scheduler started");
  }
};
