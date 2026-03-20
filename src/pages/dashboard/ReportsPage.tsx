import { useProfile } from '@/hooks/useProfile';
import { useLanguage } from '@/i18n/LanguageContext';
import { useSubscription } from '@/hooks/useSubscription';
import { dashT } from '@/i18n/dashTranslations';
import { useReportsData } from '@/hooks/useDashboardData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Download, Lock, Sparkles } from 'lucide-react';
import { exportToCSV, exportToExcel } from '@/lib/export';
import { Skeleton } from '@/components/ui/skeleton';
import UpgradeBanner from '@/components/dashboard/UpgradeBanner';
import { toast } from 'sonner';
import CashFlowReport from '@/components/dashboard/reports/CashFlowReport';
import BudgetVsActualReport from '@/components/dashboard/reports/BudgetVsActualReport';
import DailyJournalReport from '@/components/dashboard/reports/DailyJournalReport';
import AIInsightsReport from '@/components/dashboard/reports/AIInsightsReport';

const COLORS = ['#6C63FF', '#2DD4A8', '#F5A623', '#EF4444', '#3B82F6', '#8B5CF6', '#EC4899'];

const ReportsPage = () => {
  const { locale } = useLanguage();
  const { fmt: fmtCurrency } = useProfile();
  const { canExportAdvanced } = useSubscription();
  const t = dashT[locale];
  const fmt = (n: number) => fmtCurrency(n, locale);

  const { data, isLoading: loading } = useReportsData(locale);
  const monthlyData = data?.monthlyData ?? [];
  const categoryData = data?.categoryData ?? [];
  const allTransactions = data?.allTransactions ?? [];

  const handleExportCSV = () => {
    const rows = allTransactions.map(tx => ({ Date: tx.date, Description: tx.description, Type: tx.type, Category: (tx.categories as { name: string } | undefined)?.name || '', Amount: tx.amount }));
    if (!exportToCSV(rows, 'transactions')) toast.info(t.noTransactions);
  };

  const handleExportExcel = () => {
    const rows = allTransactions.map(tx => ({ Date: tx.date, Description: tx.description, Type: tx.type, Category: (tx.categories as { name: string } | undefined)?.name || '', Amount: tx.amount }));
    if (!exportToExcel(rows, 'transactions')) toast.info(t.noTransactions);
  };

  if (loading) return <div className="space-y-6"><div className="flex items-center justify-between"><Skeleton className="h-8 w-48" /><div className="flex gap-2"><Skeleton className="h-9 w-20" /><Skeleton className="h-9 w-20" /></div></div><Skeleton className="h-96 rounded-xl" /></div>;

  return (
    <div className="space-y-6">
      {!canExportAdvanced && <UpgradeBanner message={t.upgradeExport} />}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-2xl font-bold font-display">{t.reportTitle}</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={!canExportAdvanced}>{!canExportAdvanced ? <Lock className="w-4 h-4 mr-1" /> : <Download className="w-4 h-4 mr-1" />} CSV</Button>
          <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={!canExportAdvanced}>{!canExportAdvanced ? <Lock className="w-4 h-4 mr-1" /> : <Download className="w-4 h-4 mr-1" />} Excel</Button>
        </div>
      </div>

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
                  <BarChart data={monthlyData}>
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
              {categoryData.length === 0 ? <p className="text-center text-muted-foreground py-8">{t.noTransactions}</p> : (
                <div className="flex flex-col lg:flex-row items-center gap-8">
                  <div className="h-64 w-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart><Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>{categoryData.map((entry, i) => <Cell key={i} fill={entry.color || COLORS[i % COLORS.length]} />)}</Pie><Tooltip formatter={(v: number) => fmt(v)} /></PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 space-y-2">{categoryData.map((c, i) => (<div key={i} className="flex items-center justify-between py-1.5 border-b border-border last:border-0"><div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{ background: c.color || COLORS[i % COLORS.length] }} /><span className="text-sm">{c.name}</span></div><span className="text-sm font-semibold">{fmt(c.value)}</span></div>))}</div>
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
