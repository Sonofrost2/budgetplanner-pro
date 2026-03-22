import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { DashTranslations } from '@/i18n/dashTranslations';

import type { Account } from '@/hooks/useDashboardData';

interface AccountsSummaryWidgetProps {
  accounts: Account[];
  fmt: (n: number) => string;
  t: DashTranslations;
  locale: string;
}

const typeLabels: Record<string, Record<string, string>> = {
  fr: { bank: 'Banque', mobile_money: 'Mobile Money', cash: 'Espèces', card: 'Carte', savings: 'Épargne', wallet: 'Portefeuille' },
  en: { bank: 'Bank', mobile_money: 'Mobile Money', cash: 'Cash', card: 'Card', savings: 'Savings', wallet: 'Wallet' },
};

const typeIcons: Record<string, string> = {
  bank: '🏦', mobile_money: '📱', cash: '💵', card: '💳', savings: '🐖', wallet: '👛',
};

const rowVariant = {
  hidden: { opacity: 0, x: -10 },
  show: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.06, duration: 0.3, ease: 'easeOut' as const },
  }),
};

export const AccountsSummaryWidget = ({ accounts, fmt, t, locale }: AccountsSummaryWidgetProps) => {
  const navigate = useNavigate();
  if (accounts.length === 0) return null;

  const grouped: Record<string, { total: number; count: number }> = {};
  accounts.forEach(a => {
    const type = a.type || 'other';
    if (!grouped[type]) grouped[type] = { total: 0, count: 0 };
    grouped[type].total += Number(a.real_balance);
    grouped[type].count += 1;
  });

  const total = accounts.reduce((s: number, a: any) => s + Number(a.real_balance), 0);
  const labels = typeLabels[locale] || typeLabels.en;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="glass rounded-2xl p-5 glow-primary"
    >
      <h3 className="text-sm font-bold mb-3">{t.accountsSummary}</h3>
      <div className="space-y-1.5">
        {Object.entries(grouped).map(([type, { total: subtotal, count }], i) => (
          <motion.div
            key={type}
            custom={i}
            variants={rowVariant}
            initial="hidden"
            animate="show"
            whileHover={{ x: 6, backgroundColor: 'hsl(var(--muted) / 0.3)' }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center justify-between py-2 px-2.5 rounded-xl cursor-pointer transition-colors"
            onClick={() => navigate(`/dashboard/accounts?type=${type}`)}
          >
            <div className="flex items-center gap-2">
              <motion.span
                className="text-base"
                whileHover={{ scale: 1.2, rotate: 8 }}
                transition={{ type: 'spring', stiffness: 400 }}
              >
                {typeIcons[type] || '💳'}
              </motion.span>
              <div>
                <p className="text-xs font-medium">{labels[type] || type}</p>
                <p className="text-[10px] text-muted-foreground">{count} {locale === 'fr' ? 'compte(s)' : 'account(s)'}</p>
              </div>
            </div>
            <span className="text-xs font-bold tabular-nums amount-display">{fmt(subtotal)}</span>
          </motion.div>
        ))}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="flex items-center justify-between pt-2.5 mt-1.5 border-t border-glass-border"
        >
          <span className="text-xs font-bold">{t.savingsTotal}</span>
          <span className="text-sm font-extrabold tabular-nums amount-display amount-gradient">{fmt(total)}</span>
        </motion.div>
      </div>
    </motion.div>
  );
};
