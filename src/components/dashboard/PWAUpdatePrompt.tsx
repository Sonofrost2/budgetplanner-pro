import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const PWAUpdatePrompt = () => {
  const [showUpdate, setShowUpdate] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const handleControllerChange = () => {
      window.location.reload();
    };

    // Check for waiting SW on load
    navigator.serviceWorker.ready.then(reg => {
      if (reg.waiting) {
        setWaitingWorker(reg.waiting);
        setShowUpdate(true);
      }

      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            setWaitingWorker(newWorker);
            setShowUpdate(true);
          }
        });
      });
    });

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, []);

  const handleUpdate = () => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    }
  };

  return (
    <AnimatePresence>
      {showUpdate && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] glass-strong rounded-2xl border border-primary/20 shadow-lg px-5 py-3 flex items-center gap-3"
        >
          <RefreshCw className="w-4 h-4 text-primary animate-spin" />
          <span className="text-sm font-medium">Nouvelle version disponible</span>
          <Button size="sm" className="rounded-xl text-primary-foreground" style={{ background: 'var(--gradient-primary)' }} onClick={handleUpdate}>
            Mettre à jour
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
