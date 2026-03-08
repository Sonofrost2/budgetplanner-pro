import type { DashTranslations } from '@/i18n/dashTranslations';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

export const SavingsWidget = ({ goals, fmt, t }: SavingsWidgetProps) => {
  const navigate = useNavigate();

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
      <Card className="border border-border/50 shadow-[var(--shadow-card)] h-full">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-secondary/10 flex items-center justify-center">
              <Target className="w-3.5 h-3.5 text-secondary" />
            </div>
            {t.savings}
          </CardTitle>
          <Button variant="ghost" size="sm" className="text-xs h-7 px-2 text-muted-foreground" onClick={() => navigate('/dashboard/savings')}>
            {t.all || 'Voir tout'} <ChevronRight className="w-3 h-3 ml-1" />
          </Button>
        </CardHeader>
        <CardContent className="pt-0">
          {goals.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-2xl bg-muted mx-auto mb-3 flex items-center justify-center">
                <Target className="w-5 h-5 text-muted-foreground/50" />
              </div>
              <p className="text-sm text-muted-foreground mb-3">{t.noGoals}</p>
              <Button size="sm" variant="outline" className="rounded-xl" onClick={() => navigate('/dashboard/savings')}>
                <Plus className="w-4 h-4 mr-1" />{t.addGoal}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {goals.map(goal => {
                const pct = goal.target_amount > 0 ? Math.min(100, (goal.current_amount / goal.target_amount) * 100) : 0;
                return (
                  <div key={goal.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{goal.icon}</span>
                        <span className="text-sm font-semibold">{goal.name}</span>
                      </div>
                      <span className="text-xs font-bold text-secondary">{Math.round(pct)}%</span>
                    </div>
                    <Progress value={pct} className="h-2 rounded-full [&>div]:bg-secondary" />
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>{fmt(goal.current_amount)}</span>
                      <span>{fmt(goal.target_amount)}</span>
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
