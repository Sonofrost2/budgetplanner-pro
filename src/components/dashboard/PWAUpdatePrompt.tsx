import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
// @ts-ignore -- virtual module provided by vite-plugin-pwa at build time
import { useRegisterSW } from 'virtual:pwa-register/react';

const UPDATE_CHECK_INTERVAL_MS = 60_000;

export const PWAUpdatePrompt = () => {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      if (!registration) return;
      // Poll for a new SW every 60s so users see updates without a full reload.
      setInterval(() => {
        registration.update().catch(() => {});
      }, UPDATE_CHECK_INTERVAL_MS);
    },
  });

  return (
    <AnimatePresence>
      {needRefresh && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] glass-strong rounded-2xl border border-primary/20 shadow-lg px-5 py-3 flex items-center gap-3"
        >
          <RefreshCw className="w-4 h-4 text-primary animate-spin" />
          <span className="text-sm font-medium">Nouvelle version disponible</span>
          <Button
            size="sm"
            className="rounded-xl text-primary-foreground"
            style={{ background: 'var(--gradient-primary)' }}
            onClick={() => updateServiceWorker(true)}
          >
            Mettre à jour
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
