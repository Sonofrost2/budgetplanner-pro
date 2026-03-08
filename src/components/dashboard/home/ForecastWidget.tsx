import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart3, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

interface ForecastWidgetProps {
  monthlyData: { name: string; income: number; expenses: number }[];
  fmt: (n: number) => string;
  t: Record<string, string>;
}

export const ForecastWidget = ({ monthlyData, fmt, t }: ForecastWidgetProps) => {
  const navigate = useNavigate();

  const recent = monthlyData.slice(-3);
  const avgIncome = recent.length > 0 ? recent.reduce((s, m) => s + m.income, 0) / recent.length : 0;
  const avgExpenses = recent.length > 0 ? recent.reduce((s, m) => s + m.expenses, 0) / recent.length : 0;
  const projectedSavings = avgIncome - avgExpenses;
  const savingsRate = avgIncome > 0 ? ((projectedSavings / avgIncome) * 100) : 0;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
      <Card className="border border-border/50 shadow-[var(--shadow-card)]">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <BarChart3 className="w-3.5 h-3.5 text-primary" />
            </div>
            {t.forecasts}
          </CardTitle>
          <Button variant="ghost" size="sm" className="text-xs h-7 px-2 text-muted-foreground" onClick={() => navigate('/dashboard/forecasts')}>
            {t.detailed || 'Détaillé'} <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </CardHeader>
        <CardContent className="pt-0">
          {recent.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-2xl bg-muted mx-auto mb-3 flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-muted-foreground/50" />
              </div>
              <p className="text-sm text-muted-foreground">{t.noData}</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-secondary/5 border border-secondary/10 p-4 text-center">
                <TrendingUp className="w-5 h-5 text-secondary mx-auto mb-2" />
                <p className="text-[11px] text-muted-foreground mb-1">{t.avgIncome}</p>
                <p className="text-sm font-bold text-secondary">+{fmt(avgIncome)}</p>
              </div>
              <div className="rounded-xl bg-destructive/5 border border-destructive/10 p-4 text-center">
                <TrendingDown className="w-5 h-5 text-destructive mx-auto mb-2" />
                <p className="text-[11px] text-muted-foreground mb-1">{t.avgExpenses}</p>
                <p className="text-sm font-bold text-destructive">-{fmt(avgExpenses)}</p>
              </div>
              <div className="rounded-xl bg-primary/5 border border-primary/10 p-4 text-center">
                <BarChart3 className="w-5 h-5 text-primary mx-auto mb-2" />
                <p className="text-[11px] text-muted-foreground mb-1">{t.savingsRate}</p>
                <p className={`text-sm font-bold ${savingsRate >= 0 ? 'text-secondary' : 'text-destructive'}`}>
                  {savingsRate.toFixed(1)}%
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};
