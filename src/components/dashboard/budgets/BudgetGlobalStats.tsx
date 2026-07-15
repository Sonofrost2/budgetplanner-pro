import { useMemo } from 'react';

import { useLanguage } from '@/i18n/LanguageContext';
import { dashT } from '@/i18n/dashTranslations';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, AlertTriangle, PieChart, Calendar, ChevronRight, ArrowUpRight } from 'lucide-react';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { computeAnnualizedAmount } from '@/lib/budgetProjection';

interface BudgetGlobalStatsProps {
  budgets: any[];
  spending: Record<string, number>;
  fmt: (n: number) => string;
  onCardClick?: (action: string) => void;
}

/** Aggregate a list of budgets into totals + alert count.
 *  Split by budget_type upstream so expense and income never mix. */
function aggregate(budgets: any[], spending: Record<string, number>) {
  let totalAnnualized = 0;
  let totalBudgetPeriod = 0;
  let totalConsumed = 0;
  let alertCount = 0;

  for (const b of budgets) {
    const amount = Number(b.amount);
    totalAnnualized += computeAnnualizedAmount(amount, b.period, b.active_days);
    totalBudgetPeriod += amount;

    const actual = spending[b.category_id || ''] || 0;
    totalConsumed += actual;

    const controlType = b.control_type || 'max';
    const isMax = controlType === 'max';
    const threshold = b.alert_threshold ?? 80;
    const pct = amount > 0 ? (actual / amount) * 100 : 0;

    if (isMax && (actual > amount || pct >= threshold)) alertCount++;
    if (!isMax && actual < amount) alertCount++;
  }

  const globalPct = totalBudgetPeriod > 0 ? Math.round((totalConsumed / totalBudgetPeriod) * 100) : 0;
  return { totalAnnualized, totalBudgetPeriod, totalConsumed, globalPct, alertCount, count: budgets.length };
}

const BudgetGlobalStats = ({ budgets, spending, fmt, onCardClick }: BudgetGlobalStatsProps) => {
  const { locale } = useLanguage();
  const t = dashT[locale];
  const isFr = locale === 'fr';

  // ── Split income vs expense so KPIs never mix flows of opposite sign. ──
  const expenseBudgets = useMemo(
    () => budgets.filter((b) => (b?.budget_type || 'expense') !== 'income'),
    [budgets],
  );
  const incomeBudgets = useMemo(
    () => budgets.filter((b) => b?.budget_type === 'income'),
    [budgets],
  );

  const expenseStats = useMemo(() => aggregate(expenseBudgets, spending), [expenseBudgets, spending]);
  const incomeStats = useMemo(() => aggregate(incomeBudgets, spending), [incomeBudgets, spending]);
  const totalAlertCount = expenseStats.alertCount + incomeStats.alertCount;

  if (budgets.length === 0) return null;

  // Expense-focused KPI cards. Income has its own summary strip below.
  const cards = [
    {
      label: isFr ? 'Budget annualisé (dépenses)' : 'Annualized budget (expenses)',
      value: expenseStats.totalAnnualized,
      icon: <Calendar className="w-4 h-4" />,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      action: 'evolution',
    },
    {
      label: isFr ? 'Dépenses consommées (période)' : 'Consumed expenses (period)',
      value: expenseStats.totalConsumed,
      icon: <PieChart className="w-4 h-4" />,
      color: 'text-secondary',
      bgColor: 'bg-secondary/10',
      suffix: ` / ${fmt(expenseStats.totalBudgetPeriod)}`,
      action: 'consumed',
    },
    {
      label: isFr ? 'Conso. dépenses' : 'Expense usage',
      valueRaw: `${expenseStats.globalPct}%`,
      icon: <TrendingUp className="w-4 h-4" />,
      color: expenseStats.globalPct > 100 ? 'text-destructive' : expenseStats.globalPct >= 80 ? 'text-accent' : 'text-secondary',
      bgColor: expenseStats.globalPct > 100 ? 'bg-destructive/10' : expenseStats.globalPct >= 80 ? 'bg-accent/10' : 'bg-secondary/10',
      action: 'analysis',
    },
    {
      label: t.budgetsInAlert,
      valueRaw: String(totalAlertCount),
      icon: <AlertTriangle className="w-4 h-4" />,
      color: totalAlertCount > 0 ? 'text-destructive' : 'text-muted-foreground',
      bgColor: totalAlertCount > 0 ? 'bg-destructive/10' : 'bg-muted',
      action: 'alerts',
    },
  ];

  const hasIncomeBudgets = incomeBudgets.length > 0;
  // Income summary: "atteint" (min-control) = actual ≥ target.
  const incomeReachedPct = incomeStats.totalBudgetPeriod > 0
    ? Math.round((incomeStats.totalConsumed / incomeStats.totalBudgetPeriod) * 100)
    : 0;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((c, i) => (
          <Card
            key={i}
            className={`border border-border/50 shadow-[var(--shadow-card)] rounded-2xl glow-primary transition-all duration-200 ${onCardClick ? 'cursor-pointer hover:shadow-[var(--shadow-soft)] hover:-translate-y-0.5 group' : ''}`}
            onClick={() => onCardClick?.(c.action)}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${c.bgColor} ${c.color}`}>
                  {c.icon}
                </div>
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex-1">{c.label}</span>
                {onCardClick && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity" />}
              </div>
              <div className="flex items-baseline gap-1">
                {c.valueRaw ? (
                  <span className={`text-xl font-extrabold tabular-nums amount-display ${c.color}`}>{c.valueRaw}</span>
                ) : (
                  <AnimatedNumber value={c.value!} format={fmt} className={`text-xl font-extrabold amount-display ${c.color}`} />
                )}
                {c.suffix && <span className="text-xs text-muted-foreground">{c.suffix}</span>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {hasIncomeBudgets && (
        <Card className="border border-border/50 shadow-[var(--shadow-card)] rounded-2xl">
          <CardContent className="p-3">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </div>
                <span className="font-semibold uppercase tracking-wider text-[10px] text-muted-foreground">
                  {isFr ? 'Revenus' : 'Income'}
                </span>
                <span className="text-[10px] text-muted-foreground bg-muted/50 rounded-full px-1.5 py-0.5">
                  {incomeStats.count}
                </span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-[10px] uppercase text-muted-foreground tracking-wide">{isFr ? 'Perçu' : 'Received'}</span>
                <span className="font-extrabold tabular-nums amount-display text-secondary">{fmt(incomeStats.totalConsumed)}</span>
                <span className="text-muted-foreground">/ {fmt(incomeStats.totalBudgetPeriod)}</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-[10px] uppercase text-muted-foreground tracking-wide">{isFr ? 'Atteint' : 'Reached'}</span>
                <span
                  className={`font-extrabold tabular-nums ${
                    incomeReachedPct >= 100 ? 'text-secondary' : incomeReachedPct >= 80 ? 'text-accent' : 'text-destructive'
                  }`}
                >
                  {incomeReachedPct}%
                </span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-[10px] uppercase text-muted-foreground tracking-wide">{isFr ? 'Annualisé' : 'Annualized'}</span>
                <span className="font-semibold tabular-nums">{fmt(incomeStats.totalAnnualized)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default BudgetGlobalStats;
