import React from "react";
import { resetLocalData, safeGet } from "@/lib/safeStorage";

interface State { hasError: boolean; error?: Error }

const isChunkLoadError = (err: unknown): boolean => {
  const e = err as any;
  if (!e) return false;
  if (e?.name === "ChunkLoadError") return true;
  const msg = String(e?.message ?? e ?? "");
  return (
    msg.includes("Failed to fetch dynamically imported module") ||
    msg.includes("Importing a module script failed") ||
    msg.includes("Failed to load module script") ||
    msg.includes("error loading dynamically imported module")
  );
};

const RELOAD_KEY = "bp_chunk_reload_at";

/**
 * On chunk-load errors, force ONE reload to pick up the latest assets.
 * Guarded by a timestamp so we never loop.
 */
const tryChunkReloadOnce = (): boolean => {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || "0");
    if (Date.now() - last < 15_000) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
    window.location.reload();
    return true;
  } catch {
    return false;
  }
};

const dict = {
  fr: {
    title: "Une erreur inattendue est survenue",
    body: "L'application n'a pas pu se charger correctement. Vous pouvez recharger la page ou réinitialiser vos données locales si le problème persiste.",
    reload: "Recharger l'application",
    reset: "Réinitialiser les données locales et recharger",
    resetting: "Nettoyage en cours…",
  },
  en: {
    title: "An unexpected error occurred",
    body: "The app failed to load correctly. You can reload the page or reset your local data if the issue persists.",
    reload: "Reload the app",
    reset: "Reset local data and reload",
    resetting: "Cleaning up…",
  },
};

const pickLocale = (): "fr" | "en" => {
  const raw = safeGet("budgetplan-locale");
  return raw === "en" ? "en" : "fr";
};

export class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State & { resetting: boolean }
> {
  state: State & { resetting: boolean } = { hasError: false, resetting: false };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    if (isChunkLoadError(error)) {
      tryChunkReloadOnce();
    }
    // Log for observability; Sentry (if initialized) auto-hooks via global error handler.
    console.error("[RootErrorBoundary]", error);
  }

  private handleReload = () => {
    try {
      sessionStorage.removeItem(RELOAD_KEY);
    } catch { /* noop */ }
    window.location.reload();
  };

  private handleReset = async () => {
    this.setState({ resetting: true });
    await resetLocalData();
    window.location.replace("/");
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    const t = dict[pickLocale()];
    return (
      <div
        role="alert"
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          background: "#0b1220",
          color: "#e5e7eb",
        }}
      >
        <div style={{ maxWidth: 480, width: "100%", textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
          <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>
            {t.title}
          </h1>
          <p style={{ color: "#9ca3af", marginBottom: 24, lineHeight: 1.5 }}>
            {t.body}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button
              onClick={this.handleReload}
              disabled={this.state.resetting}
              style={{
                background: "linear-gradient(135deg,#3b82f6,#6366f1)",
                color: "white",
                border: 0,
                padding: "12px 18px",
                borderRadius: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {t.reload}
            </button>
            <button
              onClick={this.handleReset}
              disabled={this.state.resetting}
              style={{
                background: "transparent",
                color: "#e5e7eb",
                border: "1px solid #374151",
                padding: "12px 18px",
                borderRadius: 12,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              {this.state.resetting ? t.resetting : t.reset}
            </button>
          </div>
        </div>
      </div>
    );
  }
}
