import crypto from "crypto";
import express from "express";
import Razorpay from "razorpay";
import { authMiddleware } from "../middleware/authMiddleware.js";
import User from "../models/User.js";

let razorpay;

const getRazorpay = () => {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new Error("Razorpay credentials are not configured");
  }

  if (!razorpay) {
    razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }

  return razorpay;
};

export const createRazorpayOrder = async (amount) => {
  return await getRazorpay().orders.create({
    amount: amount * 100,
    currency: "INR",
    receipt: "fintrack_" + Date.now(),
  });
};

const router = express.Router();

router.post("/create-order", authMiddleware, async (req, res) => {
  try {
    const amount = Number(req.body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ message: "Amount must be a positive number" });
    }

    const order = await createRazorpayOrder(amount);
    res.json(order);
  } catch (err) {
    console.error("createRazorpayOrder error", err);
    res.status(500).json({ message: "Failed to create payment order" });
  }
});

router.post("/verify", authMiddleware, (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ message: "Incomplete payment verification data" });
    }

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    const expectedBuffer = Buffer.from(expectedSignature);
    const receivedBuffer = Buffer.from(razorpay_signature);
    if (expectedBuffer.length !== receivedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)) {
      return res.status(400).json({ message: "Invalid payment signature" });
    }

    User.findByIdAndUpdate(
      req.user._id,
      {
        $set: {
          isPremium: true,
          premiumActivatedAt: new Date(),
          razorpayPaymentId: razorpay_payment_id,
          razorpayOrderId: razorpay_order_id,
        },
      },
      { new: true, select: "isPremium premiumActivatedAt razorpayPaymentId razorpayOrderId" }
    )
      .then((user) => {
        if (!user) return res.status(404).json({ message: "User not found" });
        res.json({
          verified: true,
          premium: {
            isPremium: user.isPremium,
            premiumActivatedAt: user.premiumActivatedAt,
            razorpayPaymentId: user.razorpayPaymentId,
            razorpayOrderId: user.razorpayOrderId,
          },
        });
      })
      .catch((err) => {
        console.error("premium state update error", err);
        res.status(500).json({ message: "Payment verified but Premium state update failed" });
      });
  } catch (err) {
    console.error("verifyRazorpayPayment error", err);
    res.status(500).json({ message: "Failed to verify payment" });
  }
});

router.get("/status", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("isPremium premiumActivatedAt razorpayPaymentId razorpayOrderId");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({
      isPremium: user.isPremium,
      premiumActivatedAt: user.premiumActivatedAt,
      razorpayPaymentId: user.razorpayPaymentId,
      razorpayOrderId: user.razorpayOrderId,
    });
  } catch (err) {
    console.error("premium status error", err);
    res.status(500).json({ message: "Failed to fetch Premium status" });
  }
});

export default router;

