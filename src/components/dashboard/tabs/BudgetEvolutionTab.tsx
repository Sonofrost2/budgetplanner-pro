import { useMemo, useState } from 'react';
import { useProfile } from '@/hooks/useProfile';
import { useLanguage } from '@/i18n/LanguageContext';
import { dashT } from '@/i18n/dashTranslations';
import { useBudgets, useAllTransactions, useCategories } from '@/hooks/useDashboardData';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { TrendingUp, Filter, Search, Inbox, CalendarDays } from 'lucide-react';
import { abbreviateNumber, cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CHART_PALETTE, CHART_TOOLTIP_BG, CHART_GRID } from '@/lib/chartColors';

type PeriodKey = '3m' | '6m' | '1y' | 'all' | 'custom';
type TypeFilter = 'expense' | 'income' | 'all';

const TOOLTIP_STYLE = {
  borderRadius: '12px', border: 'none', background: CHART_TOOLTIP_BG,
  boxShadow: '0 8px 32px rgba(0,0,0,0.12)', fontSize: '12px', padding: '8px 12px',
};

const COLORS = CHART_PALETTE;

const BudgetEvolutionTab = () => {
  const { locale } = useLanguage();
  const { fmt: fmtCurrency } = useProfile();
  const t = dashT[locale];
  const fmt = (n: number) => fmtCurrency(n, locale);
  const isFr = locale === 'fr';

  const { data: budgets = [] } = useBudgets();
  const { data: transactions = [] } = useAllTransactions();
  const { data: categories = [] } = useCategories();

  const [period, setPeriod] = useState<PeriodKey>('6m');
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('expense');
  const [selectedBudgetIds, setSelectedBudgetIds] = useState<Set<string>>(new Set());
  const [budgetSearch, setBudgetSearch] = useState('');

  const periodLabels: Record<PeriodKey, string> = {
    '3m': isFr ? '3 mois' : '3 months', '6m': isFr ? '6 mois' : '6 months',
    '1y': isFr ? '1 an' : '1 year', all: isFr ? 'Tout' : 'All', custom: isFr ? 'Personnalisé' : 'Custom',
  };

  const filteredBudgets = useMemo(() => {
    let b = budgets;
    if (typeFilter !== 'all') b = b.filter(bg => bg.budget_type === typeFilter);
    return b;
  }, [budgets, typeFilter]);

  const searchedBudgets = useMemo(() => {
    if (!budgetSearch.trim()) return filteredBudgets;
    const q = budgetSearch.toLowerCase();
    return filteredBudgets.filter(b => b.name.toLowerCase().includes(q));
  }, [filteredBudgets, budgetSearch]);

  const effectiveIds = useMemo(() => {
    const all = new Set(filteredBudgets.map(b => b.id));
    if (selectedBudgetIds.size === 0) return all;
    const valid = new Set<string>();
    selectedBudgetIds.forEach(id => { if (all.has(id)) valid.add(id); });
    return valid.size > 0 ? valid : all;
  }, [selectedBudgetIds, filteredBudgets]);

  const toggleBudget = (id: string) => {
    setSelectedBudgetIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const { chartData, activeBudgets } = useMemo(() => {
    const now = new Date();
    let startDate: Date;
    if (period === 'custom' && customFrom) {
      startDate = new Date(customFrom.getFullYear(), customFrom.getMonth(), 1);
    } else {
      switch (period) {
        case '3m': startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1); break;
        case '6m': startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1); break;
        case '1y': startDate = new Date(now.getFullYear() - 1, now.getMonth(), 1); break;
        default: startDate = new Date(2020, 0, 1);
      }
    }
    const endDate = (period === 'custom' && customTo) ? new Date(customTo.getFullYear(), customTo.getMonth() + 1, 0) : now;

    const active = filteredBudgets.filter(b => effectiveIds.has(b.id));

    // Build monthly buckets
    const months: { label: string; start: Date; end: Date }[] = [];
    const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    while (cursor <= endDate) {
      const mEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
      months.push({ label: cursor.toLocaleDateString(isFr ? 'fr-FR' : 'en-US', { month: 'short', year: '2-digit' }), start: new Date(cursor), end: mEnd });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    const data = months.map(m => {
      const row: Record<string, any> = { name: m.label };
      active.forEach(b => {
        // Sum transactions matching budget's category and type in this month
        const spent = transactions.filter(tx => {
          if (tx.category_id !== b.category_id) return false;
          if (tx.type !== b.budget_type) return false;
          const d = new Date(tx.date);
          return d >= m.start && d <= m.end;
        }).reduce((s, tx) => s + Number(tx.amount), 0);
        row[`spent_${b.id}`] = spent;
        row[`limit_${b.id}`] = Number(b.amount);
      });
      return row;
    });

    return { chartData: data, activeBudgets: active };
  }, [filteredBudgets, effectiveIds, transactions, period, customFrom, customTo, isFr]);

  const hasData = activeBudgets.length > 0 && chartData.length > 0;
  const selectedCount = selectedBudgetIds.size;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card className="border border-border/50 rounded-2xl">
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-wrap items-center gap-2">
            {/* Period */}
            <Select value={period} onValueChange={v => setPeriod(v as PeriodKey)}>
              <SelectTrigger className="h-10 w-40 rounded-xl text-sm font-medium border-border/40 bg-background/60 hover:bg-background/80 transition-colors">
                <CalendarDays className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(periodLabels).map(([k, label]) => <SelectItem key={k} value={k}>{label}</SelectItem>)}
              </SelectContent>
            </Select>

            {/* Custom dates */}
            {period === 'custom' && (
              <>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn("h-10 rounded-xl text-xs gap-1.5 min-w-[130px]", !customFrom && "text-muted-foreground")}>
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
                    <Button variant="outline" size="sm" className={cn("h-10 rounded-xl text-xs gap-1.5 min-w-[130px]", !customTo && "text-muted-foreground")}>
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

            {/* Type filter */}
            <Select value={typeFilter} onValueChange={v => { setTypeFilter(v as TypeFilter); setSelectedBudgetIds(new Set()); }}>
              <SelectTrigger className="h-10 w-36 rounded-xl text-sm font-medium border-border/40 bg-background/60 hover:bg-background/80 transition-colors">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="expense">📉 {t.expenseType}</SelectItem>
                <SelectItem value="income">📈 {t.incomeType}</SelectItem>
                <SelectItem value="all">📊 {t.all}</SelectItem>
              </SelectContent>
            </Select>

            {/* Budget filter popover */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-10 rounded-xl text-xs gap-1.5 min-w-[140px] font-medium border-border/40 bg-background/60 hover:bg-background/80 transition-colors">
                  <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                  {isFr ? 'Budgets' : 'Budgets'}
                  {selectedCount > 0 && <span className="ml-1 bg-primary/20 text-primary rounded-full px-1.5 py-0.5 text-[10px] font-bold">{selectedCount}</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="end">
                <div className="p-3 border-b border-border space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground">{isFr ? 'Filtrer les budgets' : 'Filter budgets'}</span>
                    <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={() => setSelectedBudgetIds(new Set())}>{isFr ? 'Tout' : 'All'}</Button>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input value={budgetSearch} onChange={e => setBudgetSearch(e.target.value)} placeholder={isFr ? 'Rechercher...' : 'Search...'} className="h-9 pl-8 text-sm rounded-lg" />
                  </div>
                </div>
                <ScrollArea className="h-72">
                  <div className="p-2 space-y-0.5">
                    {searchedBudgets.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">{isFr ? 'Aucun résultat' : 'No results'}</p>
                    ) : searchedBudgets.map(b => {
                      const cat = categories.find(c => c.id === b.category_id);
                      return (
                        <label key={b.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
                          <Checkbox checked={effectiveIds.has(b.id)} onCheckedChange={() => toggleBudget(b.id)} />
                          <span className="text-base">{cat?.icon || '📊'}</span>
                          <span className="text-sm truncate flex-1">{b.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>
          </div>
        </CardContent>
      </Card>

      {/* Chart */}
      <Card className="border border-border/50 shadow-[var(--shadow-card)] rounded-2xl">
        <CardContent className="p-4 sm:p-6">
          {!hasData ? (
            <div className="h-96 flex items-center justify-center">
              <div className="text-center">
                <Inbox className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">{t.noDataYet}</p>
                <p className="text-xs text-muted-foreground/60 mt-1">{isFr ? 'Ajustez les filtres ou créez des budgets' : 'Adjust filters or create budgets'}</p>
              </div>
            </div>
          ) : (
            <>
              <div className="h-[420px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} vertical={false} opacity={0.4} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => abbreviateNumber(v, locale)} />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      formatter={(v: number, name: string) => {
                        const isLimit = name.startsWith('limit_');
                        const bId = name.replace('spent_', '').replace('limit_', '');
                        const b = activeBudgets.find(bg => bg.id === bId);
                        const cat = b ? categories.find(c => c.id === b.category_id) : null;
                        const label = b ? `${cat?.icon || '📊'} ${b.name}` : name;
                        return [fmt(v), isLimit ? `${label} (${isFr ? 'Limite' : 'Limit'})` : label];
                      }}
                      labelStyle={{ fontWeight: 600, fontSize: 12 }}
                    />
                    {activeBudgets.map((b, i) => {
                      const cat = categories.find(c => c.id === b.category_id);
                      return [
                        <Bar key={`spent_${b.id}`} dataKey={`spent_${b.id}`} fill={cat?.color || COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} name={`spent_${b.id}`} />,
                        <Bar key={`limit_${b.id}`} dataKey={`limit_${b.id}`} fill={cat?.color || COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} name={`limit_${b.id}`} opacity={0.15} />,
                      ];
                    })}
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {/* Legend */}
              <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 mt-4 pt-4 border-t border-border/50">
                {activeBudgets.map((b, i) => {
                  const cat = categories.find(c => c.id === b.category_id);
                  return (
                    <div key={b.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="w-3 h-1.5 rounded-full" style={{ background: cat?.color || COLORS[i % COLORS.length] }} />
                      <span>{cat?.icon || '📊'} {b.name}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default BudgetEvolutionTab;
