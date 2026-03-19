import { useMemo, useState } from 'react';
import { useProfile } from '@/hooks/useProfile';
import { useLanguage } from '@/i18n/LanguageContext';
import { dashT } from '@/i18n/dashTranslations';
import { useAccounts, useAllTransactions, useSavingsGoals } from '@/hooks/useDashboardData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { BarChart3, TrendingUp, TrendingDown, Wallet, Filter, PiggyBank } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line, AreaChart, Area, Legend,
} from 'recharts';
import { abbreviateNumber } from '@/lib/utils';

const TOOLTIP_STYLE = {
  borderRadius: '12px',
  border: 'none',
  background: 'hsl(var(--card))',
  boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
  fontSize: '12px',
  padding: '8px 12px',
};

const PERIOD_OPTIONS = [
  { value: '3m', labelFr: '3 mois', labelEn: '3 months', months: 3 },
  { value: '6m', labelFr: '6 mois', labelEn: '6 months', months: 6 },
  { value: '1y', labelFr: '1 an', labelEn: '1 year', months: 12 },
  { value: 'all', labelFr: 'Tout', labelEn: 'All', months: 0 },
];

const COLORS = [
  'hsl(250, 85%, 60%)', 'hsl(165, 70%, 46%)', 'hsl(35, 92%, 55%)',
  'hsl(340, 80%, 55%)', 'hsl(200, 80%, 50%)', 'hsl(280, 65%, 55%)',
  'hsl(15, 85%, 55%)', 'hsl(130, 55%, 45%)', 'hsl(45, 90%, 50%)',
];

const AccountsRecapTab = () => {
  const { locale } = useLanguage();
  const { fmt: fmtCurrency } = useProfile();
  const t = dashT[locale];
  const { data: accounts = [] } = useAccounts();
  const { data: transactions = [] } = useAllTransactions();
  const { data: savingsGoals = [] } = useSavingsGoals();
  const fmt = (n: number) => fmtCurrency(n, locale);
  const isFr = locale === 'fr';

  const [period, setPeriod] = useState('6m');
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);

  // If no accounts selected, show all
  const activeAccountIds = selectedAccountIds.size > 0
    ? selectedAccountIds
    : new Set(accounts.map(a => a.id));

  const activeAccounts = accounts.filter(a => activeAccountIds.has(a.id));

  const toggleAccount = (id: string) => {
    setSelectedAccountIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedAccountIds(new Set());

  // Filter transactions by selected accounts and period
  const periodMonths = PERIOD_OPTIONS.find(p => p.value === period)?.months || 6;
  const now = new Date();

  const filteredTransactions = useMemo(() => {
    let txs = transactions.filter(tx => tx.account_id && activeAccountIds.has(tx.account_id));
    if (periodMonths > 0) {
      const cutoff = new Date(now.getFullYear(), now.getMonth() - periodMonths, 1);
      txs = txs.filter(tx => new Date(tx.date) >= cutoff);
    }
    return txs;
  }, [transactions, activeAccountIds, periodMonths]);

  // Stats
  const totalBalance = activeAccounts.reduce((s, a) => s + Number(a.real_balance), 0);
  const totalOpening = activeAccounts.reduce((s, a) => s + Number(a.opening_balance), 0);
  const evolution = totalBalance - totalOpening;

  // Monthly data with per-account breakdown
  const monthlyData = useMemo(() => {
    const monthCount = periodMonths > 0 ? periodMonths : 24;
    const months: { date: Date; label: string }[] = [];
    for (let i = monthCount - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        date: d,
        label: d.toLocaleDateString(isFr ? 'fr-FR' : 'en-US', { month: 'short', year: '2-digit' }),
      });
    }

    return months.map(m => {
      const endOfMonth = new Date(m.date.getFullYear(), m.date.getMonth() + 1, 0);
      const row: Record<string, any> = { month: m.label, income: 0, expenses: 0 };

      // Per-account cumulative balance
      for (const acc of activeAccounts) {
        let bal = Number(acc.opening_balance);
        for (const tx of transactions) {
          if (tx.account_id !== acc.id) continue;
          const txDate = new Date(tx.date);
          if (txDate <= endOfMonth) {
            bal += tx.type === 'income' ? Number(tx.amount) : -Number(tx.amount);
          }
        }
        row[`bal_${acc.id}`] = bal;
      }

      // Income/Expenses for the month
      for (const tx of filteredTransactions) {
        const txDate = new Date(tx.date);
        if (txDate.getMonth() === m.date.getMonth() && txDate.getFullYear() === m.date.getFullYear()) {
          if (tx.type === 'income') row.income += Number(tx.amount);
          else if (tx.type === 'expense') row.expenses += Number(tx.amount);
        }
      }

      return row;
    });
  }, [activeAccounts, transactions, filteredTransactions, periodMonths]);

  // Savings evolution
  const savingsData = useMemo(() => {
    if (savingsGoals.length === 0) return [];
    return savingsGoals.map(g => ({
      name: `${g.icon} ${g.name}`,
      current: Number(g.current_amount),
      target: Number(g.target_amount),
      pct: Number(g.target_amount) > 0 ? Math.round((Number(g.current_amount) / Number(g.target_amount)) * 100) : 0,
    }));
  }, [savingsGoals]);

  // Account bar data
  const accountBarData = activeAccounts.map(a => ({
    name: `${a.icon} ${a.name}`,
    balance: Number(a.real_balance),
    opening: Number(a.opening_balance),
  }));

  if (accounts.length === 0) {
    return (
      <Card className="border border-border/50 rounded-2xl">
        <CardContent className="py-12 text-center">
          <Wallet className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">{t.noDataYet}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters Bar */}
      <Card className="border border-border/50 rounded-2xl">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Period selector */}
            <div className="flex items-center gap-1 bg-muted/50 rounded-xl p-1">
              {PERIOD_OPTIONS.map(p => (
                <Button
                  key={p.value}
                  size="sm"
                  variant={period === p.value ? 'default' : 'ghost'}
                  className={`rounded-lg text-xs h-7 px-3 ${period === p.value ? 'shadow-sm' : ''}`}
                  onClick={() => setPeriod(p.value)}
                >
                  {isFr ? p.labelFr : p.labelEn}
                </Button>
              ))}
            </div>

            <div className="h-6 w-px bg-border hidden sm:block" />

            {/* Account filter toggle */}
            <Button
              size="sm"
              variant={showFilters ? 'secondary' : 'outline'}
              className="rounded-xl text-xs h-7 gap-1.5"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="w-3 h-3" />
              {isFr ? 'Comptes' : 'Accounts'}
              {selectedAccountIds.size > 0 && (
                <span className="bg-primary text-primary-foreground rounded-full w-4 h-4 text-[10px] flex items-center justify-center">
                  {selectedAccountIds.size}
                </span>
              )}
            </Button>

            {selectedAccountIds.size > 0 && (
              <Button size="sm" variant="ghost" className="rounded-xl text-xs h-7" onClick={selectAll}>
                {isFr ? 'Tout afficher' : 'Show all'}
              </Button>
            )}
          </div>

          {/* Account checkboxes */}
          {showFilters && (
            <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-border/50">
              {accounts.map((acc, i) => (
                <label
                  key={acc.id}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer transition-colors text-xs
                    ${activeAccountIds.has(acc.id) ? 'border-primary/30 bg-primary/5' : 'border-border/50 bg-muted/30 opacity-60'}`}
                >
                  <Checkbox
                    checked={activeAccountIds.has(acc.id)}
                    onCheckedChange={() => toggleAccount(acc.id)}
                    className="w-3.5 h-3.5"
                  />
                  <span>{acc.icon} {acc.name}</span>
                </label>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border border-border/50 rounded-2xl">
          <CardContent className="p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">{t.totalBalance}</p>
            <p className="text-xl font-bold">{fmt(totalBalance)}</p>
          </CardContent>
        </Card>
        <Card className="border border-border/50 rounded-2xl">
          <CardContent className="p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">{t.openingBalance}</p>
            <p className="text-xl font-bold">{fmt(totalOpening)}</p>
          </CardContent>
        </Card>
        <Card className="border border-border/50 rounded-2xl">
          <CardContent className="p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">{isFr ? 'Évolution' : 'Evolution'}</p>
            <p className={`text-xl font-bold flex items-center gap-1 ${evolution >= 0 ? 'text-secondary' : 'text-destructive'}`}>
              {evolution >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              {fmt(Math.abs(evolution))}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Balance evolution by account */}
      <Card className="border border-border/50 rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            {isFr ? 'Évolution des soldes' : 'Balance Evolution'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => abbreviateNumber(v, locale)} />
                <Tooltip
                  formatter={(v: number, name: string) => {
                    const acc = activeAccounts.find(a => `bal_${a.id}` === name);
                    return [fmt(v), acc ? `${acc.icon} ${acc.name}` : name];
                  }}
                  contentStyle={TOOLTIP_STYLE}
                />
                <Legend
                  formatter={(value: string) => {
                    const acc = activeAccounts.find(a => `bal_${a.id}` === value);
                    return acc ? `${acc.icon} ${acc.name}` : value;
                  }}
                  wrapperStyle={{ fontSize: '11px' }}
                />
                {activeAccounts.map((acc, i) => (
                  <Line
                    key={acc.id}
                    type="monotone"
                    dataKey={`bal_${acc.id}`}
                    stroke={COLORS[i % COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name={`bal_${acc.id}`}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Income vs Expenses */}
      <Card className="border border-border/50 rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-secondary" />
            {isFr ? 'Revenus vs Dépenses' : 'Income vs Expenses'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyData}>
                <defs>
                  <linearGradient id="recapIncG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(165, 70%, 46%)" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="hsl(165, 70%, 46%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="recapExpG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(340, 80%, 55%)" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="hsl(340, 80%, 55%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => abbreviateNumber(v, locale)} />
                <Tooltip
                  formatter={(v: number, name: string) => [fmt(v), name]}
                  contentStyle={TOOLTIP_STYLE}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Area type="monotone" dataKey="income" stroke="hsl(165, 70%, 46%)" fill="url(#recapIncG)" strokeWidth={2} name={t.income} />
                <Area type="monotone" dataKey="expenses" stroke="hsl(340, 80%, 55%)" fill="url(#recapExpG)" strokeWidth={2} name={t.expenses} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Balances by account */}
      {accountBarData.length > 1 && (
        <Card className="border border-border/50 rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold">
              {isFr ? 'Soldes par compte' : 'Balances by Account'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={accountBarData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => abbreviateNumber(v, locale)} />
                  <Tooltip formatter={(v: number) => fmt(v)} contentStyle={TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="opening" fill="hsl(var(--muted-foreground))" radius={[6, 6, 0, 0]} name={t.openingBalance} opacity={0.4} />
                  <Bar dataKey="balance" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} name={t.realBalance} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Savings goals */}
      {savingsData.length > 0 && (
        <Card className="border border-border/50 rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <PiggyBank className="w-4 h-4 text-accent" />
              {isFr ? 'Objectifs d\'épargne' : 'Savings Goals'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={savingsData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => abbreviateNumber(v, locale)} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={120} />
                  <Tooltip
                    formatter={(v: number, name: string) => [fmt(v), name]}
                    contentStyle={TOOLTIP_STYLE}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="current" fill="hsl(165, 70%, 46%)" radius={[0, 6, 6, 0]} name={isFr ? 'Actuel' : 'Current'} />
                  <Bar dataKey="target" fill="hsl(var(--muted-foreground))" radius={[0, 6, 6, 0]} name={isFr ? 'Objectif' : 'Target'} opacity={0.3} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AccountsRecapTab;
