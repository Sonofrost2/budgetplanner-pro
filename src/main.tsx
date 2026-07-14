import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initSentry } from "./lib/sentry";
import { RootErrorBoundary } from "./components/RootErrorBoundary";
import { runSchemaMigration } from "./lib/safeStorage";

// Purge incompatible local state from previous schema versions before any provider boots.
runSchemaMigration();
initSentry();

// A11y: mark Lucide/decorative SVGs inside interactive elements as aria-hidden.
// Icons inside <button>/<a> are visual only — the accessible name comes from
// aria-label or child text. Scoped to interactive elements so charts (Recharts,
// standalone <svg>) are not affected.
if (typeof window !== "undefined" && typeof document !== "undefined") {
  const markDecorative = (root: ParentNode) => {
    const nodes = root.querySelectorAll<SVGElement>(
      'button svg:not([aria-hidden]):not([aria-label]):not([role="img"][aria-labelledby]), a svg:not([aria-hidden]):not([aria-label]):not([role="img"][aria-labelledby]), [role="button"] svg:not([aria-hidden]):not([aria-label]), [role="tab"] svg:not([aria-hidden]):not([aria-label]), [role="menuitem"] svg:not([aria-hidden]):not([aria-label])'
    );
    nodes.forEach((n) => {
      n.setAttribute('aria-hidden', 'true');
      n.setAttribute('focusable', 'false');
    });
  };
  const start = () => {
    markDecorative(document.body);
    const obs = new MutationObserver((muts) => {
      for (const m of muts) {
        m.addedNodes.forEach((n) => {
          if (n.nodeType === 1) markDecorative(n as Element);
        });
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
}

// Global handler: catch chunk-load errors that escape React's tree (e.g. inside async event handlers).
if (typeof window !== "undefined") {
  const isChunk = (msg: string) =>
    msg.includes("Failed to fetch dynamically imported module") ||
    msg.includes("Importing a module script failed") ||
    msg.includes("Failed to load module script") ||
    msg.includes("ChunkLoadError");

  const RELOAD_KEY = "bp_chunk_reload_at";
  const reloadOnce = () => {
    try {
      const last = Number(sessionStorage.getItem(RELOAD_KEY) || "0");
      if (Date.now() - last < 15_000) return;
      sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
      window.location.reload();
    } catch { /* noop */ }
  };

  window.addEventListener("error", (e) => {
    if (isChunk(String(e?.message ?? ""))) reloadOnce();
  });
  window.addEventListener("unhandledrejection", (e) => {
    const msg = String((e?.reason as any)?.message ?? e?.reason ?? "");
    if (isChunk(msg)) reloadOnce();
  });
}

createRoot(document.getElementById("root")!).render(
  <RootErrorBoundary>
    <App />
  </RootErrorBoundary>
);
