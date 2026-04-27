import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PiggyBank, Plus, Flame, LayoutGrid, Table as TableIcon, Sparkles } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, Tooltip } from 'recharts';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { SavingsRingProgress } from './SavingsRingProgress';
import type { SavingsGoal } from '@/hooks/useDashboardData';
import { isLiveGoal, isReachedGoal } from '@/lib/savingsLogic';

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
  view: 'cards' | 'table';
  onViewChange: (v: 'cards' | 'table') => void;
  onNewGoal: () => void;
}

/**
 * Premium Savings hero header — gradient blob + ring + sparkline + streak badge.
 * Mirrors WealthHeroHeader patterns but tuned for Savings with secondary accent.
 */
export const SavingsHeroHeader = ({
  goals,
  contributions,
  fmt,
  isFr,
  view,
  onViewChange,
  onNewGoal,
}: Props) => {
  // Live total only — completed/archived/paused goals appear in the dedicated
  // 'Atteints / Archivés' tab and must not inflate the headline KPI.
  const liveGoals = goals.filter(isLiveGoal);
  const totalSaved = liveGoals.reduce((s, g) => s + Number(g.current_amount), 0);
  const totalTarget = liveGoals.reduce((s, g) => s + Number(g.target_amount), 0);
  const globalPct = totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0;
  const completedCount = goals.filter(g => isReachedGoal(g) || (g.status && g.status !== 'active')).length;

  // 6-month sparkline of net contributions (deposits - withdrawals) per month
  const sparkline = useMemo(() => {
    const months = 6;
    const buckets: { key: string; v: number }[] = [];
    const now = new Date();
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      buckets.push({ key, v: 0 });
    }
    Object.values(contributions).flat().forEach(c => {
      if (!c.date) return;
      const key = c.date.slice(0, 7);
      const b = buckets.find(x => x.key === key);
      if (!b) return;
      const amt = Number(c.amount) || 0;
      b.v += c.type === 'deposit' ? amt : -amt;
    });
    return buckets;
  }, [contributions]);

  // Streak: consecutive months ending current with at least 1 deposit
  const streak = useMemo(() => {
    const monthsWithDeposit = new Set<string>();
    Object.values(contributions).flat().forEach(c => {
      if (c.type === 'deposit' && Number(c.amount) > 0) {
        monthsWithDeposit.add(c.date.slice(0, 7));
      }
    });
    let count = 0;
    const cursor = new Date();
    cursor.setDate(1);
    for (let i = 0; i < 24; i++) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
      if (monthsWithDeposit.has(key)) count++;
      else break;
      cursor.setMonth(cursor.getMonth() - 1);
    }
    return count;
  }, [contributions]);

  const ringTone: 'secondary' | 'primary' | 'destructive' =
    globalPct >= 80 ? 'secondary' : globalPct >= 40 ? 'primary' : 'destructive';

  return (
    <Card className="relative overflow-hidden border-0 rounded-3xl bg-gradient-to-br from-background via-background to-muted/20">
      <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full blur-3xl opacity-25 bg-secondary" />
      <div className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full blur-3xl opacity-20 bg-primary" />

      <div className="relative p-5 sm:p-7">
        <div className="flex flex-col lg:flex-row lg:items-center gap-6">
          {/* Total + sparkline */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <PiggyBank className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs uppercase tracking-widest text-muted-foreground font-bold">
                {isFr ? 'Mon épargne' : 'My Savings'}
              </span>
              {streak >= 2 && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="ml-auto lg:ml-0 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-secondary/15 text-secondary"
                  title={isFr ? `Vous avez épargné ${streak} mois de suite` : `You've saved ${streak} months in a row`}
                >
                  <Flame className="w-3 h-3" />
                  {streak} {isFr ? 'mois' : 'mo'}
                </motion.span>
              )}
            </div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="flex items-baseline gap-3 flex-wrap"
            >
              <h2 className="text-3xl sm:text-5xl font-bold tracking-tight font-display">
                <AnimatedNumber value={totalSaved} format={fmt} duration={0.9} />
              </h2>
              {totalTarget > 0 && (
                <span className="text-xs sm:text-sm text-muted-foreground">
                  {isFr ? 'sur' : 'of'} {fmt(totalTarget)}
                </span>
              )}
            </motion.div>
            <p className="text-xs text-muted-foreground mt-1">
              {(() => {
                const n = liveGoals.length;
                if (n === 0 && completedCount === 0) return isFr
                  ? '🎯 Définissez votre premier objectif pour démarrer'
                  : '🎯 Set your first goal to get started';
                if (globalPct >= 80) return isFr
                  ? `🔥 ${n} objectif${n > 1 ? 's' : ''} actif${n > 1 ? 's' : ''} · vous y êtes presque !`
                  : `🔥 ${n} active goal${n > 1 ? 's' : ''} · you're almost there!`;
                if (streak >= 3) return isFr
                  ? `💪 ${n} objectif${n > 1 ? 's' : ''} actif${n > 1 ? 's' : ''} · belle régularité, continuez !`
                  : `💪 ${n} active goal${n > 1 ? 's' : ''} · great consistency, keep going!`;
                return isFr
                  ? `🌱 ${n} objectif${n > 1 ? 's' : ''} actif${n > 1 ? 's' : ''}${completedCount > 0 ? ` · ${completedCount} déjà atteint${completedCount > 1 ? 's' : ''}` : ''}`
                  : `🌱 ${n} active goal${n > 1 ? 's' : ''}${completedCount > 0 ? ` · ${completedCount} already reached` : ''}`;
              })()}
            </p>

            {/* Sparkline */}
            <div className="h-14 mt-4 -mx-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sparkline}>
                  <defs>
                    <linearGradient id="savingsSpark" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--secondary))" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="hsl(var(--secondary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Tooltip
                    cursor={false}
                    contentStyle={{
                      borderRadius: 12,
                      border: '1px solid hsl(var(--border))',
                      background: 'hsl(var(--card))',
                      fontSize: 11,
                    }}
                    formatter={(v: number) => [fmt(v), isFr ? 'Net' : 'Net']}
                    labelFormatter={(l: string) => l}
                  />
                  <Area
                    type="monotone"
                    dataKey="v"
                    stroke="hsl(var(--secondary))"
                    strokeWidth={2}
                    fill="url(#savingsSpark)"
                    isAnimationActive
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Ring + actions */}
          <div className="flex items-center gap-4 lg:gap-6">
            {totalTarget > 0 && (
              <SavingsRingProgress value={globalPct} size={108} strokeWidth={10} tone={ringTone}>
                <div className="text-center">
                  <p className="text-xl font-bold font-display leading-none">{globalPct}%</p>
                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5">
                    {isFr ? 'Global' : 'Overall'}
                  </p>
                </div>
              </SavingsRingProgress>
            )}

            <div className="flex flex-col gap-2">
              <Button
                size="sm"
                className="rounded-xl text-primary-foreground gap-1.5 shadow-md"
                style={{ background: 'var(--gradient-primary)' }}
                onClick={onNewGoal}
              >
                <Plus className="w-4 h-4" />
                {isFr ? 'Nouvel objectif' : 'New goal'}
              </Button>
              <div className="inline-flex rounded-xl border border-border/50 p-0.5 bg-muted/30">
                <button
                  type="button"
                  onClick={() => onViewChange('cards')}
                  className={`flex items-center gap-1 px-2 py-1 text-xs rounded-lg transition-all ${
                    view === 'cards' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                  title={isFr ? 'Vue cartes' : 'Card view'}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onViewChange('table')}
                  className={`flex items-center gap-1 px-2 py-1 text-xs rounded-lg transition-all ${
                    view === 'table' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                  title={isFr ? 'Vue tableau' : 'Table view'}
                >
                  <TableIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {goals.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mt-5 flex items-center gap-2 text-xs text-muted-foreground"
          >
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            {isFr
              ? 'Pas encore d\'objectif ? Commencez par un petit défi — même un petit montant mensuel change tout 💡'
              : 'No goal yet? Start with a small challenge — even small monthly amounts add up 💡'}
          </motion.div>
        )}
      </div>
    </Card>
  );
};
