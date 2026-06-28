import { useMemo, useState } from 'react';
import { useProfile } from '@/hooks/useProfile';
import { useLanguage } from '@/i18n/LanguageContext';
import { dashT } from '@/i18n/dashTranslations';
import { useAccounts, useAllTransactions, useSavingsGoals } from '@/hooks/useDashboardData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart3, TrendingUp, TrendingDown, Wallet, Filter, PiggyBank, Search, CalendarDays } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line, AreaChart, Area, Legend,
} from 'recharts';
import { abbreviateNumber, cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CHART_INCOME, CHART_ALERT, CHART_PALETTE, CHART_TOOLTIP_BG } from '@/lib/chartColors';

const TOOLTIP_STYLE = {
  borderRadius: '12px',
  border: 'none',
  background: CHART_TOOLTIP_BG,
  boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
  fontSize: '12px',
  padding: '8px 12px',
};

type PeriodKey = '3m' | '6m' | '1y' | 'all' | 'custom';

const PERIOD_OPTIONS: { value: PeriodKey; months: number }[] = [
  { value: '3m', months: 3 },
  { value: '6m', months: 6 },
  { value: '1y', months: 12 },
  { value: 'all', months: 0 },
  { value: 'custom', months: 0 },
];

const COLORS = CHART_PALETTE;

const AccountsRecapTab = () => {
  const { locale } = useLanguage();
  const { fmt: fmtCurrency } = useProfile();
  const t = dashT[locale];
  const { data: accounts = [] } = useAccounts();
  const { data: transactions = [] } = useAllTransactions();
  const { data: savingsGoals = [] } = useSavingsGoals();
  const fmt = (n: number) => fmtCurrency(n, locale);
  const isFr = locale === 'fr';

  const [period, setPeriod] = useState<PeriodKey>('6m');
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(new Set());
  const [accountSearch, setAccountSearch] = useState('');

  const periodLabels: Record<PeriodKey, string> = {
    '3m': isFr ? '3 mois' : '3 months',
    '6m': isFr ? '6 mois' : '6 months',
    '1y': isFr ? '1 an' : '1 year',
    all: isFr ? 'Tout' : 'All',
    custom: isFr ? 'Personnalisé' : 'Custom',
  };

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

  const searchedAccounts = useMemo(() => {
    if (!accountSearch.trim()) return accounts;
    const q = accountSearch.toLowerCase();
    return accounts.filter(a => a.name.toLowerCase().includes(q));
  }, [accounts, accountSearch]);

  const now = new Date();
  const periodMonths = PERIOD_OPTIONS.find(p => p.value === period)?.months || 6;

  const { startDate, endDate } = useMemo(() => {
    if (period === 'custom') {
      return {
        startDate: customFrom || new Date(now.getFullYear(), now.getMonth() - 6, 1),
        endDate: customTo || now,
      };
    }
    const months = periodMonths > 0 ? periodMonths : 24;
    return {
      startDate: new Date(now.getFullYear(), now.getMonth() - months, 1),
      endDate: now,
    };
  }, [period, periodMonths, customFrom, customTo]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      if (!tx.account_id || !activeAccountIds.has(tx.account_id)) return false;
      const d = new Date(tx.date);
      return d >= startDate && d <= endDate;
    });
  }, [transactions, activeAccountIds, startDate, endDate]);

  const totalBalance = activeAccounts.reduce((s, a) => s + Number(a.real_balance), 0);
  const totalOpening = activeAccounts.reduce((s, a) => s + Number(a.opening_balance), 0);
  const evolution = totalBalance - totalOpening;

  const monthlyData = useMemo(() => {
    const months: { date: Date; label: string }[] = [];
    const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    while (cursor <= endDate) {
      months.push({
        date: new Date(cursor),
        label: cursor.toLocaleDateString(isFr ? 'fr-FR' : 'en-US', { month: 'short', year: '2-digit' }),
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    return months.map(m => {
      const endOfMonth = new Date(m.date.getFullYear(), m.date.getMonth() + 1, 0);
      const row: Record<string, any> = { month: m.label, income: 0, expenses: 0 };

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

      for (const tx of filteredTransactions) {
        const txDate = new Date(tx.date);
        if (txDate.getMonth() === m.date.getMonth() && txDate.getFullYear() === m.date.getFullYear()) {
          if (tx.type === 'income') row.income += Number(tx.amount);
          else if (tx.type === 'expense') row.expenses += Number(tx.amount);
        }
      }
      return row;
    });
  }, [activeAccounts, transactions, filteredTransactions, startDate, endDate]);

  const savingsData = useMemo(() => {
    if (savingsGoals.length === 0) return [];
    return savingsGoals.map(g => ({
      name: `${g.icon} ${g.name}`,
      current: Number(g.current_amount),
      target: Number(g.target_amount),
      pct: Number(g.target_amount) > 0 ? Math.round((Number(g.current_amount) / Number(g.target_amount)) * 100) : 0,
    }));
  }, [savingsGoals]);

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
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-wrap items-center gap-2">
            {/* Period selector */}
            <Select value={period} onValueChange={v => setPeriod(v as PeriodKey)}>
              <SelectTrigger className="h-9 w-36 rounded-xl text-xs font-medium">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(periodLabels).map(([k, label]) => (
                  <SelectItem key={k} value={k}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Custom dates */}
            {period === 'custom' && (
              <>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn("h-9 rounded-xl text-xs gap-1.5 min-w-[120px]", !customFrom && "text-muted-foreground")}>
                      <CalendarDays className="w-3.5 h-3.5" />
                      {customFrom ? format(customFrom, 'dd MMM yyyy', { locale: isFr ? fr : undefined }) : (isFr ? 'Du...' : 'From...')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={customFrom} onSelect={setCustomFrom} initialFocus className={cn("p-3 pointer-events-auto")} locale={isFr ? fr : undefined} />
                  </PopoverContent>
                </Popover>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn("h-9 rounded-xl text-xs gap-1.5 min-w-[120px]", !customTo && "text-muted-foreground")}>
                      <CalendarDays className="w-3.5 h-3.5" />
                      {customTo ? format(customTo, 'dd MMM yyyy', { locale: isFr ? fr : undefined }) : (isFr ? 'Au...' : 'To...')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={customTo} onSelect={setCustomTo} disabled={d => customFrom ? d < customFrom : false} initialFocus className={cn("p-3 pointer-events-auto")} locale={isFr ? fr : undefined} />
                  </PopoverContent>
                </Popover>
              </>
            )}

            {/* Account filter */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 rounded-xl text-xs gap-1.5 min-w-[140px]">
                  <Filter className="w-3.5 h-3.5" />
                  {isFr ? 'Comptes' : 'Accounts'}
                  {selectedAccountIds.size > 0 && (
                    <span className="ml-1 bg-primary/20 text-primary rounded-full px-1.5 py-0.5 text-[10px] font-bold">{selectedAccountIds.size}</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="end">
                <div className="p-3 border-b border-border space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground">{isFr ? 'Filtrer les comptes' : 'Filter accounts'}</span>
                    <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={() => setSelectedAccountIds(new Set())}>
                      {isFr ? 'Tout' : 'All'}
                    </Button>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input value={accountSearch} onChange={e => setAccountSearch(e.target.value)} placeholder={isFr ? 'Rechercher...' : 'Search...'} className="h-9 pl-8 text-sm rounded-lg" />
                  </div>
                </div>
                <ScrollArea className="h-72">
                  <div className="p-2 space-y-0.5">
                    {searchedAccounts.map(acc => (
                      <label key={acc.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
                        <Checkbox checked={activeAccountIds.has(acc.id)} onCheckedChange={() => toggleAccount(acc.id)} />
                        <span className="text-base">{acc.icon}</span>
                        <span className="text-sm truncate flex-1">{acc.name}</span>
                      </label>
                    ))}
                    {searchedAccounts.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-4">{isFr ? 'Aucun résultat' : 'No results'}</p>
                    )}
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>
          </div>
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

      {/* Balance evolution */}
      <Card className="border border-border/50 rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            {isFr ? 'Évolution des soldes' : 'Balance Evolution'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
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
                  <Line key={acc.id} type="monotone" dataKey={`bal_${acc.id}`} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 3 }} name={`bal_${acc.id}`} />
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
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyData}>
                <defs>
                  <linearGradient id="recapIncG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_INCOME} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={CHART_INCOME} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="recapExpG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_ALERT} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={CHART_ALERT} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => abbreviateNumber(v, locale)} />
                <Tooltip formatter={(v: number, name: string) => [fmt(v), name]} contentStyle={TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Area type="monotone" dataKey="income" stroke={CHART_INCOME} fill="url(#recapIncG)" strokeWidth={2} name={t.income} />
                <Area type="monotone" dataKey="expenses" stroke={CHART_ALERT} fill="url(#recapExpG)" strokeWidth={2} name={t.expenses} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Balances by account */}
      {accountBarData.length > 1 && (
        <Card className="border border-border/50 rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold">{isFr ? 'Soldes par compte' : 'Balances by Account'}</CardTitle>
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
                  <Tooltip formatter={(v: number, name: string) => [fmt(v), name]} contentStyle={TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="current" fill={CHART_INCOME} radius={[0, 6, 6, 0]} name={isFr ? 'Actuel' : 'Current'} />
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
