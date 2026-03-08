import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart3, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

interface ForecastWidgetProps {
  monthlyData: { name: string; income: number; expenses: number }[];
  fmt: (n: number) => string;
  t: Record<string, string>;
}

export const ForecastWidget = ({ monthlyData, fmt, t }: ForecastWidgetProps) => {
  const navigate = useNavigate();

  // Simple forecast: average of last 3 months projected
  const recent = monthlyData.slice(-3);
  const avgIncome = recent.length > 0 ? recent.reduce((s, m) => s + m.income, 0) / recent.length : 0;
  const avgExpenses = recent.length > 0 ? recent.reduce((s, m) => s + m.expenses, 0) / recent.length : 0;
  const projectedSavings = avgIncome - avgExpenses;
  const savingsRate = avgIncome > 0 ? ((projectedSavings / avgIncome) * 100) : 0;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
      <Card className="border-none shadow-[var(--shadow-card)]">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            {t.forecasts}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/forecasts')}>
            {t.detailed || 'Détaillé'}
          </Button>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm text-muted-foreground">{t.noData}</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-muted/50 p-3">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                    <TrendingUp className="w-3 h-3" />
                    {t.avgIncome}
                  </div>
                  <p className="text-sm font-semibold text-secondary">+{fmt(avgIncome)}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                    <TrendingDown className="w-3 h-3" />
                    {t.avgExpenses}
                  </div>
                  <p className="text-sm font-semibold text-destructive">-{fmt(avgExpenses)}</p>
                </div>
              </div>
              <div className="rounded-lg bg-primary/5 border border-primary/10 p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Minus className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">{t.savingsRate}</span>
                </div>
                <span className={`text-sm font-bold ${savingsRate >= 0 ? 'text-secondary' : 'text-destructive'}`}>
                  {savingsRate.toFixed(1)}%
                </span>
              </div>
              <Button variant="outline" size="sm" className="w-full" onClick={() => navigate('/dashboard/forecasts')}>
                <BarChart3 className="w-4 h-4 mr-1" />
                {t.generateForecast}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};
