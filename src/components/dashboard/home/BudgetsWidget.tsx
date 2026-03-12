import type { DashTranslations } from '@/i18n/dashTranslations';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { PieChart, Plus, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

interface BudgetWithSpent {
  id: string;
  name: string;
  amount: number;
  spent: number;
  category_id: string | null;
}

interface BudgetsWidgetProps {
  budgets: BudgetWithSpent[];
  fmt: (n: number) => string;
  t: DashTranslations;
}

export const BudgetsWidget = ({ budgets, fmt, t }: BudgetsWidgetProps) => {
  const navigate = useNavigate();

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
      <Card className="border border-border/50 shadow-[var(--shadow-card)] h-full">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center">
              <PieChart className="w-3.5 h-3.5 text-accent" />
            </div>
            {t.budgets}
          </CardTitle>
          <Button variant="ghost" size="sm" className="text-xs h-7 px-2 text-muted-foreground" onClick={() => navigate('/dashboard/budgets')}>
            {t.all || 'Voir tout'} <ChevronRight className="w-3 h-3 ml-1" />
          </Button>
        </CardHeader>
        <CardContent className="pt-0">
          {budgets.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-2xl bg-muted mx-auto mb-3 flex items-center justify-center">
                <PieChart className="w-5 h-5 text-muted-foreground/50" />
              </div>
              <p className="text-sm text-muted-foreground mb-3">{t.noBudgets}</p>
              <Button size="sm" variant="outline" className="rounded-xl" onClick={() => navigate('/dashboard/budgets')}>
                <Plus className="w-4 h-4 mr-1" />{t.addBudget}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {budgets.map(b => {
                const pct = b.amount > 0 ? Math.min(100, (b.spent / b.amount) * 100) : 0;
                const over = b.spent > b.amount;
                return (
                  <div key={b.id} className="space-y-2 p-2.5 rounded-xl hover:bg-muted/50 active:scale-[0.98] transition-all cursor-pointer" onClick={() => navigate('/dashboard/budgets')}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">{b.name}</span>
                      <span className={`text-xs font-bold ${over ? 'text-destructive' : 'text-muted-foreground'}`}>
                        {Math.round(pct)}%
                      </span>
                    </div>
                    <Progress value={pct} className={`h-2 rounded-full ${over ? '[&>div]:bg-destructive' : ''}`} />
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>{fmt(b.spent)}</span>
                      <span>{fmt(b.amount)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};
