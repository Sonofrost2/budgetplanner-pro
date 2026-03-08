import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { motion } from 'framer-motion';

interface StatsCardsProps {
  balance: number;
  totalIncome: number;
  totalExpenses: number;
  fmt: (n: number) => string;
  t: Record<string, string>;
}

export const StatsCards = ({ balance, totalIncome, totalExpenses, fmt, t }: StatsCardsProps) => {
  const stats = [
    { label: t.totalBalance, value: fmt(balance), color: '', icon: null, delay: 0 },
    { label: t.income, value: `+${fmt(totalIncome)}`, color: 'text-secondary', icon: TrendingUp, delay: 0.1 },
    { label: t.expenses, value: `-${fmt(totalExpenses)}`, color: 'text-destructive', icon: TrendingDown, delay: 0.2 },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {stats.map((s, i) => (
        <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: s.delay }}>
          <Card className="border-none shadow-[var(--shadow-card)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                {s.icon && <s.icon className={`w-4 h-4 ${s.color}`} />}
                {s.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
};
