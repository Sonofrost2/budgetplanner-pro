import type { DashTranslations } from '@/i18n/dashTranslations';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Inbox, ArrowUpDown, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface RecentTransactionsProps {
  transactions: any[];
  fmt: (n: number) => string;
  t: DashTranslations;
  locale: string;
}

export const RecentTransactions = ({ transactions, fmt, t, locale }: RecentTransactionsProps) => {
  const navigate = useNavigate();

  return (
    <Card className="border border-border/50 shadow-[var(--shadow-card)]">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <ArrowUpDown className="w-3.5 h-3.5 text-primary" />
          </div>
          {t.recentTransactions}
        </CardTitle>
        <Button variant="ghost" size="sm" className="text-xs h-7 px-2 text-muted-foreground" onClick={() => navigate('/dashboard/transactions')}>
          {t.all || 'Voir tout'} <ChevronRight className="w-3 h-3 ml-1" />
        </Button>
      </CardHeader>
      <CardContent className="pt-0">
        {transactions.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-14 h-14 rounded-2xl bg-muted mx-auto mb-4 flex items-center justify-center">
              <Inbox className="w-6 h-6 text-muted-foreground/40" />
            </div>
            <p className="text-sm text-muted-foreground">{t.noTransactions}</p>
          </div>
        ) : (
          <div className="space-y-1">
            {transactions.slice(0, 5).map(tx => (
              <div key={tx.id} className="flex items-center justify-between p-2.5 rounded-xl hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-muted/80 flex items-center justify-center text-base">
                    {tx.categories?.icon || '📁'}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{tx.description}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {tx.categories?.name} · {new Date(tx.date).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                </div>
                <span className={`text-sm font-bold ${tx.type === 'income' ? 'text-secondary' : 'text-destructive'}`}>
                  {tx.type === 'income' ? '+' : '-'}{fmt(Number(tx.amount))}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
