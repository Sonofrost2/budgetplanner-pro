import type { DashTranslations } from '@/i18n/dashTranslations';
import { Button } from '@/components/ui/button';
import { BarChart3, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

interface ForecastWidgetProps {
  monthlyData: { name: string; income: number; expenses: number }[];
  fmt: (n: number) => string;
  t: DashTranslations;
}

export const ForecastWidget = ({ monthlyData, fmt, t }: ForecastWidgetProps) => {
  const navigate = useNavigate();

  const recent = monthlyData.slice(-3);
  const avgIncome = recent.length > 0 ? recent.reduce((s, m) => s + m.income, 0) / recent.length : 0;
  const avgExpenses = recent.length > 0 ? recent.reduce((s, m) => s + m.expenses, 0) / recent.length : 0;
  const savingsRate = avgIncome > 0 ? (((avgIncome - avgExpenses) / avgIncome) * 100) : 0;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
      <div className="glass rounded-2xl">
        <div className="flex items-center justify-between p-4 pb-3">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <BarChart3 className="w-3.5 h-3.5 text-primary" />
            </div>
            {t.forecasts}
          </h3>
          <Button variant="ghost" size="sm" className="text-[10px] h-6 px-2 text-muted-foreground" onClick={() => navigate('/dashboard/forecasts')}>
            {t.detailed || 'Détaillé'} <ArrowRight className="w-3 h-3 ml-0.5" />
          </Button>
        </div>
        <div className="px-4 pb-4">
          {recent.length === 0 ? (
            <div className="text-center py-6">
              <div className="w-10 h-10 rounded-xl bg-muted/50 mx-auto mb-2.5 flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-muted-foreground/40" />
              </div>
              <p className="text-xs text-muted-foreground">{t.noData}</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3 cursor-pointer active:scale-[0.98] transition-transform" onClick={() => navigate('/dashboard/forecasts')}>
              <div className="rounded-xl bg-secondary/5 border border-secondary/10 p-3 text-center">
                <TrendingUp className="w-4 h-4 text-secondary mx-auto mb-1.5" />
                <p className="text-[10px] text-muted-foreground mb-0.5">{t.avgIncome}</p>
                <p className="text-xs font-bold text-secondary amount-display"><span className="text-[0.85em] opacity-70">+</span>{fmt(avgIncome)}</p>
              </div>
              <div className="rounded-xl bg-destructive/5 border border-destructive/10 p-3 text-center">
                <TrendingDown className="w-4 h-4 text-destructive mx-auto mb-1.5" />
                <p className="text-[10px] text-muted-foreground mb-0.5">{t.avgExpenses}</p>
                <p className="text-xs font-bold text-destructive amount-display"><span className="text-[0.85em] opacity-70">-</span>{fmt(avgExpenses)}</p>
              </div>
              <div className="rounded-xl bg-primary/5 border border-primary/10 p-3 text-center">
                <BarChart3 className="w-4 h-4 text-primary mx-auto mb-1.5" />
                <p className="text-[10px] text-muted-foreground mb-0.5">{t.savingsRate}</p>
                <p className={`text-xs font-bold ${savingsRate >= 0 ? 'text-secondary' : 'text-destructive'}`}>
                  {savingsRate.toFixed(1)}%
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};
