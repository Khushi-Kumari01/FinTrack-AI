// backend/controllers/authController.js
import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { sendVerificationEmail, sendPasswordResetEmail, emailVerificationEnabled } from "../services/emailService.js";

// ── Sign a JWT ─────────────────────────────────────────────────────────────
// Payload: { id, email, name }  — id is the MongoDB _id (the authoritative userId).
// The backend ALWAYS derives the authenticated user from this token, never from
// a userId supplied in the request body/query.
const signToken = (user) => {
  return jwt.sign(
    { id: user._id, email: user.email, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};

// ── REGISTER ───────────────────────────────────────────────────────────────
export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Missing fields" });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const hash = await bcrypt.hash(password, 10);

    // When email verification is disabled (default for localhost), new accounts
    // are immediately marked as verified so login works without SMTP setup.
    const autoVerify = !emailVerificationEnabled;

    let verificationToken     = undefined;
    let verificationExpires   = undefined;

    if (!autoVerify) {
      // Generate a secure verification token (stored hashed, sent as plain text)
      const { rawToken, hashedToken, expires } = User.generateVerificationToken();
      verificationToken   = hashedToken;
      verificationExpires = expires;

      // We'll send the email after creating the user
      var pendingVerification = { rawToken, email, name };
    }

    const user = await User.create({
      name,
      email,
      passwordHash: hash,
      emailVerified:             autoVerify,
      emailVerificationToken:    verificationToken,
      emailVerificationExpires:  verificationExpires,
    });

    // Send verification email (non-fatal if it fails)
    if (!autoVerify && pendingVerification) {
      try {
        await sendVerificationEmail(
          pendingVerification.email,
          pendingVerification.name,
          pendingVerification.rawToken
        );
      } catch (mailErr) {
        // Email send failed — log but don't block registration.
        // User can request a resend.
        console.error("Verification email send failed:", mailErr.message);
      }
    }

    if (!autoVerify) {
      // Return a success message without a token — user must verify email first.
      return res.status(201).json({
        message: "Registration successful. Please check your email to verify your account.",
        emailVerificationRequired: true,
      });
    }

    // Auto-verified (localhost / EMAIL_VERIFICATION_ENABLED=false) — return token immediately.
    const token = signToken(user);
    return res.status(201).json({
      token,
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (err) {
    console.error("register error", err);
    const status = err?.name === "ValidationError" ? 400 : 500;
    const message = err?.message || "Register failed";
    return res.status(status).json({ message });
  }
};

// ── LOGIN ──────────────────────────────────────────────────────────────────
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Missing fields" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // ── Email verification gate ────────────────────────────────────────
    // Only enforced when EMAIL_VERIFICATION_ENABLED=true.  When disabled
    // (default localhost), all accounts are treated as verified.
    if (emailVerificationEnabled && !user.emailVerified) {
      return res.status(403).json({
        message: "Please verify your email before signing in.",
        emailVerificationRequired: true,
      });
    }

    const token = signToken(user);
    return res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (err) {
    console.error("login error", err);
    return res.status(500).json({ message: "Login failed" });
  }
};

// ── /auth/me ───────────────────────────────────────────────────────────────
export const me = async (req, res) => {
  res.json({
    user: { id: req.user._id, name: req.user.name, email: req.user.email },
  });
};

// ── VERIFY EMAIL ───────────────────────────────────────────────────────────
export const verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) {
      return res.status(400).json({ message: "Verification token is required." });
    }

    // Hash the incoming plain-text token to compare against the stored hash
    const hashed = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      emailVerificationToken:   hashed,
      emailVerificationExpires: { $gt: new Date() }, // not expired
    });

    if (!user) {
      return res.status(400).json({
        message: "Invalid or expired verification link. Please request a new one.",
      });
    }

    // Mark verified and clear the token (single-use)
    user.emailVerified             = true;
    user.emailVerificationToken    = undefined;
    user.emailVerificationExpires  = undefined;
    await user.save();

    // Return an auth token so the user is logged in immediately after verifying
    const authToken = signToken(user);
    return res.json({
      message: "Email verified successfully.",
      token: authToken,
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (err) {
    console.error("verifyEmail error", err);
    return res.status(500).json({ message: "Verification failed." });
  }
};

// ── RESEND VERIFICATION ────────────────────────────────────────────────────
export const resendVerification = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email is required." });
    }

    const user = await User.findOne({ email });

    // Always return 200 to avoid user enumeration, even if the email is not found
    if (!user || user.emailVerified) {
      return res.json({ message: "If that account exists and is unverified, a new email has been sent." });
    }

    // Generate a new token
    const { rawToken, hashedToken, expires } = User.generateVerificationToken();
    user.emailVerificationToken   = hashedToken;
    user.emailVerificationExpires = expires;
    await user.save();

    try {
      await sendVerificationEmail(user.email, user.name, rawToken);
    } catch (mailErr) {
      console.error("Resend verification email failed:", mailErr.message);
      return res.status(500).json({ message: "Failed to send verification email. Please try again later." });
    }

    return res.json({ message: "Verification email resent. Please check your inbox." });
  } catch (err) {
    console.error("resendVerification error", err);
    return res.status(500).json({ message: "Failed to resend verification email." });
  }
};

// ── FORGOT PASSWORD ────────────────────────────────────────────────────────
// POST /auth/forgot-password  { email }
// Generates a secure single-use reset token, stores its SHA-256 hash in the
// DB with a 1-hour expiry, then sends the plain-text token in a reset link.
// Always returns the same generic message to prevent account enumeration.
export const forgotPassword = async (req, res) => {
  try {
    const raw = (req.body.email || "").toString().trim().toLowerCase();

    // Basic format check — reject clearly invalid strings early
    if (!raw || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
      return res.status(400).json({ message: "Please enter a valid email address." });
    }

    const user = await User.findOne({ email: raw });

    // If the user does NOT exist: return the same generic message (no enumeration).
    // No token is generated, no email is sent.
    if (!user) {
      return res.json({
        message: "If that email is registered with FinTrack, a reset link has been sent.",
      });
    }

    // Generate a cryptographically secure token (32 random bytes → 64-char hex)
    const rawToken    = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expires     = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Store hashed token + expiry (never store the raw token)
    user.passwordResetToken   = hashedToken;
    user.passwordResetExpires = expires;
    await user.save();

    // Send email — non-fatal: if SMTP is not configured, log a warning
    try {
      await sendPasswordResetEmail(user.email, user.name, rawToken);
    } catch (mailErr) {
      console.error("[forgotPassword] Email send failed:", mailErr.message);
      // Even if email fails, don't reveal that — return the generic message
      // so the response timing doesn't leak whether the account exists.
    }

    return res.json({
      message: "If that email is registered with FinTrack, a reset link has been sent.",
    });
  } catch (err) {
    console.error("forgotPassword error", err);
    return res.status(500).json({ message: "Failed to process password reset request." });
  }
};

// ── RESET PASSWORD ─────────────────────────────────────────────────────────
// POST /auth/reset-password  { token, password }
// Validates the raw token against the stored hash, checks expiry,
// hashes and saves the new password, then invalidates the token.
export const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || typeof token !== "string" || !token.trim()) {
      return res.status(400).json({ message: "Reset token is required." });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters." });
    }

    // Hash the incoming plain-text token to compare against the stored hash
    const hashed = crypto.createHash("sha256").update(token.trim()).digest("hex");

    const user = await User.findOne({
      passwordResetToken:   hashed,
      passwordResetExpires: { $gt: new Date() }, // not yet expired
    });

    if (!user) {
      return res.status(400).json({
        message: "This password-reset link is invalid or has expired. Please request a new one.",
      });
    }

    // Hash and save the new password
    user.passwordHash         = await bcrypt.hash(password, 10);
    // Invalidate the token immediately (single-use)
    user.passwordResetToken   = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    return res.json({ message: "Password reset successful. You can now log in with your new password." });
  } catch (err) {
    console.error("resetPassword error", err);
    return res.status(500).json({ message: "Failed to reset password." });
  }
};
