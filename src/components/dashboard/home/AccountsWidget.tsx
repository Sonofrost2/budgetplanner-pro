import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CreditCard, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

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
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
      <Card className="border-none shadow-[var(--shadow-card)]">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-primary" />
            {t.accounts}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/accounts')}>
            {t.all || 'Voir tout'}
          </Button>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm text-muted-foreground mb-3">{t.noAccounts}</p>
              <Button size="sm" variant="outline" onClick={() => navigate('/dashboard/accounts')}>
                <Plus className="w-4 h-4 mr-1" />{t.addAccount}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {accounts.map(acc => (
                <div key={acc.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{acc.icon}</span>
                    <div>
                      <p className="text-sm font-medium">{acc.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{acc.type.replace('_', ' ')}</p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold">{fmt(acc.real_balance)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};
