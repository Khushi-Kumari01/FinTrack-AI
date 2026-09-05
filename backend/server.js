// backend/server.js
import dotenv from "dotenv";

// Load env from backend/.env explicitly (works regardless of CWD)
dotenv.config({ path: new URL("./.env", import.meta.url) });

import express from "express";
import cors from "cors";
import { connectDB } from "./config/db.js";
import apiRoutes from "./routes/api.js";
import { httpLogger, logger } from "./utils/logger.js";
import { scheduler } from "./services/scheduler.js";

const app = express();

const localFrontendOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];
const configuredFrontendOrigins = (process.env.FRONTEND_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);
const allowedFrontendOrigins = new Set([
  ...(process.env.NODE_ENV === "production" ? [] : localFrontendOrigins),
  ...configuredFrontendOrigins,
]);

// Middlewares
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedFrontendOrigins.has(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
}));
app.use(express.json({ limit: "10mb" }));
app.use(httpLogger);

// Routes
app.get("/", (req, res) => {
  res.send("FinTrack Backend (multiagent)");
});

app.use("/api", apiRoutes);

// Error handler (last)
app.use((err, req, res, next) => {
  console.error("Unhandled error", err);
  res.status(500).json({ message: "Internal server error" });
});

// Start
const PORT = process.env.PORT || 5000;

const validateEnv = () => {
  const required = ["JWT_SECRET", "MONGODB_URI"];
  if (process.env.NODE_ENV === "production") required.push("FRONTEND_ORIGIN");
  const missing = required.filter((k) => !process.env[k] || !process.env[k].trim());

  if (missing.length) {
    logger.error(`❌ Missing required environment variables: ${missing.join(", ")}`);
    // Fail fast instead of letting auth routes throw 500s
    process.exit(1);
  }
};

const start = async () => {
  validateEnv();

  await connectDB();
  scheduler.start();

  app.listen(PORT, () => {
    logger.info(`🚀 Backend listening on http://localhost:${PORT}`);
  });
};

start();

