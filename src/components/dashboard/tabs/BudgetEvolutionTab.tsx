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
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, ReferenceLine, ComposedChart, Line } from 'recharts';
import { Filter, Search, Inbox, CalendarDays, AlertTriangle, Target } from 'lucide-react';
import { abbreviateNumber, cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CHART_PALETTE, CHART_GRID, CHART_TOOLTIP_STYLE, CHART_TOOLTIP_LABEL_STYLE, CHART_TOOLTIP_ITEM_STYLE } from '@/lib/chartColors';
import { Badge } from '@/components/ui/badge';
import { chartA11yProps } from '@/lib/a11y';

// Convert any budget-period amount into a monthly equivalent so weekly,
// quarterly or yearly limits are directly comparable to the monthly
// consumption plotted next to them.
const MONTHLY_FACTOR: Record<string, number> = {
  daily: 365 / 12,      // ≈ 30.42
  weekly: 52 / 12,      // ≈ 4.333
  monthly: 1,
  quarterly: 1 / 3,
  semi_annual: 1 / 6,
  yearly: 1 / 12,
};
const toMonthly = (amount: number, period: string) =>
  amount * (MONTHLY_FACTOR[period] ?? 1);

type PeriodKey = '3m' | '6m' | '1y' | 'all' | 'custom';
type TypeFilter = 'expense' | 'income' | 'all';
type ViewMode = 'grouped' | 'overlay';

const TOOLTIP_STYLE = CHART_TOOLTIP_STYLE;

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
  const [viewMode, setViewMode] = useState<ViewMode>('grouped');

  const periodLabels: Record<PeriodKey, string> = {
    '3m': isFr ? '3 mois' : '3 months', '6m': isFr ? '6 mois' : '6 months',
    '1y': isFr ? '1 an' : '1 year', all: isFr ? 'Tout' : 'All', custom: isFr ? 'Personnalisé' : 'Custom',
  };

  const filteredBudgets = useMemo(() => {
    let b = budgets;
    if (typeFilter !== 'all') b = b.filter(bg => bg.budget_type === typeFilter);
    // Exclude archived budgets from the evolution chart
    b = b.filter(bg => !(bg as any).archived_at);
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

  const { chartData, activeBudgets, sharedCategoryIds, savingsLinkedIds, currentMonthLabel } = useMemo(() => {
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

    // Detect budgets that share a category (client-side aggregation cannot
    // disambiguate them — warn the user).
    const catCount = new Map<string, number>();
    active.forEach(b => {
      if (!b.category_id) return;
      catCount.set(b.category_id, (catCount.get(b.category_id) || 0) + 1);
    });
    const sharedIds = new Set(active.filter(b => b.category_id && (catCount.get(b.category_id) || 0) > 1).map(b => b.id));
    const savingsIds = new Set(active.filter(b => !!(b as any).linked_savings_goal_id).map(b => b.id));

    // Build monthly buckets
    const months: { label: string; start: Date; end: Date }[] = [];
    const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    while (cursor <= endDate) {
      const mEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
      months.push({ label: cursor.toLocaleDateString(isFr ? 'fr-FR' : 'en-US', { month: 'short', year: '2-digit' }), start: new Date(cursor), end: mEnd });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    const currentLabel = now.toLocaleDateString(isFr ? 'fr-FR' : 'en-US', { month: 'short', year: '2-digit' });

    const data = months.map(m => {
      const row: Record<string, any> = { name: m.label };
      row.__isCurrent = m.label === currentLabel;
      active.forEach(b => {
        // Sum transactions matching budget's category and type in this month.
        // Transfers (`is_transfer=true`) are explicitly excluded to keep the
        // chart aligned with the RPC-based consumption used elsewhere.
        const spent = transactions.filter(tx => {
          if ((tx as any).is_transfer === true) return false;
          if (tx.category_id !== b.category_id) return false;
          if (tx.type !== b.budget_type) return false;
          const d = new Date(tx.date);
          return d >= m.start && d <= m.end;
        }).reduce((s, tx) => s + Number(tx.amount), 0);
        row[`spent_${b.id}`] = spent;
        // Normalize the limit to a monthly equivalent so weekly/quarterly/
        // yearly budgets are directly comparable to monthly consumption.
        row[`limit_${b.id}`] = Math.round(toMonthly(Number(b.amount), b.period || 'monthly'));
      });
      return row;
    });

    return {
      chartData: data,
      activeBudgets: active,
      sharedCategoryIds: sharedIds,
      savingsLinkedIds: savingsIds,
      currentMonthLabel: currentLabel,
    };
  }, [filteredBudgets, effectiveIds, transactions, period, customFrom, customTo, isFr]);

  const hasData = activeBudgets.length > 0 && chartData.length > 0;
  const selectedCount = selectedBudgetIds.size;
  const hasWarnings = sharedCategoryIds.size > 0 || savingsLinkedIds.size > 0;

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

            {/* View mode toggle */}
            <div className="ml-auto flex items-center gap-1 p-0.5 rounded-xl bg-muted/40 border border-border/40">
              <Button
                size="sm"
                variant={viewMode === 'grouped' ? 'default' : 'ghost'}
                className="h-8 rounded-lg text-[11px] px-2.5"
                onClick={() => setViewMode('grouped')}
              >
                {isFr ? 'Barres' : 'Bars'}
              </Button>
              <Button
                size="sm"
                variant={viewMode === 'overlay' ? 'default' : 'ghost'}
                className="h-8 rounded-lg text-[11px] px-2.5"
                onClick={() => setViewMode('overlay')}
              >
                {isFr ? 'Réel + Limite' : 'Actual + Limit'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {hasWarnings && hasData && (
        <div className="flex flex-wrap gap-2 text-[11px]">
          {sharedCategoryIds.size > 0 && (
            <Badge variant="outline" className="gap-1.5 border-accent/40 text-accent bg-accent/5">
              <AlertTriangle className="w-3 h-3" />
              {isFr
                ? `${sharedCategoryIds.size} budget(s) partagent une catégorie — le réel est agrégé`
                : `${sharedCategoryIds.size} budget(s) share a category — actual is aggregated`}
            </Badge>
          )}
          {savingsLinkedIds.size > 0 && (
            <Badge variant="outline" className="gap-1.5 border-primary/40 text-primary bg-primary/5">
              <Target className="w-3 h-3" />
              {isFr
                ? `${savingsLinkedIds.size} budget(s) liés à une épargne — réel approché par catégorie`
                : `${savingsLinkedIds.size} budget(s) linked to savings — actual approximated`}
            </Badge>
          )}
        </div>
      )}

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
              <div
                className="h-[420px]"
                {...chartA11yProps(
                  isFr ? 'Évolution mensuelle des budgets' : 'Monthly budget evolution',
                  isFr
                    ? `${activeBudgets.length} budget(s) suivis sur ${chartData.length} mois. Mode ${viewMode === 'grouped' ? 'barres' : 'réel + limite'}.`
                    : `${activeBudgets.length} budget(s) tracked across ${chartData.length} months. ${viewMode === 'grouped' ? 'Bars' : 'Actual + limit'} view.`,
                )}
              >
                <ResponsiveContainer width="100%" height="100%">
                  {viewMode === 'grouped' ? (
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} vertical={false} opacity={0.4} />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} tickFormatter={v => abbreviateNumber(v, locale)} />
                      <Tooltip
                        contentStyle={TOOLTIP_STYLE}
                        labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                        itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                        cursor={{ fill: 'hsl(var(--muted) / 0.4)' }}
                        formatter={(v: number, name: string) => {
                          const isLimit = name.startsWith('limit_');
                          const bId = name.replace('spent_', '').replace('limit_', '');
                          const b = activeBudgets.find(bg => bg.id === bId);
                          const cat = b ? categories.find(c => c.id === b.category_id) : null;
                          const label = b ? `${cat?.icon || '📊'} ${b.name}` : name;
                          return [fmt(v), isLimit ? `${label} (${isFr ? 'Limite/mois' : 'Limit/mo'})` : label];
                        }}
                        labelStyle={{ fontWeight: 600, fontSize: 12 }}
                      />
                      {chartData.some(d => d.__isCurrent) && (
                        <ReferenceLine
                          x={currentMonthLabel}
                          stroke="hsl(var(--accent))"
                          strokeDasharray="4 4"
                          label={{ value: isFr ? 'En cours' : 'Current', fill: 'hsl(var(--accent))', fontSize: 10, position: 'top' }}
                        />
                      )}
                      {activeBudgets.map((b, i) => {
                        const cat = categories.find(c => c.id === b.category_id);
                        return (
                          <Bar
                            key={`spent_${b.id}`}
                            dataKey={`spent_${b.id}`}
                            fill={cat?.color || COLORS[i % COLORS.length]}
                            radius={[4, 4, 0, 0]}
                            name={`spent_${b.id}`}
                          />
                        );
                      })}
                    </BarChart>
                  ) : (
                    <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} vertical={false} opacity={0.4} />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} tickFormatter={v => abbreviateNumber(v, locale)} />
                      <Tooltip
                        contentStyle={TOOLTIP_STYLE}
                        labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                        itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                        cursor={{ fill: 'hsl(var(--muted) / 0.4)' }}
                        formatter={(v: number, name: string) => {
                          const isLimit = name.startsWith('limit_');
                          const bId = name.replace('spent_', '').replace('limit_', '');
                          const b = activeBudgets.find(bg => bg.id === bId);
                          const cat = b ? categories.find(c => c.id === b.category_id) : null;
                          const label = b ? `${cat?.icon || '📊'} ${b.name}` : name;
                          return [fmt(v), isLimit ? `${label} (${isFr ? 'Limite/mois' : 'Limit/mo'})` : label];
                        }}
                        labelStyle={{ fontWeight: 600, fontSize: 12 }}
                      />
                      {chartData.some(d => d.__isCurrent) && (
                        <ReferenceLine
                          x={currentMonthLabel}
                          stroke="hsl(var(--accent))"
                          strokeDasharray="4 4"
                          label={{ value: isFr ? 'En cours' : 'Current', fill: 'hsl(var(--accent))', fontSize: 10, position: 'top' }}
                        />
                      )}
                      {activeBudgets.map((b, i) => {
                        const cat = categories.find(c => c.id === b.category_id);
                        const color = cat?.color || COLORS[i % COLORS.length];
                        return [
                          <Bar
                            key={`spent_${b.id}`}
                            dataKey={`spent_${b.id}`}
                            fill={color}
                            radius={[4, 4, 0, 0]}
                            name={`spent_${b.id}`}
                          />,
                          <Line
                            key={`limit_${b.id}`}
                            type="monotone"
                            dataKey={`limit_${b.id}`}
                            stroke={color}
                            strokeDasharray="5 4"
                            strokeWidth={1.5}
                            dot={false}
                            name={`limit_${b.id}`}
                          />,
                        ];
                      })}
                    </ComposedChart>
                  )}
                </ResponsiveContainer>
              </div>
              {/* Legend */}
              <ul
                aria-label={isFr ? 'Légende du graphique' : 'Chart legend'}
                className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 mt-4 pt-4 border-t border-border/50 list-none"
              >
                {activeBudgets.map((b, i) => {
                  const cat = categories.find(c => c.id === b.category_id);
                  return (
                    <li key={b.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span aria-hidden="true" className="w-3 h-1.5 rounded-full" style={{ background: cat?.color || COLORS[i % COLORS.length] }} />
                      <span>{cat?.icon || '📊'} {b.name}</span>
                      {sharedCategoryIds.has(b.id) && (
                        <AlertTriangle
                          className="w-3 h-3 text-accent"
                          aria-label={isFr ? 'Catégorie partagée entre plusieurs budgets' : 'Category shared across budgets'}
                        />
                      )}
                      {savingsLinkedIds.has(b.id) && (
                        <Target
                          className="w-3 h-3 text-primary"
                          aria-label={isFr ? 'Budget lié à une épargne' : 'Budget linked to a savings goal'}
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default BudgetEvolutionTab;
