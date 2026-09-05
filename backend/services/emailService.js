/**
 * emailService.js — Configurable transactional email sender.
 *
 * Requires these environment variables when EMAIL_VERIFICATION_ENABLED=true:
 *   SMTP_HOST      e.g. smtp.gmail.com
 *   SMTP_PORT      e.g. 587
 *   SMTP_USER      sender email address
 *   SMTP_PASS      app password / SMTP password
 *   SMTP_FROM      "FinTrack AI <noreply@yourdomain.com>"  (optional, defaults to SMTP_USER)
 *   APP_URL        e.g. http://localhost:5173  (for building verification links)
 *
 * When EMAIL_VERIFICATION_ENABLED is absent or "false" (the default for localhost),
 * all email-send calls are no-ops and verification is skipped at registration time.
 */

import nodemailer from "nodemailer";
import { logger } from "../utils/logger.js";

const ENABLED = process.env.EMAIL_VERIFICATION_ENABLED === "true";

// ── Transporter ────────────────────────────────────────────────────────────
let transporter = null;

if (ENABLED) {
  transporter = nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465, // true for 465, false for others
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

// ── Verify SMTP connection on startup (non-fatal) ──────────────────────────
if (ENABLED && transporter) {
  transporter.verify().then(() => {
    logger.info("📧 SMTP connection verified — email sending is active.");
  }).catch((err) => {
    logger.warn(`📧 SMTP connection failed: ${err.message}. Emails will not be sent.`);
  });
} else if (!ENABLED) {
  logger.info("📧 Email verification disabled (EMAIL_VERIFICATION_ENABLED != 'true'). All accounts auto-verified.");
}

// ── Send verification email ────────────────────────────────────────────────
/**
 * @param {string} toEmail  - Recipient email
 * @param {string} name     - Recipient name
 * @param {string} rawToken - Plain-text verification token (NOT the hashed version)
 */
export async function sendVerificationEmail(toEmail, name, rawToken) {
  if (!ENABLED || !transporter) {
    logger.debug(`[emailService] Verification email skipped (disabled) for ${toEmail}`);
    return;
  }

  const appUrl = (process.env.APP_URL || "http://localhost:5173").replace(/\/$/, "");
  const link   = `${appUrl}/verify-email?token=${rawToken}`;
  const from   = process.env.SMTP_FROM || process.env.SMTP_USER;

  await transporter.sendMail({
    from,
    to: toEmail,
    subject: "Verify your FinTrack AI account",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0f172a;color:#f1f5f9;border-radius:12px">
        <h1 style="color:#00d084;margin-bottom:8px">FinTrack AI</h1>
        <p>Hi ${name},</p>
        <p>Thanks for signing up! Please verify your email address by clicking the button below.</p>
        <a href="${link}"
           style="display:inline-block;margin:20px 0;padding:12px 28px;background:#00d084;color:#000;border-radius:8px;text-decoration:none;font-weight:700">
          Verify Email
        </a>
        <p style="font-size:12px;color:#94a3b8">
          This link expires in 24 hours.<br/>
          If you did not register for FinTrack AI, you can safely ignore this email.
        </p>
        <p style="font-size:11px;color:#64748b">
          Or copy this URL: <a href="${link}" style="color:#38bdf8">${link}</a>
        </p>
      </div>`,
    text: `Hi ${name},\n\nPlease verify your FinTrack AI account:\n${link}\n\nThis link expires in 24 hours.`,
  });

  logger.info(`[emailService] Verification email sent to ${toEmail}`);
}

// ── Send password-reset email ──────────────────────────────────────────────
export async function sendPasswordResetEmail(toEmail, name, rawToken) {
  if (!ENABLED || !transporter) {
    // SMTP not configured — log the link so developers can test locally
    const devLink = `${(process.env.APP_URL || "http://localhost:5173").replace(/\/$/, "")}/reset-password?token=${rawToken}`;
    logger.info(`[emailService] Password reset email skipped (SMTP disabled). DEV LINK: ${devLink}`);
    return;
  }

  const appUrl = (process.env.APP_URL || "http://localhost:5173").replace(/\/$/, "");
  const link   = `${appUrl}/reset-password?token=${rawToken}`;
  const from   = process.env.SMTP_FROM || process.env.SMTP_USER;

  await transporter.sendMail({
    from,
    to: toEmail,
    subject: "Reset your FinTrack AI password",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0f172a;color:#f1f5f9;border-radius:12px">
        <h1 style="color:#00d084;margin-bottom:8px">FinTrack AI</h1>
        <p>Hi ${name},</p>
        <p>We received a request to reset the password for your FinTrack account.</p>
        <p>Click the button below to choose a new password. This link is valid for <strong>1 hour</strong>.</p>
        <a href="${link}"
           style="display:inline-block;margin:20px 0;padding:12px 28px;background:#0ea5e9;color:#fff;border-radius:8px;text-decoration:none;font-weight:700">
          Reset Password
        </a>
        <p style="font-size:12px;color:#94a3b8">
          If you did not request a password reset, you can safely ignore this email.<br/>
          Your password will remain unchanged.
        </p>
        <p style="font-size:11px;color:#64748b">
          Or copy this URL into your browser:<br/>
          <a href="${link}" style="color:#38bdf8">${link}</a>
        </p>
      </div>`,
    text: `Hi ${name},\n\nReset your FinTrack AI password:\n${link}\n\nThis link expires in 1 hour.\n\nIf you did not request this, please ignore this email.`,
  });

  logger.info(`[emailService] Password reset email sent to ${toEmail}`);
}

export const emailVerificationEnabled = ENABLED;
