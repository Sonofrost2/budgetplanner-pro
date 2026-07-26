import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
// @ts-ignore -- virtual module provided by vite-plugin-pwa at build time
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useVersionCheck } from '@/hooks/useVersionCheck';

const UPDATE_CHECK_INTERVAL_MS = 5 * 60_000; // 5 min (was 60s — trop agressif)
const DISMISS_KEY = 'pwa-update-dismissed-at';
const DISMISS_TTL_MS = 24 * 60 * 60_000; // 24h

/**
 * Detect Capacitor native container. Native apps update via @capgo/capacitor-updater
 * (OTA), NOT via the service worker → hide this prompt entirely on native.
 */
const isNativeCapacitor = () => {
  try {
    return !!(window as any)?.Capacitor?.isNativePlatform?.();
  } catch {
    return false;
  }
};

export const PWAUpdatePrompt = () => {
  const [installing, setInstalling] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [versionMismatch, setVersionMismatch] = useState(false);
  const native = typeof window !== 'undefined' && isNativeCapacitor();

  // Fallback update signal — fires when /version.json differs from the
  // build we're running, even if the service-worker update flow misses it.
  useVersionCheck();

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl: string, registration: ServiceWorkerRegistration | undefined) {
      if (!registration) return;
      // Poll for a new SW every 5 min so users see updates without a full reload.
      setInterval(() => {
        registration.update().catch(() => {});
      }, UPDATE_CHECK_INTERVAL_MS);
    },
  });

  // Listen for the version-check fallback signal.
  useEffect(() => {
    const onUpdate = () => setVersionMismatch(true);
    window.addEventListener('app:update-available', onUpdate as EventListener);
    return () => window.removeEventListener('app:update-available', onUpdate as EventListener);
  }, []);

  // Clean the cache-busting marker left by a forced update reload.
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has('_v')) {
        url.searchParams.delete('_v');
        window.history.replaceState({}, '', url.pathname + url.search + url.hash);
      }
    } catch { /* ignore */ }
  }, []);

  const updateAvailable = needRefresh || versionMismatch;

  // Re-check dismiss state whenever a new update signal arrives.
  useEffect(() => {
    if (!updateAvailable) { setDismissed(false); return; }
    try {
      const raw = localStorage.getItem(DISMISS_KEY);
      if (raw) {
        const ts = Number(raw);
        if (Number.isFinite(ts) && Date.now() - ts < DISMISS_TTL_MS) {
          setDismissed(true);
        }
      }
    } catch { /* ignore */ }
  }, [updateAvailable]);

  /**
   * Purge every Cache Storage bucket owned by this origin's app SW before
   * reloading. This is the belt-and-suspenders step that prevents a
   * half-updated state (fresh HTML + stale hashed chunks referenced by an
   * old workbox precache manifest). We intentionally skip caches that don't
   * belong to this app (e.g. Firebase Messaging, OneSignal) by matching
   * the workbox cacheId prefix `bp-`.
   */
  const purgeAppCaches = async () => {
    if (typeof caches === 'undefined') return;
    try {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((n) => n.startsWith('bp-') || n.startsWith('workbox-') || n === 'html-navigations')
          .map((n) => caches.delete(n)),
      );
    } catch { /* ignore */ }
  };

  /**
   * Hard reload that cannot be served from any cache layer:
   * unregister every SW of this origin, drop the caches, then navigate to a
   * cache-busted URL (a plain `location.reload()` can still be answered by a
   * controlling service worker or by bfcache).
   */
  const hardReload = async () => {
    try { localStorage.removeItem(DISMISS_KEY); } catch { /* ignore */ }
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister().catch(() => false)));
      }
    } catch { /* ignore */ }
    await purgeAppCaches();
    const url = new URL(window.location.href);
    url.searchParams.set('_v', String(Date.now()));
    window.location.replace(url.toString());
  };

  const handleUpdate = async () => {
    setInstalling(true);
    await purgeAppCaches();
    let reloaded = false;
    try {
      // Only meaningful when a waiting SW exists (needRefresh).
      if (needRefresh) {
        await updateServiceWorker(true);
        reloaded = true;
      }
    } catch { /* ignore */ }
    // If the SW path did nothing (version.json mismatch without waiting SW)
    // or did not reload within 2.5s, force a fully uncached reload.
    window.setTimeout(() => { hardReload(); }, reloaded ? 2500 : 0);
  };

  const handleDismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* ignore */ }
    setDismissed(true);
    setNeedRefresh(false);
    setVersionMismatch(false);
  };

  // Never show in Capacitor native (OTA path handles updates).
  if (native) return null;

  const visible = updateAvailable && !dismissed;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] glass-strong rounded-2xl border border-primary/20 shadow-lg px-4 py-3 flex items-center gap-2 max-w-[calc(100vw-2rem)]"
          role="status"
          aria-live="polite"
        >
          {installing ? (
            <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
          ) : (
            <RefreshCw className="w-4 h-4 text-primary shrink-0" />
          )}
          <span className="text-sm font-medium truncate">
            {installing ? 'Installation…' : 'Nouvelle version disponible'}
          </span>
          <Button
            size="sm"
            className="rounded-xl text-primary-foreground shrink-0"
            style={{ background: 'var(--gradient-primary)' }}
            onClick={handleUpdate}
            disabled={installing}
          >
            {installing ? '…' : 'Mettre à jour'}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 rounded-xl shrink-0"
            onClick={handleDismiss}
            disabled={installing}
            aria-label="Ignorer pour 24 heures"
            title="Ignorer pour 24 heures"
          >
            <X className="w-4 h-4" />
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
