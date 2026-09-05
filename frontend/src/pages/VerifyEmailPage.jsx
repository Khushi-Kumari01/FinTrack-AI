import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";

const VerifyEmailPage = () => {
  const [searchParams]  = useSearchParams();
  const navigate        = useNavigate();
  const { persistAuth } = useContext(AuthContext);

  const [status, setStatus] = useState("verifying"); // verifying | success | error
  const [message, setMessage] = useState("");

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setStatus("error");
      setMessage("No verification token found in the link.");
      return;
    }

    api.get(`/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then((res) => {
        // Log the user in automatically after successful verification
        if (res.data?.token && res.data?.user) {
          localStorage.setItem("token", res.data.token);
          localStorage.setItem("user", JSON.stringify(res.data.user));
        }
        setStatus("success");
        setMessage("Email verified successfully! Redirecting to your dashboard…");
        setTimeout(() => navigate("/dashboard", { replace: true }), 2000);
      })
      .catch((err) => {
        setStatus("error");
        setMessage(
          err?.response?.data?.message ||
          "Verification failed. The link may have expired."
        );
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
        </div>
        <div className="auth-right">
          <div className="auth-form">
            {status === "verifying" && (
              <>
                <h2 className="auth-form-title">Verifying your email…</h2>
                <p style={{ color: "var(--text-soft)" }}>Please wait.</p>
              </>
            )}
            {status === "success" && (
              <>
                <h2 className="auth-form-title">✅ Email Verified</h2>
                <p style={{ color: "#4ade80" }}>{message}</p>
              </>
            )}
            {status === "error" && (
              <>
                <h2 className="auth-form-title">Verification Failed</h2>
                <div className="auth-error">{message}</div>
                <p style={{ marginTop: 16 }}>
                  <a href="/login" className="link-primary">Back to Login</a>
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmailPage;
