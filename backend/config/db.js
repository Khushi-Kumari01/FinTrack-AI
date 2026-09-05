// backend/config/db.js
import mongoose from "mongoose";
import { logger } from "../utils/logger.js";

export const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error("MONGODB_URI is not set in .env");
    }

    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 15000
    });

    logger.info("✅ MongoDB connected");
  } catch (err) {
    // Fail fast with clear root cause; do not hide the underlying error.
    logger.error("❌ MongoDB connection error", err);
    // Exit so deployments don't run in a broken state.
    process.exit(1);
  }
};

