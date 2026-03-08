import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { PieChart, Plus } from 'lucide-react';
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
  t: Record<string, string>;
}

export const BudgetsWidget = ({ budgets, fmt, t }: BudgetsWidgetProps) => {
  const navigate = useNavigate();

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
      <Card className="border-none shadow-[var(--shadow-card)]">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <PieChart className="w-4 h-4 text-primary" />
            {t.budgets}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/budgets')}>
            {t.all || 'Voir tout'}
          </Button>
        </CardHeader>
        <CardContent>
          {budgets.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm text-muted-foreground mb-3">{t.noBudgets}</p>
              <Button size="sm" variant="outline" onClick={() => navigate('/dashboard/budgets')}>
                <Plus className="w-4 h-4 mr-1" />{t.addBudget}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {budgets.map(b => {
                const pct = b.amount > 0 ? Math.min(100, (b.spent / b.amount) * 100) : 0;
                const over = b.spent > b.amount;
                return (
                  <div key={b.id} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{b.name}</span>
                      <span className={`text-xs font-medium ${over ? 'text-destructive' : 'text-muted-foreground'}`}>
                        {fmt(b.spent)} / {fmt(b.amount)}
                      </span>
                    </div>
                    <Progress value={pct} className={`h-2 ${over ? '[&>div]:bg-destructive' : ''}`} />
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
