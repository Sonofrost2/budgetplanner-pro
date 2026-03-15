import { TrendingUp, TrendingDown, Wallet, Percent, Calculator, Hash, BarChart3 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { DashTranslations } from '@/i18n/dashTranslations';

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
}

const fmtCompact = (n: number, locale: string) =>
  new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(n);

export const StatsCards = ({ balance, totalIncome, totalExpenses, fmt, t, savingsRate, netCashFlow, transactionCount, dailyAverage }: StatsCardsProps) => {
  const stats = [
    { label: t.totalBalance, value: fmt(balance), compact: fmtCompact(balance, 'fr'), color: '', icon: Wallet, iconColor: 'text-primary', bg: 'bg-primary/10', delay: 0, primary: true },
    { label: t.income, value: `+${fmt(totalIncome)}`, compact: `+${fmtCompact(totalIncome, 'fr')}`, color: 'text-secondary', icon: TrendingUp, iconColor: 'text-secondary', bg: 'bg-secondary/10', delay: 0.05, primary: true },
    { label: t.expenses, value: `-${fmt(totalExpenses)}`, compact: `-${fmtCompact(totalExpenses, 'fr')}`, color: 'text-destructive', icon: TrendingDown, iconColor: 'text-destructive', bg: 'bg-destructive/10', delay: 0.1, primary: true },
    ...(netCashFlow !== undefined ? [{
      label: t.netCashFlow, value: fmt(netCashFlow), compact: fmtCompact(netCashFlow, 'fr'), color: netCashFlow >= 0 ? 'text-secondary' : 'text-destructive',
      icon: Calculator, iconColor: netCashFlow >= 0 ? 'text-secondary' : 'text-destructive', bg: netCashFlow >= 0 ? 'bg-secondary/10' : 'bg-destructive/10', delay: 0.15, primary: true,
    }] : []),
    ...(transactionCount !== undefined ? [{
      label: t.transactionCount, value: `${transactionCount}`, compact: `${transactionCount}`, color: '',
      icon: Hash, iconColor: 'text-primary', bg: 'bg-primary/10', delay: 0.2, primary: false,
    }] : []),
    ...(savingsRate !== undefined ? [{
      label: t.savingsRate, value: `${savingsRate.toFixed(1)}%`, compact: `${savingsRate.toFixed(1)}%`, color: savingsRate >= 0 ? 'text-secondary' : 'text-destructive',
      icon: Percent, iconColor: 'text-primary', bg: 'bg-primary/10', delay: 0.25, primary: false,
    }] : []),
    ...(dailyAverage !== undefined ? [{
      label: t.dailyAverage, value: fmt(dailyAverage), compact: fmtCompact(dailyAverage, 'fr'), color: 'text-muted-foreground',
      icon: BarChart3, iconColor: 'text-primary', bg: 'bg-primary/10', delay: 0.3, primary: false,
    }] : []),
  ];

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
                      <p className={`text-sm font-bold ${s.color} truncate hidden sm:block`}>{s.value}</p>
                      <p className={`text-sm font-bold ${s.color} truncate sm:hidden`}>{s.compact}</p>
                    </div>
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p className="text-xs font-semibold">{s.label}: {s.value}</p>
              </TooltipContent>
            </Tooltip>
          </motion.div>
        ))}
      </div>
    </TooltipProvider>
  );
};
