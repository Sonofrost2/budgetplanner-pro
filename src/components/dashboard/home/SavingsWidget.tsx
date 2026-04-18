import type { DashTranslations } from '@/i18n/dashTranslations';
import { Button } from '@/components/ui/button';
import { Target, Plus, ChevronRight, Flame } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { SavingsRingProgress } from '@/components/dashboard/savings/SavingsRingProgress';
import { isLiveGoal } from '@/lib/savingsLogic';

interface SavingsGoal {
  id: string;
  name: string;
  icon: string;
  target_amount: number;
  current_amount: number;
  deadline: string | null;
  status?: string | null;
  paused_at?: string | null;
  deleted_at?: string | null;
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

export const SavingsWidget = ({ goals: rawGoals, fmt, t, locale }: SavingsWidgetProps) => {
  const navigate = useNavigate();
  const isFr = locale === 'fr';

  // Only count live goals: completed/archived/paused goals must NOT inflate the
  // dashboard widget totals. They remain visible in the dedicated Savings page.
  const goals = rawGoals.filter(isLiveGoal);
  const totalSaved = goals.reduce((s, g) => s + Number(g.current_amount), 0);
  const totalTarget = goals.reduce((s, g) => s + Number(g.target_amount), 0);
  const globalPct = totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0;
  const reached = goals.filter(g => g.target_amount > 0 && g.current_amount >= g.target_amount).length;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
      <div className="glass rounded-2xl h-full glow-primary">
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

        {/* Mini hero with ring */}
        {goals.length > 0 && (
          <div className="px-4 pb-3 flex items-center gap-3">
            <SavingsRingProgress value={globalPct} size={56} strokeWidth={5} tone={globalPct >= 80 ? 'secondary' : 'primary'}>
              <span className="text-[11px] font-bold">{globalPct}%</span>
            </SavingsRingProgress>
            <div className="min-w-0 flex-1">
              <p className="text-base font-bold amount-display truncate">{fmt(totalSaved)}</p>
              <p className="text-[10px] text-muted-foreground">
                {isFr ? 'sur' : 'of'} {fmt(totalTarget)}
              </p>
              {reached > 0 && (
                <span className="inline-flex items-center gap-1 mt-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-secondary/15 text-secondary">
                  <Flame className="w-2.5 h-2.5" />
                  {reached} {isFr ? 'atteint' : 'reached'}
                </span>
              )}
            </div>
          </div>
        )}

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
            <div className="space-y-2">
              {goals.slice(0, 3).map((goal, i) => {
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
                    className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-muted/20 transition-all cursor-pointer"
                    onClick={() => navigate(`/dashboard/savings?q=${encodeURIComponent(goal.name)}`)}
                  >
                    <SavingsRingProgress value={pct} size={32} strokeWidth={3} tone={pct >= 100 ? 'secondary' : 'primary'}>
                      <span className="text-[10px]">{goal.icon}</span>
                    </SavingsRingProgress>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-semibold truncate">{goal.name}</span>
                        <span className="text-[10px] font-bold text-secondary tabular-nums shrink-0">{Math.round(pct)}%</span>
                      </div>
                      <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums amount-display">
                        <span className="text-secondary font-semibold">{fmt(goal.current_amount)}</span>
                        <span>{fmt(goal.target_amount)}</span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
              {goals.length > 3 && (
                <p className="text-[10px] text-center text-muted-foreground pt-1">
                  +{goals.length - 3} {isFr ? 'autres' : 'more'}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};
