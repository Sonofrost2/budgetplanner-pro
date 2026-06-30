import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initSentry, Sentry } from "./lib/sentry";

initSentry();

createRoot(document.getElementById("root")!).render(
  <Sentry.ErrorBoundary fallback={<div style={{ padding: 24, fontFamily: "system-ui" }}>Une erreur inattendue est survenue. L'équipe a été notifiée.</div>}>
    <App />
  </Sentry.ErrorBoundary>
);
