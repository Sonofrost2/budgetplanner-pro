import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

interface Props {
  size?: 'sm' | 'md' | 'lg';
  pulsing?: boolean;
}

export const AICoachAvatar = ({ size = 'md', pulsing = true }: Props) => {
  const dim = size === 'sm' ? 'h-7 w-7' : size === 'lg' ? 'h-12 w-12' : 'h-9 w-9';
  const icon = size === 'sm' ? 'w-3.5 h-3.5' : size === 'lg' ? 'w-6 h-6' : 'w-4.5 h-4.5';
  return (
    <div className={`relative ${dim} shrink-0`}>
      {pulsing && (
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{ background: 'var(--gradient-primary)' }}
          animate={{ scale: [1, 1.25, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeOut' }}
        />
      )}
      <div
        className={`relative ${dim} rounded-full flex items-center justify-center text-primary-foreground shadow-md`}
        style={{ background: 'var(--gradient-primary)' }}
      >
        <Sparkles className={icon} />
      </div>
    </div>
  );
};
