import { useMemo, useState } from 'react';
import { CalendarClock, TrendingDown, TrendingUp, PiggyBank, ChevronRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import type { DashTranslations } from '@/i18n/dashTranslations';

interface Budget {
  id: string;
  name: string;
  amount: number;
  period: string;
  budget_type: string;
  category_id: string | null;
  categories?: { name: string; icon: string; color: string } | null;
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  date: string;
  category_id: string | null;
  categories?: { name: string; icon: string; color: string } | null;
}

interface WeeklyPlannerWidgetProps {
  budgets: Budget[];
  transactions: Transaction[];
  fmt: (n: number) => string;
  t: DashTranslations;
}

/** Get Monday-based week start/end dates */
function getWeekRange(offset = 0) {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + offset * 7);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return {
    start: monday.toISOString().split('T')[0],
    end: sunday.toISOString().split('T')[0],
  };
}

/** Number of weeks remaining in the current month (including current week) */
function weeksRemainingInMonth() {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = lastDay - now.getDate() + 1;
  return Math.max(1, Math.ceil(daysLeft / 7));
}

export const WeeklyPlannerWidget = ({ budgets, transactions, fmt, t }: WeeklyPlannerWidgetProps) => {
  const navigate = useNavigate();
  const [showDetails, setShowDetails] = useState(false);

  // Only expense budgets with monthly period
  const expenseBudgets = useMemo(() =>
    budgets.filter(b => b.budget_type === 'expense' && b.period === 'monthly'),
    [budgets]
  );

  // Current week range
  const thisWeek = useMemo(() => getWeekRange(0), []);
  const lastWeek = useMemo(() => getWeekRange(-1), []);
  const weeksLeft = useMemo(() => weeksRemainingInMonth(), []);

  // Monthly spending so far (whole month)
  const monthStart = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  }, []);

  // Transactions this week
  const thisWeekTxs = useMemo(() =>
    transactions.filter(tx => tx.type === 'expense' && tx.date >= thisWeek.start && tx.date <= thisWeek.end),
    [transactions, thisWeek]
  );

  // Transactions last week
  const lastWeekTxs = useMemo(() =>
    transactions.filter(tx => tx.type === 'expense' && tx.date >= lastWeek.start && tx.date <= lastWeek.end),
    [transactions, lastWeek]
  );

  // Monthly transactions so far (for computing remaining budget)
  const monthTxs = useMemo(() =>
    transactions.filter(tx => tx.type === 'expense' && tx.date >= monthStart),
    [transactions, monthStart]
  );

  // Per-category weekly allocation: (monthly budget - month spent so far) / weeks left
  const categoryBreakdown = useMemo(() => {
    return expenseBudgets.map(b => {
      const monthSpent = monthTxs
        .filter(tx => tx.category_id === b.category_id)
        .reduce((s, tx) => s + Number(tx.amount), 0);
      const remaining = Math.max(0, b.amount - monthSpent);
      const weeklyAlloc = remaining / weeksLeft;
      const weekSpent = thisWeekTxs
        .filter(tx => tx.category_id === b.category_id)
        .reduce((s, tx) => s + Number(tx.amount), 0);
      const lastWeekSpent = lastWeekTxs
        .filter(tx => tx.category_id === b.category_id)
        .reduce((s, tx) => s + Number(tx.amount), 0);
      const lastWeekAlloc = remaining / (weeksLeft + 1); // approximate last week's allocation
      const lastWeekSaving = Math.max(0, lastWeekAlloc - lastWeekSpent);

      return {
        id: b.id,
        name: b.categories?.name || b.name,
        icon: b.categories?.icon || '📁',
        color: b.categories?.color || '#6C63FF',
        weeklyAlloc: Math.round(weeklyAlloc),
        weekSpent: Math.round(weekSpent),
        lastWeekSaving: Math.round(lastWeekSaving),
        pct: weeklyAlloc > 0 ? Math.min(100, (weekSpent / weeklyAlloc) * 100) : 0,
      };
    }).filter(c => c.weeklyAlloc > 0);
  }, [expenseBudgets, monthTxs, thisWeekTxs, lastWeekTxs, weeksLeft]);

  const totalWeeklyAlloc = categoryBreakdown.reduce((s, c) => s + c.weeklyAlloc, 0);
  const totalWeekSpent = categoryBreakdown.reduce((s, c) => s + c.weekSpent, 0);
  const totalLastWeekSaving = categoryBreakdown.reduce((s, c) => s + c.lastWeekSaving, 0);
  const totalPct = totalWeeklyAlloc > 0 ? Math.min(100, (totalWeekSpent / totalWeeklyAlloc) * 100) : 0;
  const remaining = Math.max(0, totalWeeklyAlloc - totalWeekSpent);

  const statusColor = totalPct < 70 ? 'text-emerald-500' : totalPct < 90 ? 'text-amber-500' : 'text-destructive';
  const statusLabel = totalPct < 70 ? t.weeklyOnTrack : totalPct < 90 ? t.weeklyAtRisk : t.weeklyOver;

  if (expenseBudgets.length === 0) {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <CalendarClock className="w-3.5 h-3.5 text-primary" />
            </div>
            <h3 className="text-sm font-bold">{t.weeklyPlanner}</h3>
          </div>
          <p className="text-xs text-muted-foreground text-center py-4">{t.weeklyNoBudgets}</p>
          <Button size="sm" variant="outline" className="w-full rounded-xl text-xs" onClick={() => navigate('/dashboard/budgets')}>
            {t.addBudget}
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
      <div className="glass rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 pb-3">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <CalendarClock className="w-3.5 h-3.5 text-primary" />
            </div>
            {t.weeklyPlanner}
          </h3>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted/50 ${statusColor}`}>
            {statusLabel}
          </span>
        </div>

        <div className="px-4 pb-4 space-y-3">
          {/* Main progress */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{t.weeklySpent}</span>
              <span className="font-semibold tabular-nums">{fmt(totalWeekSpent)} / {fmt(totalWeeklyAlloc)}</span>
            </div>
            <Progress value={totalPct} className={`h-2 rounded-full ${totalPct > 90 ? '[&>div]:bg-destructive' : totalPct > 70 ? '[&>div]:bg-amber-500' : ''}`} />
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>{t.weeklyRemaining}: <span className="font-semibold text-foreground">{fmt(remaining)}</span></span>
              <span>{Math.round(totalPct)}%</span>
            </div>
          </div>

          {/* Last week savings banner */}
          {totalLastWeekSaving > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 space-y-2"
            >
              <div className="flex items-center gap-2">
                <PiggyBank className="w-4 h-4 text-emerald-500" />
                <div className="flex-1">
                  <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    {t.weeklySavings}: {fmt(totalLastWeekSaving)}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {(t.weeklySuggestionText as string).replace('{amount}', fmt(totalLastWeekSaving))}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 h-7 text-[10px] rounded-lg border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
                  onClick={() => navigate('/dashboard/savings')}
                >
                  <PiggyBank className="w-3 h-3 mr-1" />{t.weeklyReinvestSavings}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-[10px] rounded-lg text-muted-foreground"
                >
                  {t.weeklyKeepForLater}
                </Button>
              </div>
            </motion.div>
          )}

          {/* Category breakdown toggle */}
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="w-full flex items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
          >
            <span className="font-medium">{t.weeklyPerCategory}</span>
            <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showDetails ? 'rotate-90' : ''}`} />
          </button>

          <AnimatePresence>
            {showDetails && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2 overflow-hidden"
              >
                {categoryBreakdown.slice(0, 6).map((c, i) => {
                  const over = c.weekSpent > c.weeklyAlloc;
                  return (
                    <motion.div
                      key={c.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="space-y-1 p-1.5 rounded-lg hover:bg-muted/20 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-medium flex items-center gap-1.5">
                          <span>{c.icon}</span>{c.name}
                        </span>
                        <span className={`text-[10px] font-bold tabular-nums ${over ? 'text-destructive' : 'text-muted-foreground'}`}>
                          {fmt(c.weekSpent)} / {fmt(c.weeklyAlloc)}
                        </span>
                      </div>
                      <Progress value={c.pct} className={`h-1 rounded-full ${over ? '[&>div]:bg-destructive' : ''}`} />
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
};
