import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lightbulb, TrendingUp, AlertTriangle, PartyPopper, X, Compass, CalendarClock, Snowflake, PieChart } from 'lucide-react';
import type { SavingsGoal } from '@/hooks/useDashboardData';
import { isLiveGoal, isReachedGoal, liveSavingsTotal } from '@/lib/savingsLogic';

interface SavingsContribution {
  id: string;
  amount: number;
  date: string;
  type: string;
}

interface Props {
  goals: SavingsGoal[];
  contributions: Record<string, SavingsContribution[]>;
  fmt: (n: number) => string;
  isFr: boolean;
}

type InsightTone = 'success' | 'warn' | 'info' | 'celebrate';

interface Insight {
  id: string;
  tone: InsightTone;
  icon: React.ReactNode;
  title: string;
  body: string;
}

const TONE_CLASS: Record<InsightTone, string> = {
  success: 'border-secondary/30 bg-secondary/5',
  warn: 'border-destructive/30 bg-destructive/5',
  info: 'border-primary/30 bg-primary/5',
  celebrate: 'border-secondary/40 bg-gradient-to-br from-secondary/10 to-primary/10',
};

const ICON_CLASS: Record<InsightTone, string> = {
  success: 'text-secondary',
  warn: 'text-destructive',
  info: 'text-primary',
  celebrate: 'text-secondary',
};

/**
 * Coach Financier insights bandeau — generates up to 3 dynamic, dismissible
 * narrative cards based on goal pacing vs deadline + recent contribution rhythm.
 */
export const SavingsCoachInsights = ({ goals, contributions, fmt, isFr }: Props) => {
  // Dismissal is bucketed by ISO week so advice resurfaces automatically.
  const weekBucket = useMemo(() => {
    const d = new Date();
    const jan1 = new Date(d.getFullYear(), 0, 1);
    const week = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
    return `${d.getFullYear()}W${week}`;
  }, []);

  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem('savings-insights-dismissed');
      if (!raw) return new Set();
      const parsed = JSON.parse(raw);
      // Legacy format (array) → drop, we now scope by week
      if (Array.isArray(parsed)) return new Set();
      const forWeek = parsed?.[weekBucket];
      return new Set(Array.isArray(forWeek) ? forWeek : []);
    } catch {
      return new Set();
    }
  });

  const dismiss = (id: string) => {
    setDismissed(prev => {
      const next = new Set(prev);
      next.add(id);
      try {
        localStorage.setItem(
          'savings-insights-dismissed',
          JSON.stringify({ [weekBucket]: [...next] }),
        );
      } catch {}
      return next;
    });
  };

  const insights = useMemo<Insight[]>(() => {
    const out: Insight[] = [];
    const now = new Date();
    const nowTs = now.getTime();
    const DAY = 1000 * 60 * 60 * 24;
    const MONTH = DAY * 30;

    // Only reason about goals that count as live savings, to stay consistent
    // with the rest of the module (KPIs, evolution chart, projections).
    const liveGoals = goals.filter(isLiveGoal);
    const liveTotal = liveSavingsTotal(liveGoals);

    for (const g of liveGoals) {
      const current = Number(g.current_amount);
      const target = Number(g.target_amount);
      if (target <= 0) continue;
      const pct = (current / target) * 100;
      const remaining = Math.max(0, target - current);
      const deposits = (contributions[g.id] || []).filter(c => c.type === 'deposit');
      const totalDeposits = deposits.reduce((s, c) => s + Number(c.amount), 0);

      // Monthly avg + last deposit timestamp from history
      let monthlyAvg = 0;
      let lastDepositTs: number | null = null;
      if (deposits.length > 0) {
        const dates = deposits.map(c => new Date(c.date).getTime());
        const span = Math.max(1, (Math.max(...dates) - Math.min(...dates)) / MONTH);
        monthlyAvg = totalDeposits / span;
        lastDepositTs = Math.max(...dates);
      }

      const isCompleted = isReachedGoal(g);

      // 1. Goal reached (celebrate)
      if (isCompleted) {
        out.push({
          id: `reached-${g.id}`,
          tone: 'celebrate',
          icon: <PartyPopper className="w-4 h-4" />,
          title: `${g.icon} ${g.name} — ${isFr ? 'objectif atteint !' : 'goal reached!'}`,
          body: isFr
            ? `Bravo ! Vous avez épargné ${fmt(current)}. Réinvestir, garder ouvert, ou archiver ?`
            : `Well done! You saved ${fmt(current)}. Reinvest, keep open, or archive?`,
        });
        continue;
      }

      // 2. Deadline already passed and goal not reached (warn, top priority)
      if (g.deadline && remaining > 0) {
        const deadline = new Date(g.deadline);
        if (deadline.getTime() < nowTs) {
          const daysOver = Math.round((nowTs - deadline.getTime()) / DAY);
          out.push({
            id: `overdue-${g.id}`,
            tone: 'warn',
            icon: <CalendarClock className="w-4 h-4" />,
            title: `${g.icon} ${g.name} — ${isFr ? 'échéance dépassée' : 'deadline passed'}`,
            body: isFr
              ? `Depuis ${daysOver} j. Reste ${fmt(remaining)} : reporter la date ou ajuster l'objectif ?`
              : `${daysOver} day(s) ago. ${fmt(remaining)} left: push the deadline or adjust the target?`,
          });
          continue;
        }
      }

      // 3. Pace analysis vs deadline
      if (g.deadline && monthlyAvg > 0 && remaining > 0) {
        const deadline = new Date(g.deadline);
        const monthsLeft = Math.max(0, (deadline.getTime() - nowTs) / MONTH);
        if (monthsLeft <= 0.1) continue;
        const monthlyNeeded = remaining / monthsLeft;
        const ratio = monthlyAvg / monthlyNeeded;

        // Ahead of schedule
        if (ratio >= 1.15) {
          const monthsToFinish = remaining / monthlyAvg;
          const advance = Math.round(monthsLeft - monthsToFinish);
          if (advance >= 1) {
            out.push({
              id: `ahead-${g.id}`,
              tone: 'success',
              icon: <TrendingUp className="w-4 h-4" />,
              title: `${g.icon} ${g.name}`,
              body: isFr
                ? `À ce rythme, vous l'atteignez ${advance} mois en avance 🎯`
                : `At this pace, you'll reach it ${advance} month(s) early 🎯`,
            });
          }
        }
        // Behind
        else if (ratio < 0.85) {
          const gap = Math.round(monthlyNeeded - monthlyAvg);
          out.push({
            id: `behind-${g.id}`,
            tone: 'warn',
            icon: <AlertTriangle className="w-4 h-4" />,
            title: `${g.icon} ${g.name} — ${isFr ? 'rythme insuffisant' : 'pace too slow'}`,
            body: isFr
              ? `Augmentez de ${fmt(gap)}/mois pour rattraper l'échéance.`
              : `Add ${fmt(gap)}/month to catch up with the deadline.`,
          });
        }
      }

      // 4. Stale — active goal with no deposit in the last 45 days
      if (remaining > 0 && lastDepositTs !== null) {
        const daysSince = Math.round((nowTs - lastDepositTs) / DAY);
        if (daysSince >= 45) {
          out.push({
            id: `stale-${g.id}-${Math.floor(daysSince / 15)}`,
            tone: 'warn',
            icon: <Snowflake className="w-4 h-4" />,
            title: `${g.icon} ${g.name} — ${isFr ? 'sans dépôt depuis' : 'no deposit for'} ${daysSince} ${isFr ? 'j' : 'd'}`,
            body: isFr
              ? `Reprenez avec un petit versement pour garder l'élan.`
              : `Restart with a small deposit to keep the momentum.`,
          });
        }
      }

      // 5. Approaching milestone
      if (!isCompleted && pct >= 70 && pct < 100) {
        const milestoneId = `milestone-${g.id}-${Math.floor(pct / 10) * 10}`;
        out.push({
          id: milestoneId,
          tone: 'info',
          icon: <Compass className="w-4 h-4" />,
          title: `${g.icon} ${g.name} — ${Math.round(pct)}%`,
          body: isFr
            ? `Plus que ${fmt(remaining)} pour boucler. Vous y êtes presque 💪`
            : `Only ${fmt(remaining)} to go. You're almost there 💪`,
        });
      }
    }

    // 6. Concentration — one live goal represents more than 70% of live savings
    if (liveTotal > 0 && liveGoals.length >= 2) {
      const heaviest = liveGoals.reduce((max, g) =>
        Number(g.current_amount) > Number(max.current_amount) ? g : max,
      liveGoals[0]);
      const share = Number(heaviest.current_amount) / liveTotal;
      if (share >= 0.7) {
        out.push({
          id: `concentration-${heaviest.id}`,
          tone: 'info',
          icon: <PieChart className="w-4 h-4" />,
          title: isFr ? 'Épargne concentrée' : 'Concentrated savings',
          body: isFr
            ? `${heaviest.icon} ${heaviest.name} pèse ${Math.round(share * 100)}% de votre épargne. Diversifier ?`
            : `${heaviest.icon} ${heaviest.name} holds ${Math.round(share * 100)}% of your savings. Diversify?`,
        });
      }
    }

    return out
      .filter(i => !dismissed.has(i.id))
      .sort((a, b) => {
        const order: Record<InsightTone, number> = { celebrate: 0, warn: 1, success: 2, info: 3 };
        return order[a.tone] - order[b.tone];
      })
      .slice(0, 3);
  }, [goals, contributions, dismissed, fmt, isFr]);

  if (insights.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-1">
        <Lightbulb className="w-3.5 h-3.5 text-primary" />
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          {isFr ? 'Conseils du Coach' : 'Coach insights'}
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <AnimatePresence mode="popLayout">
          {insights.map(insight => (
            <motion.div
              key={insight.id}
              layout
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
            >
              <Card className={`relative p-3.5 rounded-2xl border ${TONE_CLASS[insight.tone]} h-full`}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-1.5 right-1.5 h-6 w-6 text-muted-foreground/60 hover:text-foreground"
                  onClick={() => dismiss(insight.id)}
                  aria-label="dismiss"
                >
                  <X className="w-3 h-3" />
                </Button>
                <div className="flex items-start gap-2.5 pr-6">
                  <div className={`shrink-0 mt-0.5 ${ICON_CLASS[insight.tone]}`}>{insight.icon}</div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold leading-tight">{insight.title}</p>
                    <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{insight.body}</p>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};
