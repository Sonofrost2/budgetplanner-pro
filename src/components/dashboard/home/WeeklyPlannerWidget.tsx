import { useMemo, useState, useCallback } from 'react';
import {
  CalendarClock, TrendingDown, TrendingUp, PiggyBank,
  ChevronRight, ChevronLeft, Pencil, Check, X, Target,
  AlertTriangle, CheckCircle2, ArrowRight, Wallet
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  expected_day?: number | null;
  occurrence_frequency?: string | null;
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

/* ── date helpers ─────────────────────────────────────────── */
function getWeekRange(offset = 0) {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + offset * 7);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { start: monday.toISOString().split('T')[0], end: sunday.toISOString().split('T')[0] };
}

function weekLabel(startStr: string, locale: string = 'fr') {
  const d = new Date(startStr);
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  return d.toLocaleDateString(locale === 'en' ? 'en-US' : 'fr-FR', opts);
}

/** Get the start/end of the period containing refDate */
function getPeriodRange(period: string, refDate: Date): { start: Date; end: Date } {
  const y = refDate.getFullYear();
  const m = refDate.getMonth();
  switch (period) {
    case 'daily':
      return { start: new Date(y, m, refDate.getDate()), end: new Date(y, m, refDate.getDate(), 23, 59, 59) };
    case 'weekly': {
      const day = refDate.getDay();
      const mon = new Date(refDate);
      mon.setDate(refDate.getDate() - (day === 0 ? 6 : day - 1));
      mon.setHours(0, 0, 0, 0);
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      sun.setHours(23, 59, 59);
      return { start: mon, end: sun };
    }
    case 'monthly':
      return { start: new Date(y, m, 1), end: new Date(y, m + 1, 0, 23, 59, 59) };
    case 'quarterly': {
      const q = Math.floor(m / 3);
      return { start: new Date(y, q * 3, 1), end: new Date(y, q * 3 + 3, 0, 23, 59, 59) };
    }
    case 'semi_annual': {
      const s = m < 6 ? 0 : 6;
      return { start: new Date(y, s, 1), end: new Date(y, s + 6, 0, 23, 59, 59) };
    }
    case 'yearly':
      return { start: new Date(y, 0, 1), end: new Date(y, 11, 31, 23, 59, 59) };
    default:
      return { start: new Date(y, m, 1), end: new Date(y, m + 1, 0, 23, 59, 59) };
  }
}

/** Compute weekly target from a budget based on its period */
function computeWeeklyTarget(
  budget: Budget,
  periodSpent: number,
  weekStart: Date
): number {
  const period = budget.period;
  const amount = budget.amount;

  if (period === 'daily') return amount * 7;
  if (period === 'weekly') return amount;

  // For monthly, quarterly, semi_annual, yearly: remaining / weeks left
  const range = getPeriodRange(period, weekStart);
  const remaining = Math.max(0, amount - periodSpent);
  const msLeft = range.end.getTime() - weekStart.getTime();
  const weeksLeft = Math.max(1, Math.ceil(msLeft / (7 * 86400000)));
  return Math.round(remaining / weeksLeft);
}

/* ── localStorage helpers for custom weekly targets ───────── */
const STORAGE_KEY = 'weekly-planner-targets';

function loadTargets(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch { return {}; }
}

function saveTargets(targets: Record<string, number>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(targets));
}

/* ── Component ─────────────────────────────────────────────── */
export const WeeklyPlannerWidget = ({ budgets, transactions, fmt, t }: WeeklyPlannerWidgetProps) => {
  const navigate = useNavigate();
  const [showExpenseDetails, setShowExpenseDetails] = useState(false);
  const [showIncomeDetails, setShowIncomeDetails] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [customTargets, setCustomTargets] = useState<Record<string, number>>(loadTargets);
  const [weekOffset, setWeekOffset] = useState(0);

  const thisWeek = useMemo(() => getWeekRange(weekOffset), [weekOffset]);
  const weekStartDate = useMemo(() => new Date(thisWeek.start), [thisWeek.start]);

  const expenseBudgets = useMemo(() =>
    budgets.filter(b => b.budget_type === 'expense'), [budgets]);

  const incomeBudgets = useMemo(() =>
    budgets.filter(b => b.budget_type === 'income'), [budgets]);

  // Filter transactions for displayed week
  const weekExpenseTxs = useMemo(() =>
    transactions.filter(tx => tx.type === 'expense' && tx.date >= thisWeek.start && tx.date <= thisWeek.end),
    [transactions, thisWeek]);

  const weekIncomeTxs = useMemo(() =>
    transactions.filter(tx => tx.type === 'income' && tx.date >= thisWeek.start && tx.date <= thisWeek.end),
    [transactions, thisWeek]);

  // Build expense rows
  const expenseRows = useMemo(() => {
    return expenseBudgets.map(b => {
      const range = getPeriodRange(b.period, weekStartDate);
      const rangeStart = range.start.toISOString().split('T')[0];
      const rangeEnd = range.end.toISOString().split('T')[0];

      const periodSpent = transactions
        .filter(tx => tx.type === 'expense' && tx.category_id === b.category_id && tx.date >= rangeStart && tx.date <= rangeEnd)
        .reduce((s, tx) => s + Number(tx.amount), 0);

      const autoTarget = computeWeeklyTarget(b, periodSpent, weekStartDate);
      const customTarget = customTargets[b.id];
      const weeklyTarget = customTarget ?? autoTarget;

      const weekSpent = weekExpenseTxs
        .filter(tx => tx.category_id === b.category_id)
        .reduce((s, tx) => s + Number(tx.amount), 0);

      const delta = weeklyTarget - weekSpent;
      const pct = weeklyTarget > 0 ? Math.min(100, (weekSpent / weeklyTarget) * 100) : (weekSpent > 0 ? 100 : 0);

      return {
        id: b.id,
        name: b.categories?.name || b.name,
        icon: b.categories?.icon || '📁',
        color: b.categories?.color || '#6C63FF',
        period: b.period,
        budgetAmount: b.amount,
        periodSpent,
        autoTarget,
        weeklyTarget,
        isCustom: customTarget !== undefined,
        weekSpent: Math.round(weekSpent),
        delta: Math.round(delta),
        pct,
      };
    }).filter(c => c.budgetAmount > 0);
  }, [expenseBudgets, transactions, weekExpenseTxs, weekStartDate, customTargets]);

  // Build income rows
  const incomeRows = useMemo(() => {
    return incomeBudgets.map(b => {
      const range = getPeriodRange(b.period, weekStartDate);
      const rangeStart = range.start.toISOString().split('T')[0];
      const rangeEnd = range.end.toISOString().split('T')[0];

      const periodReceived = transactions
        .filter(tx => tx.type === 'income' && tx.category_id === b.category_id && tx.date >= rangeStart && tx.date <= rangeEnd)
        .reduce((s, tx) => s + Number(tx.amount), 0);

      const autoTarget = computeWeeklyTarget(b, periodReceived, weekStartDate);
      const weekReceived = weekIncomeTxs
        .filter(tx => tx.category_id === b.category_id)
        .reduce((s, tx) => s + Number(tx.amount), 0);

      return {
        id: b.id,
        name: b.categories?.name || b.name,
        icon: b.categories?.icon || '💰',
        period: b.period,
        weeklyTarget: autoTarget,
        weekReceived: Math.round(weekReceived),
        delta: Math.round(weekReceived - autoTarget),
      };
    }).filter(c => c.weeklyTarget > 0 || c.weekReceived > 0);
  }, [incomeBudgets, transactions, weekIncomeTxs, weekStartDate]);

  // Totals
  const totalExpenseTarget = expenseRows.reduce((s, r) => s + r.weeklyTarget, 0);
  const totalExpenseSpent = expenseRows.reduce((s, r) => s + r.weekSpent, 0);
  const totalIncomeTarget = incomeRows.reduce((s, r) => s + r.weeklyTarget, 0);
  const totalIncomeReceived = incomeRows.reduce((s, r) => s + r.weekReceived, 0);
  const netBalance = (totalIncomeReceived - totalExpenseSpent);
  const netTarget = (totalIncomeTarget - totalExpenseTarget);
  const totalDelta = totalExpenseTarget - totalExpenseSpent; // positive = savings
  const totalPct = totalExpenseTarget > 0 ? Math.min(100, (totalExpenseSpent / totalExpenseTarget) * 100) : 0;

  // Status
  const statusColor = totalPct < 70 ? 'text-emerald-500' : totalPct < 90 ? 'text-amber-500' : 'text-destructive';
  const StatusIcon = totalPct < 70 ? CheckCircle2 : totalPct < 90 ? AlertTriangle : TrendingDown;
  const statusLabel = totalPct < 70 ? t.weeklyOnTrack : totalPct < 90 ? t.weeklyAtRisk : t.weeklyOver;

  // Edit handlers
  const startEdit = useCallback((id: string, current: number) => {
    setEditingId(id);
    setEditValue(String(current));
  }, []);

  const confirmEdit = useCallback(() => {
    if (editingId && editValue) {
      const val = Math.max(0, parseInt(editValue) || 0);
      const updated = { ...customTargets, [editingId]: val };
      setCustomTargets(updated);
      saveTargets(updated);
    }
    setEditingId(null);
  }, [editingId, editValue, customTargets]);

  const cancelEdit = useCallback(() => setEditingId(null), []);

  const resetTarget = useCallback((id: string) => {
    const updated = { ...customTargets };
    delete updated[id];
    setCustomTargets(updated);
    saveTargets(updated);
  }, [customTargets]);

  const isCurrentWeek = weekOffset === 0;
  const isPastWeek = weekOffset < 0;

  const periodLabel = (p: string) => {
    const map: Record<string, string> = {
      daily: t.daily as string, weekly: t.weekly as string, monthly: t.monthly as string,
      quarterly: t.quarterly as string, semi_annual: t.semiAnnual as string, yearly: t.yearly as string,
    };
    return map[p] || p;
  };

  if (expenseBudgets.length === 0 && incomeBudgets.length === 0) {
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

  const renderCategoryRow = (r: typeof expenseRows[0], i: number) => {
    const over = r.weekSpent > r.weeklyTarget;
    const isEditing = editingId === r.id;

    return (
      <motion.div
        key={r.id}
        initial={{ opacity: 0, x: -6 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: i * 0.03 }}
        className="space-y-0.5 p-1.5 rounded-lg hover:bg-muted/20 transition-colors"
      >
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-1 items-center">
          <span className="text-[11px] font-medium flex items-center gap-1 truncate">
            <span>{r.icon}</span>
            <span className="truncate">{r.name}</span>
            <span className="text-[8px] text-muted-foreground/60 font-normal">({periodLabel(r.period)})</span>
          </span>
          <div className="w-16 flex items-center justify-end gap-0.5">
            {isEditing ? (
              <div className="flex items-center gap-0.5">
                <Input
                  type="number"
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && confirmEdit()}
                  className="h-5 w-14 text-[10px] px-1 text-right"
                  autoFocus
                />
                <button onClick={confirmEdit} className="text-emerald-500"><Check className="w-3 h-3" /></button>
                <button onClick={cancelEdit} className="text-muted-foreground"><X className="w-3 h-3" /></button>
              </div>
            ) : (
              <button
                onClick={() => startEdit(r.id, r.weeklyTarget)}
                className="text-[10px] tabular-nums font-semibold text-right hover:text-primary transition-colors flex items-center gap-0.5 group"
              >
                {fmt(r.weeklyTarget)}
                <Pencil className="w-2.5 h-2.5 opacity-0 group-hover:opacity-60 transition-opacity" />
              </button>
            )}
          </div>
          <span className={`text-[10px] tabular-nums font-semibold text-right w-16 ${over ? 'text-destructive' : ''}`}>
            {fmt(r.weekSpent)}
          </span>
          <span className={`text-[10px] tabular-nums font-bold text-right w-14 flex items-center justify-end gap-0.5 ${
            r.delta > 0 ? 'text-emerald-500' : r.delta < 0 ? 'text-destructive' : 'text-muted-foreground'
          }`}>
            {r.delta > 0 ? <TrendingUp className="w-2.5 h-2.5" /> : r.delta < 0 ? <TrendingDown className="w-2.5 h-2.5" /> : null}
            {r.delta >= 0 ? '+' : ''}{fmt(r.delta)}
          </span>
        </div>
        <Progress value={r.pct} className={`h-1 rounded-full ${over ? '[&>div]:bg-destructive' : ''}`} />
        {r.isCustom && (
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-muted-foreground italic">auto: {fmt(r.autoTarget)}</span>
            <button onClick={() => resetTarget(r.id)} className="text-[9px] text-muted-foreground hover:text-foreground underline">reset</button>
          </div>
        )}
      </motion.div>
    );
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
      <div className="glass rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 pb-2">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <CalendarClock className="w-3.5 h-3.5 text-primary" />
            </div>
            {t.weeklyPlanner}
          </h3>
          <div className="flex items-center gap-1">
            <StatusIcon className={`w-3.5 h-3.5 ${statusColor}`} />
            <span className={`text-[10px] font-bold ${statusColor}`}>{statusLabel}</span>
          </div>
        </div>

        {/* Week navigation */}
        <div className="flex items-center justify-between px-4 pb-3">
          <button onClick={() => setWeekOffset(o => o - 1)} className="p-1 rounded-lg hover:bg-muted/30 transition-colors">
            <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
          <span className="text-[11px] font-medium text-muted-foreground">
            {weekLabel(thisWeek.start)} — {weekLabel(thisWeek.end)}
            {isCurrentWeek && <span className="ml-1 text-primary font-bold">●</span>}
          </span>
          <button
            onClick={() => setWeekOffset(o => Math.min(0, o + 1))}
            disabled={weekOffset >= 0}
            className="p-1 rounded-lg hover:bg-muted/30 transition-colors disabled:opacity-30"
          >
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>

        <div className="px-4 pb-4 space-y-3">
          {/* Global expense progress */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{t.weeklySpent}</span>
              <span className="font-semibold tabular-nums">{fmt(totalExpenseSpent)} / {fmt(totalExpenseTarget)}</span>
            </div>
            <Progress
              value={totalPct}
              className={`h-2.5 rounded-full ${totalPct > 90 ? '[&>div]:bg-destructive' : totalPct > 70 ? '[&>div]:bg-amber-500' : ''}`}
            />
          </div>

          {/* Delta banner */}
          <div className={`rounded-xl p-3 flex items-center gap-3 ${
            totalDelta >= 0
              ? 'bg-emerald-500/10 border border-emerald-500/20'
              : 'bg-destructive/10 border border-destructive/20'
          }`}>
            {totalDelta >= 0 ? (
              <PiggyBank className="w-5 h-5 text-emerald-500 shrink-0" />
            ) : (
              <TrendingDown className="w-5 h-5 text-destructive shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-bold ${totalDelta >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-destructive'}`}>
                {totalDelta >= 0 ? t.weeklySaved : t.weeklyOverspent}: {fmt(Math.abs(totalDelta))}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {totalDelta >= 0
                  ? (t.weeklySuggestionText as string).replace('{amount}', fmt(totalDelta))
                  : `${t.weeklyOver} — ${t.weeklyAtRisk}`}
              </p>
            </div>
          </div>

          {/* Savings action buttons */}
          {totalDelta > 0 && isPastWeek && (
            <div className="flex gap-2">
              <Button
                size="sm" variant="outline"
                className="flex-1 h-7 text-[10px] rounded-lg border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
                onClick={() => navigate('/dashboard/savings')}
              >
                <PiggyBank className="w-3 h-3 mr-1" />{t.weeklyReinvestSavings}
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-[10px] rounded-lg text-muted-foreground">
                {t.weeklyKeepForLater}
              </Button>
            </div>
          )}

          {/* ── EXPENSES section ────────────────────────── */}
          <button
            onClick={() => setShowExpenseDetails(!showExpenseDetails)}
            className="w-full flex items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
          >
            <span className="font-medium flex items-center gap-1.5">
              <Target className="w-3 h-3" />
              {t.expenses} ({expenseRows.length})
            </span>
            <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showExpenseDetails ? 'rotate-90' : ''}`} />
          </button>

          <AnimatePresence>
            {showExpenseDetails && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-1 overflow-hidden"
              >
                <div className="grid grid-cols-[1fr_auto_auto_auto] gap-1 px-1.5 text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                  <span>Cat.</span>
                  <span className="text-right w-16">{t.target}</span>
                  <span className="text-right w-16">{t.spent}</span>
                  <span className="text-right w-14">+/-</span>
                </div>
                {expenseRows.map(renderCategoryRow)}
                {/* Totals */}
                <div className="grid grid-cols-[1fr_auto_auto_auto] gap-1 px-1.5 pt-2 border-t border-border/50">
                  <span className="text-[10px] font-bold">Total</span>
                  <span className="text-[10px] font-bold tabular-nums text-right w-16">{fmt(totalExpenseTarget)}</span>
                  <span className="text-[10px] font-bold tabular-nums text-right w-16">{fmt(totalExpenseSpent)}</span>
                  <span className={`text-[10px] font-bold tabular-nums text-right w-14 ${totalDelta >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>
                    {totalDelta >= 0 ? '+' : ''}{fmt(totalDelta)}
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── INCOME section ──────────────────────────── */}
          {incomeRows.length > 0 && (
            <>
              <button
                onClick={() => setShowIncomeDetails(!showIncomeDetails)}
                className="w-full flex items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
              >
                <span className="font-medium flex items-center gap-1.5">
                  <Wallet className="w-3 h-3" />
                  {t.weeklyIncomeExpected} ({incomeRows.length})
                </span>
                <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showIncomeDetails ? 'rotate-90' : ''}`} />
              </button>

              <AnimatePresence>
                {showIncomeDetails && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-1 overflow-hidden"
                  >
                    <div className="grid grid-cols-[1fr_auto_auto_auto] gap-1 px-1.5 text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                      <span>Cat.</span>
                      <span className="text-right w-16">{t.target}</span>
                      <span className="text-right w-16">{t.received}</span>
                      <span className="text-right w-14">+/-</span>
                    </div>
                    {incomeRows.map((r, i) => (
                      <motion.div
                        key={r.id}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="grid grid-cols-[1fr_auto_auto_auto] gap-1 items-center p-1.5 rounded-lg hover:bg-muted/20 transition-colors"
                      >
                        <span className="text-[11px] font-medium flex items-center gap-1 truncate">
                          <span>{r.icon}</span>
                          <span className="truncate">{r.name}</span>
                          <span className="text-[8px] text-muted-foreground/60 font-normal">({periodLabel(r.period)})</span>
                        </span>
                        <span className="text-[10px] tabular-nums font-semibold text-right w-16">{fmt(r.weeklyTarget)}</span>
                        <span className="text-[10px] tabular-nums font-semibold text-right w-16">{fmt(r.weekReceived)}</span>
                        <span className={`text-[10px] tabular-nums font-bold text-right w-14 ${
                          r.delta > 0 ? 'text-emerald-500' : r.delta < 0 ? 'text-destructive' : 'text-muted-foreground'
                        }`}>
                          {r.delta >= 0 ? '+' : ''}{fmt(r.delta)}
                        </span>
                      </motion.div>
                    ))}
                    <div className="grid grid-cols-[1fr_auto_auto_auto] gap-1 px-1.5 pt-2 border-t border-border/50">
                      <span className="text-[10px] font-bold">Total</span>
                      <span className="text-[10px] font-bold tabular-nums text-right w-16">{fmt(totalIncomeTarget)}</span>
                      <span className="text-[10px] font-bold tabular-nums text-right w-16">{fmt(totalIncomeReceived)}</span>
                      <span className={`text-[10px] font-bold tabular-nums text-right w-14 ${
                        totalIncomeReceived >= totalIncomeTarget ? 'text-emerald-500' : 'text-destructive'
                      }`}>
                        {totalIncomeReceived >= totalIncomeTarget ? '+' : ''}{fmt(totalIncomeReceived - totalIncomeTarget)}
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}

          {/* ── NET BALANCE ─────────────────────────────── */}
          <div className="rounded-xl p-2.5 bg-muted/30 border border-border/50">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-muted-foreground">{t.weeklyNetBalance}</span>
              <span className={`text-xs font-bold tabular-nums ${netBalance >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>
                {netBalance >= 0 ? '+' : ''}{fmt(netBalance)}
              </span>
            </div>
            {netTarget !== 0 && (
              <div className="flex items-center justify-between mt-0.5">
                <span className="text-[9px] text-muted-foreground">{t.target}</span>
                <span className="text-[9px] tabular-nums text-muted-foreground">{netTarget >= 0 ? '+' : ''}{fmt(netTarget)}</span>
              </div>
            )}
          </div>

          {/* Quick link */}
          <button
            onClick={() => navigate('/dashboard/budgets')}
            className="w-full flex items-center justify-center gap-1 text-[10px] text-primary hover:underline pt-1"
          >
            {t.budgets} <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};
