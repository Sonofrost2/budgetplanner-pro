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

  const handleUpdate = async () => {
    setInstalling(true);
    await purgeAppCaches();
    try {
      await updateServiceWorker(true);
    } catch { /* ignore */ }
    // Fallback: si le SW ne recharge pas la page en 3s, on force le reload.
    setTimeout(() => {
      try {
        localStorage.removeItem(DISMISS_KEY);
        window.location.reload();
      } catch { /* ignore */ }
    }, 3000);
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
