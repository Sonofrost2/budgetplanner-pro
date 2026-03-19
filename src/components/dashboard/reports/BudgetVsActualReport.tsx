import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useLanguage } from '@/i18n/LanguageContext';
import { dashT } from '@/i18n/dashTranslations';
import { supabase } from '@/integrations/supabase/client';
import { getBudgetPeriodBounds, formatDateStr } from '@/lib/budgetProjection';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableFooter } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';

const PERIOD_MULTIPLIER: Record<string, number> = {
  daily: 365, weekly: 52, monthly: 12, quarterly: 4, semi_annual: 2, yearly: 1,
};

interface Row {
  name: string;
  icon: string;
  color: string;
  budget: number;
  actual: number;
  variance: number;
  pct: number;
  controlType: string;
  budgetType: string;
  projection: number;
  annualized: number;
  period: string;
}

function getPeriodRange(period: string): { start: string; end: string } {
  const now = new Date();
  let start: string, end: string;
  if (period === 'daily') {
    start = now.toISOString().split('T')[0]; end = start;
  } else if (period === 'weekly') {
    const day = now.getDay();
    const ws = new Date(now); ws.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
    const we = new Date(ws); we.setDate(ws.getDate() + 6);
    start = ws.toISOString().split('T')[0]; end = we.toISOString().split('T')[0];
  } else if (period === 'quarterly') {
    const q = Math.floor(now.getMonth() / 3);
    start = new Date(now.getFullYear(), q * 3, 1).toISOString().split('T')[0];
    end = new Date(now.getFullYear(), q * 3 + 3, 0).toISOString().split('T')[0];
  } else if (period === 'semi_annual') {
    const s = now.getMonth() < 6 ? 0 : 6;
    start = new Date(now.getFullYear(), s, 1).toISOString().split('T')[0];
    end = new Date(now.getFullYear(), s + 6, 0).toISOString().split('T')[0];
  } else if (period === 'yearly') {
    start = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
    end = new Date(now.getFullYear(), 11, 31).toISOString().split('T')[0];
  } else {
    start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  }
  return { start, end };
}

const BudgetVsActualReport = () => {
  const { user } = useAuth();
  const { locale } = useLanguage();
  const { fmt: fmtCurrency } = useProfile();
  const t = dashT[locale];
  const [rows, setRows] = useState<Row[]>([]);

  const fmt = (n: number) => fmtCurrency(n, locale);

  useEffect(() => {
    if (!user) return;

    supabase.from('budgets').select('*, categories(name, icon, color)').eq('user_id', user.id).then(async (budRes) => {
      const budgets = budRes.data || [];
      const results: Row[] = [];

      const promises = budgets.map(async (b) => {
        const bType = (b as any).budget_type || 'expense';
        const controlType = (b as any).control_type || 'max';
        const txType = bType === 'income' ? 'income' : 'expense';
        const period = b.period || 'monthly';
        const { start, end } = getPeriodRange(period);

        const { data: spendingData } = await supabase.rpc('get_budget_spending', {
          p_user_id: user.id,
          p_category_id: b.category_id!,
          p_type: txType,
          p_start_date: start,
          p_end_date: end,
        });

        const actual = Number(spendingData || 0);
        const amount = Number(b.amount);
        const variance = controlType === 'max' ? amount - actual : actual - amount;
        const pct = amount > 0 ? Math.round((actual / amount) * 100) : 0;

        // Projection
        const periodStart = new Date(start);
        const periodEnd = new Date(end);
        const today = new Date();
        const daysElapsed = Math.max(1, Math.floor((today.getTime() - periodStart.getTime()) / 86400000) + 1);
        const daysTotal = Math.max(1, Math.floor((periodEnd.getTime() - periodStart.getTime()) / 86400000) + 1);
        const projection = Math.round((actual / daysElapsed) * daysTotal);
        const annualized = amount * (PERIOD_MULTIPLIER[period] || 12);

        const cat = b.categories as { icon?: string; color?: string; name?: string } | null;
        return {
          name: b.name,
          icon: cat?.icon || '📁',
          color: cat?.color || '#6C63FF',
          budget: amount,
          actual,
          variance,
          pct,
          controlType,
          budgetType: bType,
          projection,
          annualized,
          period,
        };
      });

      const settled = await Promise.all(promises);
      setRows(settled);
    });
  }, [user]);

  const totalBudget = rows.reduce((s, r) => s + r.budget, 0);
  const totalActual = rows.reduce((s, r) => s + r.actual, 0);
  const totalProjection = rows.reduce((s, r) => s + r.projection, 0);
  const totalAnnualized = rows.reduce((s, r) => s + r.annualized, 0);
  const totalPct = totalBudget > 0 ? Math.round((totalActual / totalBudget) * 100) : 0;

  const getPctColor = (pct: number) => {
    if (pct > 100) return 'text-destructive';
    if (pct >= 80) return 'text-accent';
    return 'text-secondary';
  };

  const getBarClass = (pct: number) => {
    if (pct > 100) return '[&>div]:bg-destructive';
    if (pct >= 80) return '[&>div]:bg-accent';
    return '[&>div]:bg-secondary';
  };

  const periodLabels: Record<string, string> = {
    daily: t.daily, weekly: t.weekly, monthly: t.monthly,
    quarterly: t.quarterly, semi_annual: t.semiAnnual, yearly: t.yearly,
  };

  return (
    <Card className="border-none shadow-[var(--shadow-card)]">
      <CardHeader>
        <CardTitle className="text-base">{t.budgetVsActual}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">{t.noBudgets}</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.category}</TableHead>
                  <TableHead className="text-right">{t.period}</TableHead>
                  <TableHead className="text-right">Budget</TableHead>
                  <TableHead className="text-right">{locale === 'fr' ? 'Réel' : 'Actual'}</TableHead>
                  <TableHead className="text-right">{t.projection}</TableHead>
                  <TableHead className="text-right">{t.annualized}</TableHead>
                  <TableHead className="text-right">{t.variance}</TableHead>
                  <TableHead className="min-w-[120px]">{t.consumptionPct}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">
                      <span className="mr-2">{r.icon}</span>{r.name}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">{periodLabels[r.period] || r.period}</TableCell>
                    <TableCell className="text-right text-sm">{fmt(r.budget)}</TableCell>
                    <TableCell className="text-right text-sm font-semibold">{fmt(r.actual)}</TableCell>
                    <TableCell className={`text-right text-sm ${r.projection > r.budget ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}>{fmt(r.projection)}</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">{fmt(r.annualized)}</TableCell>
                    <TableCell className={`text-right text-sm font-semibold ${r.variance >= 0 ? 'text-secondary' : 'text-destructive'}`}>
                      {r.variance >= 0 ? '+' : ''}{fmt(r.variance)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={Math.min(r.pct, 100)} className={`h-2 flex-1 rounded-full ${getBarClass(r.pct)}`} />
                        <span className={`text-xs font-bold w-10 text-right ${getPctColor(r.pct)}`}>{r.pct}%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="font-bold">{t.savingsTotal}</TableCell>
                  <TableCell />
                  <TableCell className="text-right font-bold">{fmt(totalBudget)}</TableCell>
                  <TableCell className="text-right font-bold">{fmt(totalActual)}</TableCell>
                  <TableCell className={`text-right font-bold ${totalProjection > totalBudget ? 'text-destructive' : ''}`}>{fmt(totalProjection)}</TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground font-bold">{fmt(totalAnnualized)}</TableCell>
                  <TableCell className={`text-right font-bold ${totalBudget - totalActual >= 0 ? 'text-secondary' : 'text-destructive'}`}>
                    {totalBudget - totalActual >= 0 ? '+' : ''}{fmt(totalBudget - totalActual)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={Math.min(totalPct, 100)} className={`h-2 flex-1 rounded-full ${getBarClass(totalPct)}`} />
                      <span className={`text-xs font-bold w-10 text-right ${getPctColor(totalPct)}`}>{totalPct}%</span>
                    </div>
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BudgetVsActualReport;
