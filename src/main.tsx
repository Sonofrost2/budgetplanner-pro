import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initSentry } from "./lib/sentry";
import { RootErrorBoundary } from "./components/RootErrorBoundary";
import { runSchemaMigration } from "./lib/safeStorage";

// Purge incompatible local state from previous schema versions before any provider boots.
runSchemaMigration();
initSentry();

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
