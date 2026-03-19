import { useMemo } from 'react';
import { useLanguage } from '@/i18n/LanguageContext';
import { dashT } from '@/i18n/dashTranslations';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, AlertTriangle, PieChart, Calendar, ChevronRight } from 'lucide-react';
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
  fmt: (n: number) => string;
  onCardClick?: (action: string) => void;
}

const BudgetGlobalStats = ({ budgets, spending, fmt, onCardClick }: BudgetGlobalStatsProps) => {
  const { locale } = useLanguage();
  const t = dashT[locale];

  const stats = useMemo(() => {
    let totalAnnualized = 0;
    let totalBudgetPeriod = 0;
    let totalConsumed = 0;
    let alertCount = 0;

    for (const b of budgets) {
      const amount = Number(b.amount);
      const activeDaysArr = b.active_days ? String(b.active_days).split(',').filter(Boolean) : [];
      const multiplier = b.period === 'daily' && activeDaysArr.length > 0
        ? Math.round((activeDaysArr.length / 7) * 365)
        : (PERIOD_MULTIPLIER[b.period] || 12);
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
      action: 'evolution',
    },
    {
      label: t.consumedPeriod,
      value: stats.totalConsumed,
      icon: <PieChart className="w-4 h-4" />,
      color: 'text-secondary',
      bgColor: 'bg-secondary/10',
      suffix: ` / ${fmt(stats.totalBudgetPeriod)}`,
      action: 'consumed',
    },
    {
      label: t.globalConsumption,
      valueRaw: `${stats.globalPct}%`,
      icon: <TrendingUp className="w-4 h-4" />,
      color: stats.globalPct > 100 ? 'text-destructive' : stats.globalPct >= 80 ? 'text-accent' : 'text-secondary',
      bgColor: stats.globalPct > 100 ? 'bg-destructive/10' : stats.globalPct >= 80 ? 'bg-accent/10' : 'bg-secondary/10',
      action: 'analysis',
    },
    {
      label: t.budgetsInAlert,
      valueRaw: String(stats.alertCount),
      icon: <AlertTriangle className="w-4 h-4" />,
      color: stats.alertCount > 0 ? 'text-destructive' : 'text-muted-foreground',
      bgColor: stats.alertCount > 0 ? 'bg-destructive/10' : 'bg-muted',
      action: 'alerts',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((c, i) => (
        <Card
          key={i}
          className={`border border-border/50 shadow-[var(--shadow-card)] rounded-2xl transition-all duration-200 ${onCardClick ? 'cursor-pointer hover:shadow-[var(--shadow-soft)] hover:-translate-y-0.5 group' : ''}`}
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
