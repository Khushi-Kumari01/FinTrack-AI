import React, { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";

const ForgotPassword = () => {
  const [email, setEmail]     = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");   // success/generic message
  const [error, setError]     = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setError("Please enter your email address.");
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post("/auth/forgot-password", { email: trimmed });
      setMessage(data.message || "If that email is registered, a reset link has been sent.");
    } catch (err) {
      const msg = err?.response?.data?.message;
      if (msg && err?.response?.status === 400) {
        // Validation error (e.g. invalid email format) — show it directly
        setError(msg);
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-root">
      <div className="auth-glow" />

      <div className="auth-card single">
        <form className="auth-form" onSubmit={handleSubmit}>
          <h2 className="auth-form-title">Forgot Password</h2>
          <p className="auth-form-subtitle">
            Enter your registered email and we'll send you a reset link.
          </p>

          {message && (
            <div className="auth-success">{message}</div>
          )}

          {error && (
            <div className="auth-error">{error}</div>
          )}

          <label className="auth-label">Email</label>
          {/* Wrap in auth-input-wrapper so focus styling matches the Password
              input on the Login page exactly (same border/glow on focus). */}
          <div className="auth-input-wrapper">
            <input
              className="auth-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              disabled={loading || !!message}
            />
          </div>

          <button
            className="auth-submit"
            type="submit"
            disabled={loading || !!message}
          >
            {loading ? "Sending…" : "Send Reset Link"}
          </button>

          <p className="auth-terms">
            <Link to="/login" className="link-muted">Back to login</Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default ForgotPassword;
