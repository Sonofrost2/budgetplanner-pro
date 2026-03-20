import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

type AmountVariant = 'default' | 'hero' | 'compact' | 'inline';
type AmountSign = 'positive' | 'negative' | 'neutral' | 'auto';

interface FormattedAmountProps {
  value: number;
  formatted: string;
  sign?: AmountSign;
  variant?: AmountVariant;
  showSign?: boolean;
  animate?: boolean;
  className?: string;
}

const signClasses: Record<string, string> = {
  positive: 'text-secondary',
  negative: 'text-destructive',
  neutral: 'text-foreground',
};

const variantClasses: Record<AmountVariant, string> = {
  hero: 'text-xl sm:text-2xl font-extrabold tracking-tight',
  default: 'text-sm font-bold',
  compact: 'text-xs font-semibold',
  inline: 'text-[13px] font-bold',
};

/**
 * Beautiful formatted amount display with consistent styling across the app.
 * Uses Space Grotesk for numbers, tabular-nums, gradient effects for hero variant.
 */
export const FormattedAmount = ({
  value,
  formatted,
  sign = 'auto',
  variant = 'default',
  showSign = false,
  animate = true,
  className,
}: FormattedAmountProps) => {
  const resolvedSign = sign === 'auto'
    ? value > 0 ? 'positive' : value < 0 ? 'negative' : 'neutral'
    : sign;

  const prefix = showSign ? (resolvedSign === 'positive' ? '+' : resolvedSign === 'negative' ? '-' : '') : '';
  const displayValue = showSign && resolvedSign === 'negative' ? formatted.replace(/^-/, '') : formatted;

  const isHero = variant === 'hero';

  const content = (
    <span
      className={cn(
        'tabular-nums amount-display',
        variantClasses[variant],
        signClasses[resolvedSign],
        isHero && resolvedSign === 'positive' && 'amount-glow-green',
        isHero && resolvedSign === 'negative' && 'amount-glow-red',
        isHero && resolvedSign === 'neutral' && 'amount-gradient',
        className,
      )}
    >
      {prefix && (
        <span className={cn(
          'mr-0.5 opacity-70',
          isHero ? 'text-lg' : 'text-[0.85em]',
        )}>
          {prefix}
        </span>
      )}
      <span className="amount-digits">{displayValue}</span>
    </span>
  );

  if (!animate) return content;

  return (
    <motion.span
      initial={{ opacity: 0, y: 4, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="inline-flex items-baseline"
    >
      {content}
    </motion.span>
  );
};

/**
 * Simple wrapper for transaction amounts with +/- sign and colors.
 */
export const TransactionAmount = ({
  amount,
  type,
  formatted,
  variant = 'default',
  className,
}: {
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  formatted: string;
  variant?: AmountVariant;
  className?: string;
}) => (
  <FormattedAmount
    value={amount}
    formatted={formatted}
    sign={type === 'income' ? 'positive' : type === 'expense' ? 'negative' : 'neutral'}
    showSign
    variant={variant}
    className={className}
  />
);
