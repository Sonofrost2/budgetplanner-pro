import { useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useLanguage } from '@/i18n/LanguageContext';
import { dashT } from '@/i18n/dashTranslations';
import { useBudgets, useCategories } from '@/hooks/useDashboardData';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { PieChart as PieChartIcon, AlertTriangle, CheckCircle, TrendingUp, TrendingDown, Calendar as CalendarIcon, CalendarDays } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { abbreviateNumber, cn } from '@/lib/utils';
import { getBudgetPeriodBounds, computeBudgetProjection, formatDateStr } from '@/lib/budgetProjection';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const TOOLTIP_STYLE = {
  borderRadius: '12px',
  border: 'none',
  background: 'hsl(var(--card))',
  boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
  fontSize: '12px',
  padding: '8px 12px',
};

type AnalysisPeriod = 'current' | 'last_month' | 'last_3' | 'last_6' | 'last_year' | 'custom';

const BudgetAnalysisTab = () => {
  const { user } = useAuth();
  const { locale } = useLanguage();
  const { fmt: fmtCurrency } = useProfile();
  const t = dashT[locale];
  const isFr = locale === 'fr';
  const { data: budgets = [] } = useBudgets();
  const fmt = (n: number) => fmtCurrency(n, locale);

  const [analysisPeriod, setAnalysisPeriod] = useState<AnalysisPeriod>('current');
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();

  const periodLabels: Record<AnalysisPeriod, string> = {
    current: t.currentPeriod,
    last_month: t.lastMonth,
    last_3: t.last3Months,
    last_6: t.last6Months,
    last_year: t.lastYear,
    custom: isFr ? 'Personnalisé' : 'Custom',
  };

  // Compute period ranges for each budget based on analysis period
  const periodRanges = useMemo(() => {
    const now = new Date();
    return budgets.map(b => {
      let offset = 0;
      if (analysisPeriod === 'last_month') offset = 1;

      const { periodStart, periodEnd } = getBudgetPeriodBounds(
        b.period || 'monthly', now, b.reference_date, offset
      );

      let start = formatDateStr(periodStart);
      let end = formatDateStr(periodEnd);

      if (analysisPeriod === 'last_3') {
        const d = new Date(now); d.setMonth(d.getMonth() - 3);
        start = formatDateStr(new Date(d.getFullYear(), d.getMonth(), 1));
        end = formatDateStr(new Date(now.getFullYear(), now.getMonth() + 1, 0));
      } else if (analysisPeriod === 'last_6') {
        const d = new Date(now); d.setMonth(d.getMonth() - 6);
        start = formatDateStr(new Date(d.getFullYear(), d.getMonth(), 1));
        end = formatDateStr(new Date(now.getFullYear(), now.getMonth() + 1, 0));
      } else if (analysisPeriod === 'last_year') {
        start = `${now.getFullYear() - 1}-01-01`;
        end = `${now.getFullYear()}-12-31`;
      } else if (analysisPeriod === 'custom' && customFrom && customTo) {
        start = formatDateStr(customFrom);
        end = formatDateStr(customTo);
      }

      return {
        id: b.id,
        category_id: b.category_id,
        type: (b as any).budget_type === 'income' ? 'income' : 'expense',
        start, end,
        periodStart: new Date(start),
        periodEnd: new Date(end),
      };
    });
  }, [budgets, analysisPeriod, customFrom, customTo]);

  // Fetch spending for each budget
  const { data: spending = {} } = useQuery({
    queryKey: ['budget-analysis-spending', user?.id, analysisPeriod, customFrom?.toISOString(), customTo?.toISOString(), periodRanges.map(r => r.id).join(',')],
    queryFn: async () => {
      const map: Record<string, number> = {};
      await Promise.all(periodRanges.filter(r => r.category_id).map(async r => {
        const { data } = await supabase.rpc('get_budget_spending', {
          p_user_id: user!.id, p_category_id: r.category_id!, p_type: r.type,
          p_start_date: r.start, p_end_date: r.end,
        });
        if (data !== null) map[r.id] = Number(data);
      }));
      return map;
    },
    enabled: !!user && periodRanges.length > 0,
    staleTime: 30_000,
  });

  const expenseBudgets = budgets.filter(b => (b as any).budget_type !== 'income');
  const now = new Date();

  // Compute projections for each budget
  const budgetAnalysis = useMemo(() => {
    return expenseBudgets.map(b => {
      const actual = spending[b.id] || 0;
      const amount = Number(b.amount);
      const range = periodRanges.find(r => r.id === b.id);
      if (!range) return { budget: b, actual, amount, pct: 0, projection: 0, dailyRate: 0, paceLabel: 'on_track' as const, daysLeft: 0, variance: 0 };

      const daysElapsed = Math.max(1, Math.floor((now.getTime() - range.periodStart.getTime()) / 86400000) + 1);
      const daysTotal = Math.max(1, Math.floor((range.periodEnd.getTime() - range.periodStart.getTime()) / 86400000) + 1);
      const daysLeft = Math.max(0, Math.floor((range.periodEnd.getTime() - now.getTime()) / 86400000));
      const pct = amount > 0 ? Math.min((actual / amount) * 100, 100) : 0;

      const isMax = (b as any).control_type !== 'min';
      const proj = computeBudgetProjection(actual, daysElapsed, daysLeft, daysTotal, amount, actual, daysElapsed, isMax);

      // Variance = budget - actual (positive = saving, negative = overspend) for max budgets
      // For min budgets: actual - budget (positive = on track, negative = under target)
      const variance = isMax ? amount - actual : actual - amount;

      return {
        budget: b,
        actual,
        amount,
        pct,
        projection: proj.projection,
        dailyRate: proj.dailyRate,
        paceLabel: proj.paceLabel,
        daysLeft,
        variance,
      };
    });
  }, [expenseBudgets, spending, periodRanges, now]);

  // Global summary
  const summary = useMemo(() => {
    const totalBudgeted = budgetAnalysis.reduce((s, a) => s + a.amount, 0);
    const totalConsumed = budgetAnalysis.reduce((s, a) => s + a.actual, 0);
    const overBudgetCount = budgetAnalysis.filter(a => a.variance < 0).length;
    const onTrackCount = budgetAnalysis.length - overBudgetCount;
    const totalSavings = budgetAnalysis.filter(a => a.variance > 0).reduce((s, a) => s + a.variance, 0);
    const totalOverspend = budgetAnalysis.filter(a => a.variance < 0).reduce((s, a) => s + Math.abs(a.variance), 0);
    const netVariance = totalSavings - totalOverspend;
    return { totalBudgeted, totalConsumed, overBudgetCount, onTrackCount, totalSavings, totalOverspend, netVariance };
  }, [budgetAnalysis]);

  const chartData = budgetAnalysis.map(a => ({
    name: a.budget.name.length > 12 ? a.budget.name.slice(0, 12) + '…' : a.budget.name,
    budget: a.amount,
    actual: a.actual,
    projection: Math.round(a.projection),
  }));

  const paceLabels = {
    fast: { label: t.paceFast, color: 'text-destructive', bg: 'bg-destructive/10' },
    slow: { label: t.paceSlow, color: 'text-muted-foreground', bg: 'bg-muted/50' },
    on_track: { label: t.paceOnTrack, color: 'text-secondary', bg: 'bg-secondary/10' },
  };

  if (budgets.length === 0) {
    return (
      <Card className="border border-border/50 rounded-2xl">
        <CardContent className="py-12 text-center">
          <PieChartIcon className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">{t.noDataYet}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <CalendarIcon className="w-4 h-4 text-muted-foreground" />
          {t.budgetAnalysis}
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={analysisPeriod} onValueChange={(v) => setAnalysisPeriod(v as AnalysisPeriod)}>
            <SelectTrigger className="w-[180px] h-8 rounded-xl text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(periodLabels).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {analysisPeriod === 'custom' && (
            <>
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
            </>
          )}
        </div>
      </div>

      {/* Global summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border border-border/50 rounded-2xl">
          <CardContent className="p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">{t.totalBudgeted}</p>
            <p className="text-lg font-bold">{fmt(summary.totalBudgeted)}</p>
          </CardContent>
        </Card>
        <Card className="border border-border/50 rounded-2xl">
          <CardContent className="p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">{t.totalConsumed}</p>
            <p className="text-lg font-bold">{fmt(summary.totalConsumed)}</p>
            <p className="text-[10px] text-muted-foreground">
              {summary.totalBudgeted > 0 ? Math.round((summary.totalConsumed / summary.totalBudgeted) * 100) : 0}%
            </p>
          </CardContent>
        </Card>
        <Card className="border border-border/50 rounded-2xl">
          <CardContent className="p-4 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-secondary" />
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">{t.onTrack}</p>
              <p className="text-lg font-bold text-secondary">{summary.onTrackCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-border/50 rounded-2xl">
          <CardContent className="p-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">{t.budgetsInAlert}</p>
              <p className="text-lg font-bold text-destructive">{summary.overBudgetCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Savings vs overspend summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="border border-border/50 rounded-2xl">
          <CardContent className="p-4 flex items-center gap-3">
            <TrendingDown className="w-5 h-5 text-secondary" />
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">{t.totalSavings}</p>
              <p className="text-lg font-bold text-secondary">{fmt(Math.round(summary.totalSavings))}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-border/50 rounded-2xl">
          <CardContent className="p-4 flex items-center gap-3">
            <TrendingUp className="w-5 h-5 text-destructive" />
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">{t.totalOverspend}</p>
              <p className="text-lg font-bold text-destructive">{fmt(Math.round(summary.totalOverspend))}</p>
            </div>
          </CardContent>
        </Card>
        <Card className={`border border-border/50 rounded-2xl ${summary.netVariance >= 0 ? 'ring-1 ring-secondary/30' : 'ring-1 ring-destructive/30'}`}>
          <CardContent className="p-4 flex items-center gap-3">
            {summary.netVariance >= 0 ? <CheckCircle className="w-5 h-5 text-secondary" /> : <AlertTriangle className="w-5 h-5 text-destructive" />}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">{t.netVariance}</p>
              <p className={`text-lg font-bold ${summary.netVariance >= 0 ? 'text-secondary' : 'text-destructive'}`}>
                {summary.netVariance >= 0 ? '+' : ''}{fmt(Math.round(summary.netVariance))}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <Card className="border border-border/50 rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold">{t.budgetVsActual}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => abbreviateNumber(v, locale)} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={100} />
                  <Tooltip formatter={(v: number) => fmt(v)} contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="budget" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name={t.budgetAmount} />
                  <Bar dataKey="actual" fill="hsl(var(--destructive))" radius={[0, 4, 4, 0]} name={t.spent} />
                  <Bar dataKey="projection" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} name={t.projection} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-6 mt-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="w-3 h-1 rounded-full bg-primary" />
                {t.budgetAmount}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="w-3 h-1 rounded-full bg-destructive" />
                {t.spent}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="w-3 h-1 rounded-full bg-accent" />
                {t.projection}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detail cards per budget */}
      <div className="space-y-3">
        {budgetAnalysis.map(a => {
          const over = a.actual > a.amount;
          const pace = paceLabels[a.paceLabel];
          return (
            <Card key={a.budget.id} className={`border border-border/50 rounded-2xl ${over ? 'ring-1 ring-destructive/20' : ''}`}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm flex items-center gap-2">
                    <span>{a.budget.categories?.icon || '📁'}</span> {a.budget.name}
                  </span>
                  <span className={`text-sm font-bold ${over ? 'text-destructive' : 'text-secondary'}`}>
                    {fmt(a.actual)} / {fmt(a.amount)}
                  </span>
                </div>
                <Progress value={a.pct} className="h-2" />

                {/* Enriched indicators */}
                <div className="grid grid-cols-3 gap-2 text-[11px]">
                  <div className="bg-muted/50 rounded-lg px-2 py-1.5">
                    <p className="text-muted-foreground">{t.projection}</p>
                    <p className={`font-bold ${a.projection > a.amount ? 'text-destructive' : 'text-secondary'}`}>
                      {fmt(Math.round(a.projection))}
                    </p>
                  </div>
                  <div className={`rounded-lg px-2 py-1.5 ${pace.bg}`}>
                    <p className="text-muted-foreground">{t.tempo}</p>
                    <p className={`font-bold ${pace.color}`}>{pace.label}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg px-2 py-1.5">
                    <p className="text-muted-foreground">{a.saving >= 0 ? t.estimatedSaving : t.estimatedOverspend}</p>
                    <p className={`font-bold ${a.saving >= 0 ? 'text-secondary' : 'text-destructive'}`}>
                      {fmt(Math.abs(Math.round(a.saving)))}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
                  <span>{a.daysLeft} {t.daysRemaining}</span>
                  <span>{t.dailyPace}: {fmt(Math.round(a.dailyRate))}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default BudgetAnalysisTab;
