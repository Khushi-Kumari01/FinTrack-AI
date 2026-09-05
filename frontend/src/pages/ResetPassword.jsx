import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client";

const ResetPassword = () => {
  const [searchParams]          = useSearchParams();
  const token                   = searchParams.get("token") || "";
  const navigate                = useNavigate();

  const [password, setPassword]   = useState("");
  const [confirm,  setConfirm]    = useState("");
  const [showPwd,  setShowPwd]    = useState(false);
  const [loading,  setLoading]    = useState(false);
  const [error,    setError]      = useState("");
  const [success,  setSuccess]    = useState(false);

  // Guard: if no token in URL, show an error immediately
  if (!token) {
    return (
      <div className="auth-root">
        <div className="auth-glow" />
        <div className="auth-card single">
          <div className="auth-form">
            <h2 className="auth-form-title">Invalid Link</h2>
            <div className="auth-error">
              This password-reset link is missing or invalid.
              Please request a new one.
            </div>
            <p className="auth-terms" style={{ marginTop: 20 }}>
              <Link to="/forgot-password" className="link-primary">
                Request a new reset link
              </Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!password || password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post("/auth/reset-password", { token, password });
      setSuccess(true);
      // Redirect to login after a short pause so the user can read the success message
      setTimeout(() => navigate("/login", { replace: true }), 3000);
    } catch (err) {
      const msg = err?.response?.data?.message;
      setError(msg || "Failed to reset password. The link may have expired.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-root">
      <div className="auth-glow" />

      <div className="auth-card single">
        <form className="auth-form" onSubmit={handleSubmit}>
          <h2 className="auth-form-title">Reset Password</h2>
          <p className="auth-form-subtitle">Enter your new password below.</p>

          {success && (
            <div className="auth-success">
              Password reset successfully! Redirecting to login…
            </div>
          )}

          {error && (
            <div className="auth-error">{error}</div>
          )}

          {!success && (
            <>
              <label className="auth-label">New Password</label>
              {/* auth-input-wrapper gives identical focus border as Login page */}
              <div className="auth-input-wrapper">
                <input
                  className="auth-input"
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  className="auth-input-addon"
                  onClick={() => setShowPwd((s) => !s)}
                >
                  {showPwd ? "Hide" : "Show"}
                </button>
              </div>

              <label className="auth-label" style={{ marginTop: "0.75rem" }}>
                Confirm New Password
              </label>
              <div className="auth-input-wrapper">
                <input
                  className="auth-input"
                  type={showPwd ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Repeat password"
                  required
                  disabled={loading}
                />
              </div>

              <button
                className="auth-submit"
                type="submit"
                disabled={loading}
              >
                {loading ? "Resetting…" : "Reset Password"}
              </button>
            </>
          )}

          <p className="auth-terms">
            <Link to="/login" className="link-muted">Back to login</Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
