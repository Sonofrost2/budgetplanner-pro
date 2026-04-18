import { motion } from 'framer-motion';
import { useDashboardInsights } from '@/hooks/useDashboardInsights';

interface Props {
  locale: 'fr' | 'en';
}

const toneClass: Record<string, string> = {
  streak: 'border-orange-500/30 bg-orange-500/10 text-orange-500 dark:text-orange-300',
  warn: 'border-destructive/30 bg-destructive/10 text-destructive',
  good: 'border-secondary/30 bg-secondary/10 text-secondary',
  info: 'border-primary/30 bg-primary/10 text-primary',
  primary: 'border-primary/40 bg-primary/15 text-primary',
};

export const DashboardCoachInsights = ({ locale }: Props) => {
  const { data: insights = [] } = useDashboardInsights(locale);
  if (!insights.length) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none"
    >
      {insights.map((ins, i) => (
        <motion.div
          key={ins.key}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15 + i * 0.05, duration: 0.3 }}
          className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border backdrop-blur-md text-xs font-semibold whitespace-nowrap ${toneClass[ins.tone] || toneClass.primary}`}
        >
          <span className="text-sm leading-none">{ins.icon}</span>
          <span>{ins.text}</span>
        </motion.div>
      ))}
    </motion.div>
  );
};
