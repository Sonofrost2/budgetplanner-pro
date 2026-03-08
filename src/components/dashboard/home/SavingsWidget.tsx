import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Target, Plus } from 'lucide-react';
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
  t: Record<string, string>;
  locale: string;
}

export const SavingsWidget = ({ goals, fmt, t, locale }: SavingsWidgetProps) => {
  const navigate = useNavigate();

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
      <Card className="border-none shadow-[var(--shadow-card)]">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            {t.savings}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/savings')}>
            {t.all || 'Voir tout'}
          </Button>
        </CardHeader>
        <CardContent>
          {goals.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm text-muted-foreground mb-3">{t.noGoals}</p>
              <Button size="sm" variant="outline" onClick={() => navigate('/dashboard/savings')}>
                <Plus className="w-4 h-4 mr-1" />{t.addGoal}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {goals.map(goal => {
                const pct = goal.target_amount > 0 ? Math.min(100, (goal.current_amount / goal.target_amount) * 100) : 0;
                return (
                  <div key={goal.id} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span>{goal.icon}</span>
                        <span className="text-sm font-medium">{goal.name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{Math.round(pct)}%</span>
                    </div>
                    <Progress value={pct} className="h-2" />
                    <div className="flex justify-between text-xs text-muted-foreground">
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
