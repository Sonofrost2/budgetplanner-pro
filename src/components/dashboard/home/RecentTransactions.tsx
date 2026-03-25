import type { DashTranslations } from '@/i18n/dashTranslations';
import { Button } from '@/components/ui/button';
import { Inbox, ArrowUpDown, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

import type { Transaction } from '@/hooks/useDashboardData';

interface RecentTransactionsProps {
  transactions: Transaction[];
  fmt: (n: number) => string;
  t: DashTranslations;
  locale: string;
}

const listItem = {
  hidden: { opacity: 0, x: -12 },
  show: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.05, duration: 0.3, ease: 'easeOut' as const },
  }),
};

export const RecentTransactions = ({ transactions, fmt, t, locale }: RecentTransactionsProps) => {
  const navigate = useNavigate();

  return (
    <div className="glass rounded-2xl">
      <div className="flex items-center justify-between p-4 pb-3">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <ArrowUpDown className="w-3.5 h-3.5 text-primary" />
          </div>
          {t.recentTransactions}
        </h3>
        <Button variant="ghost" size="sm" className="text-[10px] h-6 px-2 text-muted-foreground" onClick={() => navigate('/dashboard/transactions')}>
          {t.all || 'Voir tout'} <ChevronRight className="w-3 h-3 ml-0.5" />
        </Button>
      </div>
      <div className="px-4 pb-4">
        {transactions.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-10"
          >
            <div className="w-12 h-12 rounded-2xl bg-muted/40 mx-auto mb-3 flex items-center justify-center">
              <Inbox className="w-5 h-5 text-muted-foreground/30" />
            </div>
            <p className="text-xs text-muted-foreground">{t.noTransactions}</p>
          </motion.div>
        ) : (
          <div className="space-y-0.5">
            {transactions.slice(0, 5).map((tx, i) => (
              <motion.div
                key={tx.id}
                custom={i}
                variants={listItem}
                initial="hidden"
                animate="show"
                whileHover={{ x: 4, backgroundColor: 'hsl(var(--muted) / 0.3)' }}
                className="flex items-center justify-between p-2 rounded-xl transition-colors cursor-pointer"
                onClick={() => navigate(`/dashboard/transactions?q=${encodeURIComponent(tx.description)}`)}
              >
                <div className="flex items-center gap-2.5">
                  <motion.div
                    className="w-8 h-8 rounded-xl bg-muted/40 flex items-center justify-center text-sm"
                    whileHover={{ scale: 1.15, rotate: 5 }}
                    transition={{ type: 'spring', stiffness: 400 }}
                  >
                    {tx.categories?.icon || '📁'}
                  </motion.div>
                  <div>
                    <p className="text-xs font-semibold">{tx.description}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {tx.categories?.name} · {new Date(tx.date).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                </div>
                <motion.span
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05 + 0.2 }}
                  className={`text-xs font-bold tabular-nums amount-display ${tx.type === 'income' ? 'text-secondary amount-glow-green' : 'text-destructive amount-glow-red'}`}
                >
                  <span className="text-[0.85em] opacity-70 mr-0.5">{tx.type === 'income' ? '+' : '-'}</span>{fmt(Number(tx.amount))}
                </motion.span>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
