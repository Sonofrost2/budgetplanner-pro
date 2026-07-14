/**
 * Safe wrappers around localStorage / sessionStorage.
 * - Never throw on read/write (Safari private mode, quota, disabled storage, corrupted values).
 * - Schema versioning: bump SCHEMA_VERSION to purge incompatible client-side state on next load.
 */

export const SCHEMA_VERSION = "2026-07-14-1";
const SCHEMA_KEY = "bp_schema_version";

// Keys we NEVER purge on schema migration (auth session, essential prefs).
const PRESERVE_KEYS = [
  /^sb-.*-auth-token$/,          // Supabase session
  /^theme-mode$/,
  /^budgetplan-locale$/,
  /^bp_referral_code$/,
];

const shouldPreserve = (key: string) => PRESERVE_KEYS.some((rx) => rx.test(key));

export const safeGet = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

export const safeSet = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* noop */
  }
};

export const safeRemove = (key: string): void => {
  try {
    localStorage.removeItem(key);
  } catch {
    /* noop */
  }
};

export const safeGetJSON = <T>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    // Corrupted value — evict it.
    safeRemove(key);
    return fallback;
  }
};

export const safeSetJSON = (key: string, value: unknown): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* noop */
  }
};

/**
 * Wipe every client-side persistence surface (localStorage, sessionStorage,
 * IndexedDB, Cache Storage) and unregister service workers. Used by the
 * root ErrorBoundary "reset" button and by schema-version migrations.
 */
export const resetLocalData = async (): Promise<void> => {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k) keys.push(k);
    }
    keys.forEach((k) => {
      if (!shouldPreserve(k)) safeRemove(k);
    });
  } catch { /* noop */ }

  try { sessionStorage.clear(); } catch { /* noop */ }

  try {
    if ("indexedDB" in window && (indexedDB as any).databases) {
      const dbs = await (indexedDB as any).databases();
      await Promise.all(
        (dbs || []).map((db: { name?: string }) =>
          db.name ? new Promise<void>((r) => {
            const req = indexedDB.deleteDatabase(db.name!);
            req.onsuccess = req.onerror = req.onblocked = () => r();
          }) : Promise.resolve()
        )
      );
    }
  } catch { /* noop */ }

  try {
    if ("caches" in window) {
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
    }
  } catch { /* noop */ }

  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
  } catch { /* noop */ }
};

/**
 * Run once at app boot: if the stored schema version differs, purge non-essential
 * local data (keeps auth + language/theme) to avoid crashes on stale shapes.
 */
export const runSchemaMigration = (): void => {
  try {
    const current = safeGet(SCHEMA_KEY);
    if (current === SCHEMA_VERSION) return;
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k) keys.push(k);
    }
    keys.forEach((k) => {
      if (k === SCHEMA_KEY) return;
      if (!shouldPreserve(k)) safeRemove(k);
    });
    try { sessionStorage.clear(); } catch { /* noop */ }
    safeSet(SCHEMA_KEY, SCHEMA_VERSION);
  } catch { /* noop */ }
};
