import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { askAssistant } from "../controllers/assistantController.js";

const router = express.Router();

router.post("/ask", authMiddleware, askAssistant);

export default router;
