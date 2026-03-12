import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Wallet, Percent, Calculator } from 'lucide-react';
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
}

const fmtCompact = (n: number, locale: string) =>
  new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(n);

export const StatsCards = ({ balance, totalIncome, totalExpenses, fmt, t, savingsRate, netCashFlow }: StatsCardsProps) => {
  const stats = [
    { label: t.totalBalance, value: fmt(balance), compact: fmtCompact(balance, 'fr'), color: '', icon: Wallet, iconColor: 'text-primary', bg: 'bg-primary/10', delay: 0, primary: true },
    { label: t.income, value: `+${fmt(totalIncome)}`, compact: `+${fmtCompact(totalIncome, 'fr')}`, color: 'text-secondary', icon: TrendingUp, iconColor: 'text-secondary', bg: 'bg-secondary/10', delay: 0.1, primary: true },
    { label: t.expenses, value: `-${fmt(totalExpenses)}`, compact: `-${fmtCompact(totalExpenses, 'fr')}`, color: 'text-destructive', icon: TrendingDown, iconColor: 'text-destructive', bg: 'bg-destructive/10', delay: 0.2, primary: true },
    ...(savingsRate !== undefined ? [{
      label: t.savingsRate, value: `${savingsRate.toFixed(1)}%`, compact: `${savingsRate.toFixed(1)}%`, color: savingsRate >= 0 ? 'text-secondary' : 'text-destructive',
      icon: Percent, iconColor: 'text-primary', bg: 'bg-primary/10', delay: 0.3, primary: false,
    }] : []),
    ...(netCashFlow !== undefined ? [{
      label: (t as any).netCashFlow || 'Trésorerie nette', value: fmt(netCashFlow), compact: fmtCompact(netCashFlow, 'fr'), color: netCashFlow >= 0 ? 'text-secondary' : 'text-destructive',
      icon: Calculator, iconColor: netCashFlow >= 0 ? 'text-secondary' : 'text-destructive', bg: netCashFlow >= 0 ? 'bg-secondary/10' : 'bg-destructive/10', delay: 0.4, primary: false,
    }] : []),
  ];

  return (
    <TooltipProvider delayDuration={200}>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {stats.map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: s.delay, duration: 0.4 }}
            className={!s.primary ? 'hidden sm:block' : ''}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <Card className="border border-border/50 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-soft)] transition-shadow duration-300 overflow-hidden h-full">
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex items-center gap-2.5 sm:gap-3">
                      <div className={`w-9 h-9 sm:w-11 sm:h-11 rounded-xl ${s.bg} flex items-center justify-center flex-shrink-0`}>
                        <s.icon className={`w-4 h-4 sm:w-5 sm:h-5 ${s.iconColor}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] sm:text-xs font-medium text-muted-foreground truncate">{s.label}</p>
                        {/* Full value on desktop, compact on mobile */}
                        <p className={`text-base sm:text-xl font-extrabold ${s.color} truncate hidden sm:block`}>{s.value}</p>
                        <p className={`text-base font-extrabold ${s.color} truncate sm:hidden`}>{s.compact}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p className="font-semibold">{s.label}: {s.value}</p>
              </TooltipContent>
            </Tooltip>
          </motion.div>
        ))}
      </div>
    </TooltipProvider>
  );
};
