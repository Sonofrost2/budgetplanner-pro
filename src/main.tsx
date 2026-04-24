import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Guard: never let a service worker run inside the Lovable editor preview
// (iframe / id-preview / lovableproject host). Stale SW caches were forcing
// the preview to keep loading old bundles, breaking notifications & pushes.
// In production (published .lovable.app or custom domain) the SW is left
// untouched so PWA features keep working.
if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  const isInIframe = (() => {
    try { return window.self !== window.top; } catch { return true; }
  })();
  const host = window.location.hostname;
  const isPreviewHost =
    host.includes("id-preview--") ||
    host.includes("lovableproject.com") ||
    host.includes("lovable.dev");

  if (isInIframe || isPreviewHost) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((r) => r.unregister());
    }).catch(() => {});
    if (window.caches) {
      caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => {});
    }
  }
}

createRoot(document.getElementById("root")!).render(<App />);
