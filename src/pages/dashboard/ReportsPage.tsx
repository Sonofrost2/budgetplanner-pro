import { useState, useMemo } from 'react';
import { useProfile } from '@/hooks/useProfile';
import { useLanguage } from '@/i18n/LanguageContext';
import { useSubscription } from '@/hooks/useSubscription';
import { dashT } from '@/i18n/dashTranslations';
import { useReportsData } from '@/hooks/useDashboardData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Download, Lock, Sparkles, CalendarRange } from 'lucide-react';
import { exportToCSV, exportToExcel } from '@/lib/export';
import { Skeleton } from '@/components/ui/skeleton';
import UpgradeBanner from '@/components/dashboard/UpgradeBanner';
import { toast } from 'sonner';
import CashFlowReport from '@/components/dashboard/reports/CashFlowReport';
import BudgetVsActualReport from '@/components/dashboard/reports/BudgetVsActualReport';
import DailyJournalReport from '@/components/dashboard/reports/DailyJournalReport';
import AIInsightsReport from '@/components/dashboard/reports/AIInsightsReport';
import { ReportsHeroHeader } from '@/components/dashboard/reports/ReportsHeroHeader';

import { CHART_PALETTE as COLORS } from '@/lib/chartColors';

type PeriodPreset = 'all' | 'month' | 'quarter' | 'semester' | 'year' | 'custom';

const ReportsPage = () => {
  const { locale } = useLanguage();
  const { fmt: fmtCurrency } = useProfile();
  const { canExportAdvanced } = useSubscription();
  const t = dashT[locale];
  const fmt = (n: number) => fmtCurrency(n, locale);

  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const { data, isLoading: loading } = useReportsData(locale);
  const monthlyData = data?.monthlyData ?? [];
  const categoryData = data?.categoryData ?? [];
  const allTransactions = data?.allTransactions ?? [];

  // Compute period bounds
  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    let s = '';
    let e = now.toISOString().split('T')[0];
    switch (periodPreset) {
      case 'month':
        s = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        break;
      case 'quarter': {
        const qm = Math.floor(now.getMonth() / 3) * 3;
        s = new Date(now.getFullYear(), qm, 1).toISOString().split('T')[0];
        break;
      }
      case 'semester':
        s = new Date(now.getFullYear(), now.getMonth() >= 6 ? 6 : 0, 1).toISOString().split('T')[0];
        break;
      case 'year':
        s = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
        break;
      case 'custom':
        s = customStart;
        e = customEnd || e;
        break;
      default:
        s = '';
        e = '';
    }
    return { startDate: s, endDate: e };
  }, [periodPreset, customStart, customEnd]);

  // Filter transactions by period
  const filteredTx = useMemo(() => {
    if (!startDate && !endDate) return allTransactions;
    return allTransactions.filter(tx => {
      if (startDate && tx.date < startDate) return false;
      if (endDate && tx.date > endDate) return false;
      return true;
    });
  }, [allTransactions, startDate, endDate]);

  // Recompute monthly chart from filtered transactions
  const filteredMonthlyData = useMemo(() => {
    if (periodPreset === 'all') return monthlyData;
    const monthMap: Record<string, { name: string; income: number; expenses: number }> = {};
    for (const tx of filteredTx) {
      const d = new Date(tx.date);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (!monthMap[key]) {
        const label = d.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', { month: 'short', year: '2-digit' });
        monthMap[key] = { name: label, income: 0, expenses: 0 };
      }
      if (tx.type === 'income') monthMap[key].income += Number(tx.amount);
      else if (tx.type === 'expense') monthMap[key].expenses += Number(tx.amount);
    }
    return Object.values(monthMap);
  }, [filteredTx, periodPreset, monthlyData, locale]);

  // Recompute category pie from filtered transactions
  const filteredCategoryData = useMemo(() => {
    if (periodPreset === 'all') return categoryData;
    const catMap: Record<string, { name: string; value: number; color: string }> = {};
    for (const tx of filteredTx) {
      if (tx.type !== 'expense') continue;
      const cat = tx.categories as { name: string; color: string } | null;
      const name = cat?.name || 'Autres';
      const color = cat?.color || '#6C63FF';
      if (!catMap[name]) catMap[name] = { name, value: 0, color };
      catMap[name].value += Number(tx.amount);
    }
    return Object.values(catMap).sort((a, b) => b.value - a.value);
  }, [filteredTx, periodPreset, categoryData]);

  const handleExportCSV = () => {
    const rows = filteredTx.map(tx => ({ Date: tx.date, Description: tx.description, Type: tx.type, Category: (tx.categories as { name: string } | undefined)?.name || '', Amount: tx.amount }));
    if (!exportToCSV(rows, 'transactions')) toast.info(t.noTransactions);
  };

  const handleExportExcel = () => {
    const rows = filteredTx.map(tx => ({ Date: tx.date, Description: tx.description, Type: tx.type, Category: (tx.categories as { name: string } | undefined)?.name || '', Amount: tx.amount }));
    if (!exportToExcel(rows, 'transactions')) toast.info(t.noTransactions);
  };

  // 30-day daily surplus sparkline for the hero header
  const reportsSparkline = useMemo(() => {
    const days = 30;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const start = new Date(today); start.setDate(today.getDate() - days);
    const buckets: number[] = Array(days + 1).fill(0);
    for (const tx of allTransactions) {
      const d = new Date(tx.date); d.setHours(0, 0, 0, 0);
      if (d < start || d > today) continue;
      const idx = Math.floor((d.getTime() - start.getTime()) / 86400000);
      if (idx < 0 || idx >= buckets.length) continue;
      const amt = Number(tx.amount);
      if (tx.type === 'income') buckets[idx] += amt;
      else if (tx.type === 'expense') buckets[idx] -= amt;
    }
    return buckets.map(v => ({ v }));
  }, [allTransactions]);

  const presetLabels: Record<PeriodPreset, string> = {
    all: locale === 'fr' ? 'Tout' : 'All',
    month: t.thisMonth,
    quarter: t.thisQuarter,
    semester: t.thisSemester,
    year: t.thisYear,
    custom: locale === 'fr' ? 'Personnalisé' : 'Custom',
  };

  if (loading) return <div className="space-y-6"><div className="flex items-center justify-between"><Skeleton className="h-8 w-48" /><div className="flex gap-2"><Skeleton className="h-9 w-20" /><Skeleton className="h-9 w-20" /></div></div><Skeleton className="h-96 rounded-xl" /></div>;

  return (
    <div className="space-y-6">
      {!canExportAdvanced && <UpgradeBanner message={t.upgradeExport} />}
      <ReportsHeroHeader
        isFr={locale === 'fr'}
        fmt={fmt}
        totalIncome={filteredTx.filter(tx => tx.type === 'income').reduce((s, tx) => s + Number(tx.amount), 0)}
        totalExpense={filteredTx.filter(tx => tx.type === 'expense').reduce((s, tx) => s + Number(tx.amount), 0)}
        txCount={filteredTx.length}
        periodLabel={presetLabels[periodPreset]}
        sparkline={reportsSparkline}
        canExportAdvanced={canExportAdvanced}
        onExportCSV={handleExportCSV}
        onExportExcel={handleExportExcel}
      />

      {/* Period selector */}
      <Card className="border border-border/50 shadow-sm rounded-2xl">
        <CardContent className="py-3 px-4">
          <div className="flex flex-wrap items-center gap-3">
            <CalendarRange className="w-4 h-4 text-muted-foreground" />
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(presetLabels) as PeriodPreset[]).map(preset => (
                <button
                  key={preset}
                  onClick={() => setPeriodPreset(preset)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border
                    ${periodPreset === preset
                      ? 'bg-primary text-primary-foreground border-primary shadow-[0_2px_8px_-2px_hsl(var(--primary)/0.4)]'
                      : 'bg-background/60 text-muted-foreground border-border/40 hover:bg-background/80 hover:text-foreground'
                    }`}
                >
                  {presetLabels[preset]}
                </button>
              ))}
            </div>
            {periodPreset === 'custom' && (
              <div className="flex items-center gap-2 ml-auto">
                <Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="rounded-xl h-8 text-xs w-[130px]" />
                <span className="text-xs text-muted-foreground">→</span>
                <Input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="rounded-xl h-8 text-xs w-[130px]" />
              </div>
            )}
            {startDate && (
              <span className="text-[11px] text-muted-foreground ml-auto">
                {filteredTx.length} {locale === 'fr' ? 'transactions' : 'transactions'}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="ai-insights">
        <TabsList className="flex-wrap">
          <TabsTrigger value="ai-insights" className="gap-1.5"><Sparkles className="w-3.5 h-3.5" />{locale === 'fr' ? 'Insights IA' : 'AI Insights'}</TabsTrigger>
          <TabsTrigger value="monthly">{t.monthlyReport}</TabsTrigger>
          <TabsTrigger value="categories">{t.topExpenses}</TabsTrigger>
          <TabsTrigger value="cashflow">{t.cashFlow}</TabsTrigger>
          <TabsTrigger value="budgetvsactual">{t.budgetVsActual}</TabsTrigger>
          <TabsTrigger value="journal">{t.dailyJournal}</TabsTrigger>
        </TabsList>

        <TabsContent value="ai-insights"><AIInsightsReport /></TabsContent>

        <TabsContent value="monthly">
          <Card className="border-none shadow-[var(--shadow-card)]">
            <CardHeader><CardTitle className="text-base">{t.incomeVsExpenses}</CardTitle></CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={filteredMonthlyData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => fmt(v)} /><Legend />
                    <Bar dataKey="income" fill="hsl(170, 65%, 45%)" name={t.income} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expenses" fill="hsl(250, 70%, 58%)" name={t.expenses} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories">
          <Card className="border-none shadow-[var(--shadow-card)]">
            <CardHeader><CardTitle className="text-base">{t.topExpenses}</CardTitle></CardHeader>
            <CardContent>
              {filteredCategoryData.length === 0 ? <p className="text-center text-muted-foreground py-8">{t.noTransactions}</p> : (
                <div className="flex flex-col lg:flex-row items-center gap-8">
                  <div className="h-64 w-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart><Pie data={filteredCategoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>{filteredCategoryData.map((entry, i) => <Cell key={i} fill={entry.color || COLORS[i % COLORS.length]} />)}</Pie><Tooltip formatter={(v: number) => fmt(v)} /></PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 space-y-2">{filteredCategoryData.map((c, i) => (<div key={i} className="flex items-center justify-between py-1.5 border-b border-border last:border-0"><div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{ background: c.color || COLORS[i % COLORS.length] }} /><span className="text-sm">{c.name}</span></div><span className="text-sm font-semibold">{fmt(c.value)}</span></div>))}</div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="cashflow"><CashFlowReport /></TabsContent>
        <TabsContent value="budgetvsactual"><BudgetVsActualReport /></TabsContent>
        <TabsContent value="journal"><DailyJournalReport /></TabsContent>
      </Tabs>
    </div>
  );
};

export default ReportsPage;