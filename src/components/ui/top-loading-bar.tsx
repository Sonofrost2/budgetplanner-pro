import { motion, AnimatePresence } from 'framer-motion';

interface TopLoadingBarProps {
  loading: boolean;
}

/**
 * Sleek top-of-page loading indicator (NProgress-style).
 */
export const TopLoadingBar = ({ loading }: TopLoadingBarProps) => (
  <AnimatePresence>
    {loading && (
      <motion.div
        className="fixed top-0 left-0 right-0 h-[3px] z-[9999]"
        initial={{ scaleX: 0, opacity: 1 }}
        animate={{ scaleX: 0.85, opacity: 1 }}
        exit={{ scaleX: 1, opacity: 0 }}
        transition={{
          scaleX: { duration: 2, ease: 'easeInOut' },
          opacity: { duration: 0.3, delay: 0.1 },
        }}
        style={{
          background: 'var(--gradient-primary)',
          transformOrigin: 'left',
        }}
      >
        {/* Pulsing glow at the tip */}
        <motion.div
          className="absolute right-0 top-0 h-full w-24"
          style={{
            background: 'linear-gradient(90deg, transparent, hsl(var(--primary) / 0.5))',
          }}
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.2, repeat: Infinity }}
        />
      </motion.div>
    )}
  </AnimatePresence>
);
