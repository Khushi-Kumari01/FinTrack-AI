// backend/models/User.js
import mongoose from "mongoose";
import crypto from "crypto";

const userSchema = new mongoose.Schema(
  {
    name:          { type: String, required: true },
    email:         { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash:  { type: String, required: true },

    isPremium: { type: Boolean, default: false },
    premiumActivatedAt: { type: Date },
    razorpayPaymentId: { type: String },
    razorpayOrderId: { type: String },

    passwordResetToken:   { type: String },
    passwordResetExpires: { type: Date },

    // ── Email verification ──────────────────────────────────────────────
    // emailVerified = false until the user clicks the link sent to their inbox.
    // When EMAIL_VERIFICATION_ENABLED=false (default for localhost), all new
    // accounts are created with emailVerified = true so login works immediately.
    emailVerified: { type: Boolean, default: false },

    // Token stored as a hex digest, expires 24 hours after creation.
    emailVerificationToken:   { type: String },
    emailVerificationExpires: { type: Date },
  },
  { timestamps: true }
);

// ── Static: generate a fresh verification token ─────────────────────────
userSchema.statics.generateVerificationToken = function () {
  const rawToken   = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expires     = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 h
  return { rawToken, hashedToken, expires };
};

const User = mongoose.model("User", userSchema);
export default User;
