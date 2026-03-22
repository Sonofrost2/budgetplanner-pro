import { TrendingUp, TrendingDown, Wallet, Percent, Calculator, BarChart3, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { motion } from 'framer-motion';
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
  const w = 100;
  const h = 36;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  }).join(' ');
  const areaPoints = `0,${h} ${points} ${w},${h}`;

  return (
    <svg width={w} height={h} className={`${className || ''}`} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`sg-${color.replace(/[^a-z0-9]/g, '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#sg-${color.replace(/[^a-z0-9]/g, '')})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

const TrendBadge = ({ trend, invertColor }: { trend?: number; invertColor?: boolean }) => {
  if (trend === undefined || trend === 0) return null;
  const positive = trend > 0;
  const isGood = invertColor ? !positive : positive;
  const Icon = positive ? ArrowUpRight : ArrowDownRight;
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full ${
        isGood ? 'text-secondary bg-secondary/10' : 'text-destructive bg-destructive/10'
      }`}
    >
      <Icon className="w-3 h-3" />
      {Math.abs(trend).toFixed(0)}%
    </motion.span>
  );
};

export const StatsCards = ({
  balance, totalIncome, totalExpenses, fmt, t,
  onIncomeClick, onExpenseClick, onBalanceClick,
  savingsRate, netCashFlow, transactionCount, dailyAverage,
  prevIncome, prevExpenses, prevNetCashFlow, prevDailyAverage, prevSavingsRate,
  dailyIncomeData, dailyExpenseData, dailyBalanceData,
}: StatsCardsProps) => {
  return (
    <div className="space-y-3">
      {/* Hero balance card — full width, gradient */}
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        whileHover={{ scale: 1.005 }}
        onClick={onBalanceClick}
        className="relative overflow-hidden rounded-3xl p-5 sm:p-6 cursor-pointer group"
        style={{ background: 'var(--gradient-primary)' }}
      >
        {/* Mesh overlay */}
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, rgba(255,255,255,0.3) 0%, transparent 50%), radial-gradient(circle at 20% 80%, rgba(255,255,255,0.15) 0%, transparent 50%)' }} />
        <div className="relative z-10 flex items-end justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center">
                <Wallet className="w-4.5 h-4.5 text-white" />
              </div>
              <p className="text-xs font-semibold text-white/70 uppercase tracking-wider">{t.totalBalance}</p>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold text-white tabular-nums tracking-tight leading-none">{fmt(balance)}</p>
            {/* Mini stats row */}
            <div className="flex flex-wrap items-center gap-3 mt-3">
              {netCashFlow !== undefined && (
                <span className={`text-xs font-semibold flex items-center gap-1 ${netCashFlow >= 0 ? 'text-emerald-200' : 'text-red-200'}`}>
                  {netCashFlow >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {netCashFlow >= 0 ? '+' : ''}{fmt(netCashFlow)}
                </span>
              )}
              {savingsRate !== undefined && (
                <span className="text-xs font-semibold text-white/60 flex items-center gap-1">
                  <Percent className="w-3 h-3" />
                  {savingsRate.toFixed(0)}%
                </span>
              )}
              {transactionCount !== undefined && (
                <span className="text-xs font-semibold text-white/60">
                  {transactionCount} tx
                </span>
              )}
            </div>
          </div>
          {dailyBalanceData && dailyBalanceData.length >= 2 && (
            <div className="flex-shrink-0 w-28 opacity-80 group-hover:opacity-100 transition-opacity">
              <Sparkline data={dailyBalanceData} color="rgba(255,255,255,0.9)" />
            </div>
          )}
        </div>
      </motion.div>

      {/* 3 secondary cards */}
      <div className="grid grid-cols-3 gap-3">
        {/* Income */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.97 }}
          onClick={onIncomeClick}
          className="glass rounded-2xl p-3 sm:p-4 cursor-pointer group glow-primary"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 rounded-xl bg-secondary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
              <TrendingUp className="w-4 h-4 text-secondary" />
            </div>
            <TrendBadge trend={prevIncome !== undefined ? calcTrend(totalIncome, prevIncome) : undefined} />
          </div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">{t.income}</p>
          <p className="text-sm sm:text-base font-extrabold text-secondary tabular-nums truncate leading-tight">+{fmt(totalIncome)}</p>
          {dailyIncomeData && dailyIncomeData.length >= 2 && (
            <div className="mt-2 -mx-1 opacity-60 group-hover:opacity-100 transition-opacity">
              <Sparkline data={dailyIncomeData} color="hsl(165, 70%, 46%)" className="w-full h-6" />
            </div>
          )}
        </motion.div>

        {/* Expenses */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4 }}
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.97 }}
          onClick={onExpenseClick}
          className="glass rounded-2xl p-3 sm:p-4 cursor-pointer group glow-primary"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 rounded-xl bg-destructive/10 flex items-center justify-center group-hover:scale-110 transition-transform">
              <TrendingDown className="w-4 h-4 text-destructive" />
            </div>
            <TrendBadge trend={prevExpenses !== undefined ? calcTrend(totalExpenses, prevExpenses) : undefined} invertColor />
          </div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">{t.expenses}</p>
          <p className="text-sm sm:text-base font-extrabold text-destructive tabular-nums truncate leading-tight">-{fmt(totalExpenses)}</p>
          {dailyExpenseData && dailyExpenseData.length >= 2 && (
            <div className="mt-2 -mx-1 opacity-60 group-hover:opacity-100 transition-opacity">
              <Sparkline data={dailyExpenseData} color="hsl(0, 84%, 60%)" className="w-full h-6" />
            </div>
          )}
        </motion.div>

        {/* Daily average */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          whileHover={{ scale: 1.02, y: -2 }}
          className="glass rounded-2xl p-3 sm:p-4 glow-primary"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-primary" />
            </div>
            <TrendBadge trend={prevDailyAverage !== undefined && dailyAverage !== undefined ? calcTrend(dailyAverage, prevDailyAverage) : undefined} invertColor />
          </div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">{t.dailyAverage}</p>
          <p className="text-sm sm:text-base font-extrabold tabular-nums truncate leading-tight">{dailyAverage !== undefined ? fmt(dailyAverage) : '—'}</p>
          {prevSavingsRate !== undefined && savingsRate !== undefined && (
            <p className="text-[10px] text-muted-foreground mt-1.5">
              {t.savingsRate}: <span className={`font-bold ${savingsRate >= 0 ? 'text-secondary' : 'text-destructive'}`}>{savingsRate.toFixed(0)}%</span>
            </p>
          )}
        </motion.div>
      </div>
    </div>
  );
};
