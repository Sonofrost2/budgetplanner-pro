import { useMemo, useState } from 'react';
import { useProfile } from '@/hooks/useProfile';
import { useLanguage } from '@/i18n/LanguageContext';
import { dashT } from '@/i18n/dashTranslations';
import { useAllTransactions, useCategories } from '@/hooks/useDashboardData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { PieChart as PieChartIcon, TrendingUp, TrendingDown, Inbox, CalendarDays } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { abbreviateNumber, groupTopN, cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

import { CHART_PALETTE as COLORS } from '@/lib/chartColors';

const TOOLTIP_STYLE = {
  borderRadius: '12px',
  border: 'none',
  background: 'hsl(var(--card))',
  boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
  fontSize: '12px',
  padding: '8px 12px',
};

type PeriodKey = 'this_month' | 'last_month' | '3m' | '6m' | '1y' | 'all' | 'custom';

const TransactionsStatsTab = () => {
  const { locale } = useLanguage();
  const { fmt: fmtCurrency } = useProfile();
  const t = dashT[locale];
  const { data: transactions = [] } = useAllTransactions();
  const { data: categories = [] } = useCategories();
  const fmt = (n: number) => fmtCurrency(n, locale);
  const isFr = locale === 'fr';

  const [period, setPeriod] = useState<PeriodKey>('6m');
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();

  const periodLabels: Record<PeriodKey, string> = {
    this_month: isFr ? 'Ce mois' : 'This month',
    last_month: isFr ? 'Mois dernier' : 'Last month',
    '3m': isFr ? '3 mois' : '3 months',
    '6m': isFr ? '6 mois' : '6 months',
    '1y': isFr ? '1 an' : '1 year',
    all: isFr ? 'Tout' : 'All',
    custom: isFr ? 'Personnalisé' : 'Custom',
  };

  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    if (period === 'custom') {
      return { startDate: customFrom || new Date(now.getFullYear(), now.getMonth(), 1), endDate: customTo || now };
    }
    let start: Date;
    let end = new Date(now);
    switch (period) {
      case 'this_month': start = new Date(now.getFullYear(), now.getMonth(), 1); break;
      case 'last_month':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case '3m': start = new Date(now.getFullYear(), now.getMonth() - 3, 1); break;
      case '6m': start = new Date(now.getFullYear(), now.getMonth() - 6, 1); break;
      case '1y': start = new Date(now.getFullYear() - 1, now.getMonth(), 1); break;
      default: start = new Date(2000, 0, 1);
    }
    return { startDate: start, endDate: end };
  }, [period, customFrom, customTo]);

  const filteredTx = useMemo(() => {
    return transactions.filter(tx => {
      const d = new Date(tx.date);
      return d >= startDate && d <= endDate;
    });
  }, [transactions, startDate, endDate]);

  const totalIncome = filteredTx.filter(tx => tx.type === 'income').reduce((s, tx) => s + Number(tx.amount), 0);
  const totalExpense = filteredTx.filter(tx => tx.type === 'expense').reduce((s, tx) => s + Number(tx.amount), 0);

  const categoryData = useMemo(() => {
    const map: Record<string, { name: string; value: number; color: string }> = {};
    filteredTx.filter(tx => tx.type === 'expense').forEach(tx => {
      const cat = categories.find(c => c.id === tx.category_id);
      const name = cat ? `${cat.icon} ${cat.name}` : (isFr ? 'Sans catégorie' : 'Uncategorized');
      const color = cat?.color || '#94A3B8';
      if (!map[name]) map[name] = { name, value: 0, color };
      map[name].value += Number(tx.amount);
    });
    return Object.values(map).sort((a, b) => b.value - a.value);
  }, [filteredTx, categories, isFr]);

  const groupedCategoryData = useMemo(() => groupTopN(categoryData, 5, locale), [categoryData, locale]);
  const totalCat = groupedCategoryData.reduce((s, d) => s + d.value, 0);

  const monthlyData = useMemo(() => {
    const months: { month: string; income: number; expense: number }[] = [];
    // Determine month range from startDate to endDate
    const s = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const e = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
    const d = new Date(s);
    while (d <= e) {
      const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      const label = d.toLocaleDateString(isFr ? 'fr-FR' : 'en-US', { month: 'short' });
      let income = 0, expense = 0;
      filteredTx.forEach(tx => {
        const txDate = new Date(tx.date);
        if (txDate >= d && txDate <= mEnd) {
          if (tx.type === 'income') income += Number(tx.amount);
          else expense += Number(tx.amount);
        }
      });
      months.push({ month: label, income, expense });
      d.setMonth(d.getMonth() + 1);
    }
    return months;
  }, [filteredTx, startDate, endDate, isFr]);

  if (transactions.length === 0) {
    return (
      <Card className="border border-border/50 rounded-2xl">
        <CardContent className="py-12 text-center">
          <Inbox className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">{t.noDataYet}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={period} onValueChange={v => setPeriod(v as PeriodKey)}>
          <SelectTrigger className="h-9 w-[160px] rounded-xl text-xs font-medium">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(periodLabels).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {period === 'custom' && (
          <>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn('h-9 rounded-xl text-xs gap-1.5', !customFrom && 'text-muted-foreground')}>
                  <CalendarDays className="w-3.5 h-3.5" />
                  {customFrom ? format(customFrom, 'dd MMM yyyy', { locale: isFr ? fr : undefined }) : (isFr ? 'Début' : 'Start')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={customFrom} onSelect={setCustomFrom} initialFocus className={cn('p-3 pointer-events-auto')} />
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn('h-9 rounded-xl text-xs gap-1.5', !customTo && 'text-muted-foreground')}>
                  <CalendarDays className="w-3.5 h-3.5" />
                  {customTo ? format(customTo, 'dd MMM yyyy', { locale: isFr ? fr : undefined }) : (isFr ? 'Fin' : 'End')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={customTo} onSelect={setCustomTo} initialFocus className={cn('p-3 pointer-events-auto')} />
              </PopoverContent>
            </Popover>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border border-border/50 rounded-2xl">
          <CardContent className="p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">{t.income}</p>
            <p className="text-xl font-bold text-secondary flex items-center gap-1"><TrendingUp className="w-4 h-4" />{fmt(totalIncome)}</p>
          </CardContent>
        </Card>
        <Card className="border border-border/50 rounded-2xl">
          <CardContent className="p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">{t.expenses}</p>
            <p className="text-xl font-bold text-destructive flex items-center gap-1"><TrendingDown className="w-4 h-4" />{fmt(totalExpense)}</p>
          </CardContent>
        </Card>
        <Card className="border border-border/50 rounded-2xl">
          <CardContent className="p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">{isFr ? 'Solde net' : 'Net'}</p>
            <p className={`text-xl font-bold ${totalIncome - totalExpense >= 0 ? 'text-secondary' : 'text-destructive'}`}>{fmt(totalIncome - totalExpense)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie chart with external legend */}
        <Card className="border border-border/50 rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <PieChartIcon className="w-4 h-4 text-primary" />
              {t.expenseByCategory}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={groupedCategoryData}
                    cx="50%" cy="50%"
                    outerRadius={75} innerRadius={42}
                    dataKey="value"
                    stroke="hsl(var(--card))" strokeWidth={2}
                    animationDuration={1000}
                  >
                    {groupedCategoryData.map((d, i) => <Cell key={i} fill={d.color || COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmt(v)} contentStyle={TOOLTIP_STYLE} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* Legend */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-2">
              {groupedCategoryData.map((d, i) => {
                const pct = totalCat > 0 ? ((d.value / totalCat) * 100).toFixed(1) : '0';
                return (
                  <div key={i} className="flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color || COLORS[i % COLORS.length] }} />
                    <span className="text-xs text-muted-foreground truncate">{d.name}</span>
                    <span className="text-xs font-semibold ml-auto shrink-0">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Monthly bar chart */}
        <Card className="border border-border/50 rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold">{t.incomeVsExpenses}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => abbreviateNumber(v, locale)} />
                  <Tooltip formatter={(v: number) => fmt(v)} contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="income" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} name={t.income} />
                  <Bar dataKey="expense" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} name={t.expenses} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-6 mt-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="w-3 h-1 rounded-full bg-secondary" />
                {t.income}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="w-3 h-1 rounded-full bg-destructive" />
                {t.expenses}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TransactionsStatsTab;
