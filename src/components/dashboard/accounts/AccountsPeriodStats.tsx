import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Wallet, TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';
import type { Account, Transaction } from '@/hooks/useDashboardData';
import type { DashTranslations } from '@/i18n/dashTranslations';

type PeriodKey = 'this_month' | 'last_month' | '3m' | '6m' | '1y' | 'all';

interface AccountsPeriodStatsProps {
  accounts: Account[];
  transactions: Transaction[];
  fmt: (n: number) => string;
  t: DashTranslations;
  locale: string;
}

const getPeriodBounds = (period: PeriodKey): { start: Date; end: Date } => {
  const now = new Date();
  const end = new Date(now);
  let start: Date;
  switch (period) {
    case 'this_month':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'last_month':
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end.setTime(new Date(now.getFullYear(), now.getMonth(), 0).getTime());
      break;
    case '3m':
      start = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      break;
    case '6m':
      start = new Date(now.getFullYear(), now.getMonth() - 6, 1);
      break;
    case '1y':
      start = new Date(now.getFullYear() - 1, now.getMonth(), 1);
      break;
    default:
      start = new Date(2000, 0, 1);
  }
  return { start, end };
};

export const AccountsPeriodStats = ({ accounts, transactions, fmt, t, locale }: AccountsPeriodStatsProps) => {
  const [period, setPeriod] = useState<PeriodKey>('this_month');
  const isFr = locale === 'fr';

  const periodLabels: Record<PeriodKey, string> = {
    this_month: isFr ? 'Ce mois' : 'This month',
    last_month: isFr ? 'Mois dernier' : 'Last month',
    '3m': isFr ? '3 derniers mois' : 'Last 3 months',
    '6m': isFr ? '6 derniers mois' : 'Last 6 months',
    '1y': isFr ? 'Cette année' : 'This year',
    all: isFr ? 'Depuis le début' : 'All time',
  };

  const stats = useMemo(() => {
    const { start, end } = getPeriodBounds(period);

    let totalIncome = 0;
    let totalExpense = 0;
    const byAccount: Record<string, { income: number; expense: number }> = {};

    for (const acc of accounts) {
      byAccount[acc.id] = { income: 0, expense: 0 };
    }

    for (const tx of transactions) {
      const d = new Date(tx.date);
      if (d < start || d > end) continue;
      if (!tx.account_id || !byAccount[tx.account_id]) continue;
      const amount = Number(tx.amount);
      if (tx.type === 'income') {
        totalIncome += amount;
        byAccount[tx.account_id].income += amount;
      } else if (tx.type === 'expense') {
        totalExpense += amount;
        byAccount[tx.account_id].expense += amount;
      }
    }

    // Theoretical balance at end of period: opening_balance + all tx up to end
    const theoreticalAtEnd: Record<string, number> = {};
    for (const acc of accounts) {
      let bal = Number(acc.opening_balance);
      for (const tx of transactions) {
        if (tx.account_id !== acc.id) continue;
        const d = new Date(tx.date);
        if (d > end) continue;
        if (tx.type === 'income') bal += Number(tx.amount);
        else if (tx.type === 'expense') bal -= Number(tx.amount);
      }
      theoreticalAtEnd[acc.id] = bal;
    }

    return { totalIncome, totalExpense, byAccount, theoreticalAtEnd };
  }, [accounts, transactions, period]);

  if (accounts.length === 0) return null;

  const net = stats.totalIncome - stats.totalExpense;

  return (
    <Card className="border-border/50 shadow-[var(--shadow-card)] rounded-2xl">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-muted-foreground" />
            {isFr ? 'Statistiques par période' : 'Period statistics'}
          </h3>
          <Select value={period} onValueChange={(v) => setPeriod(v as PeriodKey)}>
            <SelectTrigger className="w-[180px] h-8 rounded-xl text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(periodLabels).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Global summary */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="rounded-xl bg-secondary/5 border border-secondary/10 p-3 text-center">
            <TrendingUp className="w-4 h-4 text-secondary mx-auto mb-1" />
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{t.income}</p>
            <p className="text-sm font-bold text-secondary">{fmt(stats.totalIncome)}</p>
          </div>
          <div className="rounded-xl bg-destructive/5 border border-destructive/10 p-3 text-center">
            <TrendingDown className="w-4 h-4 text-destructive mx-auto mb-1" />
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{t.expenses}</p>
            <p className="text-sm font-bold text-destructive">{fmt(stats.totalExpense)}</p>
          </div>
          <div className={`rounded-xl p-3 text-center ${net >= 0 ? 'bg-secondary/5 border border-secondary/10' : 'bg-destructive/5 border border-destructive/10'}`}>
            <Wallet className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{isFr ? 'Solde net' : 'Net balance'}</p>
            <p className={`text-sm font-bold ${net >= 0 ? 'text-secondary' : 'text-destructive'}`}>{net >= 0 ? '+' : ''}{fmt(net)}</p>
          </div>
        </div>

        {/* Per-account breakdown */}
        <div className="space-y-2">
          {accounts
            .filter(acc => {
              const s = stats.byAccount[acc.id];
              return s && (s.income > 0 || s.expense > 0);
            })
            .sort((a, b) => {
              const aNet = (stats.byAccount[a.id]?.income || 0) - (stats.byAccount[a.id]?.expense || 0);
              const bNet = (stats.byAccount[b.id]?.income || 0) - (stats.byAccount[b.id]?.expense || 0);
              return bNet - aNet;
            })
            .map(acc => {
              const s = stats.byAccount[acc.id];
              const accNet = s.income - s.expense;
              const theoretical = stats.theoreticalAtEnd[acc.id] ?? 0;
              return (
                <div key={acc.id} className="flex items-center justify-between px-3 py-2 rounded-xl border border-border/30 bg-muted/10 hover:bg-muted/20 transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{acc.icon}</span>
                    <div>
                      <p className="text-sm font-bold">{acc.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {isFr ? 'Solde théorique' : 'Theoretical bal.'}: <span className="font-semibold text-foreground">{fmt(theoretical)}</span>
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-secondary">+{fmt(s.income)}</span>
                      <span className="text-destructive">-{fmt(s.expense)}</span>
                    </div>
                    <p className={`text-xs font-bold ${accNet >= 0 ? 'text-secondary' : 'text-destructive'}`}>
                      {accNet >= 0 ? '+' : ''}{fmt(accNet)}
                    </p>
                  </div>
                </div>
              );
            })}
        </div>
      </CardContent>
    </Card>
  );
};
