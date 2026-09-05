// src/components/PWAInstallCard.jsx
import React, { useState, useEffect } from "react";

const StepRow = ({ step, icon, title, detail, last }) => (
  <div
    style={{
      display: "flex",
      alignItems: "flex-start",
      gap: 10,
      padding: "8px 0",
      borderBottom: last ? "none" : "1px solid var(--border-subtle)",
    }}
  >
    <div
      style={{
        width: 24,
        height: 24,
        borderRadius: 999,
        flexShrink: 0,
        background: "rgba(34,197,94,0.12)",
        border: "1px solid rgba(34,197,94,0.3)",
        color: "#4ade80",
        fontSize: 11,
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {step}
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
      <span style={{ fontSize: 15, flexShrink: 0 }}>{icon}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{title}</div>
        <div style={{ fontSize: 11, color: "var(--text-soft)", marginTop: 1 }}>{detail}</div>
      </div>
    </div>
  </div>
);

const PWAInstallCard = () => {
  // Track whether the install prompt is available and whether the app is
  // already installed (running in standalone mode).
  const [promptAvailable, setPromptAvailable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  // Show a non-blocking in-card guide when the prompt is not available.
  const [showManualGuide, setShowManualGuide] = useState(false);

  useEffect(() => {
    // Check if already running as installed PWA.
    const mq = window.matchMedia("(display-mode: standalone)");
    if (mq.matches) {
      setIsInstalled(true);
      return;
    }

    // Check if we captured the prompt before the component mounted.
    if (window.__INSTALL_PROMPT__) {
      setPromptAvailable(true);
    }

    // Also listen for the event arriving after mount (some browsers fire it late).
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      window.__INSTALL_PROMPT__ = e;
      setPromptAvailable(true);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    // If the app gets installed while the card is shown, update state.
    const handleInstalled = () => {
      setIsInstalled(true);
      setPromptAvailable(false);
      window.__INSTALL_PROMPT__ = null;
    };
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isInstalled) return;

    if (window.__INSTALL_PROMPT__) {
      // Browser exposes the install API — show the native prompt.
      window.__INSTALL_PROMPT__.prompt();
      const choice = await window.__INSTALL_PROMPT__.userChoice;
      if (choice.outcome === "accepted") {
        window.__INSTALL_PROMPT__ = null;
        setPromptAvailable(false);
      }
    } else {
      // No prompt available (iOS Safari, Firefox, or already dismissed).
      // Show an in-card guide instead of a disruptive alert.
      setShowManualGuide((s) => !s);
    }
  };

  if (isInstalled) {
    return (
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Install as app</div>
            <div style={{ fontSize: 12, color: "var(--text-soft)" }}>
              Pin FinTrack like a native app
            </div>
          </div>
          <span style={{ fontSize: 18 }}>📲</span>
        </div>
        <div
          style={{
            marginTop: 8,
            padding: "12px 14px",
            borderRadius: 10,
            background: "rgba(34,197,94,0.10)",
            border: "1px solid rgba(34,197,94,0.25)",
            fontSize: 12,
            color: "#4ade80",
            fontWeight: 600,
          }}
        >
          ✅ FinTrack is already installed on this device.
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">Install as app</div>
          <div style={{ fontSize: 12, color: "var(--text-soft)" }}>
            Pin FinTrack like a native app
          </div>
        </div>
        <span style={{ fontSize: 18 }}>📲</span>
      </div>

      <div style={{ marginTop: 4 }}>
        <StepRow
          step={1}
          icon="🌐"
          title="Open in browser"
          detail="Use Chrome, Edge, or Safari on any device"
        />
        <StepRow
          step={2}
          icon="🔗"
          title="Find the install icon"
          detail="Address bar on desktop · Share menu on mobile"
        />
        <StepRow
          step={3}
          icon="🚀"
          title="Launch from home"
          detail="Tap 'Add to Home screen' or 'Install'"
          last
        />
      </div>

      <button
        onClick={handleInstallClick}
        style={{
          width: "100%",
          marginTop: 12,
          padding: "10px 14px",
          borderRadius: 999,
          cursor: "pointer",
          fontSize: 13,
          fontWeight: 700,
          background: promptAvailable
            ? "linear-gradient(135deg,#22c55e,#16a34a)"
            : "linear-gradient(135deg,#334155,#1e293b)",
          color: promptAvailable ? "#ffffff" : "#94a3b8",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          transition: "filter 0.15s ease",
          border: promptAvailable ? "none" : "1px solid rgba(148,163,184,0.2)",
        }}
      >
        <span>⬇️</span>
        {promptAvailable ? "Install FinTrack" : "How to install"}
      </button>

      {/* Non-blocking in-card manual install guide (shown instead of alert) */}
      {showManualGuide && !promptAvailable && (
        <div
          style={{
            marginTop: 10,
            padding: "12px 14px",
            borderRadius: 10,
            background: "rgba(56,189,248,0.08)",
            border: "1px solid rgba(56,189,248,0.2)",
            fontSize: 12,
            color: "var(--text-soft)",
            lineHeight: 1.6,
          }}
        >
          <div style={{ fontWeight: 700, color: "#7dd3fc", marginBottom: 6 }}>
            📱 Install manually:
          </div>
          <div><strong>Chrome / Edge desktop:</strong> click the ⊕ or install icon in the address bar.</div>
          <div style={{ marginTop: 4 }}><strong>Chrome Android:</strong> tap ⋮ menu → "Add to Home screen".</div>
          <div style={{ marginTop: 4 }}><strong>Safari iOS:</strong> tap the Share icon → "Add to Home Screen".</div>
          <div style={{ marginTop: 6, fontSize: 11, color: "var(--text-subtle)" }}>
            Note: The one-click install button only appears after the browser decides the app meets PWA criteria (served over HTTPS with icons).
          </div>
        </div>
      )}
    </div>
  );
};

export default PWAInstallCard;
