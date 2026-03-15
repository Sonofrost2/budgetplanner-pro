import type { DashTranslations } from '@/i18n/dashTranslations';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Target, Plus, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

interface SavingsGoal {
  id: string;
  name: string;
  icon: string;
  target_amount: number;
  current_amount: number;
  deadline: string | null;
}

interface SavingsWidgetProps {
  goals: SavingsGoal[];
  fmt: (n: number) => string;
  t: DashTranslations;
  locale: string;
}

const listItem = {
  hidden: { opacity: 0, y: 8 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.35, ease: 'easeOut' as const },
  }),
};

export const SavingsWidget = ({ goals, fmt, t }: SavingsWidgetProps) => {
  const navigate = useNavigate();

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
      <div className="glass rounded-2xl h-full">
        <div className="flex items-center justify-between p-4 pb-3">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-secondary/10 flex items-center justify-center">
              <Target className="w-3.5 h-3.5 text-secondary" />
            </div>
            {t.savings}
          </h3>
          <Button variant="ghost" size="sm" className="text-[10px] h-6 px-2 text-muted-foreground" onClick={() => navigate('/dashboard/savings')}>
            {t.all || 'Voir tout'} <ChevronRight className="w-3 h-3 ml-0.5" />
          </Button>
        </div>
        <div className="px-4 pb-4">
          {goals.length === 0 ? (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-6">
              <div className="w-10 h-10 rounded-xl bg-muted/50 mx-auto mb-2.5 flex items-center justify-center">
                <Target className="w-4 h-4 text-muted-foreground/40" />
              </div>
              <p className="text-xs text-muted-foreground mb-2.5">{t.noGoals}</p>
              <Button size="sm" variant="outline" className="rounded-xl h-7 text-[10px] glass border-glass-border" onClick={() => navigate('/dashboard/savings')}>
                <Plus className="w-3 h-3 mr-1" />{t.addGoal}
              </Button>
            </motion.div>
          ) : (
            <div className="space-y-3">
              {goals.map((goal, i) => {
                const pct = goal.target_amount > 0 ? Math.min(100, (goal.current_amount / goal.target_amount) * 100) : 0;
                return (
                  <motion.div
                    key={goal.id}
                    custom={i}
                    variants={listItem}
                    initial="hidden"
                    animate="show"
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    className="space-y-1.5 p-2 rounded-xl hover:bg-muted/20 transition-all cursor-pointer"
                    onClick={() => navigate('/dashboard/savings')}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <motion.span
                          className="text-sm"
                          whileHover={{ scale: 1.3, rotate: 10 }}
                          transition={{ type: 'spring', stiffness: 400 }}
                        >
                          {goal.icon}
                        </motion.span>
                        <span className="text-xs font-semibold">{goal.name}</span>
                      </div>
                      <motion.span
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.08 + 0.2 }}
                        className="text-[10px] font-bold text-secondary"
                      >
                        {Math.round(pct)}%
                      </motion.span>
                    </div>
                    <Progress value={pct} className="h-1.5 rounded-full [&>div]:bg-secondary" />
                    <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums">
                      <span>{fmt(goal.current_amount)}</span>
                      <span>{fmt(goal.target_amount)}</span>
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
