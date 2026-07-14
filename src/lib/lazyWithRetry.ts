import { lazy, type ComponentType, type LazyExoticComponent } from "react";

const LAZY_RELOAD_PREFIX = "lazy-retry";

const isDynamicImportFetchError = (error: unknown) => {
  const err = error as any;
  if (err?.name === "ChunkLoadError") return true;
  const message = error instanceof Error ? error.message : String(error);
  return [
    "Failed to fetch dynamically imported module",
    "Importing a module script failed",
    "Failed to load module script",
    "error loading dynamically imported module",
  ].some((fragment) => message.includes(fragment));
};

export const lazyWithRetry = <T extends ComponentType<any>>(
  importer: () => Promise<{ default: T }>,
  key: string,
): LazyExoticComponent<T> =>
  lazy(async () => {
    try {
      const module = await importer();

      if (typeof window !== "undefined") {
        sessionStorage.removeItem(`${LAZY_RELOAD_PREFIX}:${key}`);
      }

      return module;
    } catch (error) {
      if (typeof window !== "undefined" && isDynamicImportFetchError(error)) {
        const retryKey = `${LAZY_RELOAD_PREFIX}:${key}`;
        const alreadyRetried = sessionStorage.getItem(retryKey) === "1";

        if (!alreadyRetried) {
          sessionStorage.setItem(retryKey, "1");
          window.location.reload();
          return new Promise<never>(() => {
            // Intentionally unresolved while the page reloads.
          });
        }
      }

      throw error;
    }
  });