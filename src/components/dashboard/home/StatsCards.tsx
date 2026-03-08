import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { motion } from 'framer-motion';
import type { DashTranslations } from '@/i18n/dashTranslations';

interface StatsCardsProps {
  balance: number;
  totalIncome: number;
  totalExpenses: number;
  fmt: (n: number) => string;
  t: Record<string, string>;
}

export const StatsCards = ({ balance, totalIncome, totalExpenses, fmt, t }: StatsCardsProps) => {
  const stats = [
    { label: t.totalBalance, value: fmt(balance), color: '', icon: Wallet, iconColor: 'text-primary', bg: 'bg-primary/10', delay: 0 },
    { label: t.income, value: `+${fmt(totalIncome)}`, color: 'text-secondary', icon: TrendingUp, iconColor: 'text-secondary', bg: 'bg-secondary/10', delay: 0.1 },
    { label: t.expenses, value: `-${fmt(totalExpenses)}`, color: 'text-destructive', icon: TrendingDown, iconColor: 'text-destructive', bg: 'bg-destructive/10', delay: 0.2 },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {stats.map((s, i) => (
        <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: s.delay, duration: 0.4 }}>
          <Card className="border border-border/50 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-soft)] transition-shadow duration-300 overflow-hidden">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-xl ${s.bg} flex items-center justify-center flex-shrink-0`}>
                  <s.icon className={`w-5 h-5 ${s.iconColor}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground truncate">{s.label}</p>
                  <p className={`text-xl font-extrabold ${s.color} truncate`}>{s.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
};
