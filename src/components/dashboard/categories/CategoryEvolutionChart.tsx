import { useMemo, useState } from 'react';
import { useLanguage } from '@/i18n/LanguageContext';
import { useProfile } from '@/hooks/useProfile';
import { dashT } from '@/i18n/dashTranslations';
import { useAllTransactions, useCategories } from '@/hooks/useDashboardData';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Search, Filter, Inbox, CalendarDays } from 'lucide-react';
import { abbreviateNumber } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

type PeriodKey = '3m' | '6m' | '1y' | 'all' | 'custom';
type TypeFilter = 'expense' | 'income' | 'all';

const TOOLTIP_STYLE = {
  borderRadius: '12px',
  border: 'none',
  background: 'hsl(var(--card))',
  boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
  fontSize: '12px',
  padding: '8px 12px',
};

const CategoryEvolutionChart = () => {
  const { locale } = useLanguage();
  const { fmt: fmtCurrency } = useProfile();
  const t = dashT[locale];
  const fmt = (n: number) => fmtCurrency(n, locale);
  const isFr = locale === 'fr';

  const { data: transactions = [] } = useAllTransactions();
  const { data: categories = [] } = useCategories();

  const [period, setPeriod] = useState<PeriodKey>('6m');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('expense');
  const [selectedCatIds, setSelectedCatIds] = useState<Set<string>>(new Set());
  const [catSearch, setCatSearch] = useState('');
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();

  const periodOptions: { value: PeriodKey; label: string }[] = [
    { value: '3m', label: isFr ? '3 mois' : '3 months' },
    { value: '6m', label: isFr ? '6 mois' : '6 months' },
    { value: '1y', label: isFr ? '1 an' : '1 year' },
    { value: 'all', label: isFr ? 'Tout' : 'All' },
    { value: 'custom', label: isFr ? 'Personnalisé' : 'Custom' },
  ];

  const filteredCategories = useMemo(() => {
    let cats = categories;
    if (typeFilter !== 'all') cats = cats.filter(c => c.type === typeFilter);
    return cats;
  }, [categories, typeFilter]);

  const searchedCategories = useMemo(() => {
    if (!catSearch.trim()) return filteredCategories;
    const q = catSearch.toLowerCase();
    return filteredCategories.filter(c => c.name.toLowerCase().includes(q));
  }, [filteredCategories, catSearch]);

  // Effective selected IDs: if none selected, show all filtered
  const effectiveCatIds = useMemo(() => {
    const validIds = new Set(filteredCategories.map(c => c.id));
    if (selectedCatIds.size === 0) return validIds;
    const intersection = new Set<string>();
    selectedCatIds.forEach(id => { if (validIds.has(id)) intersection.add(id); });
    return intersection.size > 0 ? intersection : validIds;
  }, [selectedCatIds, filteredCategories]);

  const toggleCat = (id: string) => {
    setSelectedCatIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllCats = () => setSelectedCatIds(new Set());
  const clearAllCats = () => setSelectedCatIds(new Set(['__none__']));

  const { chartData, activeCats } = useMemo(() => {
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

    const filtered = transactions.filter(tx => {
      const d = new Date(tx.date);
      if (d < startDate || d > endDate) return false;
      if (typeFilter !== 'all' && tx.type !== typeFilter) return false;
      if (!tx.category_id || !effectiveCatIds.has(tx.category_id)) return false;
      return true;
    });

    const months: { label: string; start: Date; end: Date }[] = [];
    const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    while (cursor <= endDate) {
      const mEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
      months.push({
        label: cursor.toLocaleDateString(isFr ? 'fr-FR' : 'en-US', { month: 'short', year: '2-digit' }),
        start: new Date(cursor),
        end: mEnd,
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    const catIds = new Set<string>();
    filtered.forEach(tx => { if (tx.category_id) catIds.add(tx.category_id); });
    const cats = categories.filter(c => catIds.has(c.id));

    const data = months.map(m => {
      const row: Record<string, any> = { name: m.label };
      cats.forEach(c => { row[c.id] = 0; });
      filtered.forEach(tx => {
        const d = new Date(tx.date);
        if (d >= m.start && d <= m.end && tx.category_id && catIds.has(tx.category_id)) {
          row[tx.category_id] = (row[tx.category_id] || 0) + Number(tx.amount);
        }
      });
      return row;
    });

    return { chartData: data, activeCats: cats };
  }, [transactions, categories, period, typeFilter, effectiveCatIds, isFr, customFrom, customTo]);

  const hasData = activeCats.length > 0 && chartData.length > 0;
  const selectedCount = selectedCatIds.size > 0 && !selectedCatIds.has('__none__') ? selectedCatIds.size : 0;

  return (
    <div className="space-y-4">
      {/* Filters bar */}
      <Card className="border border-border/50 rounded-2xl">
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-wrap items-center gap-2">
            {/* Period */}
            <Select value={period} onValueChange={v => setPeriod(v as PeriodKey)}>
              <SelectTrigger className="h-9 w-32 rounded-xl text-xs font-medium">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {periodOptions.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Custom date pickers */}
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
                    <Calendar
                      mode="single"
                      selected={customFrom}
                      onSelect={setCustomFrom}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                      locale={isFr ? fr : undefined}
                    />
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
                    <Calendar
                      mode="single"
                      selected={customTo}
                      onSelect={setCustomTo}
                      disabled={d => customFrom ? d < customFrom : false}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                      locale={isFr ? fr : undefined}
                    />
                  </PopoverContent>
                </Popover>
              </>
            )}

            {/* Type */}
            <Select value={typeFilter} onValueChange={v => { setTypeFilter(v as TypeFilter); setSelectedCatIds(new Set()); }}>
              <SelectTrigger className="h-9 w-28 rounded-xl text-xs font-medium">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="expense">{t.expenseType}</SelectItem>
                <SelectItem value="income">{t.incomeType}</SelectItem>
                <SelectItem value="all">{t.all}</SelectItem>
              </SelectContent>
            </Select>

            {/* Category selector */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 rounded-xl text-xs gap-1.5">
                  <Filter className="w-3.5 h-3.5" />
                  {isFr ? 'Catégories' : 'Categories'}
                  {selectedCount > 0 && (
                    <span className="ml-1 bg-primary/20 text-primary rounded-full px-1.5 py-0.5 text-[10px] font-bold">
                      {selectedCount}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-0" align="end">
                <div className="p-2 border-b border-border space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground">
                      {isFr ? 'Filtrer les catégories' : 'Filter categories'}
                    </span>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={selectAllCats}>
                        {isFr ? 'Tout' : 'All'}
                      </Button>
                      <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={clearAllCats}>
                        {isFr ? 'Aucun' : 'None'}
                      </Button>
                    </div>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      value={catSearch}
                      onChange={e => setCatSearch(e.target.value)}
                      placeholder={isFr ? 'Rechercher...' : 'Search...'}
                      className="h-8 pl-8 text-xs rounded-lg"
                    />
                  </div>
                </div>
                <ScrollArea className="max-h-64">
                  <div className="p-2 space-y-0.5">
                    {searchedCategories.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">{isFr ? 'Aucun résultat' : 'No results'}</p>
                    ) : searchedCategories.map(cat => (
                      <label key={cat.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
                        <Checkbox
                          checked={effectiveCatIds.has(cat.id) && !selectedCatIds.has('__none__')}
                          onCheckedChange={() => toggleCat(cat.id)}
                        />
                        <span className="w-6 h-6 rounded-lg flex items-center justify-center text-sm" style={{ background: cat.color + '20' }}>
                          {cat.icon}
                        </span>
                        <span className="text-xs truncate flex-1">{cat.name}</span>
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: cat.color }} />
                      </label>
                    ))}
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
                <p className="text-sm text-muted-foreground">{t.noTransactions}</p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  {isFr ? 'Ajustez les filtres ou la période' : 'Adjust filters or period'}
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="h-[420px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      {activeCats.map(cat => (
                        <linearGradient key={cat.id} id={`evo-${cat.id}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={cat.color} stopOpacity={0.2} />
                          <stop offset="95%" stopColor={cat.color} stopOpacity={0} />
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(225, 15%, 88%)" vertical={false} opacity={0.4} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => abbreviateNumber(v, locale)} />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      formatter={(v: number, name: string) => {
                        const cat = activeCats.find(c => c.id === name);
                        return [fmt(v), cat ? `${cat.icon} ${cat.name}` : name];
                      }}
                      labelStyle={{ fontWeight: 600, fontSize: 12 }}
                    />
                    {activeCats.map(cat => (
                      <Area
                        key={cat.id}
                        type="monotone"
                        dataKey={cat.id}
                        stroke={cat.color}
                        fill={`url(#evo-${cat.id})`}
                        strokeWidth={2.5}
                        name={cat.id}
                        animationDuration={800}
                      />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              {/* Legend */}
              <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 mt-4 pt-4 border-t border-border/50">
                {activeCats.map(cat => (
                  <div key={cat.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="w-3 h-1.5 rounded-full" style={{ background: cat.color }} />
                    <span>{cat.icon} {cat.name}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CategoryEvolutionChart;
