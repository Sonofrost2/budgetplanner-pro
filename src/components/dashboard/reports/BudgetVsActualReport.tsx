import { useMemo, useState } from 'react';
import { useProfile } from '@/hooks/useProfile';
import { useLanguage } from '@/i18n/LanguageContext';
import { dashT } from '@/i18n/dashTranslations';
import { useBudgets } from '@/hooks/useDashboardData';
import { useBudgetSpending, type BudgetSpendingRange } from '@/hooks/useBudgetSpending';
import { getBudgetPeriodBounds, formatDateStr, computeAnnualizedAmount } from '@/lib/budgetProjection';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableFooter } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { ArrowUp, ArrowDown, ArrowUpDown, Target } from 'lucide-react';
import { ariaSortValue } from '@/lib/a11y';

interface Row {
  id: string;
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
  isSavings: boolean;
  daysElapsed: number;
}

type SortKey = 'name' | 'budget' | 'actual' | 'projection' | 'annualized' | 'variance' | 'pct';

const BudgetVsActualReport = () => {
  const { locale } = useLanguage();
  const { fmt: fmtCurrency } = useProfile();
  const t = dashT[locale];
  const isFr = locale === 'fr';
  const { data: budgets = [] } = useBudgets();
  const [sortKey, setSortKey] = useState<SortKey>('pct');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const fmt = (n: number) => fmtCurrency(n, locale);

  // Filter out archived / soft-deleted budgets, then build spending ranges
  // for the shared hook (keyed by budget id, savings-aware).
  const activeBudgets = useMemo(
    () => budgets.filter(b => !(b as any).archived_at),
    [budgets],
  );

  const ranges = useMemo<BudgetSpendingRange[]>(() => {
    const now = new Date();
    return activeBudgets.map(b => {
      const bType = (b as any).budget_type || 'expense';
      const { periodStart, periodEnd } = getBudgetPeriodBounds(b.period || 'monthly', now, (b as any).reference_date);
      return {
        id: b.id,
        category_id: b.category_id,
        type: bType === 'income' ? 'income' : 'expense',
        start: formatDateStr(periodStart),
        end: formatDateStr(periodEnd),
        linked_savings_goal_id: (b as any).linked_savings_goal_id || null,
      };
    });
  }, [activeBudgets]);

  const { data: spending = {} } = useBudgetSpending(ranges, { queryKey: 'report' });

  const rows: Row[] = useMemo(() => {
    const now = new Date();
    return activeBudgets.map(b => {
      const bType = (b as any).budget_type || 'expense';
      const controlType = (b as any).control_type || 'max';
      const period = b.period || 'monthly';
      const { periodStart, periodEnd } = getBudgetPeriodBounds(period, now, (b as any).reference_date);

      const actual = Number(spending[b.id] || 0);
      const amount = Number(b.amount);
      const variance = controlType === 'max' ? amount - actual : actual - amount;
      const pct = amount > 0 ? Math.round((actual / amount) * 100) : 0;

      // Safer projection:
      // - Requires ≥7 days of history to project (avoids the "1st-of-month → ×365" trap).
      // - Capped at 2× the budget so a single spike doesn't wreck the display.
      const daysElapsed = Math.max(1, Math.floor((now.getTime() - periodStart.getTime()) / 86400000) + 1);
      const daysTotal = Math.max(1, Math.floor((periodEnd.getTime() - periodStart.getTime()) / 86400000) + 1);
      const projection =
        daysElapsed >= Math.min(7, daysTotal)
          ? Math.min(Math.round((actual / daysElapsed) * daysTotal), amount * 3)
          : actual; // Not enough data → show actual, not extrapolation

      const annualized = Math.round(computeAnnualizedAmount(amount, period, (b as any).active_days));

      const cat = (b as any).categories as { icon?: string; color?: string; name?: string } | null;
      return {
        id: b.id,
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
        isSavings: !!(b as any).linked_savings_goal_id,
        daysElapsed,
      };
    });
  }, [activeBudgets, spending]);

  const sortedRows = useMemo(() => {
    const arr = [...rows];
    const dir = sortDir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      if (sortKey === 'name') return a.name.localeCompare(b.name) * dir;
      return ((a[sortKey] as number) - (b[sortKey] as number)) * dir;
    });
    return arr;
  }, [rows, sortKey, sortDir]);

  // Split expense / income so the footer totals are meaningful.
  const expenseRows = sortedRows.filter(r => r.budgetType !== 'income');
  const incomeRows = sortedRows.filter(r => r.budgetType === 'income');

  const sumOf = (rs: Row[], k: 'budget' | 'actual' | 'projection' | 'annualized') =>
    rs.reduce((s, r) => s + r[k], 0);

  const expTotals = {
    budget: sumOf(expenseRows, 'budget'),
    actual: sumOf(expenseRows, 'actual'),
    projection: sumOf(expenseRows, 'projection'),
    annualized: sumOf(expenseRows, 'annualized'),
  };
  const incTotals = {
    budget: sumOf(incomeRows, 'budget'),
    actual: sumOf(incomeRows, 'actual'),
    projection: sumOf(incomeRows, 'projection'),
    annualized: sumOf(incomeRows, 'annualized'),
  };
  const expPct = expTotals.budget > 0 ? Math.round((expTotals.actual / expTotals.budget) * 100) : 0;
  const incPct = incTotals.budget > 0 ? Math.round((incTotals.actual / incTotals.budget) * 100) : 0;

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

  const SortableHead = ({ k, children, align = 'right' }: { k: SortKey; children: React.ReactNode; align?: 'left' | 'right' }) => {
    const active = sortKey === k;
    const nextDir: 'asc' | 'desc' = active ? (sortDir === 'asc' ? 'desc' : 'asc') : (k === 'name' ? 'asc' : 'desc');
    const dirLabel = (d: 'asc' | 'desc') => (isFr
      ? (d === 'asc' ? 'croissant' : 'décroissant')
      : (d === 'asc' ? 'ascending' : 'descending'));
    const label = typeof children === 'string' ? children : k;
    return (
      <TableHead
        scope="col"
        aria-sort={ariaSortValue(active, sortDir)}
        className={align === 'right' ? 'text-right' : ''}
      >
        <button
          type="button"
          className={`inline-flex items-center gap-1 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-sm transition-colors ${active ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}
          aria-label={
            isFr
              ? `Trier par ${label}, ${active ? `actuellement ${dirLabel(sortDir)}, cliquer pour trier en ${dirLabel(nextDir)}` : `cliquer pour trier en ${dirLabel(nextDir)}`}`
              : `Sort by ${label}, ${active ? `currently ${dirLabel(sortDir)}, click to sort ${dirLabel(nextDir)}` : `click to sort ${dirLabel(nextDir)}`}`
          }
          onClick={() => {
            if (active) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
            else { setSortKey(k); setSortDir(k === 'name' ? 'asc' : 'desc'); }
          }}
        >
          {children}
          {active
            ? (sortDir === 'asc' ? <ArrowUp className="w-3 h-3" aria-hidden="true" /> : <ArrowDown className="w-3 h-3" aria-hidden="true" />)
            : <ArrowUpDown className="w-3 h-3 opacity-40" aria-hidden="true" />}
        </button>
      </TableHead>
    );
  };

  const renderBody = (rs: Row[]) => rs.map((r) => (
    <TableRow key={r.id}>
      <TableCell className="font-medium">
        <span className="mr-2">{r.icon}</span>{r.name}
        {r.isSavings && (
          <span className="ml-2 inline-flex items-center gap-1 text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded-md align-middle">
            <Target className="w-2.5 h-2.5" />{isFr ? 'Épargne' : 'Savings'}
          </span>
        )}
      </TableCell>
      <TableCell className="text-right text-xs text-muted-foreground">{periodLabels[r.period] || r.period}</TableCell>
      <TableCell className="text-right text-sm">{fmt(r.budget)}</TableCell>
      <TableCell className="text-right text-sm font-semibold">{fmt(r.actual)}</TableCell>
      <TableCell
        className={`text-right text-sm ${r.projection > r.budget ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}
        title={r.daysElapsed < 7 ? (isFr ? 'Peu de données — projection = réel' : 'Insufficient data — projection = actual') : undefined}
      >
        {fmt(r.projection)}
        {r.daysElapsed < 7 && <span className="ml-1 text-[9px] text-muted-foreground/70">*</span>}
      </TableCell>
      <TableCell className="text-right text-xs text-muted-foreground">{fmt(r.annualized)}</TableCell>
      <TableCell className={`text-right text-sm font-semibold ${r.variance >= 0 ? 'text-secondary' : 'text-destructive'}`}>
        {r.variance >= 0 ? '+' : ''}{fmt(r.variance)}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Progress
            value={Math.min(r.pct, 100)}
            aria-label={isFr ? `${r.name} : ${r.pct}% consommé` : `${r.name}: ${r.pct}% consumed`}
            className={`h-2 flex-1 rounded-full ${getBarClass(r.pct)}`}
          />
          <span className={`text-xs font-bold w-10 text-right ${getPctColor(r.pct)}`}>{r.pct}%</span>
        </div>
      </TableCell>
    </TableRow>
  ));

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
              <caption className="sr-only">
                {isFr
                  ? `Comparaison budget vs réel pour ${activeBudgets.length} budget(s), triée par ${sortKey} en ordre ${sortDir === 'asc' ? 'croissant' : 'décroissant'}.`
                  : `Budget vs actual comparison for ${activeBudgets.length} budget(s), sorted by ${sortKey} in ${sortDir === 'asc' ? 'ascending' : 'descending'} order.`}
              </caption>
              <TableHeader>
                <TableRow>
                  <SortableHead k="name" align="left">{t.category}</SortableHead>
                  <TableHead scope="col" className="text-right">{t.period}</TableHead>
                  <SortableHead k="budget">Budget</SortableHead>
                  <SortableHead k="actual">{isFr ? 'Réel' : 'Actual'}</SortableHead>
                  <SortableHead k="projection">{t.projection}</SortableHead>
                  <SortableHead k="annualized">{t.annualized}</SortableHead>
                  <SortableHead k="variance">{t.variance}</SortableHead>
                  <TableHead
                    scope="col"
                    aria-sort={ariaSortValue(sortKey === 'pct', sortDir)}
                    className="min-w-[120px]"
                  >
                    <button
                      type="button"
                      className={`inline-flex items-center gap-1 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-sm transition-colors ${sortKey === 'pct' ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}
                      aria-label={
                        isFr
                          ? `Trier par ${t.consumptionPct}${sortKey === 'pct' ? `, actuellement ${sortDir === 'asc' ? 'croissant' : 'décroissant'}` : ''}`
                          : `Sort by ${t.consumptionPct}${sortKey === 'pct' ? `, currently ${sortDir === 'asc' ? 'ascending' : 'descending'}` : ''}`
                      }
                      onClick={() => { if (sortKey === 'pct') setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortKey('pct'); setSortDir('desc'); } }}
                    >
                      {t.consumptionPct}
                      {sortKey === 'pct'
                        ? (sortDir === 'asc' ? <ArrowUp className="w-3 h-3" aria-hidden="true" /> : <ArrowDown className="w-3 h-3" aria-hidden="true" />)
                        : <ArrowUpDown className="w-3 h-3 opacity-40" aria-hidden="true" />}
                    </button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenseRows.length > 0 && (
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableCell colSpan={8} className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground py-1.5">
                      {isFr ? 'Dépenses' : 'Expenses'} · {expenseRows.length}
                    </TableCell>
                  </TableRow>
                )}
                {renderBody(expenseRows)}
                {incomeRows.length > 0 && (
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableCell colSpan={8} className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground py-1.5">
                      {isFr ? 'Revenus' : 'Income'} · {incomeRows.length}
                    </TableCell>
                  </TableRow>
                )}
                {renderBody(incomeRows)}
              </TableBody>
              <TableFooter>
                {expenseRows.length > 0 && (
                  <TableRow>
                    <TableCell className="font-bold">{isFr ? 'Total dépenses' : 'Total expenses'}</TableCell>
                    <TableCell />
                    <TableCell className="text-right font-bold">{fmt(expTotals.budget)}</TableCell>
                    <TableCell className="text-right font-bold">{fmt(expTotals.actual)}</TableCell>
                    <TableCell className={`text-right font-bold ${expTotals.projection > expTotals.budget ? 'text-destructive' : ''}`}>{fmt(expTotals.projection)}</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground font-bold">{fmt(expTotals.annualized)}</TableCell>
                    <TableCell className={`text-right font-bold ${expTotals.budget - expTotals.actual >= 0 ? 'text-secondary' : 'text-destructive'}`}>
                      {expTotals.budget - expTotals.actual >= 0 ? '+' : ''}{fmt(expTotals.budget - expTotals.actual)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress
                          value={Math.min(expPct, 100)}
                          aria-label={isFr ? `Total dépenses : ${expPct}% consommé` : `Total expenses: ${expPct}% consumed`}
                          className={`h-2 flex-1 rounded-full ${getBarClass(expPct)}`}
                        />
                        <span className={`text-xs font-bold w-10 text-right ${getPctColor(expPct)}`}>{expPct}%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {incomeRows.length > 0 && (
                  <TableRow>
                    <TableCell className="font-bold">{isFr ? 'Total revenus' : 'Total income'}</TableCell>
                    <TableCell />
                    <TableCell className="text-right font-bold">{fmt(incTotals.budget)}</TableCell>
                    <TableCell className="text-right font-bold">{fmt(incTotals.actual)}</TableCell>
                    <TableCell className="text-right font-bold text-muted-foreground">{fmt(incTotals.projection)}</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground font-bold">{fmt(incTotals.annualized)}</TableCell>
                    <TableCell className={`text-right font-bold ${incTotals.actual - incTotals.budget >= 0 ? 'text-secondary' : 'text-destructive'}`}>
                      {incTotals.actual - incTotals.budget >= 0 ? '+' : ''}{fmt(incTotals.actual - incTotals.budget)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress
                          value={Math.min(incPct, 100)}
                          aria-label={isFr ? `Total revenus : ${incPct}% atteint` : `Total income: ${incPct}% achieved`}
                          className={`h-2 flex-1 rounded-full ${getBarClass(incPct)}`}
                        />
                        <span className={`text-xs font-bold w-10 text-right ${getPctColor(incPct)}`}>{incPct}%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableFooter>
            </Table>
            <p className="text-[10px] text-muted-foreground mt-2">
              * {isFr
                ? 'Projection = réel tant que la période n\'a pas atteint 7 jours d\'historique.'
                : 'Projection = actual until the period has ≥ 7 days of history.'}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BudgetVsActualReport;
