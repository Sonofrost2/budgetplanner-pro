import { motion } from 'framer-motion';

interface SavingsRingProgressProps {
  /** 0-100 */
  value: number;
  size?: number;
  strokeWidth?: number;
  /** semantic tone */
  tone?: 'primary' | 'secondary' | 'destructive' | 'emerald' | 'muted';
  children?: React.ReactNode;
  className?: string;
}

const TONE_CLASS: Record<NonNullable<SavingsRingProgressProps['tone']>, string> = {
  primary: 'stroke-primary',
  secondary: 'stroke-secondary',
  destructive: 'stroke-destructive',
  emerald: 'stroke-secondary',
  muted: 'stroke-muted-foreground',
};

/**
 * Reusable circular progress ring (SVG) for the Savings module.
 * Renders an animated arc with optional centered content.
 */
export const SavingsRingProgress = ({
  value,
  size = 96,
  strokeWidth = 8,
  tone = 'primary',
  children,
  className,
}: SavingsRingProgressProps) => {
  const clamped = Math.max(0, Math.min(100, value));
  const radius = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (clamped / 100) * circ;

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className || ''}`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          className="stroke-muted/40"
          fill="none"
          strokeLinecap="round"
        />
        {/* Progress */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          className={TONE_CLASS[tone]}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
        />
      </svg>
      {children && (
        <div className="absolute inset-0 flex items-center justify-center">
          {children}
        </div>
      )}
    </div>
  );
};
