import { useMemo, useState, useCallback } from 'react';
import {
  CalendarClock, TrendingDown, TrendingUp, PiggyBank,
  ChevronRight, ChevronLeft, Pencil, Check, X, Target,
  AlertTriangle, CheckCircle2, ArrowRight, Wallet, Compass,
  Flame, Zap, CalendarPlus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
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
  reference_date?: string | null;
  active_days?: string | null;
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
  locale?: string;
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

function dayOfMonthFallsInWeek(dayOfMonth: number, weekStart: Date, weekEnd: Date): boolean {
  for (let d = new Date(weekStart); d <= weekEnd; d.setDate(d.getDate() + 1)) {
    if (d.getDate() === dayOfMonth) return true;
  }
  return false;
}

function weeksInPeriod(period: string): number {
  switch (period) {
    case 'daily': return 1 / 7;
    case 'weekly': return 1;
    case 'monthly': return 30.44 / 7;
    case 'quarterly': return 91.31 / 7;
    case 'semi_annual': return 182.62 / 7;
    case 'yearly': return 365.25 / 7;
    default: return 30.44 / 7;
  }
}

function getOccurrencesInWeek(budget: Budget, weekStart: Date, weekEnd: Date): number {
  const freq = budget.occurrence_frequency;
  const expectedDay = budget.expected_day;
  const refDateStr = budget.reference_date;
  const activeDays = budget.active_days;

  if (!freq) {
    if (expectedDay) {
      if (budget.period === 'weekly') {
        for (let d = new Date(weekStart); d <= weekEnd; d.setDate(d.getDate() + 1)) {
          const jsDay = d.getDay();
          const isoDay = jsDay === 0 ? 7 : jsDay;
          if (isoDay === expectedDay) return 1;
        }
        return 0;
      }
      return dayOfMonthFallsInWeek(expectedDay, weekStart, weekEnd) ? 1 : 0;
    }
    return -1;
  }

  if (freq === 'daily') {
    if (activeDays) {
      const activeDayNums = activeDays.split(',').filter(Boolean).map(Number);
      let count = 0;
      for (let d = new Date(weekStart); d <= weekEnd; d.setDate(d.getDate() + 1)) {
        const jsDay = d.getDay();
        const isoDay = jsDay === 0 ? 7 : jsDay;
        if (activeDayNums.includes(isoDay)) count++;
      }
      return count;
    }
    return 7;
  }

  if (freq === 'once') {
    if (refDateStr) {
      const refDate = new Date(refDateStr);
      if (refDate >= weekStart && refDate <= weekEnd) return 1;
      return 0;
    }
    if (expectedDay) {
      if (budget.period === 'weekly') {
        for (let d = new Date(weekStart); d <= weekEnd; d.setDate(d.getDate() + 1)) {
          const jsDay = d.getDay();
          const isoDay = jsDay === 0 ? 7 : jsDay;
          if (isoDay === expectedDay) return 1;
        }
        return 0;
      }
      return dayOfMonthFallsInWeek(expectedDay, weekStart, weekEnd) ? 1 : 0;
    }
    return -1;
  }

  if (freq === 'weekly') {
    if (expectedDay) {
      for (let d = new Date(weekStart); d <= weekEnd; d.setDate(d.getDate() + 1)) {
        const jsDay = d.getDay();
        const isoDay = jsDay === 0 ? 7 : jsDay;
        if (isoDay === expectedDay) return 1;
      }
      return 0;
    }
    return 1;
  }

  if (freq === 'biweekly') {
    if (refDateStr) {
      const refDate = new Date(refDateStr);
      const weeksSinceRef = Math.floor((weekStart.getTime() - refDate.getTime()) / (7 * 86400000));
      return weeksSinceRef % 2 === 0 ? 1 : 0;
    }
    if (expectedDay && dayOfMonthFallsInWeek(expectedDay, weekStart, weekEnd)) {
      const weekNum = Math.floor(weekStart.getTime() / (7 * 86400000));
      return weekNum % 2 === 0 ? 1 : 0;
    }
    return -1;
  }

  if (['monthly', 'quarterly', 'semi_annual', 'yearly'].includes(freq)) {
    if (refDateStr) {
      const refDate = new Date(refDateStr);
      const increment = freq === 'monthly' ? 1 : freq === 'quarterly' ? 3 : freq === 'semi_annual' ? 6 : 12;
      let d = new Date(refDate);
      const twoYearsAgo = new Date(weekStart);
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
      while (d > twoYearsAgo) d.setMonth(d.getMonth() - increment);
      const oneYearAhead = new Date(weekEnd);
      oneYearAhead.setFullYear(oneYearAhead.getFullYear() + 1);
      while (d <= oneYearAhead) {
        if (d >= weekStart && d <= weekEnd) return 1;
        d = new Date(d);
        d.setMonth(d.getMonth() + increment);
      }
      return 0;
    }
    if (expectedDay) {
      if (freq === 'monthly') {
        return dayOfMonthFallsInWeek(expectedDay, weekStart, weekEnd) ? 1 : 0;
      }
      if (freq === 'quarterly') {
        const quarterMonths = [0, 3, 6, 9];
        const monthsInWeek = new Set<number>();
        for (let d = new Date(weekStart); d <= weekEnd; d.setDate(d.getDate() + 1)) monthsInWeek.add(d.getMonth());
        if ([...monthsInWeek].some(m => quarterMonths.includes(m)) && dayOfMonthFallsInWeek(expectedDay, weekStart, weekEnd)) return 1;
        return 0;
      }
      if (freq === 'semi_annual') {
        const semiMonths = [0, 6];
        const monthsInWeek = new Set<number>();
        for (let d = new Date(weekStart); d <= weekEnd; d.setDate(d.getDate() + 1)) monthsInWeek.add(d.getMonth());
        if ([...monthsInWeek].some(m => semiMonths.includes(m)) && dayOfMonthFallsInWeek(expectedDay, weekStart, weekEnd)) return 1;
        return 0;
      }
      if (freq === 'yearly') {
        const monthsInWeek = new Set<number>();
        for (let d = new Date(weekStart); d <= weekEnd; d.setDate(d.getDate() + 1)) monthsInWeek.add(d.getMonth());
        if (monthsInWeek.has(0) && dayOfMonthFallsInWeek(expectedDay, weekStart, weekEnd)) return 1;
        return 0;
      }
    }
    return -1;
  }

  return -1;
}

function computeWeeklyTarget(
  budget: Budget,
  periodSpent: number,
  weekStart: Date,
  weekEnd: Date
): number {
  const { period, amount, occurrence_frequency: freq } = budget;
  const occurrences = getOccurrencesInWeek(budget, weekStart, weekEnd);

  if (occurrences === 0) return 0;

  if (occurrences > 0) {
    if (freq === 'daily') return amount * occurrences;
    if (freq === 'once' || !freq) return amount;
    if (freq === 'weekly') return Math.round(amount / weeksInPeriod(period));
    if (freq === 'biweekly') return Math.round(amount / (weeksInPeriod(period) / 2));
    if (freq === 'monthly') {
      const monthsInPeriod = period === 'monthly' ? 1 : period === 'quarterly' ? 3 : period === 'semi_annual' ? 6 : period === 'yearly' ? 12 : 1;
      return Math.round(amount / monthsInPeriod);
    }
    if (freq === 'quarterly') {
      const quartersInPeriod = period === 'quarterly' ? 1 : period === 'semi_annual' ? 2 : period === 'yearly' ? 4 : 1;
      return Math.round(amount / quartersInPeriod);
    }
    if (freq === 'semi_annual') {
      const halves = period === 'semi_annual' ? 1 : period === 'yearly' ? 2 : 1;
      return Math.round(amount / halves);
    }
    if (freq === 'yearly') return amount;
    return amount;
  }

  if (period === 'daily') return amount * 7;
  if (period === 'weekly') return amount;

  const range = getPeriodRange(period, weekStart);
  const remaining = Math.max(0, amount - periodSpent);
  const msLeft = range.end.getTime() - weekStart.getTime();
  const wLeft = Math.max(1, Math.ceil(msLeft / (7 * 86400000)));
  return Math.round(remaining / wLeft);
}

/* ── localStorage helpers ─────────────────────────────────── */
const STORAGE_KEY = 'weekly-planner-targets';
function loadTargets(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
}
function saveTargets(targets: Record<string, number>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(targets));
}

/* ── Progress Ring SVG ────────────────────────────────────── */
const ProgressRing = ({ pct, size = 100, stroke = 8, color }: { pct: number; size?: number; stroke?: number; color: string }) => {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(pct, 100) / 100) * c;
  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={stroke} opacity={0.3} />
      <motion.circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={c}
        initial={{ strokeDashoffset: c }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1, ease: 'easeOut' }}
      />
    </svg>
  );
};

/* ── Day labels ───────────────────────────────────────────── */
const DAY_LABELS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const DAY_LABELS_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_SHORT_FR = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const DAY_SHORT_EN = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/* ── Component ─────────────────────────────────────────────── */
export const WeeklyPlannerWidget = ({ budgets, transactions, fmt, t, locale = 'fr' }: WeeklyPlannerWidgetProps) => {
  const navigate = useNavigate();
  const [showExpenseDetails, setShowExpenseDetails] = useState(false);
  const [showIncomeDetails, setShowIncomeDetails] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [customTargets, setCustomTargets] = useState<Record<string, number>>(loadTargets);
  const [weekOffset, setWeekOffset] = useState(0);

  const isFr = locale === 'fr';

  const thisWeek = useMemo(() => getWeekRange(weekOffset), [weekOffset]);
  const weekStartDate = useMemo(() => new Date(thisWeek.start), [thisWeek.start]);
  const weekEndDate = useMemo(() => new Date(thisWeek.end), [thisWeek.end]);

  const expenseBudgets = useMemo(() => budgets.filter(b => b.budget_type === 'expense'), [budgets]);
  const incomeBudgets = useMemo(() => budgets.filter(b => b.budget_type === 'income'), [budgets]);

  const weekExpenseTxs = useMemo(() =>
    transactions.filter(tx => tx.type === 'expense' && tx.date >= thisWeek.start && tx.date <= thisWeek.end),
    [transactions, thisWeek]);
  const weekIncomeTxs = useMemo(() =>
    transactions.filter(tx => tx.type === 'income' && tx.date >= thisWeek.start && tx.date <= thisWeek.end),
    [transactions, thisWeek]);

  // Daily spending per day of week (Mon=0..Sun=6)
  const dailySpending = useMemo(() => {
    const days = [0, 0, 0, 0, 0, 0, 0];
    const ws = new Date(thisWeek.start);
    weekExpenseTxs.forEach(tx => {
      const txDate = new Date(tx.date);
      const diff = Math.floor((txDate.getTime() - ws.getTime()) / 86400000);
      if (diff >= 0 && diff < 7) days[diff] += Number(tx.amount);
    });
    return days;
  }, [weekExpenseTxs, thisWeek.start]);

  const maxDailySpending = Math.max(...dailySpending, 1);

  // Today's day index (0=Mon..6=Sun)
  const todayIndex = useMemo(() => {
    if (weekOffset !== 0) return -1;
    const d = new Date().getDay();
    return d === 0 ? 6 : d - 1;
  }, [weekOffset]);

  // Build expense rows
  const expenseRows = useMemo(() => {
    return expenseBudgets.map(b => {
      const range = getPeriodRange(b.period, weekStartDate);
      const rangeStart = range.start.toISOString().split('T')[0];
      const rangeEnd = range.end.toISOString().split('T')[0];
      const periodSpent = transactions
        .filter(tx => tx.type === 'expense' && tx.category_id === b.category_id && tx.date >= rangeStart && tx.date <= rangeEnd)
        .reduce((s, tx) => s + Number(tx.amount), 0);
      const autoTarget = computeWeeklyTarget(b, periodSpent, weekStartDate, weekEndDate);
      const customTarget = customTargets[b.id];
      const weeklyTarget = customTarget ?? autoTarget;
      const weekSpent = weekExpenseTxs
        .filter(tx => tx.category_id === b.category_id)
        .reduce((s, tx) => s + Number(tx.amount), 0);
      const delta = weeklyTarget - weekSpent;
      const pct = weeklyTarget > 0 ? Math.min(100, (weekSpent / weeklyTarget) * 100) : (weekSpent > 0 ? 100 : 0);
      return {
        id: b.id, name: b.categories?.name || b.name, icon: b.categories?.icon || '📁',
        color: b.categories?.color || '#6C63FF', period: b.period, budgetAmount: b.amount,
        periodSpent, autoTarget, weeklyTarget, isCustom: customTarget !== undefined,
        weekSpent: Math.round(weekSpent), delta: Math.round(delta), pct,
      };
    }).filter(c => c.budgetAmount > 0);
  }, [expenseBudgets, transactions, weekExpenseTxs, weekStartDate, customTargets]);

  const incomeRows = useMemo(() => {
    return incomeBudgets.map(b => {
      const range = getPeriodRange(b.period, weekStartDate);
      const rangeStart = range.start.toISOString().split('T')[0];
      const rangeEnd = range.end.toISOString().split('T')[0];
      const periodReceived = transactions
        .filter(tx => tx.type === 'income' && tx.category_id === b.category_id && tx.date >= rangeStart && tx.date <= rangeEnd)
        .reduce((s, tx) => s + Number(tx.amount), 0);
      const autoTarget = computeWeeklyTarget(b, periodReceived, weekStartDate, weekEndDate);
      const weekReceived = weekIncomeTxs
        .filter(tx => tx.category_id === b.category_id)
        .reduce((s, tx) => s + Number(tx.amount), 0);
      return {
        id: b.id, name: b.categories?.name || b.name, icon: b.categories?.icon || '💰',
        period: b.period, weeklyTarget: autoTarget,
        weekReceived: Math.round(weekReceived), delta: Math.round(weekReceived - autoTarget),
      };
    }).filter(c => c.weeklyTarget > 0 || c.weekReceived > 0);
  }, [incomeBudgets, transactions, weekIncomeTxs, weekStartDate]);

  const totalExpenseTarget = expenseRows.reduce((s, r) => s + r.weeklyTarget, 0);
  const totalExpenseSpent = expenseRows.reduce((s, r) => s + r.weekSpent, 0);
  const totalIncomeTarget = incomeRows.reduce((s, r) => s + r.weeklyTarget, 0);
  const totalIncomeReceived = incomeRows.reduce((s, r) => s + r.weekReceived, 0);
  const netBalance = totalIncomeReceived - totalExpenseSpent;
  const netTarget = totalIncomeTarget - totalExpenseTarget;
  const totalDelta = totalExpenseTarget - totalExpenseSpent;
  const totalPct = totalExpenseTarget > 0 ? Math.min(100, (totalExpenseSpent / totalExpenseTarget) * 100) : 0;

  const ringColor = totalPct < 70 ? 'hsl(var(--secondary))' : totalPct < 90 ? 'hsl(var(--warning))' : 'hsl(var(--destructive))';
  const statusColor = totalPct < 70 ? 'text-secondary' : totalPct < 90 ? 'text-warning' : 'text-destructive';
  const StatusIcon = totalPct < 70 ? CheckCircle2 : totalPct < 90 ? AlertTriangle : Flame;
  const statusLabel = totalPct < 70 ? t.weeklyOnTrack : totalPct < 90 ? t.weeklyAtRisk : t.weeklyOver;

  const startEdit = useCallback((id: string, current: number) => {
    setEditingId(id); setEditValue(String(current));
  }, []);
  const confirmEdit = useCallback(() => {
    if (editingId && editValue) {
      const val = Math.max(0, parseInt(editValue) || 0);
      const updated = { ...customTargets, [editingId]: val };
      setCustomTargets(updated); saveTargets(updated);
    }
    setEditingId(null);
  }, [editingId, editValue, customTargets]);
  const cancelEdit = useCallback(() => setEditingId(null), []);
  const resetTarget = useCallback((id: string) => {
    const updated = { ...customTargets }; delete updated[id];
    setCustomTargets(updated); saveTargets(updated);
  }, [customTargets]);

  const isCurrentWeek = weekOffset === 0;
  const isPastWeek = weekOffset < 0;
  const isFutureWeek = weekOffset > 0;

  const periodLabel = (p: string) => {
    const map: Record<string, string> = {
      daily: t.daily as string, weekly: t.weekly as string, monthly: t.monthly as string,
      quarterly: t.quarterly as string, semi_annual: t.semiAnnual as string, yearly: t.yearly as string,
    };
    return map[p] || p;
  };

  const dayLabels = isFr ? DAY_LABELS_FR : DAY_LABELS_EN;
  const dayShort = isFr ? DAY_SHORT_FR : DAY_SHORT_EN;

  // Compute full day dates for tooltips
  const dayDates = useMemo(() => {
    const ws = new Date(thisWeek.start);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(ws);
      d.setDate(ws.getDate() + i);
      return d.toLocaleDateString(isFr ? 'fr-FR' : 'en-US', { weekday: 'short', day: 'numeric', month: 'short' });
    });
  }, [thisWeek.start, isFr]);

  if (expenseBudgets.length === 0 && incomeBudgets.length === 0) {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <div className="glass rounded-2xl p-5 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <Compass className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold">{t.weeklyPlanner}</h3>
            <p className="text-xs text-muted-foreground mt-1">{t.weeklyNoBudgets}</p>
          </div>
          <Button size="sm" variant="outline" className="rounded-xl text-xs" onClick={() => navigate('/dashboard/budgets')}>
            {t.addBudget}
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
      <div className="glass rounded-2xl overflow-hidden">
        {/* ── Header with week navigation ── */}
        <div className="flex items-center justify-between p-4 pb-0">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: 'var(--gradient-primary)' }}>
              <Compass className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            {t.weeklyPlanner}
          </h3>
          <div className="flex items-center gap-0.5 glass rounded-full px-1 py-0.5 border border-glass-border">
            <button onClick={() => setWeekOffset(o => o - 1)} className="p-1 rounded-full hover:bg-muted/40 transition-colors">
              <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
            <span className="text-[10px] font-semibold tabular-nums px-1.5 whitespace-nowrap">
              {weekLabel(thisWeek.start)} — {weekLabel(thisWeek.end)}
              {isCurrentWeek && <span className="ml-1 text-primary">●</span>}
              {isFutureWeek && <span className="ml-1 text-accent">◆</span>}
            </span>
            <button
              onClick={() => setWeekOffset(o => o + 1)}
              className="p-1 rounded-full hover:bg-muted/40 transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Future week indicator */}
        {isFutureWeek && (
          <div className="mx-4 mt-3 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-accent/10 border border-accent/20">
            <CalendarPlus className="w-3.5 h-3.5 text-accent shrink-0" />
            <span className="text-[10px] font-medium text-accent-foreground">
              {isFr ? 'Prévision — Objectifs budgétaires uniquement' : 'Forecast — Budget targets only'}
            </span>
          </div>
        )}

        {/* Quick return to current week */}
        {!isCurrentWeek && (
          <div className="mx-4 mt-2">
            <button
              onClick={() => setWeekOffset(0)}
              className="text-[10px] font-medium text-primary hover:underline flex items-center gap-1"
            >
              <ArrowRight className="w-3 h-3 rotate-180" />
              {isFr ? 'Revenir à cette semaine' : 'Back to this week'}
            </button>
          </div>
        )}

        {/* ── Hero: Ring + Stats ── */}
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              <ProgressRing pct={totalPct} size={88} stroke={7} color={ringColor} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg font-bold tabular-nums leading-none">{Math.round(totalPct)}%</span>
                <span className="text-[8px] text-muted-foreground font-medium mt-0.5">
                  {(t as any).weeklyUsed || (isFr ? 'utilisé' : 'used')}
                </span>
              </div>
            </div>

            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center gap-1.5">
                <StatusIcon className={`w-3.5 h-3.5 ${statusColor}`} />
                <span className={`text-[11px] font-bold ${statusColor}`}>{statusLabel}</span>
              </div>

              <div>
                <div className="flex items-baseline gap-1">
                  <span className="text-base font-bold tabular-nums">{fmt(totalExpenseSpent)}</span>
                  <span className="text-[10px] text-muted-foreground">/ {fmt(totalExpenseTarget)}</span>
                </div>
              </div>

              <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                totalDelta >= 0
                  ? 'bg-secondary/10 text-secondary'
                  : 'bg-destructive/10 text-destructive'
              }`}>
                {totalDelta >= 0 ? <PiggyBank className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {totalDelta >= 0 ? '+' : ''}{fmt(totalDelta)}
                <span className="font-medium opacity-70">
                  {totalDelta >= 0 ? ((t as any).weeklyLeft || (isFr ? 'restant' : 'left')) : ((t as any).weeklyOverBy || (isFr ? 'dépassé' : 'over'))}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Daily spending timeline with tooltips ── */}
        <div className="px-4 pb-3">
          <div className="flex items-end gap-1.5 h-12">
            {dailySpending.map((amount, i) => {
              const h = maxDailySpending > 0 ? Math.max(4, (amount / maxDailySpending) * 100) : 4;
              const isToday = i === todayIndex;
              const isFuture = weekOffset === 0 && i > todayIndex;
              return (
                <Tooltip key={i}>
                  <TooltipTrigger asChild>
                    <div className="flex-1 flex flex-col items-center gap-0.5 cursor-pointer group">
                      <motion.div
                        className="w-full rounded-md group-hover:opacity-80 transition-opacity"
                        style={{
                          background: isToday
                            ? 'var(--gradient-primary)'
                            : isFuture
                            ? 'hsl(var(--muted) / 0.25)'
                            : amount > 0
                            ? 'hsl(var(--primary) / 0.3)'
                            : 'hsl(var(--muted) / 0.4)',
                          minHeight: 4,
                        }}
                        initial={{ height: 0 }}
                        animate={{ height: `${h}%` }}
                        transition={{ duration: 0.5, delay: i * 0.05 }}
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-[10px] px-2 py-1">
                    <p className="font-semibold">{dayDates[i]}</p>
                    <p className="tabular-nums">{amount > 0 ? fmt(amount) : (isFr ? 'Aucune dépense' : 'No spending')}</p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
          <div className="flex gap-1.5 mt-1">
            {dayShort.map((label, i) => (
              <span key={i} className={`flex-1 text-center text-[8px] font-semibold ${
                i === todayIndex ? 'text-primary' : 'text-muted-foreground/60'
              }`}>
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* ── Savings action ── */}
        {totalDelta > 0 && isPastWeek && (
          <div className="px-4 pb-3">
            <Button
              size="sm" variant="outline"
              className="w-full h-8 text-[10px] rounded-xl border-secondary/30 text-secondary hover:bg-secondary/10 gap-1.5"
              onClick={() => navigate('/dashboard/savings')}
            >
              <PiggyBank className="w-3.5 h-3.5" />{t.weeklyReinvestSavings}
            </Button>
          </div>
        )}

        {/* ── EXPENSE details ── */}
        <div className="px-4 pb-1">
          <button
            onClick={() => setShowExpenseDetails(!showExpenseDetails)}
            className="w-full flex items-center justify-between py-2.5 border-t border-border/30"
          >
            <span className="text-[11px] font-bold flex items-center gap-1.5 text-foreground">
              <Target className="w-3.5 h-3.5 text-primary" />
              {t.expenses}
              <span className="text-[9px] font-medium text-muted-foreground bg-muted/40 rounded-full px-1.5 py-0.5">{expenseRows.length}</span>
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] tabular-nums font-semibold text-muted-foreground">
                {fmt(totalExpenseSpent)} / {fmt(totalExpenseTarget)}
              </span>
              <ChevronRight className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${showExpenseDetails ? 'rotate-90' : ''}`} />
            </div>
          </button>
        </div>

        <AnimatePresence>
          {showExpenseDetails && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="px-3 pb-3 space-y-0.5 max-h-[340px] overflow-y-auto scrollbar-thin">
                {expenseRows.map((r, i) => {
                  const over = r.weekSpent > r.weeklyTarget;
                  const isEditing = editingId === r.id;
                  const pctCapped = Math.min(r.pct, 100);
                  return (
                    <motion.div
                      key={r.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.025 }}
                      className="rounded-xl hover:bg-muted/20 transition-colors px-2.5 py-2"
                    >
                      {/* Row 1: Icon + Name + Status dot */}
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[11px] font-medium flex items-center gap-1.5 truncate min-w-0">
                          <span className="w-6 h-6 rounded-lg flex items-center justify-center text-xs shrink-0"
                            style={{ background: `${r.color}18` }}>{r.icon}</span>
                          <span className="truncate">{r.name}</span>
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          {r.weeklyTarget === 0 && r.weekSpent === 0 ? (
                            <span className="text-[9px] text-muted-foreground/50">—</span>
                          ) : (
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                              over ? 'bg-destructive' : r.pct > 70 ? 'bg-warning' : 'bg-secondary'
                            }`} />
                          )}
                        </div>
                      </div>

                      {/* Row 2: Target / Spent / Delta — only if there's data */}
                      {(r.weeklyTarget > 0 || r.weekSpent > 0) && (
                        <>
                          <div className="flex items-center justify-between gap-2 text-[10px] tabular-nums">
                            <div className="flex items-center gap-0.5">
                              {isEditing ? (
                                <div className="flex items-center gap-0.5">
                                  <Input type="number" value={editValue} onChange={e => setEditValue(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && confirmEdit()}
                                    className="h-5 w-16 text-[10px] px-1 text-right rounded-md" autoFocus />
                                  <button onClick={confirmEdit} className="text-secondary p-0.5"><Check className="w-3 h-3" /></button>
                                  <button onClick={cancelEdit} className="text-muted-foreground p-0.5"><X className="w-3 h-3" /></button>
                                </div>
                              ) : (
                                <button onClick={() => startEdit(r.id, r.weeklyTarget)}
                                  className="font-semibold text-muted-foreground hover:text-primary transition-colors flex items-center gap-0.5 group">
                                  {isFr ? 'Obj' : 'Tgt'}: {fmt(r.weeklyTarget)}
                                  <Pencil className="w-2 h-2 opacity-0 group-hover:opacity-60 transition-opacity" />
                                </button>
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              <span className={`font-semibold ${over ? 'text-destructive' : ''}`}>
                                {fmt(r.weekSpent)}
                              </span>
                              <span className={`font-bold flex items-center gap-0.5 min-w-[3.5rem] justify-end ${
                                r.delta > 0 ? 'text-secondary' : r.delta < 0 ? 'text-destructive' : 'text-muted-foreground'
                              }`}>
                                {r.delta > 0 ? <TrendingUp className="w-2.5 h-2.5" /> : r.delta < 0 ? <TrendingDown className="w-2.5 h-2.5" /> : null}
                                {r.delta >= 0 ? '+' : ''}{fmt(r.delta)}
                              </span>
                            </div>
                          </div>

                          {/* Progress bar */}
                          <div className="mt-1.5 h-1 rounded-full bg-muted/30 overflow-hidden">
                            <motion.div
                              className="h-full rounded-full"
                              style={{ background: over ? 'hsl(var(--destructive))' : r.color }}
                              initial={{ width: 0 }}
                              animate={{ width: `${pctCapped}%` }}
                              transition={{ duration: 0.6, delay: i * 0.03 }}
                            />
                          </div>

                          {r.isCustom && (
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-[9px] text-muted-foreground italic">auto: {fmt(r.autoTarget)}</span>
                              <button onClick={() => resetTarget(r.id)} className="text-[9px] text-muted-foreground hover:text-foreground underline">reset</button>
                            </div>
                          )}
                        </>
                      )}
                    </motion.div>
                  );
                })}
                {/* Totals */}
                <div className="flex items-center justify-between px-2.5 pt-2 border-t border-border/30">
                  <span className="text-[10px] font-bold">Total</span>
                  <div className="flex items-center gap-3 text-[10px] font-bold tabular-nums">
                    <span className="text-muted-foreground">{fmt(totalExpenseTarget)}</span>
                    <span>{fmt(totalExpenseSpent)}</span>
                    <span className={`min-w-[3.5rem] text-right ${totalDelta >= 0 ? 'text-secondary' : 'text-destructive'}`}>
                      {totalDelta >= 0 ? '+' : ''}{fmt(totalDelta)}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── INCOME details ── */}
        {incomeRows.length > 0 && (
          <>
            <div className="px-4 pb-1">
              <button
                onClick={() => setShowIncomeDetails(!showIncomeDetails)}
                className="w-full flex items-center justify-between py-2.5 border-t border-border/30"
              >
                <span className="text-[11px] font-bold flex items-center gap-1.5 text-foreground">
                  <Wallet className="w-3.5 h-3.5 text-secondary" />
                  {t.weeklyIncomeExpected}
                  <span className="text-[9px] font-medium text-muted-foreground bg-muted/40 rounded-full px-1.5 py-0.5">{incomeRows.length}</span>
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] tabular-nums font-semibold text-muted-foreground">
                    {fmt(totalIncomeReceived)} / {fmt(totalIncomeTarget)}
                  </span>
                  <ChevronRight className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${showIncomeDetails ? 'rotate-90' : ''}`} />
                </div>
              </button>
            </div>

            <AnimatePresence>
              {showIncomeDetails && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="px-3 pb-3 space-y-0.5 max-h-[260px] overflow-y-auto scrollbar-thin">
                    {incomeRows.map((r, i) => (
                      <motion.div
                        key={r.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.025 }}
                        className="rounded-xl hover:bg-muted/20 transition-colors px-2.5 py-2"
                      >
                        {/* Name row */}
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-[11px] font-medium flex items-center gap-1.5 truncate min-w-0">
                            <span>{r.icon}</span>
                            <span className="truncate">{r.name}</span>
                          </span>
                          {(r.weeklyTarget > 0 || r.weekReceived > 0) && (
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                              r.weekReceived >= r.weeklyTarget ? 'bg-secondary' : 'bg-warning'
                            }`} />
                          )}
                        </div>
                        {/* Data row */}
                        {(r.weeklyTarget > 0 || r.weekReceived > 0) && (
                          <div className="flex items-center justify-between gap-2 text-[10px] tabular-nums">
                            <span className="font-semibold text-muted-foreground">
                              {isFr ? 'Obj' : 'Tgt'}: {fmt(r.weeklyTarget)}
                            </span>
                            <div className="flex items-center gap-3">
                              <span className="font-semibold">{fmt(r.weekReceived)}</span>
                              <span className={`font-bold min-w-[3.5rem] text-right ${
                                r.delta > 0 ? 'text-secondary' : r.delta < 0 ? 'text-destructive' : 'text-muted-foreground'
                              }`}>
                                {r.delta >= 0 ? '+' : ''}{fmt(r.delta)}
                              </span>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    ))}
                    <div className="flex items-center justify-between px-2.5 pt-2 border-t border-border/30">
                      <span className="text-[10px] font-bold">Total</span>
                      <div className="flex items-center gap-3 text-[10px] font-bold tabular-nums">
                        <span className="text-muted-foreground">{fmt(totalIncomeTarget)}</span>
                        <span>{fmt(totalIncomeReceived)}</span>
                        <span className={`min-w-[3.5rem] text-right ${
                          totalIncomeReceived >= totalIncomeTarget ? 'text-secondary' : 'text-destructive'
                        }`}>
                          {totalIncomeReceived >= totalIncomeTarget ? '+' : ''}{fmt(totalIncomeReceived - totalIncomeTarget)}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}

        {/* ── Net Balance footer ── */}
        <div className="mx-4 mb-3 rounded-xl p-3 border border-border/30" style={{ background: 'var(--gradient-hero)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className={`w-4 h-4 ${netBalance >= 0 ? 'text-secondary' : 'text-destructive'}`} />
              <span className="text-[11px] font-bold">{t.weeklyNetBalance}</span>
            </div>
            <span className={`text-sm font-bold tabular-nums ${netBalance >= 0 ? 'text-secondary' : 'text-destructive'}`}>
              {netBalance >= 0 ? '+' : ''}{fmt(netBalance)}
            </span>
          </div>
          {netTarget !== 0 && (
            <div className="flex items-center justify-end mt-0.5">
              <span className="text-[9px] text-muted-foreground tabular-nums">{t.target}: {netTarget >= 0 ? '+' : ''}{fmt(netTarget)}</span>
            </div>
          )}
        </div>

        {/* ── Footer link ── */}
        <button
          onClick={() => navigate('/dashboard/budgets')}
          className="w-full flex items-center justify-center gap-1 text-[10px] text-primary font-medium hover:underline py-2.5 border-t border-border/20"
        >
          {t.budgets} <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    </motion.div>
  );
};
