import { useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useLanguage } from '@/i18n/LanguageContext';
import { dashT } from '@/i18n/dashTranslations';
import { useBudgets, useCategories } from '@/hooks/useDashboardData';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { PieChart as PieChartIcon, AlertTriangle, CheckCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const BudgetAnalysisTab = () => {
  const { user } = useAuth();
  const { locale } = useLanguage();
  const { fmt: fmtCurrency } = useProfile();
  const t = dashT[locale];
  const { data: budgets = [] } = useBudgets();
  const { data: categories = [] } = useCategories();
  const fmt = (n: number) => fmtCurrency(n, locale);

  const periodRanges = useMemo(() => {
    const now = new Date();
    return budgets.map(b => {
      let start: string, end: string;
      if (b.period === 'weekly') {
        const day = now.getDay();
        const ws = new Date(now); ws.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
        start = ws.toISOString().split('T')[0]; end = now.toISOString().split('T')[0];
      } else if (b.period === 'yearly') {
        start = `${now.getFullYear()}-01-01`; end = `${now.getFullYear()}-12-31`;
      } else {
        start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      }
      return { id: b.id, category_id: b.category_id, type: (b as any).budget_type === 'income' ? 'income' : 'expense', start, end };
    });
  }, [budgets]);

  const { data: spending = {} } = useQuery({
    queryKey: ['budget-analysis-spending', user?.id, periodRanges.map(r => r.id).join(',')],
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

  const chartData = expenseBudgets.map(b => ({
    name: b.name,
    budget: Number(b.amount),
    actual: spending[b.id] || 0,
  }));

  const overBudgetCount = expenseBudgets.filter(b => (spending[b.id] || 0) > Number(b.amount)).length;
  const onTrackCount = expenseBudgets.length - overBudgetCount;

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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border border-border/50 rounded-2xl">
          <CardContent className="p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">{t.budgets}</p>
            <p className="text-xl font-bold">{expenseBudgets.length}</p>
          </CardContent>
        </Card>
        <Card className="border border-border/50 rounded-2xl">
          <CardContent className="p-4 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-secondary" />
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">{t.onTrack}</p>
              <p className="text-xl font-bold text-secondary">{onTrackCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-border/50 rounded-2xl">
          <CardContent className="p-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">{t.budgetsInAlert}</p>
              <p className="text-xl font-bold text-destructive">{overBudgetCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

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
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Legend />
                  <Bar dataKey="budget" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name={t.budgetAmount} />
                  <Bar dataKey="actual" fill="hsl(var(--destructive))" radius={[0, 4, 4, 0]} name={t.spent} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detail list */}
      <div className="space-y-3">
        {expenseBudgets.map(b => {
          const actual = spending[b.id] || 0;
          const amount = Number(b.amount);
          const pct = amount > 0 ? Math.min((actual / amount) * 100, 100) : 0;
          const over = actual > amount;
          return (
            <Card key={b.id} className={`border border-border/50 rounded-2xl ${over ? 'ring-1 ring-destructive/20' : ''}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-sm flex items-center gap-2">
                    <span>{b.categories?.icon || '📁'}</span> {b.name}
                  </span>
                  <span className={`text-sm font-bold ${over ? 'text-destructive' : 'text-secondary'}`}>
                    {fmt(actual)} / {fmt(amount)}
                  </span>
                </div>
                <Progress value={pct} className="h-2" />
                <p className="text-xs text-muted-foreground mt-1">{pct.toFixed(0)}% {locale === 'fr' ? 'consommé' : 'consumed'}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default BudgetAnalysisTab;
