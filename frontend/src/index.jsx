// src/index.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/globals.css";

// ── PWA install prompt ─────────────────────────────────────────────────────
// Capture the browser's beforeinstallprompt event so PWAInstallCard can call
// prompt() when the user clicks "Install FinTrack". Without this listener the
// event fires and is lost before the component ever mounts.
window.__INSTALL_PROMPT__ = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();            // stop the browser from auto-showing the banner
  window.__INSTALL_PROMPT__ = e; // stash for later use by PWAInstallCard
});
window.addEventListener("appinstalled", () => {
  window.__INSTALL_PROMPT__ = null; // clean up after installation
});

// ── Service worker registration ────────────────────────────────────────────
// Only register in production builds. In development (Vite dev server),
// the service worker must NOT intercept HMR module requests — doing so
// causes stale cached JS bundles to be served after source changes,
// producing a blank dashboard page.
if ("serviceWorker" in navigator) {
  if (import.meta.env.PROD) {
    // Production: register SW for offline resilience
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => console.info("[SW] Registered:", reg.scope))
        .catch((err) => console.warn("[SW] Registration failed:", err));
    });
  } else {
    // Development: unregister any previously installed SW so it cannot
    // intercept Vite's HMR module requests with stale cached responses.
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const reg of registrations) {
        reg.unregister();
        console.info("[SW] Unregistered SW in dev mode:", reg.scope);
      }
    });
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
