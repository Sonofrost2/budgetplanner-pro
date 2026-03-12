import type { DashTranslations } from '@/i18n/dashTranslations';
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
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
      <div className="glass rounded-2xl h-full">
        <div className="flex items-center justify-between p-4 pb-3">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center">
              <PieChart className="w-3.5 h-3.5 text-accent" />
            </div>
            {t.budgets}
          </h3>
          <Button variant="ghost" size="sm" className="text-[10px] h-6 px-2 text-muted-foreground" onClick={() => navigate('/dashboard/budgets')}>
            {t.all || 'Voir tout'} <ChevronRight className="w-3 h-3 ml-0.5" />
          </Button>
        </div>
        <div className="px-4 pb-4">
          {budgets.length === 0 ? (
            <div className="text-center py-6">
              <div className="w-10 h-10 rounded-xl bg-muted/50 mx-auto mb-2.5 flex items-center justify-center">
                <PieChart className="w-4 h-4 text-muted-foreground/40" />
              </div>
              <p className="text-xs text-muted-foreground mb-2.5">{t.noBudgets}</p>
              <Button size="sm" variant="outline" className="rounded-xl h-7 text-[10px] glass border-glass-border" onClick={() => navigate('/dashboard/budgets')}>
                <Plus className="w-3 h-3 mr-1" />{t.addBudget}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {budgets.map(b => {
                const pct = b.amount > 0 ? Math.min(100, (b.spent / b.amount) * 100) : 0;
                const over = b.spent > b.amount;
                return (
                  <div key={b.id} className="space-y-1.5 p-2 rounded-xl hover:bg-muted/20 active:scale-[0.98] transition-all cursor-pointer" onClick={() => navigate('/dashboard/budgets')}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold">{b.name}</span>
                      <span className={`text-[10px] font-bold ${over ? 'text-destructive' : 'text-muted-foreground'}`}>
                        {Math.round(pct)}%
                      </span>
                    </div>
                    <Progress value={pct} className={`h-1.5 rounded-full ${over ? '[&>div]:bg-destructive' : ''}`} />
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>{fmt(b.spent)}</span>
                      <span>{fmt(b.amount)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};
