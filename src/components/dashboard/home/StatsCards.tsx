import { TrendingUp, TrendingDown, Wallet, Percent, Calculator, Hash, BarChart3, ChevronDown, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import type { DashTranslations } from '@/i18n/dashTranslations';

interface StatsCardsProps {
  balance: number;
  totalIncome: number;
  totalExpenses: number;
  fmt: (n: number) => string;
  t: DashTranslations;
  onIncomeClick?: () => void;
  onExpenseClick?: () => void;
  onBalanceClick?: () => void;
  savingsRate?: number;
  netCashFlow?: number;
  transactionCount?: number;
  dailyAverage?: number;
  topExpense?: { description: string; amount: number };
  topIncome?: { description: string; amount: number };
  prevIncome?: number;
  prevExpenses?: number;
  prevNetCashFlow?: number;
  prevTransactionCount?: number;
  prevDailyAverage?: number;
  prevSavingsRate?: number;
  dailyIncomeData?: number[];
  dailyExpenseData?: number[];
  dailyBalanceData?: number[];
}

const calcTrend = (current: number, previous: number): number | undefined => {
  if (previous === 0 && current === 0) return 0;
  if (previous === 0) return current > 0 ? 100 : -100;
  return ((current - previous) / Math.abs(previous)) * 100;
};

/** Tiny inline SVG sparkline */
const Sparkline = ({ data, color, className }: { data: number[]; color: string; className?: string }) => {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const w = 80;
  const h = 28;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  }).join(' ');

  // Area fill
  const areaPoints = `0,${h} ${points} ${w},${h}`;

  return (
    <svg width={w} height={h} className={`flex-shrink-0 ${className || ''}`}>
      <polygon points={areaPoints} fill={color} opacity="0.1" />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

const TrendBadge = ({ trend, invertColor }: { trend?: number; invertColor?: boolean }) => {
  if (trend === undefined || trend === 0) return null;
  const positive = trend > 0;
  const isGood = invertColor ? !positive : positive;
  const Icon = positive ? TrendingUp : TrendingDown;
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
        isGood ? 'text-secondary bg-secondary/10' : 'text-destructive bg-destructive/10'
      }`}
    >
      <Icon className="w-3 h-3" />
      {Math.abs(trend).toFixed(0)}%
    </motion.span>
  );
};

/** Hero stat card — larger, more prominent */
const HeroCard = ({ label, value, icon: Icon, iconColor, bg, color, trend, invertTrend, sparkline, sparklineColor, delay, onClick }: {
  label: string; value: string; icon: typeof Wallet; iconColor: string; bg: string; color: string;
  trend?: number; invertTrend?: boolean; sparkline?: number[]; sparklineColor: string; delay: number;
  onClick?: () => void;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20, scale: 0.95 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    transition={{ delay, duration: 0.4, ease: 'easeOut' }}
    whileHover={{ scale: 1.02 }}
    whileTap={onClick ? { scale: 0.97 } : undefined}
    onClick={onClick}
    className={`glass rounded-2xl p-4 hover:bg-glass-hover transition-all duration-300 group ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
  >
    <div className="flex items-start justify-between mb-3">
      <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
        <Icon className={`w-4.5 h-4.5 ${iconColor}`} />
      </div>
      <TrendBadge trend={trend} invertColor={invertTrend} />
    </div>
    <div className="flex items-end justify-between gap-2">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
        <p className={`text-lg sm:text-xl font-extrabold ${color} truncate leading-tight`}>{value}</p>
      </div>
      {sparkline && sparkline.length >= 2 && (
        <Sparkline data={sparkline} color={sparklineColor} className="opacity-70 group-hover:opacity-100 transition-opacity duration-300" />
      )}
    </div>
  </motion.div>
);

/** Secondary stat — compact, used in the drawer */
const SecondaryStatRow = ({ label, value, icon: Icon, iconColor, bg, color, trend, invertTrend, tooltip }: {
  label: string; value: string; icon: typeof Wallet; iconColor: string; bg: string; color: string;
  trend?: number; invertTrend?: boolean; tooltip?: string;
}) => (
  <motion.div
    initial={{ opacity: 0, x: -10 }}
    animate={{ opacity: 1, x: 0 }}
    className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/30 transition-colors"
  >
    <div className="flex items-center gap-3">
      <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center`}>
        <Icon className={`w-4 h-4 ${iconColor}`} />
      </div>
      <div>
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className={`text-sm font-bold ${color}`}>{value}</p>
      </div>
    </div>
    <TrendBadge trend={trend} invertColor={invertTrend} />
  </motion.div>
);

export const StatsCards = ({
  balance, totalIncome, totalExpenses, fmt, t,
  onIncomeClick, onExpenseClick, onBalanceClick,
  savingsRate, netCashFlow, transactionCount, dailyAverage,
  topExpense, topIncome,
  prevIncome, prevExpenses, prevNetCashFlow, prevTransactionCount, prevDailyAverage, prevSavingsRate,
  dailyIncomeData, dailyExpenseData, dailyBalanceData,
}: StatsCardsProps) => {
  const [detailsOpen, setDetailsOpen] = useState(false);

  const secondaryStats = [
    ...(netCashFlow !== undefined ? [{
      label: t.netCashFlow, value: fmt(netCashFlow),
      color: netCashFlow >= 0 ? 'text-secondary' : 'text-destructive',
      icon: Calculator, iconColor: netCashFlow >= 0 ? 'text-secondary' : 'text-destructive',
      bg: netCashFlow >= 0 ? 'bg-secondary/10' : 'bg-destructive/10',
      trend: prevNetCashFlow !== undefined ? calcTrend(netCashFlow, prevNetCashFlow) : undefined,
    }] : []),
    ...(transactionCount !== undefined ? [{
      label: t.transactionCount, value: `${transactionCount}`,
      color: '', icon: Hash, iconColor: 'text-primary', bg: 'bg-primary/10',
      trend: prevTransactionCount !== undefined ? calcTrend(transactionCount, prevTransactionCount) : undefined,
    }] : []),
    ...(savingsRate !== undefined ? [{
      label: t.savingsRate, value: `${savingsRate.toFixed(1)}%`,
      color: savingsRate >= 0 ? 'text-secondary' : 'text-destructive',
      icon: Percent, iconColor: 'text-primary', bg: 'bg-primary/10',
      trend: prevSavingsRate !== undefined ? calcTrend(savingsRate, prevSavingsRate) : undefined,
    }] : []),
    ...(dailyAverage !== undefined ? [{
      label: t.dailyAverage, value: fmt(dailyAverage),
      color: 'text-muted-foreground', icon: BarChart3, iconColor: 'text-primary', bg: 'bg-primary/10',
      trend: prevDailyAverage !== undefined ? calcTrend(dailyAverage, prevDailyAverage) : undefined,
    }] : []),
    ...(topExpense ? [{
      label: t.topExpense,
      value: `${fmt(topExpense.amount)}`,
      color: 'text-destructive', icon: TrendingDown, iconColor: 'text-destructive', bg: 'bg-destructive/10',
      tooltip: topExpense.description,
    }] : []),
    ...(topIncome ? [{
      label: t.topIncome,
      value: `${fmt(topIncome.amount)}`,
      color: 'text-secondary', icon: TrendingUp, iconColor: 'text-secondary', bg: 'bg-secondary/10',
      tooltip: topIncome.description,
    }] : []),
  ];

  return (
    <div className="space-y-3">
      {/* 3 Hero Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <HeroCard
          label={t.totalBalance} value={fmt(balance)}
          icon={Wallet} iconColor="text-primary" bg="bg-primary/10" color=""
          sparkline={dailyBalanceData} sparklineColor="hsl(250, 85%, 60%)" delay={0}
          onClick={onBalanceClick}
        />
        <HeroCard
          label={t.income} value={`+${fmt(totalIncome)}`}
          icon={TrendingUp} iconColor="text-secondary" bg="bg-secondary/10" color="text-secondary"
          trend={prevIncome !== undefined ? calcTrend(totalIncome, prevIncome) : undefined}
          sparkline={dailyIncomeData} sparklineColor="hsl(165, 70%, 46%)" delay={0.08}
          onClick={onIncomeClick}
        />
        <HeroCard
          label={t.expenses} value={`-${fmt(totalExpenses)}`}
          icon={TrendingDown} iconColor="text-destructive" bg="bg-destructive/10" color="text-destructive"
          trend={prevExpenses !== undefined ? calcTrend(totalExpenses, prevExpenses) : undefined}
          invertTrend
          sparkline={dailyExpenseData} sparklineColor="hsl(0, 84%, 60%)" delay={0.16}
          onClick={onExpenseClick}
        />
      </div>

      {/* "See more" button → opens Sheet with secondary stats */}
      {secondaryStats.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="flex justify-center"
        >
          <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground hover:text-foreground gap-1.5 rounded-full px-4 glass border border-glass-border hover:bg-glass-hover"
              >
                <Eye className="w-3.5 h-3.5" />
                {t.moreDetails}
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${detailsOpen ? 'rotate-180' : ''}`} />
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-3xl max-h-[60vh]">
              <SheetHeader className="pb-2">
                <SheetTitle className="text-sm font-bold">{t.moreDetails}</SheetTitle>
              </SheetHeader>
              <div className="space-y-1 overflow-y-auto">
                {secondaryStats.map((s, i) => (
                  <SecondaryStatRow
                    key={i}
                    label={s.label}
                    value={s.value}
                    icon={s.icon}
                    iconColor={s.iconColor}
                    bg={s.bg}
                    color={s.color}
                    trend={s.trend}
                    tooltip={s.tooltip}
                  />
                ))}
              </div>
            </SheetContent>
          </Sheet>
        </motion.div>
      )}
    </div>
  );
};
