import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "fs";
import path from "path";

// ── Service-worker cache-buster plugin ───────────────────────────────────
// Injects the current build timestamp into sw.js so that every `npm run build`
// produces a different CACHE_NAME.  Without this the installed PWA keeps
// serving a stale cached JS bundle after the frontend is rebuilt, breaking
// login and dashboard navigation.
const swCacheBuster = () => ({
  name: "sw-cache-buster",
  closeBundle() {
    // Only runs during `vite build`, not `vite dev`
    const swSrc  = path.resolve(__dirname, "public", "sw.js");
    const swDest = path.resolve(__dirname, "dist",   "sw.js");
    if (!fs.existsSync(swSrc)) return;

    const src = fs.readFileSync(swSrc, "utf8");
    const ts  = Date.now();
    // Replace the static cache name with a timestamped one so the browser
    // activates the new SW and discards the old cached assets.
    const patched = src.replace(
      /const CACHE_NAME\s*=\s*["']fintrack-v[^"']*["']/,
      `const CACHE_NAME = "fintrack-v${ts}"`
    );
    fs.writeFileSync(swDest, patched, "utf8");
    console.log(`[sw-cache-buster] Patched sw.js with CACHE_NAME fintrack-v${ts}`);
  },
});

const __dirname = new URL(".", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");

export default defineConfig({
  plugins: [react(), swCacheBuster()],
  build: {
    target: "esnext",
  },
  optimizeDeps: {
    esbuildOptions: {
      target: "esnext",
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
    },
  },
});
