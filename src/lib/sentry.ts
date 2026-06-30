import * as Sentry from "@sentry/react";

const DSN = "https://b622deef6ab7f159db3a898f2ed97c7a@o4511656829124608.ingest.de.sentry.io/4511656851669072";

export function initSentry() {
  if (import.meta.env.DEV) return;
  if (typeof window === "undefined") return;

  Sentry.init({
    dsn: DSN,
    environment: import.meta.env.MODE,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    ignoreErrors: [
      "NetworkError",
      "AbortError",
      "Failed to fetch",
      "Load failed",
      "ResizeObserver loop limit exceeded",
      "ResizeObserver loop completed with undelivered notifications",
    ],
    beforeSend(event) {
      // Strip potential secrets from URLs / extra
      if (event.request?.url) {
        event.request.url = event.request.url.replace(/(access_token|token|key)=[^&]+/gi, "$1=[Filtered]");
      }
      return event;
    },
  });
}

export { Sentry };