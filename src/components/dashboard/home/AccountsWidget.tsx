import { Button } from '@/components/ui/button';
import { CreditCard, Plus, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { DashTranslations } from '@/i18n/dashTranslations';

interface Account {
  id: string;
  name: string;
  icon: string;
  type: string;
  real_balance: number;
  opening_balance: number;
}

interface AccountsWidgetProps {
  accounts: Account[];
  fmt: (n: number) => string;
  t: DashTranslations;
}

const listItem = {
  hidden: { opacity: 0, x: -8 },
  show: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.06, duration: 0.3, ease: 'easeOut' as const },
  }),
};

export const AccountsWidget = ({ accounts, fmt, t }: AccountsWidgetProps) => {
  const navigate = useNavigate();

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
      <div className="glass rounded-2xl h-full glow-primary">
        <div className="flex items-center justify-between p-4 pb-3">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <CreditCard className="w-3.5 h-3.5 text-primary" />
            </div>
            {t.accounts}
          </h3>
          <Button variant="ghost" size="sm" className="text-[10px] h-6 px-2 text-muted-foreground" onClick={() => navigate('/dashboard/accounts')}>
            {t.all || 'Voir tout'} <ChevronRight className="w-3 h-3 ml-0.5" />
          </Button>
        </div>
        <div className="px-4 pb-4">
          {accounts.length === 0 ? (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-6">
              <div className="w-10 h-10 rounded-xl bg-muted/50 mx-auto mb-2.5 flex items-center justify-center">
                <CreditCard className="w-4 h-4 text-muted-foreground/40" />
              </div>
              <p className="text-xs text-muted-foreground mb-2.5">{t.noAccounts}</p>
              <Button size="sm" variant="outline" className="rounded-xl h-7 text-[10px] glass border-glass-border" onClick={() => navigate('/dashboard/accounts')}>
                <Plus className="w-3 h-3 mr-1" />{t.addAccount}
              </Button>
            </motion.div>
          ) : (
            <div className="space-y-1">
              {accounts.map((acc, i) => (
                <motion.div
                  key={acc.id}
                  custom={i}
                  variants={listItem}
                  initial="hidden"
                  animate="show"
                  whileHover={{ x: 4, backgroundColor: 'hsl(var(--muted) / 0.3)' }}
                  whileTap={{ scale: 0.97 }}
                  className="flex items-center justify-between p-2 rounded-xl transition-colors cursor-pointer"
                  onClick={() => navigate(`/dashboard/accounts?q=${encodeURIComponent(acc.name)}`)}
                >
                  <div className="flex items-center gap-2.5">
                    <motion.span
                      className="text-base"
                      whileHover={{ scale: 1.2, rotate: 10 }}
                      transition={{ type: 'spring', stiffness: 400 }}
                    >
                      {acc.icon}
                    </motion.span>
                    <div>
                      <p className="text-xs font-semibold">{acc.name}</p>
                      <p className="text-[10px] text-muted-foreground capitalize">{acc.type.replace('_', ' ')}</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold tabular-nums amount-display">{fmt(acc.real_balance)}</span>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};
