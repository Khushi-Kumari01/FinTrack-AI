import React, { useState, useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { api } from "../api/client";

const LoginPage = () => {
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);

  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState("");

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setNeedsVerification(false);
    setResendMessage("");
    setLoading(true);

    // AuthContext.login() returns { ok, message } — it never throws.
    // We MUST check result.ok before navigating.
    const result = await login(form.email, form.password);
    setLoading(false);

    if (result.ok) {
      // Navigation happens AFTER login() resolves, which means persistAuth()
      // has already run and token is in state.  The ProtectedRoute will now pass.
      navigate("/dashboard", { replace: true });
    } else {
      // Check if the server indicated email verification is required
      if (result.emailVerificationRequired) {
        setNeedsVerification(true);
      }
      setError(result.message || "Login failed. Please try again.");
    }
  };

  const handleResendVerification = async () => {
    setResendLoading(true);
    setResendMessage("");
    try {
      await api.post("/auth/resend-verification", { email: form.email });
      setResendMessage("Verification email sent — please check your inbox.");
    } catch (err) {
      setResendMessage(
        err?.response?.data?.message || "Failed to resend. Please try again."
      );
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="auth-root">
      <div className="auth-glow" />

      <div className="auth-card">
        <div className="auth-left">
          <div className="logo-row">
            <div className="logo-circle">₹</div>
            <div>
              <div className="logo-title">FinTrack AI</div>
              <div className="logo-sub">Smart Personal Finance</div>
            </div>
          </div>

          <h1 className="auth-heading">Welcome back 👋</h1>
          <p className="auth-subheading">
            Login to manage expenses, view insights &amp; get AI guidance.
          </p>
        </div>

        <div className="auth-right">
          <form className="auth-form" onSubmit={handleSubmit}>
            <h2 className="auth-form-title">Login</h2>

            <p className="auth-form-subtitle">
              Don't have an account?{" "}
              <Link to="/register" className="link-primary">Sign Up</Link>
            </p>

            {/* Error message */}
            {error && (
              <div className="auth-error">
                {error}
              </div>
            )}

            {/* Email verification prompt */}
            {needsVerification && (
              <div style={{
                marginBottom: 12,
                padding: "10px 14px",
                borderRadius: 8,
                background: "rgba(251,191,36,0.1)",
                border: "1px solid rgba(251,191,36,0.4)",
                fontSize: 13,
              }}>
                <p style={{ margin: "0 0 8px 0", color: "#fbbf24" }}>
                  Please verify your email address before signing in.
                </p>
                {resendMessage ? (
                  <p style={{ margin: 0, color: "#4ade80", fontSize: 12 }}>{resendMessage}</p>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendVerification}
                    disabled={resendLoading || !form.email}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#38bdf8",
                      cursor: resendLoading ? "not-allowed" : "pointer",
                      padding: 0,
                      fontSize: 13,
                      textDecoration: "underline",
                    }}
                  >
                    {resendLoading ? "Sending…" : "Resend verification email"}
                  </button>
                )}
              </div>
            )}

            <label className="auth-label">Email</label>
            {/* Wrap in auth-input-wrapper so focus border/glow matches
                the Password input exactly (same CSS selector applies). */}
            <div className="auth-input-wrapper">
              <input
                className="auth-input"
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                required
              />
            </div>

            <label className="auth-label">Password</label>
            <div className="auth-input-wrapper">
              <input
                className="auth-input"
                type={showPassword ? "text" : "password"}
                name="password"
                value={form.password}
                onChange={handleChange}
                required
              />
              <button
                type="button"
                className="auth-input-addon"
                onClick={() => setShowPassword((s) => !s)}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>

            <div className="auth-row-between">
              <Link to="/forgot-password" className="link-muted">
                Forgot password?
              </Link>
            </div>

            <button className="auth-submit" type="submit" disabled={loading}>
              {loading ? "Logging in…" : "Continue"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
