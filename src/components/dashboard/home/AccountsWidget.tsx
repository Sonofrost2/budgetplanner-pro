import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  t: Record<string, string>;
}

export const AccountsWidget = ({ accounts, fmt, t }: AccountsWidgetProps) => {
  const navigate = useNavigate();

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
      <Card className="border border-border/50 shadow-[var(--shadow-card)] h-full">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <CreditCard className="w-3.5 h-3.5 text-primary" />
            </div>
            {t.accounts}
          </CardTitle>
          <Button variant="ghost" size="sm" className="text-xs h-7 px-2 text-muted-foreground" onClick={() => navigate('/dashboard/accounts')}>
            {t.all || 'Voir tout'} <ChevronRight className="w-3 h-3 ml-1" />
          </Button>
        </CardHeader>
        <CardContent className="pt-0">
          {accounts.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-2xl bg-muted mx-auto mb-3 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-muted-foreground/50" />
              </div>
              <p className="text-sm text-muted-foreground mb-3">{t.noAccounts}</p>
              <Button size="sm" variant="outline" className="rounded-xl" onClick={() => navigate('/dashboard/accounts')}>
                <Plus className="w-4 h-4 mr-1" />{t.addAccount}
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {accounts.map(acc => (
                <div key={acc.id} className="flex items-center justify-between p-2.5 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => navigate('/dashboard/accounts')}>
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{acc.icon}</span>
                    <div>
                      <p className="text-sm font-semibold">{acc.name}</p>
                      <p className="text-[11px] text-muted-foreground capitalize">{acc.type.replace('_', ' ')}</p>
                    </div>
                  </div>
                  <span className="text-sm font-bold">{fmt(acc.real_balance)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};
