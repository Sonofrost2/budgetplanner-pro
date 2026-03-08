import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Inbox } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface RecentTransactionsProps {
  transactions: any[];
  fmt: (n: number) => string;
  t: Record<string, string>;
  locale: string;
}

export const RecentTransactions = ({ transactions, fmt, t, locale }: RecentTransactionsProps) => {
  const navigate = useNavigate();

  return (
    <Card className="border-none shadow-[var(--shadow-card)]">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold">{t.recentTransactions}</CardTitle>
        <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/transactions')}>
          {t.all || 'Voir tout'}
        </Button>
      </CardHeader>
      <CardContent>
        {transactions.length === 0 ? (
          <div className="text-center py-10">
            <Inbox className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">{t.noTransactions}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {transactions.slice(0, 5).map(tx => (
              <div key={tx.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{tx.categories?.icon || '📁'}</span>
                  <div>
                    <p className="text-sm font-medium">{tx.description}</p>
                    <p className="text-xs text-muted-foreground">{tx.categories?.name} · {new Date(tx.date).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US')}</p>
                  </div>
                </div>
                <span className={`text-sm font-semibold ${tx.type === 'income' ? 'text-secondary' : 'text-destructive'}`}>
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
