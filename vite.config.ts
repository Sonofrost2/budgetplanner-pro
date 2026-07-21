import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import { compression } from "vite-plugin-compression2";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";
import fs from "node:fs";

// Unique build identifier — regenerated on each build. Used as the SW cacheId
// and written to dist/version.json so the client can detect a new deploy even
// when the service worker fails to notify.
const BUILD_ID = `${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * Emits `dist/version.json` at build end. The client polls this file
 * (with cache-busting) to detect deployments and prompt for reload — this
 * is the safety net when the service-worker update path misses an update.
 */
const versionJsonPlugin = () => ({
  name: "emit-version-json",
  apply: "build" as const,
  closeBundle() {
    try {
      const out = path.resolve(__dirname, "dist/version.json");
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(
        out,
        JSON.stringify({ version: BUILD_ID, builtAt: new Date().toISOString() }, null, 2),
      );
    } catch (err) {
      console.warn("[versionJsonPlugin] failed to emit version.json", err);
    }
  },
});

export default defineConfig(({ mode }) => ({
  define: {
    __APP_BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
          charts: ['recharts'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-popover', '@radix-ui/react-select', '@radix-ui/react-tabs'],
        },
      },
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    // Bundles src/lib/mcp/index.ts (and its tools) into
    // supabase/functions/mcp/index.ts on every build so external AI clients
    // (ChatGPT, Claude, Cursor…) can call Budget Planner Pro over MCP.
    mcpPlugin(),
    versionJsonPlugin(),
    // Precompress assets at build time so hosting can serve .br / .gz sidecars
    // when its origin does not compress large JS bundles (Supabase chunk was
    // shipping uncompressed at ~193 KB). Only files > 1 KB are worth it.
    compression({
      algorithms: ["brotliCompress"],
      exclude: [/\.(br)$/, /\.(gz)$/],
      threshold: 1024,
    }),
    compression({
      algorithms: ["gzip"],
      exclude: [/\.(br)$/, /\.(gz)$/],
      threshold: 1024,
    }),
    VitePWA({
      registerType: "prompt",
      // useRegisterSW (React hook) is the single registrar — disable auto-injection.
      injectRegister: null,
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        // Do NOT auto-skipWaiting / clientsClaim: the user must confirm the
        // update via PWAUpdatePrompt. Auto-activation mid-session mixes an
        // old HTML shell with new chunks and causes regressions.
        clientsClaim: false,
        skipWaiting: false,
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/~oauth/],
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        importScripts: ["/sw-push.js"],
        // Cache-busting: unique per-build so every deploy invalidates old caches.
        cacheId: `bp-${BUILD_ID}`,
        runtimeCaching: [
          {
            // HTML navigations: network-first so users always get fresh index.html post-deploy.
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: {
              cacheName: "html-navigations",
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 32, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
        ],
      },
      manifest: false,
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
