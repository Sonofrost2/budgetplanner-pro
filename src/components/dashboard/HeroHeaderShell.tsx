import { motion } from 'framer-motion';
import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface Props {
  /** Optional className appended to the outer wrapper */
  className?: string;
  /** Tweak inner padding (default: p-5 sm:p-6 lg:p-7) */
  innerClassName?: string;
  /** Override the colored decorative blobs */
  topBlobClassName?: string;
  bottomBlobClassName?: string;
  children: ReactNode;
}

/**
 * Generic glass shell for all module hero headers (Coach Financier).
 * Provides: rounded-3xl glass surface, decorative blurred blobs and entry animation.
 *
 * Children are rendered above the blobs (z-stacked via `relative`).
 */
export const HeroHeaderShell = ({
  className,
  innerClassName,
  topBlobClassName = 'bg-primary/20',
  bottomBlobClassName = 'bg-accent/15',
  children,
}: Props) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className={cn(
        'relative overflow-hidden rounded-3xl border border-[hsl(var(--glass-border))] bg-[hsl(var(--glass))] backdrop-blur-xl shadow-[var(--shadow-glass)]',
        className,
      )}
    >
      <div className={cn('pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full blur-3xl', topBlobClassName)} />
      <div className={cn('pointer-events-none absolute -bottom-24 -left-20 w-72 h-72 rounded-full blur-3xl', bottomBlobClassName)} />
      <div className={cn('relative', innerClassName ?? 'p-5 sm:p-6 lg:p-7')}>
        {children}
      </div>
    </motion.div>
  );
};
