import { useMemo } from 'react';
import { useLanguage } from '@/i18n/LanguageContext';
import { useProfile } from '@/hooks/useProfile';
import { dashT } from '@/i18n/dashTranslations';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, AlertTriangle, PieChart, Calendar } from 'lucide-react';
import { AnimatedNumber } from '@/components/ui/animated-number';

const PERIOD_MULTIPLIER: Record<string, number> = {
  daily: 365,
  weekly: 52,
  monthly: 12,
  quarterly: 4,
  semi_annual: 2,
  yearly: 1,
};

interface BudgetGlobalStatsProps {
  budgets: any[];
  spending: Record<string, number>;
}

const BudgetGlobalStats = ({ budgets, spending }: BudgetGlobalStatsProps) => {
  const { locale } = useLanguage();
  const { fmt: fmtCurrency } = useProfile();
  const t = dashT[locale];
  const fmt = (n: number) => fmtCurrency(n, locale);

  const stats = useMemo(() => {
    let totalAnnualized = 0;
    let totalBudgetPeriod = 0;
    let totalConsumed = 0;
    let alertCount = 0;

    for (const b of budgets) {
      const amount = Number(b.amount);
      const multiplier = PERIOD_MULTIPLIER[b.period] || 12;
      totalAnnualized += amount * multiplier;
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

    return { totalAnnualized, totalBudgetPeriod, totalConsumed, globalPct, alertCount };
  }, [budgets, spending]);

  if (budgets.length === 0) return null;

  const cards = [
    {
      label: t.annualizedBudget,
      value: stats.totalAnnualized,
      icon: <Calendar className="w-4 h-4" />,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      label: t.consumedPeriod,
      value: stats.totalConsumed,
      icon: <PieChart className="w-4 h-4" />,
      color: 'text-secondary',
      bgColor: 'bg-secondary/10',
      suffix: ` / ${fmt(stats.totalBudgetPeriod)}`,
    },
    {
      label: t.globalConsumption,
      valueRaw: `${stats.globalPct}%`,
      icon: <TrendingUp className="w-4 h-4" />,
      color: stats.globalPct > 100 ? 'text-destructive' : stats.globalPct >= 80 ? 'text-accent' : 'text-secondary',
      bgColor: stats.globalPct > 100 ? 'bg-destructive/10' : stats.globalPct >= 80 ? 'bg-accent/10' : 'bg-secondary/10',
    },
    {
      label: t.budgetsInAlert,
      valueRaw: String(stats.alertCount),
      icon: <AlertTriangle className="w-4 h-4" />,
      color: stats.alertCount > 0 ? 'text-destructive' : 'text-muted-foreground',
      bgColor: stats.alertCount > 0 ? 'bg-destructive/10' : 'bg-muted',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((c, i) => (
        <Card key={i} className="border border-border/50 shadow-[var(--shadow-card)] rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${c.bgColor} ${c.color}`}>
                {c.icon}
              </div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{c.label}</span>
            </div>
            <div className="flex items-baseline gap-1">
              {c.valueRaw ? (
                <span className={`text-xl font-extrabold ${c.color}`}>{c.valueRaw}</span>
              ) : (
                <AnimatedNumber value={c.value!} format={fmt} className={`text-xl font-extrabold ${c.color}`} />
              )}
              {c.suffix && <span className="text-xs text-muted-foreground">{c.suffix}</span>}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default BudgetGlobalStats;
