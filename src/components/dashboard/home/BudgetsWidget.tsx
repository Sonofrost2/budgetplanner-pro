import type { DashTranslations } from '@/i18n/dashTranslations';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { PieChart, Plus, ChevronRight, Target, Flame, Repeat } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

interface BudgetWithSpent {
  id: string;
  name: string;
  amount: number;
  spent: number;
  category_id: string | null;
  linked_savings_goal_id?: string | null;
  priority?: string | null;
  occurrence_frequency?: string | null;
  is_renewable?: boolean | null;
}

interface BudgetsWidgetProps {
  budgets: BudgetWithSpent[];
  totalCount?: number;
  fmt: (n: number) => string;
  t: DashTranslations;
}

const listItem = {
  hidden: { opacity: 0, y: 8 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.35, ease: 'easeOut' as const },
  }),
};

export const BudgetsWidget = ({ budgets, totalCount, fmt, t }: BudgetsWidgetProps) => {
  const navigate = useNavigate();
  const shown = budgets.length;
  const total = totalCount ?? shown;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
      <div className="glass rounded-2xl h-full glow-primary">
        <div className="flex items-center justify-between p-4 pb-3">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center">
              <PieChart className="w-3.5 h-3.5 text-accent" />
            </div>
            {t.budgets}
            {total > 0 && (
              <span className="text-[10px] font-normal text-muted-foreground">
                {shown}/{total}
              </span>
            )}
          </h3>
          <Button variant="ghost" size="sm" className="text-[10px] h-6 px-2 text-muted-foreground" onClick={() => navigate('/dashboard/budgets')}>
            {t.all || 'Voir tout'} <ChevronRight className="w-3 h-3 ml-0.5" />
          </Button>
        </div>
        <div className="px-4 pb-4">
          {budgets.length === 0 ? (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-6">
              <div className="w-10 h-10 rounded-xl bg-muted/50 mx-auto mb-2.5 flex items-center justify-center">
                <PieChart className="w-4 h-4 text-muted-foreground/40" />
              </div>
              <p className="text-xs text-muted-foreground mb-2.5">{t.noBudgets}</p>
              <Button size="sm" variant="outline" className="rounded-xl h-7 text-[10px] glass border-glass-border" onClick={() => navigate('/dashboard/budgets')}>
                <Plus className="w-3 h-3 mr-1" />{t.addBudget}
              </Button>
            </motion.div>
          ) : (
            <div className="space-y-3">
              {budgets.map((b, i) => {
                const pct = b.amount > 0 ? Math.min(100, (b.spent / b.amount) * 100) : 0;
                const over = b.spent > b.amount;
                const isSavings = !!b.linked_savings_goal_id;
                const isOnce = b.occurrence_frequency === 'once';
                const isHighPriority = b.priority === 'high';
                const notRenewable = b.is_renewable === false;
                return (
                  <motion.div
                    key={b.id}
                    custom={i}
                    variants={listItem}
                    initial="hidden"
                    animate="show"
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    className="space-y-1.5 p-2 rounded-xl hover:bg-muted/20 transition-all cursor-pointer"
                    onClick={() => navigate(`/dashboard/budgets?q=${encodeURIComponent(b.name)}`)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold flex items-center gap-1.5 min-w-0">
                        <span className="truncate">{b.name}</span>
                        {isHighPriority && (
                          <Flame className="w-2.5 h-2.5 text-destructive shrink-0" />
                        )}
                        {isSavings && (
                          <Target className="w-2.5 h-2.5 text-primary shrink-0" />
                        )}
                        {isOnce && (
                          <span className="text-[8px] font-bold text-accent bg-accent/10 px-1 rounded shrink-0">1×</span>
                        )}
                        {notRenewable && (
                          <Repeat className="w-2.5 h-2.5 text-muted-foreground/60 shrink-0 line-through" />
                        )}
                      </span>
                      <motion.span
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.08 + 0.2 }}
                        className={`text-[10px] font-bold shrink-0 ${over ? 'text-destructive' : 'text-muted-foreground'}`}
                      >
                        {Math.round(pct)}%
                      </motion.span>
                    </div>
                    <Progress value={pct} className={`h-1.5 rounded-full ${over ? '[&>div]:bg-destructive' : ''}`} />
                    <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums amount-display">
                      <span>{fmt(b.spent)}</span>
                      <span className="font-semibold">{fmt(b.amount)}</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};
