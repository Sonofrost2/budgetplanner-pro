import { useMemo, useState } from 'react';
import { useLanguage } from '@/i18n/LanguageContext';
import { useProfile } from '@/hooks/useProfile';
import { dashT } from '@/i18n/dashTranslations';
import { useAllTransactions, useCategories } from '@/hooks/useDashboardData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp, Filter, Inbox } from 'lucide-react';
import { abbreviateNumber } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

type PeriodKey = '3m' | '6m' | '1y' | 'all';
type TypeFilter = 'expense' | 'income' | 'all';

const PERIOD_OPTIONS: Record<string, Record<PeriodKey, string>> = {
  fr: { '3m': '3 mois', '6m': '6 mois', '1y': '1 an', all: 'Tout' },
  en: { '3m': '3 months', '6m': '6 months', '1y': '1 year', all: 'All' },
};

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
  const periods = PERIOD_OPTIONS[locale] || PERIOD_OPTIONS.en;

  const { data: transactions = [] } = useAllTransactions();
  const { data: categories = [] } = useCategories();

  const [period, setPeriod] = useState<PeriodKey>('6m');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('expense');
  const [selectedCatIds, setSelectedCatIds] = useState<Set<string>>(new Set());

  const filteredCategories = useMemo(() => {
    if (typeFilter === 'all') return categories;
    return categories.filter(c => c.type === typeFilter);
  }, [categories, typeFilter]);

  // Auto-select all when filter changes
  const effectiveCatIds = useMemo(() => {
    if (selectedCatIds.size === 0) return new Set(filteredCategories.map(c => c.id));
    const valid = new Set<string>();
    selectedCatIds.forEach(id => {
      if (filteredCategories.some(c => c.id === id)) valid.add(id);
    });
    return valid.size > 0 ? valid : new Set(filteredCategories.map(c => c.id));
  }, [selectedCatIds, filteredCategories]);

  const toggleCat = (id: string) => {
    setSelectedCatIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllCats = () => setSelectedCatIds(new Set(filteredCategories.map(c => c.id)));
  const clearAllCats = () => setSelectedCatIds(new Set());

  const { chartData, activeCats } = useMemo(() => {
    const now = new Date();
    let startDate: Date;
    switch (period) {
      case '3m': startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1); break;
      case '6m': startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1); break;
      case '1y': startDate = new Date(now.getFullYear() - 1, now.getMonth(), 1); break;
      default: startDate = new Date(2020, 0, 1);
    }

    // Filter transactions
    const filtered = transactions.filter(tx => {
      const d = new Date(tx.date);
      if (d < startDate) return false;
      if (typeFilter !== 'all' && tx.type !== typeFilter) return false;
      if (!tx.category_id || !effectiveCatIds.has(tx.category_id)) return false;
      return true;
    });

    // Build monthly buckets
    const months: string[] = [];
    const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    while (cursor <= now) {
      months.push(cursor.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', { month: 'short', year: '2-digit' }));
      cursor.setMonth(cursor.getMonth() + 1);
    }

    // Gather active categories
    const catIds = new Set<string>();
    filtered.forEach(tx => { if (tx.category_id) catIds.add(tx.category_id); });
    const cats = categories.filter(c => catIds.has(c.id));

    // Build data
    const data = months.map((label, i) => {
      const mStart = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
      const mEnd = new Date(mStart.getFullYear(), mStart.getMonth() + 1, 0);
      const row: Record<string, any> = { name: label };
      cats.forEach(c => {
        row[c.id] = 0;
      });
      filtered.forEach(tx => {
        const d = new Date(tx.date);
        if (d >= mStart && d <= mEnd && tx.category_id && catIds.has(tx.category_id)) {
          row[tx.category_id] = (row[tx.category_id] || 0) + Number(tx.amount);
        }
      });
      return row;
    });

    return { chartData: data, activeCats: cats };
  }, [transactions, categories, period, typeFilter, effectiveCatIds, locale]);

  const hasData = activeCats.length > 0 && chartData.length > 0;

  return (
    <Card className="border border-border/50 shadow-[var(--shadow-card)] rounded-2xl">
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5 text-primary" />
            </div>
            {locale === 'fr' ? 'Évolution des catégories' : 'Category Evolution'}
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            {/* Period filter */}
            <Select value={period} onValueChange={v => setPeriod(v as PeriodKey)}>
              <SelectTrigger className="h-8 w-28 rounded-lg text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(periods).map(([k, label]) => (
                  <SelectItem key={k} value={k}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Type filter */}
            <Select value={typeFilter} onValueChange={v => setTypeFilter(v as TypeFilter)}>
              <SelectTrigger className="h-8 w-28 rounded-lg text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="expense">{t.expenseType}</SelectItem>
                <SelectItem value="income">{t.incomeType}</SelectItem>
                <SelectItem value="all">{t.all}</SelectItem>
              </SelectContent>
            </Select>

            {/* Category group filter */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs gap-1.5">
                  <Filter className="w-3 h-3" />
                  {locale === 'fr' ? 'Catégories' : 'Categories'}
                  {selectedCatIds.size > 0 && selectedCatIds.size < filteredCategories.length && (
                    <span className="ml-1 bg-primary/20 text-primary rounded-full px-1.5 text-[10px] font-bold">
                      {selectedCatIds.size}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-0" align="end">
                <div className="p-2 border-b border-border flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">
                    {locale === 'fr' ? 'Filtrer les catégories' : 'Filter categories'}
                  </span>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={selectAllCats}>
                      {locale === 'fr' ? 'Tout' : 'All'}
                    </Button>
                    <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={clearAllCats}>
                      {locale === 'fr' ? 'Aucun' : 'None'}
                    </Button>
                  </div>
                </div>
                <ScrollArea className="max-h-56">
                  <div className="p-2 space-y-1">
                    {filteredCategories.map(cat => (
                      <label key={cat.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/50 cursor-pointer">
                        <Checkbox
                          checked={effectiveCatIds.has(cat.id)}
                          onCheckedChange={() => toggleCat(cat.id)}
                        />
                        <span className="w-5 h-5 rounded-md flex items-center justify-center text-xs" style={{ background: cat.color + '20' }}>
                          {cat.icon}
                        </span>
                        <span className="text-xs truncate">{cat.name}</span>
                      </label>
                    ))}
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="h-64 flex items-center justify-center">
            <div className="text-center">
              <Inbox className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-xs text-muted-foreground">{t.noTransactions}</p>
            </div>
          </div>
        ) : (
          <>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    {activeCats.map(cat => (
                      <linearGradient key={cat.id} id={`grad-${cat.id}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={cat.color} stopOpacity={0.15} />
                        <stop offset="95%" stopColor={cat.color} stopOpacity={0} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(225, 15%, 88%)" vertical={false} opacity={0.4} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => abbreviateNumber(v, locale)} />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(v: number, name: string) => {
                      const cat = activeCats.find(c => c.id === name);
                      return [fmt(v), cat ? `${cat.icon} ${cat.name}` : name];
                    }}
                    labelStyle={{ fontWeight: 600, fontSize: 11 }}
                  />
                  {activeCats.map(cat => (
                    <Area
                      key={cat.id}
                      type="monotone"
                      dataKey={cat.id}
                      stroke={cat.color}
                      fill={`url(#grad-${cat.id})`}
                      strokeWidth={2}
                      name={cat.id}
                      animationDuration={800}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
            {/* Legend */}
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 mt-3">
              {activeCats.map(cat => (
                <div key={cat.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="w-3 h-1 rounded-full" style={{ background: cat.color }} />
                  {cat.icon} {cat.name}
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default CategoryEvolutionChart;
