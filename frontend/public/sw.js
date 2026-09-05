// sw.js — FinTrack service worker
// CACHE_NAME is patched by the Vite swCacheBuster plugin on every build
// (replaced with "fintrack-v<timestamp>") so stale assets are never served.
// During development (npm run dev) this file is served from /public/sw.js
// as-is — the cache name stays "fintrack-v1" which is fine for dev.
const CACHE_NAME = "fintrack-v1";

// App shell: only cache the bare minimum needed for offline fallback.
// Hashed JS/CSS assets are handled below in the fetch handler.
const APP_SHELL = ["/index.html"];

// ── Install: pre-cache the app shell ─────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {
      // Non-fatal: cache addAll can fail if the shell assets aren't available yet
    })
  );
  self.skipWaiting();
});

// ── Activate: clean up old caches ────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: clear strategy per request type ────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // ① API requests → always network-first, never cache financial data.
  //   Matches both absolute http://localhost:5000/api/... and
  //   relative /api/... paths.
  if (
    url.pathname.startsWith("/api/") ||
    url.href.includes("/api/")
  ) {
    event.respondWith(
      fetch(request).catch((err) => {
        // Network offline — return a JSON error so the frontend can handle it
        return new Response(
          JSON.stringify({ message: "Network unavailable. Please check your connection." }),
          { status: 503, headers: { "Content-Type": "application/json" } }
        );
      })
    );
    return;
  }

  // ② Navigation requests (HTML pages) → network-first so the latest
  //   frontend code is always served; fall back to cache for offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache the fresh response for offline fallback
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match("/index.html"))
    );
    return;
  }

  // ③ Static assets (hashed JS/CSS/images) → cache-first since they are
  //   content-addressed and never change between builds.
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.ok && url.origin === self.location.origin) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
    )
  );
});
