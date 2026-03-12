import type { DashTranslations } from '@/i18n/dashTranslations';
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
          <div className="text-center py-10">
            <div className="w-12 h-12 rounded-2xl bg-muted/40 mx-auto mb-3 flex items-center justify-center">
              <Inbox className="w-5 h-5 text-muted-foreground/30" />
            </div>
            <p className="text-xs text-muted-foreground">{t.noTransactions}</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {transactions.slice(0, 5).map(tx => (
              <div key={tx.id} className="flex items-center justify-between p-2 rounded-xl hover:bg-muted/20 transition-colors">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-muted/40 flex items-center justify-center text-sm">
                    {tx.categories?.icon || '📁'}
                  </div>
                  <div>
                    <p className="text-xs font-semibold">{tx.description}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {tx.categories?.name} · {new Date(tx.date).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                </div>
                <span className={`text-xs font-bold ${tx.type === 'income' ? 'text-secondary' : 'text-destructive'}`}>
                  {tx.type === 'income' ? '+' : '-'}{fmt(Number(tx.amount))}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
