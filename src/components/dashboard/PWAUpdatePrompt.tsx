import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
// @ts-ignore -- virtual module provided by vite-plugin-pwa at build time
import { useRegisterSW } from 'virtual:pwa-register/react';

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
  const native = typeof window !== 'undefined' && isNativeCapacitor();

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

  // Re-check dismiss state whenever a new update signal arrives.
  useEffect(() => {
    if (!needRefresh) { setDismissed(false); return; }
    try {
      const raw = localStorage.getItem(DISMISS_KEY);
      if (raw) {
        const ts = Number(raw);
        if (Number.isFinite(ts) && Date.now() - ts < DISMISS_TTL_MS) {
          setDismissed(true);
        }
      }
    } catch { /* ignore */ }
  }, [needRefresh]);

  const handleUpdate = async () => {
    setInstalling(true);
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
  };

  // Never show in Capacitor native (OTA path handles updates).
  if (native) return null;

  const visible = needRefresh && !dismissed;

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
