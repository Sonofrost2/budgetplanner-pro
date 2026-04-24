import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// ─────────────────────────────────────────────────────────────────────────────
// Preview freshness strategy
//
// The Lovable editor preview runs inside an iframe on a *.lovableproject.com
// host. Service Workers + HTTP caches there were pinning old bundles, so
// notification / alert code paths kept executing stale logic until the user
// hit "hard reload". In production (published .lovable.app or custom domain)
// we leave the SW untouched so PWA features keep working.
//
// In preview we now:
//   1. Unregister any existing SW and purge caches on boot.
//   2. Poll index.html every 30s; if its ETag/Last-Modified changes,
//      do a silent location.reload() so the latest bundle is loaded
//      without manual intervention.
//   3. Re-check on tab focus / network reconnect for fast catch-up.
// ─────────────────────────────────────────────────────────────────────────────
const isInIframe = (() => {
  try { return typeof window !== "undefined" && window.self !== window.top; }
  catch { return true; }
})();
const previewHost =
  typeof window !== "undefined" &&
  (window.location.hostname.includes("id-preview--") ||
    window.location.hostname.includes("lovableproject.com") ||
    window.location.hostname.includes("lovable.dev"));
const IS_PREVIEW = isInIframe || previewHost;

if (typeof window !== "undefined" && "serviceWorker" in navigator && IS_PREVIEW) {
  navigator.serviceWorker.getRegistrations()
    .then((regs) => regs.forEach((r) => r.unregister()))
    .catch(() => {});
  if (window.caches) {
    caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => {});
  }
}

if (typeof window !== "undefined" && IS_PREVIEW) {
  let signature: string | null = null;
  let reloading = false;

  const fetchSignature = async (): Promise<string | null> => {
    try {
      const res = await fetch(`/index.html?_=${Date.now()}`, {
        method: "GET",
        cache: "no-store",
        credentials: "omit",
      });
      if (!res.ok) return null;
      const etag = res.headers.get("etag");
      const lastMod = res.headers.get("last-modified");
      if (etag || lastMod) return `${etag ?? ""}|${lastMod ?? ""}`;
      // Fallback: hash the script tag line so bundle hash changes are caught
      const html = await res.text();
      const match = html.match(/src="\/[^"]*main\.tsx[^"]*"/);
      return match ? match[0] : html.length.toString();
    } catch {
      return null;
    }
  };

  const check = async () => {
    if (reloading) return;
    const next = await fetchSignature();
    if (!next) return;
    if (signature === null) { signature = next; return; }
    if (next !== signature) {
      reloading = true;
      // Silent refresh — no prompt, preview should always feel current.
      window.location.reload();
    }
  };

  // Initial baseline + periodic polling
  void check();
  const interval = window.setInterval(check, 30_000);

  // Catch-up on focus / reconnect
  window.addEventListener("focus", check);
  window.addEventListener("online", check);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void check();
  });

  // Cleanup safety net (HMR re-execute)
  window.addEventListener("beforeunload", () => window.clearInterval(interval));
}

createRoot(document.getElementById("root")!).render(<App />);
