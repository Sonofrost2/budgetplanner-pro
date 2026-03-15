import { TrendingUp, TrendingDown, Wallet, Percent, Calculator, Hash, BarChart3, Minus } from 'lucide-react';
import { motion } from 'framer-motion';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { DashTranslations } from '@/i18n/dashTranslations';

interface StatItem {
  label: string;
  value: string;
  compact: string;
  color: string;
  icon: typeof Wallet;
  iconColor: string;
  bg: string;
  delay: number;
  primary: boolean;
  trend?: number; // percentage change vs previous period
  sparkline?: number[]; // daily data points for mini chart
}

interface StatsCardsProps {
  balance: number;
  totalIncome: number;
  totalExpenses: number;
  fmt: (n: number) => string;
  t: DashTranslations;
  savingsRate?: number;
  netCashFlow?: number;
  transactionCount?: number;
  dailyAverage?: number;
  // Previous period comparison
  prevIncome?: number;
  prevExpenses?: number;
  prevNetCashFlow?: number;
  prevTransactionCount?: number;
  prevDailyAverage?: number;
  prevSavingsRate?: number;
  // Sparkline daily data
  dailyIncomeData?: number[];
  dailyExpenseData?: number[];
  dailyBalanceData?: number[];
}

const fmtCompact = (n: number, locale: string) =>
  new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(n);

const calcTrend = (current: number, previous: number): number | undefined => {
  if (previous === 0 && current === 0) return 0;
  if (previous === 0) return current > 0 ? 100 : -100;
  return ((current - previous) / Math.abs(previous)) * 100;
};

/** Tiny inline SVG sparkline */
const Sparkline = ({ data, color }: { data: number[]; color: string }) => {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const w = 60;
  const h = 20;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 2) - 1;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={w} height={h} className="flex-shrink-0 opacity-60">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

const TrendBadge = ({ trend, invertColor }: { trend?: number; invertColor?: boolean }) => {
  if (trend === undefined || trend === 0) return null;
  const positive = trend > 0;
  // For expenses, positive trend = bad (red), negative = good (green)
  const isGood = invertColor ? !positive : positive;
  const Icon = positive ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[8px] font-semibold ${isGood ? 'text-secondary' : 'text-destructive'}`}>
      <Icon className="w-2.5 h-2.5" />
      {Math.abs(trend).toFixed(0)}%
    </span>
  );
};

export const StatsCards = ({
  balance, totalIncome, totalExpenses, fmt, t,
  savingsRate, netCashFlow, transactionCount, dailyAverage,
  prevIncome, prevExpenses, prevNetCashFlow, prevTransactionCount, prevDailyAverage, prevSavingsRate,
  dailyIncomeData, dailyExpenseData, dailyBalanceData,
}: StatsCardsProps) => {
  const stats: StatItem[] = [
    {
      label: t.totalBalance, value: fmt(balance), compact: fmtCompact(balance, 'fr'),
      color: '', icon: Wallet, iconColor: 'text-primary', bg: 'bg-primary/10', delay: 0, primary: true,
      sparkline: dailyBalanceData,
    },
    {
      label: t.income, value: `+${fmt(totalIncome)}`, compact: `+${fmtCompact(totalIncome, 'fr')}`,
      color: 'text-secondary', icon: TrendingUp, iconColor: 'text-secondary', bg: 'bg-secondary/10', delay: 0.05, primary: true,
      trend: prevIncome !== undefined ? calcTrend(totalIncome, prevIncome) : undefined,
      sparkline: dailyIncomeData,
    },
    {
      label: t.expenses, value: `-${fmt(totalExpenses)}`, compact: `-${fmtCompact(totalExpenses, 'fr')}`,
      color: 'text-destructive', icon: TrendingDown, iconColor: 'text-destructive', bg: 'bg-destructive/10', delay: 0.1, primary: true,
      trend: prevExpenses !== undefined ? calcTrend(totalExpenses, prevExpenses) : undefined,
      sparkline: dailyExpenseData,
    },
    ...(netCashFlow !== undefined ? [{
      label: t.netCashFlow, value: fmt(netCashFlow), compact: fmtCompact(netCashFlow, 'fr'),
      color: netCashFlow >= 0 ? 'text-secondary' : 'text-destructive',
      icon: Calculator, iconColor: netCashFlow >= 0 ? 'text-secondary' : 'text-destructive',
      bg: netCashFlow >= 0 ? 'bg-secondary/10' : 'bg-destructive/10', delay: 0.15, primary: true,
      trend: prevNetCashFlow !== undefined ? calcTrend(netCashFlow, prevNetCashFlow) : undefined,
    } as StatItem] : []),
    ...(transactionCount !== undefined ? [{
      label: t.transactionCount, value: `${transactionCount}`, compact: `${transactionCount}`,
      color: '', icon: Hash, iconColor: 'text-primary', bg: 'bg-primary/10', delay: 0.2, primary: false,
      trend: prevTransactionCount !== undefined ? calcTrend(transactionCount, prevTransactionCount) : undefined,
    } as StatItem] : []),
    ...(savingsRate !== undefined ? [{
      label: t.savingsRate, value: `${savingsRate.toFixed(1)}%`, compact: `${savingsRate.toFixed(1)}%`,
      color: savingsRate >= 0 ? 'text-secondary' : 'text-destructive',
      icon: Percent, iconColor: 'text-primary', bg: 'bg-primary/10', delay: 0.25, primary: false,
      trend: prevSavingsRate !== undefined ? calcTrend(savingsRate, prevSavingsRate) : undefined,
    } as StatItem] : []),
    ...(dailyAverage !== undefined ? [{
      label: t.dailyAverage, value: fmt(dailyAverage), compact: fmtCompact(dailyAverage, 'fr'),
      color: 'text-muted-foreground', icon: BarChart3, iconColor: 'text-primary', bg: 'bg-primary/10', delay: 0.3, primary: false,
      trend: prevDailyAverage !== undefined ? calcTrend(dailyAverage, prevDailyAverage) : undefined,
    } as StatItem] : []),
  ];

  // Determine which stats should have inverted color logic for trend (expenses: up = bad)
  const invertTrendIndices = new Set([2]); // index 2 = expenses

  return (
    <TooltipProvider delayDuration={200}>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {stats.map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: s.delay, duration: 0.3 }}
            className={!s.primary ? 'hidden sm:block' : ''}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="glass rounded-2xl p-3 hover:bg-glass-hover transition-all duration-200 cursor-default h-full">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-xl ${s.bg} flex items-center justify-center flex-shrink-0`}>
                      <s.icon className={`w-3.5 h-3.5 ${s.iconColor}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[9px] font-medium text-muted-foreground truncate">{s.label}</p>
                      <div className="flex items-center gap-1">
                        <p className={`text-sm font-bold ${s.color} truncate hidden sm:block`}>{s.value}</p>
                        <p className={`text-sm font-bold ${s.color} truncate sm:hidden`}>{s.compact}</p>
                        <TrendBadge trend={s.trend} invertColor={invertTrendIndices.has(i)} />
                      </div>
                    </div>
                  </div>
                  {/* Sparkline */}
                  {s.sparkline && s.sparkline.length >= 2 && (
                    <div className="mt-1.5 flex justify-end">
                      <Sparkline
                        data={s.sparkline}
                        color={s.iconColor === 'text-secondary' ? 'hsl(165, 70%, 46%)' :
                               s.iconColor === 'text-destructive' ? 'hsl(0, 84%, 60%)' :
                               'hsl(250, 85%, 60%)'}
                      />
                    </div>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p className="text-xs font-semibold">{s.label}: {s.value}</p>
                {s.trend !== undefined && s.trend !== 0 && (
                  <p className="text-[10px] text-muted-foreground">
                    {s.trend > 0 ? '+' : ''}{s.trend.toFixed(1)}% vs précédent
                  </p>
                )}
              </TooltipContent>
            </Tooltip>
          </motion.div>
        ))}
      </div>
    </TooltipProvider>
  );
};
