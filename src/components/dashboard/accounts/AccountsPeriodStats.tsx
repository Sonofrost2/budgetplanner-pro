import { useMemo, useState, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Wallet, TrendingUp, TrendingDown, BarChart3, CalendarDays, Search, X, ArrowUpDown, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { Account, Transaction } from '@/hooks/useDashboardData';
import type { DashTranslations } from '@/i18n/dashTranslations';

type PeriodKey = 'today' | 'this_week' | 'this_month' | 'last_month' | '3m' | '6m' | '1y' | 'all' | 'custom';
type SortKey = 'name' | 'net' | 'income' | 'expense' | 'theoretical';

interface AccountsPeriodStatsProps {
  accounts: Account[];
  transactions: Transaction[];
  fmt: (n: number) => string;
  t: DashTranslations;
  locale: string;
}

const getPeriodBounds = (period: PeriodKey, customFrom?: Date, customTo?: Date): { start: Date; end: Date } => {
  const now = new Date();
  const end = new Date(now);
  let start: Date;
  switch (period) {
    case 'today':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'this_week': {
      const day = now.getDay() || 7;
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 1);
      break;
    }
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
    case 'custom':
      start = customFrom || new Date(now.getFullYear(), now.getMonth(), 1);
      if (customTo) end.setTime(customTo.getTime());
      return { start, end };
    default:
      start = new Date(2000, 0, 1);
  }
  return { start, end };
};

export const AccountsPeriodStats = ({ accounts, transactions, fmt, t, locale }: AccountsPeriodStatsProps) => {
  const [period, setPeriod] = useState<PeriodKey>('this_month');
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();
  const isFr = locale === 'fr';

  // Debounce search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(searchQuery), 250);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [searchQuery]);

  const periodLabels: Record<PeriodKey, string> = {
    today: isFr ? "Aujourd'hui" : 'Today',
    this_week: isFr ? 'Cette semaine' : 'This week',
    this_month: isFr ? 'Ce mois' : 'This month',
    last_month: isFr ? 'Mois dernier' : 'Last month',
    '3m': isFr ? '3 derniers mois' : 'Last 3 months',
    '6m': isFr ? '6 derniers mois' : 'Last 6 months',
    '1y': isFr ? 'Cette année' : 'This year',
    all: isFr ? 'Depuis le début' : 'All time',
    custom: isFr ? 'Personnalisé' : 'Custom',
  };

  const sortLabels: Record<SortKey, string> = {
    name: isFr ? 'Nom' : 'Name',
    net: isFr ? 'Solde net' : 'Net balance',
    income: isFr ? 'Revenus' : 'Income',
    expense: isFr ? 'Dépenses' : 'Expenses',
    theoretical: isFr ? 'Solde théorique' : 'Theoretical bal.',
  };

  const stats = useMemo(() => {
    const { start, end } = getPeriodBounds(period, customFrom, customTo);

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

    // Theoretical balance at end of period
    const theoreticalAtEnd: Record<string, number> = {};
    const { end: periodEnd } = getPeriodBounds(period, customFrom, customTo);
    for (const acc of accounts) {
      let bal = Number(acc.opening_balance);
      for (const tx of transactions) {
        if (tx.account_id !== acc.id) continue;
        const d = new Date(tx.date);
        if (d > periodEnd) continue;
        if (tx.type === 'income') bal += Number(tx.amount);
        else if (tx.type === 'expense') bal -= Number(tx.amount);
      }
      theoreticalAtEnd[acc.id] = bal;
    }

    return { totalIncome, totalExpense, byAccount, theoreticalAtEnd };
  }, [accounts, transactions, period, customFrom, customTo]);

  // Filter & sort accounts
  const displayedAccounts = useMemo(() => {
    let result = [...accounts];

    // Search filter
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(a => a.name.toLowerCase().includes(q) || a.type.toLowerCase().includes(q));
    }

    // Account selection filter
    if (selectedAccountIds.size > 0) {
      result = result.filter(a => selectedAccountIds.has(a.id));
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      const sA = stats.byAccount[a.id] || { income: 0, expense: 0 };
      const sB = stats.byAccount[b.id] || { income: 0, expense: 0 };
      switch (sortKey) {
        case 'name': cmp = a.name.localeCompare(b.name); break;
        case 'net': cmp = (sA.income - sA.expense) - (sB.income - sB.expense); break;
        case 'income': cmp = sA.income - sB.income; break;
        case 'expense': cmp = sA.expense - sB.expense; break;
        case 'theoretical': cmp = (stats.theoreticalAtEnd[a.id] ?? 0) - (stats.theoreticalAtEnd[b.id] ?? 0); break;
      }
      return sortOrder === 'desc' ? -cmp : cmp;
    });

    return result;
  }, [accounts, debouncedSearch, selectedAccountIds, sortKey, sortOrder, stats]);

  // Compute filtered totals based on displayed accounts
  const filteredTotals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const acc of displayedAccounts) {
      const s = stats.byAccount[acc.id];
      if (s) {
        income += s.income;
        expense += s.expense;
      }
    }
    return { income, expense, net: income - expense };
  }, [displayedAccounts, stats]);

  const activeFiltersCount = (debouncedSearch ? 1 : 0) + (selectedAccountIds.size > 0 ? 1 : 0);

  const clearAllFilters = () => {
    setSearchQuery('');
    setDebouncedSearch('');
    setSelectedAccountIds(new Set());
  };

  const toggleAccountFilter = (id: string) => {
    setSelectedAccountIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  if (accounts.length === 0) return (
    <Card className="border-border/50 shadow-[var(--shadow-card)] rounded-2xl">
      <CardContent className="py-12 text-center">
        <BarChart3 className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">{isFr ? 'Aucun compte créé' : 'No accounts created'}</p>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <Card className="border-border/50 shadow-[var(--shadow-card)] rounded-2xl">
        <CardContent className="p-4 space-y-3">
          {/* Row 1: Search + Period + Sort */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={isFr ? 'Rechercher un compte...' : 'Search accounts...'}
                className="pl-9 h-9 rounded-xl text-xs"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Period */}
            <Select value={period} onValueChange={(v) => setPeriod(v as PeriodKey)}>
              <SelectTrigger className="w-[160px] h-9 rounded-xl text-xs">
                <CalendarDays className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(periodLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Sort */}
            <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
              <SelectTrigger className="w-[140px] h-9 rounded-xl text-xs">
                <ArrowUpDown className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(sortLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={() => setSortOrder(o => o === 'asc' ? 'desc' : 'asc')}>
              <ArrowUpDown className={cn('w-4 h-4 transition-transform', sortOrder === 'desc' && 'rotate-180')} />
            </Button>
          </div>

          {/* Custom date pickers */}
          {period === 'custom' && (
            <div className="flex flex-wrap items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn('h-8 rounded-xl text-xs gap-1.5', !customFrom && 'text-muted-foreground')}>
                    <CalendarDays className="w-3.5 h-3.5" />
                    {customFrom ? format(customFrom, 'dd MMM yyyy', { locale: isFr ? fr : undefined }) : (isFr ? 'Début' : 'Start')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={customFrom} onSelect={setCustomFrom} initialFocus className={cn('p-3 pointer-events-auto')} />
                </PopoverContent>
              </Popover>
              <span className="text-xs text-muted-foreground">→</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn('h-8 rounded-xl text-xs gap-1.5', !customTo && 'text-muted-foreground')}>
                    <CalendarDays className="w-3.5 h-3.5" />
                    {customTo ? format(customTo, 'dd MMM yyyy', { locale: isFr ? fr : undefined }) : (isFr ? 'Fin' : 'End')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={customTo} onSelect={setCustomTo} initialFocus className={cn('p-3 pointer-events-auto')} />
                </PopoverContent>
              </Popover>
            </div>
          )}

          {/* Account chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-muted-foreground mr-1" />
            <Badge
              variant={selectedAccountIds.size === 0 ? 'default' : 'outline'}
              className="cursor-pointer text-[10px] rounded-lg h-6 px-2"
              onClick={() => setSelectedAccountIds(new Set())}
            >
              {isFr ? 'Tous' : 'All'} ({accounts.length})
            </Badge>
            {accounts.map(acc => (
              <Badge
                key={acc.id}
                variant={selectedAccountIds.has(acc.id) ? 'default' : 'outline'}
                className="cursor-pointer text-[10px] rounded-lg h-6 px-2 gap-1"
                onClick={() => toggleAccountFilter(acc.id)}
              >
                <span>{acc.icon}</span> {acc.name}
              </Badge>
            ))}
            {activeFiltersCount > 0 && (
              <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] text-muted-foreground" onClick={clearAllFilters}>
                <X className="w-3 h-3 mr-0.5" /> {isFr ? 'Réinitialiser' : 'Reset'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Global summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-border/50 shadow-[var(--shadow-card)] rounded-2xl">
          <CardContent className="p-4 text-center">
            <TrendingUp className="w-5 h-5 text-secondary mx-auto mb-1.5" />
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{t.income}</p>
            <p className="text-base font-bold text-secondary">{fmt(stats.totalIncome)}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 shadow-[var(--shadow-card)] rounded-2xl">
          <CardContent className="p-4 text-center">
            <TrendingDown className="w-5 h-5 text-destructive mx-auto mb-1.5" />
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{t.expenses}</p>
            <p className="text-base font-bold text-destructive">{fmt(stats.totalExpense)}</p>
          </CardContent>
        </Card>
        <Card className={cn("border-border/50 shadow-[var(--shadow-card)] rounded-2xl")}>
          <CardContent className="p-4 text-center">
            <Wallet className="w-5 h-5 mx-auto mb-1.5 text-muted-foreground" />
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{isFr ? 'Solde net' : 'Net balance'}</p>
            <p className={cn("text-base font-bold", net >= 0 ? 'text-secondary' : 'text-destructive')}>
              {net >= 0 ? '+' : ''}{fmt(net)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Per-account breakdown */}
      <Card className="border-border/50 shadow-[var(--shadow-card)] rounded-2xl">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold">
              {isFr ? 'Détail par compte' : 'Per account detail'}
              <span className="text-muted-foreground font-normal ml-1.5">({displayedAccounts.length})</span>
            </h3>
          </div>

          {displayedAccounts.length === 0 ? (
            <div className="py-8 text-center">
              <Search className="w-6 h-6 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">{isFr ? 'Aucun résultat' : 'No results'}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {displayedAccounts.map(acc => {
                const s = stats.byAccount[acc.id] || { income: 0, expense: 0 };
                const accNet = s.income - s.expense;
                const theoretical = stats.theoreticalAtEnd[acc.id] ?? 0;
                const realBalance = Number(acc.real_balance);
                const discrepancy = realBalance - theoretical;
                const hasActivity = s.income > 0 || s.expense > 0;

                return (
                  <div key={acc.id} className={cn(
                    "flex items-center justify-between px-3 py-2.5 rounded-xl border transition-colors",
                    hasActivity ? "border-border/30 bg-muted/10 hover:bg-muted/20" : "border-border/20 bg-muted/5 opacity-70"
                  )}>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-lg shrink-0">{acc.icon}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-bold truncate">{acc.name}</p>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          <span>{isFr ? 'Théorique' : 'Theoretical'}: <span className="font-semibold text-foreground">{fmt(theoretical)}</span></span>
                          {Math.abs(discrepancy) > 0.01 && (
                            <span className={cn("font-semibold", discrepancy > 0 ? 'text-secondary' : 'text-destructive')}>
                              ({isFr ? 'Écart' : 'Gap'}: {discrepancy > 0 ? '+' : ''}{fmt(discrepancy)})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-secondary">+{fmt(s.income)}</span>
                        <span className="text-destructive">-{fmt(s.expense)}</span>
                      </div>
                      <p className={cn("text-xs font-bold", accNet >= 0 ? 'text-secondary' : 'text-destructive')}>
                        {accNet >= 0 ? '+' : ''}{fmt(accNet)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
