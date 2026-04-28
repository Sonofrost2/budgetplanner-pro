import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/i18n/LanguageContext';
import { dashT } from '@/i18n/dashTranslations';
import { supabase } from '@/integrations/supabase/client';
import { getBudgetPeriodBounds, shouldAlertForExpectedDay, computeDaysRemaining } from '@/lib/budgetProjection';
import {
  shouldFireUpcoming,
  shouldFireUpcomingWide,
  shouldFireDeadline,
  shouldFireBilan,
  inQuietHours,
  getStepBucket,
  hasStepChanged,
  shouldEmitForSignature,
  daysBetween,
  daysUntilMonthDay,
  formatDaysLeftLabel,
  localDateStr,
  parseLocalDate,
  type CadencePrefs,
} from '@/lib/notificationCadence';
import { AlertTriangle, CheckCircle2, Bell, PiggyBank, X, TrendingDown, ChevronDown, ChevronUp, Calendar, Search, Trophy, Clock, ExternalLink } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { motion, AnimatePresence } from 'framer-motion';
import { formatNumber } from '@/lib/currency';

interface Notification {
  id: string;
  type: 'budget_exceeded' | 'budget_warning' | 'savings_reached' | 'savings_behind' | 'budget_savings' | 'budget_upcoming' | 'savings_upcoming' | 'balance_discrepancy' | 'recurring_upcoming' | 'week_summary' | 'link_mismatch';
  title: string;
  message: string;
  severity: 'critical' | 'warning' | 'success' | 'info';
  action?: { label: string; path: string };
  /** Days until the relevant event (0 = today). Used for sorting & "À venir" tab. */
  daysLeft?: number;
  /** True if the event is in the future (≥1 day) — drives the "À venir" tab. */
  upcoming?: boolean;
  /** Special tag for the date pill (overrides numeric label):
   *  - 'today' / 'thisWeek' / 'passed' come from `computeDaysRemaining`
   *  - 'closed' = period ended today (bilan)
   *  - 'now' = realised event (overshoot, discrepancy) */
  dueLabelKey?: 'today' | 'thisWeek' | 'passed' | 'closed' | 'now';
}

const DISMISSED_KEY = 'notif_dismissed';

const getDismissedIds = (): Set<string> => {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (parsed.exp && Date.now() > parsed.exp) {
      localStorage.removeItem(DISMISSED_KEY);
      return new Set();
    }
    return new Set(parsed.ids || []);
  } catch { return new Set(); }
};

const saveDismissedIds = (ids: Set<string>) => {
  localStorage.setItem(DISMISSED_KEY, JSON.stringify({
    ids: [...ids],
    exp: Date.now() + 24 * 60 * 60 * 1000,
  }));
};

// getBudgetPeriodBounds is now imported from @/lib/budgetProjection

export const useBudgetNotifications = () => {
  const { user } = useAuth();
  const { locale } = useLanguage();
  const t = dashT[locale];
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const isFr = locale === 'fr';

  const checkNotifications = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const now = new Date();
    // Use LOCAL date strings everywhere — `toISOString()` would drift by one
    // day around midnight for users in non-UTC timezones.
    const todayStr = localDateStr(now);
    const sevenDaysAgo = new Date(now); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = localDateStr(sevenDaysAgo);
    const sevenDaysLater = new Date(now); sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
    const sevenDaysLaterStr = localDateStr(sevenDaysLater);
    const yearStart = `${now.getFullYear()}-01-01`;
    const monthStart = localDateStr(new Date(now.getFullYear(), now.getMonth(), 1));

    const [budgetsRes, allTxRes, savingsRes, savingsMonthTxRes, accountsRes, recurringRes, accountTxRes, prefsRes] = await Promise.all([
      supabase.from('budgets').select('*, categories(name, icon)').eq('user_id', user.id)
        .is('deleted_at', null).is('paused_at', null),
      // Exclude internal transfers from budget spending sums
      supabase.from('transactions').select('category_id, amount, type, date, linked_transfer_id, notes').eq('user_id', user.id)
        .is('deleted_at', null).is('linked_transfer_id', null)
        .gte('date', yearStart).lte('date', todayStr),
      supabase.from('savings_goals').select('*').eq('user_id', user.id)
        .is('deleted_at', null).is('paused_at', null).eq('status', 'active'),
      supabase.from('transactions').select('amount, date, notes, type, account_id, description, linked_transfer_id')
        .eq('user_id', user.id)
        .is('deleted_at', null).is('linked_transfer_id', null)
        .gte('date', monthStart).lte('date', todayStr),
      supabase.from('payment_accounts').select('id, name, icon, real_balance, opening_balance, type').eq('user_id', user.id)
        .is('deleted_at', null).is('archived_at', null),
      supabase.from('recurring_transactions').select('*').eq('user_id', user.id).eq('active', true)
        .is('deleted_at', null)
        .or(`end_date.is.null,end_date.gte.${todayStr}`)
        .lte('next_date', sevenDaysLaterStr),
      // Include ALL transactions (including transfer legs) — both legs already
      // hit `account_id` with the right sign, so the theoretical balance must
      // count them. Excluding them was the source of the false discrepancies.
      supabase.from('transactions').select('account_id, amount, type').eq('user_id', user.id)
        .is('deleted_at', null)
        .not('account_id', 'is', null).limit(100000),
      supabase.from('notification_preferences').select('*').eq('user_id', user.id).maybeSingle(),
    ]);

    const budgets = budgetsRes.data || [];
    const allTxs = allTxRes.data || [];
    const savings = savingsRes.data || [];
    const savingsMonthTxs = savingsMonthTxRes.data || [];
    const accounts = accountsRes.data || [];
    const recurringTxs = recurringRes.data || [];
    const accountTxs = accountTxRes.data || [];
    const prefs: CadencePrefs | null = (prefsRes.data as CadencePrefs | null) ?? null;

    // Quiet hours → leave the bell empty until window closes
    if (inQuietHours(now, prefs)) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    const onChangeOnly = prefs?.status_reminder_frequency === 'on_change_only';

    const notifs: Notification[] = [];

    // ────── Budget alerts (simplified — no projections) ──────
    for (const budget of budgets) {
      const { periodStart, periodEnd } = getBudgetPeriodBounds(budget.period || 'monthly', now, budget.reference_date);
      const periodStartStr = localDateStr(periodStart);
      const periodEndStr = localDateStr(periodEnd);

      const budgetType = budget.budget_type || 'expense';
      const periodTxs = allTxs.filter(tx => {
        if (tx.category_id !== budget.category_id) return false;
        if (tx.type !== budgetType) return false;
        if (tx.date < periodStartStr || tx.date > periodEndStr) return false;
        // Avoid double-counting savings contributions on income budgets
        if (budgetType === 'income' && typeof tx.notes === 'string' && tx.notes.startsWith('🎯')) return false;
        return true;
      });
      const spent = periodTxs.reduce((sum, tx) => sum + Number(tx.amount), 0);
      const amount = Number(budget.amount);
      const pct = amount > 0 ? (spent / amount) * 100 : 0;
      const threshold = budget.alert_threshold ?? 80;
      const controlType = budget.control_type || 'max';
      const isMax = controlType === 'max';

      const daysElapsed = Math.max(1, Math.floor((now.getTime() - periodStart.getTime()) / 86400000) + 1);
      const daysTotal = Math.max(1, Math.floor((periodEnd.getTime() - periodStart.getTime()) / 86400000) + 1);

      // Compute days-until-next-occurrence using the smart helper
      const { daysLeft, label: dueLabel } = computeDaysRemaining(budget.period || 'monthly', now, {
        expectedDay: budget.expected_day,
        occurrenceFrequency: budget.occurrence_frequency,
        referenceDate: budget.reference_date,
        activeDays: budget.active_days,
        periodStart,
        periodEnd,
      });

      // Honor user preference toggles
      const allowAlerts = prefs?.budget_alerts !== false;
      const allowProjections = prefs?.budget_projections !== false;

      const isIncomeBudget = budgetType === 'income';
      // Activity signature: tx count + rounded total. While unchanged, we don't
      // re-emit any of the budget status notifs (warning / exceeded / target).
      const activitySig = `tx${periodTxs.length}_amt${Math.round(spent)}_pct${getStepBucket(pct)}`;
      const sigKeyBase = `budget-${budget.id}-${localDateStr(periodStart)}`;

      if (isMax) {
        // Edge case: an income budget configured as "max" — exceeding is good
        // news, not a critical alert. Surface it as a success instead.
        if (spent > amount && allowAlerts && isIncomeBudget && shouldEmitForSignature(`${sigKeyBase}-incover`, activitySig)) {
          notifs.push({
            id: `budget-income-over-${budget.id}`,
            type: 'budget_savings',
            severity: 'success',
            title: isFr ? '💰 Revenu au-dessus du plafond' : '💰 Income above ceiling',
            message: `${(budget.categories as any)?.icon || '📁'} ${budget.name}: +${Math.round(spent - amount).toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-US')}`,
            action: { label: isFr ? 'Voir budget' : 'View budget', path: `/dashboard/budgets?q=${encodeURIComponent(budget.name)}` },
            daysLeft: 0,
            dueLabelKey: 'now',
          });
        } else if (spent > amount && allowAlerts && shouldEmitForSignature(`${sigKeyBase}-exceeded`, activitySig)) {
          notifs.push({
            id: `budget-exceeded-${budget.id}`,
            type: 'budget_exceeded',
            severity: 'critical',
            title: isFr ? `Budget dépassé (${Math.round(pct)}%)` : `Budget exceeded (${Math.round(pct)}%)`,
            message: `${(budget.categories as any)?.icon || '📁'} ${budget.name}: ${Math.round(spent).toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-US')} / ${Math.round(amount).toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-US')} — +${Math.round(spent - amount).toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-US')}`,
            action: { label: isFr ? 'Voir transactions' : 'View transactions', path: `/dashboard/transactions?category=${budget.category_id}&type=${budgetType}&from=${periodStartStr}&to=${periodEndStr}` },
            daysLeft: 0,
            dueLabelKey: 'now',
          });
        } else if (pct >= threshold && allowAlerts) {
          // Always require activity-signature change to avoid daily spam.
          // Bucket shift is implicit in the signature.
          if (shouldEmitForSignature(`${sigKeyBase}-warning`, activitySig)) {
            notifs.push({
              id: `budget-warning-${budget.id}`,
              type: 'budget_warning',
              severity: isIncomeBudget ? 'info' : 'warning',
              title: isIncomeBudget
                ? (isFr ? `💰 Revenu à ${Math.round(pct)}%` : `💰 Income at ${Math.round(pct)}%`)
                : (isFr ? `Budget à ${Math.round(pct)}%` : `Budget at ${Math.round(pct)}%`),
              message: `${(budget.categories as any)?.icon || '📁'} ${budget.name}: ${Math.round(spent).toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-US')} / ${Math.round(amount).toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-US')} ${isFr ? `(seuil ${threshold}%)` : `(threshold ${threshold}%)`}`,
              action: { label: isFr ? 'Voir budget' : 'View budget', path: `/dashboard/budgets?q=${encodeURIComponent(budget.name)}` },
              daysLeft: 0,
              dueLabelKey: 'now',
            });
          }
        } else if (pct < 50 && !isIncomeBudget && shouldFireBilan(periodEnd, now)) {
          // Bilan only on the actual closing day, AND only once per period.
          if (shouldEmitForSignature(`${sigKeyBase}-bilan`, `closed_${Math.round(spent)}`)) {
            notifs.push({
            id: `budget-savings-${budget.id}`,
            type: 'budget_savings',
            severity: 'success',
            title: isFr ? '🏁 Bilan : budget maîtrisé' : '🏁 Bilan: budget under control',
            message: `${(budget.categories as any)?.icon || '📁'} ${budget.name}: ${Math.round(amount - spent).toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-US')} ${isFr ? 'économisés' : 'saved'}`,
            action: { label: isFr ? 'Voir budget' : 'View budget', path: `/dashboard/budgets?q=${encodeURIComponent(budget.name)}` },
            daysLeft: 0,
            dueLabelKey: 'closed',
            });
          }
        }
      } else {
        // Min budget (income target)
        if (spent >= amount && allowAlerts && shouldEmitForSignature(`${sigKeyBase}-target`, activitySig)) {
          notifs.push({
            id: `budget-target-reached-${budget.id}`,
            type: 'budget_savings',
            severity: 'success',
            title: isFr ? '🎉 Objectif atteint' : '🎉 Target reached',
            message: `${(budget.categories as any)?.icon || '📁'} ${budget.name}: +${Math.round(spent - amount).toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-US')} ${isFr ? 'au-dessus' : 'above'}`,
            action: { label: isFr ? 'Voir budget' : 'View budget', path: `/dashboard/budgets?q=${encodeURIComponent(budget.name)}` },
            daysLeft: 0,
            dueLabelKey: 'now',
          });
        } else if (allowAlerts && shouldAlertForExpectedDay(budget.expected_day, now, daysElapsed, daysTotal) && shouldEmitForSignature(`${sigKeyBase}-behind`, activitySig)) {
          notifs.push({
            id: `budget-below-${budget.id}`,
            type: 'budget_warning',
            severity: 'info',
            title: isFr ? 'Objectif non atteint' : 'Target not reached',
            message: `${(budget.categories as any)?.icon || '📁'} ${budget.name}: ${Math.round(pct)}% — ${isFr ? 'manque' : 'missing'} ${Math.round(amount - spent).toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-US')}`,
            action: { label: isFr ? 'Voir budget' : 'View budget', path: `/dashboard/budgets?q=${encodeURIComponent(budget.name)}` },
            daysLeft: 0,
            dueLabelKey: 'now',
          });
        }
      }

      // Upcoming budget deadline (continuous J-7..J-0) — dedup by daysLeft so
      // the user sees "in 4 days" without waiting for a fixed bucket day.
      if (allowProjections && shouldFireUpcomingWide(daysLeft) && daysLeft > 0) {
        const isIncomeBudgetUp = budgetType === 'income';
        const kindIcon = isIncomeBudgetUp ? '💰' : '📅';
        const kindLabel = isIncomeBudgetUp
          ? (isFr ? 'Revenu attendu' : 'Expected income')
          : (isFr ? 'Échéance prévue' : 'Upcoming deadline');
        notifs.push({
          id: `budget-upcoming-${budget.id}-d${daysLeft}`,
          type: 'budget_upcoming',
          severity: 'info',
          title: isFr
            ? `${kindIcon} ${budget.name} — ${formatDaysLeftLabel(daysLeft, locale, dueLabel)}`
            : `${kindIcon} ${budget.name} — ${formatDaysLeftLabel(daysLeft, locale, dueLabel)}`,
          message: `${(budget.categories as any)?.icon || '📁'} ${kindLabel}: ${Math.round(amount).toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-US')}`,
          action: { label: isFr ? 'Voir budget' : 'View budget', path: `/dashboard/budgets?q=${encodeURIComponent(budget.name)}` },
          daysLeft,
          upcoming: true,
          dueLabelKey: dueLabel as Notification['dueLabelKey'],
        });
      }
    }

    // ────── Recurring transaction reminders ──────
    for (const rec of recurringTxs) {
      if (prefs?.recurring_reminders === false) break;
      const nextDate = parseLocalDate(rec.next_date);
      const daysUntil = Math.max(0, daysBetween(now, nextDate));
      if (shouldFireUpcoming(daysUntil)) {
        notifs.push({
          id: `recurring-upcoming-${rec.id}-d${daysUntil}`,
          type: 'recurring_upcoming',
          severity: 'info',
          title: daysUntil === 0
            ? (isFr ? "📋 Échéance aujourd'hui" : '📋 Due today')
            : (isFr ? `📋 Échéance dans ${daysUntil}j` : `📋 Due in ${daysUntil}d`),
          message: `${rec.description}: ${Math.round(Number(rec.amount)).toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-US')} (${rec.type === 'income' ? (isFr ? 'revenu' : 'income') : (isFr ? 'dépense' : 'expense')})`,
          action: { label: isFr ? 'Voir récurrences' : 'View recurring', path: `/dashboard/recurring?q=${encodeURIComponent(rec.description)}` },
          daysLeft: daysUntil,
          upcoming: daysUntil > 0,
          dueLabelKey: daysUntil === 0 ? 'today' : undefined,
        });
      }
    }

    // ────── Savings alerts ──────
    for (const goal of savings) {
      const allowSavings = prefs?.savings_reminders !== false;
      const allowGoalReached = prefs?.goal_reached !== false;

      // Skip goals that haven't started yet (start_date in the future).
      // They are NOT late and shouldn't generate any reminder.
      const goalStart = (goal as any).start_date ? parseLocalDate((goal as any).start_date) : null;
      if (goalStart && goalStart > now) continue;

      if (Number(goal.current_amount) >= Number(goal.target_amount)) {
        if (allowGoalReached) {
          notifs.push({
            id: `savings-reached-${goal.id}`,
            type: 'savings_reached',
            severity: 'success',
            title: isFr ? 'Objectif atteint !' : 'Goal reached!',
            message: `${goal.icon} ${goal.name}`,
            action: { label: isFr ? 'Voir épargne' : 'View savings', path: `/dashboard/savings?q=${encodeURIComponent(goal.name)}` },
            daysLeft: 0,
            dueLabelKey: 'now',
          });
        }
        continue;
      }

      // Pré-calcul du total cotisé ce mois pour CE goal — source de vérité
      // pour décider d'afficher (ou de masquer) toutes les alertes ci-dessous.
      let monthlyActualForGoal = 0;
      for (const tx of savingsMonthTxs) {
        if (tx.type !== 'income') continue;
        const isReturn = typeof tx.description === 'string' && tx.description.includes('↩');
        if (isReturn) continue;
        if (goal.account_id) {
          if (tx.account_id === goal.account_id) monthlyActualForGoal += Number(tx.amount);
        } else if (tx.notes === `🎯 ${goal.name}`) {
          monthlyActualForGoal += Number(tx.amount);
        }
      }
      const monthlyNeededRaw = Number(goal.monthly_contribution) || 0;
      const alreadyFunded = monthlyNeededRaw > 0 && monthlyActualForGoal >= monthlyNeededRaw * 0.9;

      const contribDay = (goal as any).contribution_day;
      if (contribDay && allowSavings) {
        const daysUntil = daysUntilMonthDay(contribDay, now);
        // Ne pas rappeler la cotisation si elle est déjà faite (≥ 90% du besoin mensuel)
        if (shouldFireUpcoming(daysUntil) && !alreadyFunded) {
          notifs.push({
            id: `savings-upcoming-${goal.id}-d${daysUntil}`,
            type: 'savings_upcoming',
            severity: 'info',
            title: daysUntil === 0
              ? (isFr ? "🐷 Cotisation aujourd'hui" : '🐷 Contribution today')
              : (isFr ? `🐷 Cotisation dans ${daysUntil}j` : `🐷 Contribution in ${daysUntil}d`),
            message: `${goal.icon} ${goal.name}: ${Math.round(Number(goal.monthly_contribution || 0)).toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-US')}`,
            action: { label: isFr ? 'Voir épargne' : 'View savings', path: `/dashboard/savings?q=${encodeURIComponent(goal.name)}` },
            daysLeft: daysUntil,
            upcoming: daysUntil > 0,
            dueLabelKey: daysUntil === 0 ? 'today' : undefined,
          });
        }
      }

      // Deadline reminders (J-30 / J-7 / J-2 / J-0) — skip if locked & still future
      if (goal.deadline && allowSavings) {
        const dl = parseLocalDate(goal.deadline);
        const daysToDeadline = daysBetween(now, dl);
        if (daysToDeadline >= 0 && shouldFireDeadline(daysToDeadline) && !(goal.is_locked && daysToDeadline > 0)) {
          const remaining = Number(goal.target_amount) - Number(goal.current_amount);
          notifs.push({
            id: `savings-deadline-${goal.id}-d${daysToDeadline}`,
            type: 'savings_upcoming',
            severity: daysToDeadline <= 2 ? 'warning' : 'info',
            title: isFr
              ? `🎯 Échéance ${formatDaysLeftLabel(daysToDeadline, locale)}`
              : `🎯 Deadline ${formatDaysLeftLabel(daysToDeadline, locale)}`,
            message: `${goal.icon} ${goal.name}: ${isFr ? 'reste' : 'remaining'} ${Math.round(remaining).toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-US')}`,
            action: { label: isFr ? 'Voir épargne' : 'View savings', path: `/dashboard/savings?q=${encodeURIComponent(goal.name)}` },
            daysLeft: daysToDeadline,
            upcoming: daysToDeadline > 0,
            dueLabelKey: daysToDeadline === 0 ? 'today' : undefined,
          });
        }
      }

      if (!allowSavings) continue;

      let monthlyNeeded = Number(goal.monthly_contribution) || 0;
      if (monthlyNeeded <= 0 && goal.deadline) {
        const dl = parseLocalDate(goal.deadline);
        if (dl <= now) continue;
        const remaining = Number(goal.target_amount) - Number(goal.current_amount);
        const monthsLeft = Math.max(1, (dl.getFullYear() - now.getFullYear()) * 12 + dl.getMonth() - now.getMonth());
        monthlyNeeded = remaining / monthsLeft;
      }
      if (monthlyNeeded <= 0) continue;
      // Skip "insufficient" warnings on locked goals — withdrawals/contribs are constrained
      if (goal.is_locked) continue;

      // Réutilise le pré-calcul fait plus haut (évite double comptage)
      const monthlyActual = monthlyActualForGoal;

      // ⚠️ Garde-fou anti-faux-positif : si l'utilisateur a un contribution_day
      // futur (ex. cotise le 25, on est le 10), on n'est PAS en retard — on
      // attend le jour J + une grâce de 2 jours avant d'alerter "no contribution"
      // ou "insufficient". Idem pour deadline future sans contribution_day.
      if (contribDay) {
        const cd = Number(contribDay);
        const todayDay = now.getDate();
        // Pas encore arrivé ce mois-ci → pas d'alerte de retard
        if (todayDay < cd) continue;
        // Grâce de 2 jours après le contribution_day pour laisser le temps de saisir
        if (todayDay - cd < 2 && monthlyActual === 0) continue;
      }

      // "No contribution" → status reminder, gated by frequency
      const ratio = monthlyActual / monthlyNeeded;
      const bucket = getStepBucket(ratio * 100);
      const changed = onChangeOnly ? hasStepChanged(`savings-${goal.id}`, bucket) : true;

      if (monthlyActual === 0 && changed) {
        notifs.push({
          id: `savings-nocontrib-${goal.id}`,
          type: 'savings_behind',
          severity: 'warning',
          title: isFr ? 'Rappel épargne' : 'Savings reminder',
          message: `${goal.icon} ${isFr ? 'Aucun versement ce mois pour' : 'No contribution this month for'} ${goal.name}`,
          action: { label: isFr ? 'Voir épargne' : 'View savings', path: `/dashboard/savings?q=${encodeURIComponent(goal.name)}` },
          daysLeft: 0,
          dueLabelKey: 'now',
        });
      } else if (monthlyActual < monthlyNeeded * 0.9 && changed) {
        notifs.push({
          id: `savings-behind-${goal.id}`,
          type: 'savings_behind',
          severity: 'info',
          title: isFr ? 'Versement insuffisant' : 'Insufficient contribution',
          message: `${goal.icon} ${goal.name}: ${Math.round(monthlyActual).toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-US')} / ${Math.round(monthlyNeeded).toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-US')}`,
          action: { label: isFr ? 'Voir épargne' : 'View savings', path: `/dashboard/savings?q=${encodeURIComponent(goal.name)}` },
          daysLeft: 0,
          dueLabelKey: 'now',
        });
      }
    }

    // ────── Balance discrepancy alerts (corrected) ──────
    // Cash accounts are intentionally excluded: their `real_balance` is set
    // by manual cash counts (`cash_counts`) so a divergence vs the theoretical
    // ledger is expected and tracked elsewhere.
    if (prefs?.balance_discrepancy !== false) {
      type Discrep = { account: any; diff: number; realBalance: number; theoreticalBalance: number };
      const discrepancies: Discrep[] = [];
      for (const account of accounts) {
        if ((account as any).type === 'cash') continue;
        const acctTxs = accountTxs.filter((tx: any) => tx.account_id === account.id);
        const txSum = acctTxs.reduce((sum: number, tx: any) => {
          return sum + (tx.type === 'income' ? Number(tx.amount) : -Number(tx.amount));
        }, 0);
        const theoreticalBalance = Number(account.opening_balance) + txSum;
        const realBalance = Number(account.real_balance);
        const diff = Math.abs(realBalance - theoreticalBalance);
        // 1 000 XOF mini, 0,5% pour les gros soldes
        const threshold = Math.max(1000, Math.abs(realBalance) * 0.005);
        if (diff > threshold) {
          discrepancies.push({ account, diff, realBalance, theoreticalBalance });
        }
      }

      if (discrepancies.length === 1) {
        const { account, diff, realBalance, theoreticalBalance } = discrepancies[0];
        const sign = realBalance > theoreticalBalance ? '+' : '-';
        // Dedup by signed diff so we don't re-emit if nothing changed.
        if (shouldEmitForSignature(`bal-${account.id}`, `${sign}${Math.round(diff)}`)) {
          notifs.push({
            id: `balance-discrepancy-${account.id}`,
            type: 'balance_discrepancy',
            severity: 'warning',
            title: isFr ? `🔍 Écart de solde` : `🔍 Balance discrepancy`,
            message: `${account.icon} ${account.name}: ${sign}${Math.round(diff).toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-US')} (${isFr ? 'réel' : 'actual'}: ${Math.round(realBalance).toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-US')} / ${isFr ? 'calculé' : 'calculated'}: ${Math.round(theoreticalBalance).toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-US')})`,
            action: { label: isFr ? 'Corriger le compte' : 'Fix account', path: `/dashboard/accounts?q=${encodeURIComponent(account.name)}` },
            daysLeft: 0,
            dueLabelKey: 'now',
          });
        }
      } else if (discrepancies.length > 1) {
        const totalDiff = discrepancies.reduce((s, d) => s + d.diff, 0);
        const sig = `n${discrepancies.length}_t${Math.round(totalDiff)}`;
        if (shouldEmitForSignature('bal-aggregate', sig)) {
          notifs.push({
            id: 'balance-discrepancy-aggregate',
            type: 'balance_discrepancy',
            severity: 'warning',
            title: isFr ? `🔍 Écart sur ${discrepancies.length} comptes` : `🔍 Discrepancy on ${discrepancies.length} accounts`,
            message: `${isFr ? 'Total' : 'Total'}: ${Math.round(totalDiff).toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-US')}`,
            action: { label: isFr ? 'Voir les comptes' : 'View accounts', path: `/dashboard/accounts` },
            daysLeft: 0,
            dueLabelKey: 'now',
          });
        }
      }
    }

    // ────── Sort: critical > today > soon (<3d) > thresholds > bilans > success ──────
    const sevOrder = { critical: 0, warning: 1, info: 2, success: 3 } as const;
    notifs.sort((a, b) => {
      // Critical always first
      if (a.severity === 'critical' && b.severity !== 'critical') return -1;
      if (b.severity === 'critical' && a.severity !== 'critical') return 1;
      // Today (daysLeft=0 & not upcoming) before upcoming
      const aToday = (a.daysLeft ?? 0) === 0 && !a.upcoming ? 0 : 1;
      const bToday = (b.daysLeft ?? 0) === 0 && !b.upcoming ? 0 : 1;
      if (aToday !== bToday) return aToday - bToday;
      // Then by daysLeft ascending (sooner first)
      const aDays = a.daysLeft ?? 999;
      const bDays = b.daysLeft ?? 999;
      if (aDays !== bDays) return aDays - bDays;
      // Finally by severity
      return sevOrder[a.severity] - sevOrder[b.severity];
    });

    setNotifications(notifs);
    setLoading(false);
  }, [user, locale]);

  useEffect(() => { checkNotifications(); }, [checkNotifications]);

  useEffect(() => {
    const interval = setInterval(checkNotifications, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [checkNotifications]);

  // Realtime: refresh immediately when a transaction is inserted/updated/deleted
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('notif-bell-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions', filter: `user_id=eq.${user.id}` }, () => {
        // Debounce to avoid multiple rapid refreshes (e.g. bulk import)
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => checkNotifications(), 800);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'budgets', filter: `user_id=eq.${user.id}` }, () => {
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => checkNotifications(), 800);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'savings_goals', filter: `user_id=eq.${user.id}` }, () => {
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => checkNotifications(), 800);
      })
      .subscribe();
    return () => {
      clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [user, checkNotifications]);

  return { notifications, loading, refresh: checkNotifications };
};

// Premium icon bubbles — gradient surfaces with severity tint
const iconMap: Record<Notification['type'], React.ReactNode> = {
  budget_exceeded: <AlertTriangle className="w-4 h-4" />,
  budget_warning: <TrendingDown className="w-4 h-4" />,
  savings_behind: <PiggyBank className="w-4 h-4" />,
  savings_reached: <CheckCircle2 className="w-4 h-4" />,
  budget_savings: <Trophy className="w-4 h-4" />,
  budget_upcoming: <Calendar className="w-4 h-4" />,
  savings_upcoming: <Clock className="w-4 h-4" />,
  balance_discrepancy: <Search className="w-4 h-4" />,
  recurring_upcoming: <Calendar className="w-4 h-4" />,
  week_summary: <CheckCircle2 className="w-4 h-4" />,
};

// Glassmorphism severity styles — gradient bar + tinted surface
const severityStyles: Record<Notification['severity'], string> = {
  critical: 'border-l-[3px] border-l-destructive bg-gradient-to-r from-destructive/10 via-destructive/5 to-transparent',
  warning: 'border-l-[3px] border-l-amber-500 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent',
  success: 'border-l-[3px] border-l-secondary bg-gradient-to-r from-secondary/10 via-secondary/5 to-transparent',
  info: 'border-l-[3px] border-l-primary bg-gradient-to-r from-primary/10 via-primary/5 to-transparent',
};

// Icon-bubble color tint per severity (used inside the rounded pill)
const iconBubbleStyles: Record<Notification['severity'], string> = {
  critical: 'bg-destructive/15 text-destructive ring-1 ring-destructive/20',
  warning: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/20',
  success: 'bg-secondary/15 text-secondary ring-1 ring-secondary/20',
  info: 'bg-primary/15 text-primary ring-1 ring-primary/20',
};

const GROUP_THRESHOLD = 3;

const groupLabels: Record<string, Record<Notification['type'], string>> = {
  fr: {
    budget_exceeded: 'budgets dépassés',
    budget_warning: 'budgets en alerte',
    savings_reached: 'objectifs atteints',
    savings_behind: 'rappels épargne',
    budget_savings: 'budgets maîtrisés',
    budget_upcoming: 'budgets à échéance',
    savings_upcoming: 'épargne à échéance',
    balance_discrepancy: 'écarts de solde',
    recurring_upcoming: 'récurrences à venir',
    week_summary: 'bilans',
  },
  en: {
    budget_exceeded: 'budgets exceeded',
    budget_warning: 'budget warnings',
    savings_reached: 'goals reached',
    savings_behind: 'savings reminders',
    budget_savings: 'budgets on track',
    budget_upcoming: 'budget deadlines',
    savings_upcoming: 'savings deadlines',
    balance_discrepancy: 'balance discrepancies',
    recurring_upcoming: 'upcoming recurring',
    week_summary: 'summaries',
  },
};

interface NotifGroup {
  type: Notification['type'];
  items: Notification[];
  severity: Notification['severity'];
}

const ActionLink = ({ action, onNavigate }: { action: Notification['action']; onNavigate: (path: string) => void }) => {
  if (!action) return null;
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onNavigate(action.path); }}
      className="inline-flex items-center gap-1 mt-1.5 text-[11px] font-semibold text-primary hover:text-primary/80 transition-colors group"
    >
      {action.label}
      <ExternalLink className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
    </button>
  );
};

/** Compact pill showing the temporal context of a notification.
 *  Resolves `dueLabelKey` first, then falls back to a numeric "in N days". */
const DuePill = ({ notif, locale }: { notif: Notification; locale: string }) => {
  const isFr = locale === 'fr';
  const key = notif.dueLabelKey;
  let text: string | null = null;
  let tone: 'now' | 'today' | 'soon' | 'later' | 'closed' = 'later';

  if (key === 'closed') { text = isFr ? 'Période clôturée' : 'Period closed'; tone = 'closed'; }
  else if (key === 'now') { text = isFr ? 'En cours' : 'Live'; tone = 'now'; }
  else if (key === 'passed') { text = isFr ? 'Échéance passée' : 'Past due'; tone = 'now'; }
  else if (key === 'thisWeek') { text = isFr ? 'Cette semaine' : 'This week'; tone = 'soon'; }
  else if (key === 'today' || (notif.daysLeft === 0 && notif.upcoming === false)) {
    text = isFr ? "Aujourd'hui" : 'Today'; tone = 'today';
  }
  else if (typeof notif.daysLeft === 'number' && notif.daysLeft > 0) {
    text = formatDaysLeftLabel(notif.daysLeft, locale);
    tone = notif.daysLeft <= 2 ? 'soon' : 'later';
  }

  if (!text) return null;

  const toneClass = {
    now: 'bg-destructive/10 text-destructive ring-destructive/20',
    today: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-amber-500/25',
    soon: 'bg-primary/10 text-primary ring-primary/20',
    later: 'bg-foreground/5 text-muted-foreground ring-foreground/10',
    closed: 'bg-secondary/15 text-secondary ring-secondary/20',
  }[tone];

  return (
    <span className={`inline-flex items-center gap-1 mt-1.5 mr-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold ring-1 ${toneClass}`}>
      <Clock className="w-2.5 h-2.5" />
      {text}
    </span>
  );
};

const notifItemVariants = {
  hidden: { opacity: 0, x: -12, scale: 0.96 },
  visible: (i: number) => ({
    opacity: 1, x: 0, scale: 1,
    transition: { delay: i * 0.04, duration: 0.25, ease: 'easeOut' as const },
  }),
  exit: { opacity: 0, x: 12, scale: 0.96, transition: { duration: 0.2 } },
};

const GroupedNotifCard = ({ group, locale, onDismiss, onDismissGroup, onNavigate, index }: {
  group: NotifGroup;
  locale: string;
  onDismiss: (id: string) => void;
  onDismissGroup: (ids: string[]) => void;
  onNavigate: (path: string) => void;
  index: number;
}) => {
  const [expanded, setExpanded] = useState(false);
  const labels = groupLabels[locale] || groupLabels.en;
  const worstSeverity = group.items.reduce((worst, n) => {
    const order = { critical: 0, warning: 1, info: 2, success: 3 };
    return order[n.severity] < order[worst] ? n.severity : worst;
  }, 'success' as Notification['severity']);

  return (
    <motion.div
      custom={index}
      variants={notifItemVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      layout
      className={`rounded-2xl overflow-hidden backdrop-blur-md ${severityStyles[worstSeverity]} shadow-sm hover:shadow-md transition-shadow duration-300`}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-3.5 py-3 flex items-center gap-3 hover:bg-foreground/[0.03] transition-all duration-200"
      >
        <motion.div
          className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${iconBubbleStyles[worstSeverity]}`}
          animate={{ rotate: expanded ? 8 : 0, scale: expanded ? 1.05 : 1 }}
          transition={{ duration: 0.25 }}
        >
          {iconMap[group.type]}
        </motion.div>
        <div className="min-w-0 flex-1 text-left">
          <p className="text-[13px] font-semibold leading-tight tracking-tight">
            {group.items.length} {labels[group.type] || group.type}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {locale === 'fr' ? 'Cliquer pour déplier' : 'Click to expand'}
          </p>
        </div>
        <Badge variant="outline" className="text-[10px] h-5 px-2 flex-shrink-0 rounded-full font-bold border-foreground/15">
          {group.items.length}
        </Badge>
        <motion.div
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.25, ease: 'easeInOut' }}
          className="flex-shrink-0"
        >
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </motion.div>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="overflow-hidden border-t border-foreground/10"
          >
            {group.items.map((n, i) => (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.2 }}
                className="px-3.5 py-2.5 flex items-start gap-2.5 border-b border-foreground/5 last:border-b-0 hover:bg-foreground/[0.03] transition-colors"
              >
                <div className="min-w-0 flex-1 pl-11">
                  <p className="text-[12px] font-semibold leading-tight">{n.title}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug break-words">{n.message}</p>
                  <DuePill notif={n} locale={locale} />
                  <ActionLink action={n.action} onNavigate={onNavigate} />
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); onDismiss(n.id); }}
                  className="flex-shrink-0 p-1.5 rounded-lg hover:bg-foreground/10 transition-colors"
                  aria-label="Dismiss"
                >
                  <X className="w-3 h-3 text-muted-foreground" />
                </button>
              </motion.div>
            ))}
            <button
              onClick={(e) => { e.stopPropagation(); onDismissGroup(group.items.map(n => n.id)); }}
              className="w-full px-3 py-2.5 text-[11px] font-semibold text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors text-center border-t border-foreground/10"
            >
              {locale === 'fr' ? '✕ Tout effacer ce groupe' : '✕ Clear this group'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

type SeverityFilter = 'all' | 'upcoming' | 'critical' | 'warning' | 'success';

export const NotificationBell = () => {
  const { notifications, refresh } = useBudgetNotifications();
  const { locale } = useLanguage();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState<Set<string>>(() => getDismissedIds());
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<SeverityFilter>('all');
  const isFr = locale === 'fr';

  const visible = notifications.filter(n => !dismissed.has(n.id));
  const criticalCount = visible.filter(n => n.severity === 'critical' || n.severity === 'warning').length;
  const successCount = visible.filter(n => n.severity === 'success').length;

  const handleDismiss = (id: string) => {
    setDismissed(prev => {
      const next = new Set([...prev, id]);
      saveDismissedIds(next);
      return next;
    });
  };

  const handleDismissGroup = (ids: string[]) => {
    setDismissed(prev => {
      const next = new Set([...prev, ...ids]);
      saveDismissedIds(next);
      return next;
    });
  };

  const handleDismissAll = () => {
    const next = new Set(notifications.map(n => n.id));
    saveDismissedIds(next);
    setDismissed(next);
  };

  const handleNavigate = (path: string) => {
    setIsOpen(false);
    navigate(path);
  };

  // Apply severity filter
  let filtered = visible.filter(n => {
    if (filter === 'all') return true;
    if (filter === 'upcoming') return !!n.upcoming && (n.daysLeft ?? 0) > 0;
    if (filter === 'critical') return n.severity === 'critical';
    if (filter === 'warning') return n.severity === 'warning';
    if (filter === 'success') return n.severity === 'success';
    return true;
  });

  // In the "upcoming" tab, sort strictly by daysLeft ascending (sooner first)
  // — bypasses the default critical-first ordering which is irrelevant here.
  if (filter === 'upcoming') {
    filtered = [...filtered].sort((a, b) => (a.daysLeft ?? 999) - (b.daysLeft ?? 999));
  }

  // Group filtered notifications by type
  const typeGroups = new Map<Notification['type'], Notification[]>();
  for (const n of filtered) {
    const list = typeGroups.get(n.type) || [];
    list.push(n);
    typeGroups.set(n.type, list);
  }

  const renderItems: Array<{ kind: 'single'; notif: Notification } | { kind: 'group'; group: NotifGroup }> = [];
  const rendered = new Set<string>();

  for (const [type, items] of typeGroups) {
    if (items.length >= GROUP_THRESHOLD) {
      renderItems.push({
        kind: 'group',
        group: { type, items, severity: items[0].severity },
      });
      items.forEach(n => rendered.add(n.id));
    }
  }

  for (const n of filtered) {
    if (!rendered.has(n.id)) {
      renderItems.push({ kind: 'single', notif: n });
    }
  }

  const filterTabs: { key: SeverityFilter; label: string; count: number; color: string }[] = [
    { key: 'all', label: isFr ? 'Tout' : 'All', count: visible.length, color: 'text-foreground' },
    { key: 'upcoming', label: isFr ? 'À venir' : 'Upcoming', count: visible.filter(n => n.upcoming && (n.daysLeft ?? 0) > 0).length, color: 'text-primary' },
    { key: 'critical', label: isFr ? 'Critique' : 'Critical', count: visible.filter(n => n.severity === 'critical').length, color: 'text-destructive' },
    { key: 'warning', label: isFr ? 'Alertes' : 'Alerts', count: visible.filter(n => n.severity === 'warning').length, color: 'text-amber-600 dark:text-amber-400' },
    { key: 'success', label: isFr ? 'Succès' : 'Wins', count: successCount, color: 'text-secondary' },
  ];

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button className="relative p-2 rounded-xl hover:bg-muted transition-colors group">
          <Bell className={`w-5 h-5 transition-transform duration-300 group-hover:rotate-12 ${visible.length > 0 ? 'text-foreground' : 'text-muted-foreground'}`} />
          <AnimatePresence>
            {visible.length > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                className={`absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 ${criticalCount > 0 ? 'bg-destructive' : 'bg-primary'} text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center shadow-lg ${criticalCount > 0 ? 'shadow-destructive/30 animate-pulse' : 'shadow-primary/30'}`}
              >
                {visible.length}
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[calc(100vw-2rem)] max-w-md p-0 rounded-3xl border border-border/50 shadow-2xl shadow-primary/10 overflow-hidden bg-background/95 backdrop-blur-2xl"
        align="end"
        sideOffset={10}
      >
        {/* Premium gradient header */}
        <div className="relative px-5 pt-4 pb-3 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-b border-border/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-md shadow-primary/30">
                <Bell className="w-4 h-4 text-primary-foreground" />
              </div>
              <div>
                <p className="text-sm font-bold tracking-tight">Notifications</p>
                <p className="text-[10px] text-muted-foreground font-medium">
                  {isFr ? 'Coach Financier' : 'Financial Coach'}
                </p>
              </div>
            </div>
            {visible.length > 0 && (
              <Button variant="ghost" size="sm" className="text-[11px] h-7 px-2.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 font-semibold" onClick={handleDismissAll}>
                {isFr ? 'Tout effacer' : 'Clear all'}
              </Button>
            )}
          </div>

          {/* Severity filter tabs */}
          {visible.length > 0 && (
            <div className="flex items-center gap-1 mt-3 -mx-1 px-1 overflow-x-auto scrollbar-none">
              {filterTabs.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key)}
                  className={`relative flex-shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-200 whitespace-nowrap ${
                    filter === tab.key
                      ? 'bg-background shadow-sm ring-1 ring-border/60'
                      : 'text-muted-foreground hover:text-foreground hover:bg-foreground/5'
                  }`}
                >
                  <span className={filter === tab.key ? tab.color : ''}>{tab.label}</span>
                  {tab.count > 0 && (
                    <span className={`ml-1.5 inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 text-[9px] font-bold rounded-full ${
                      filter === tab.key ? 'bg-foreground/10' : 'bg-foreground/5'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Body */}
        {filtered.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="px-4 py-12 text-center"
          >
            <div className="relative w-16 h-16 mx-auto mb-4">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 blur-xl" />
              <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/15 to-secondary/15 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-secondary" />
              </div>
            </div>
            <p className="text-sm font-bold">
              {visible.length === 0
                ? (isFr ? 'Tout est sous contrôle' : 'All under control')
                : (isFr ? 'Aucune notification dans cette vue' : 'No notifications in this view')}
            </p>
            <p className="text-[12px] text-muted-foreground mt-1.5 max-w-[240px] mx-auto leading-relaxed">
              {visible.length === 0
                ? (isFr ? 'Votre coach veille — vous serez alerté en temps utile 🧭' : 'Your coach is watching — you\'ll be notified in time 🧭')
                : (isFr ? 'Essayez un autre filtre ci-dessus' : 'Try another filter above')}
            </p>
          </motion.div>
        ) : (
          <ScrollArea className="max-h-[60vh] overflow-y-auto">
            <div className="p-2.5 space-y-2">
              <AnimatePresence mode="popLayout">
                {renderItems.map((item, i) =>
                  item.kind === 'group' ? (
                    <GroupedNotifCard
                      key={`group-${item.group.type}`}
                      group={item.group}
                      locale={locale}
                      onDismiss={handleDismiss}
                      onDismissGroup={handleDismissGroup}
                      onNavigate={handleNavigate}
                      index={i}
                    />
                  ) : (
                    <motion.div
                      key={item.notif.id}
                      custom={i}
                      variants={notifItemVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      layout
                      className={`relative px-3.5 py-3 rounded-2xl flex items-start gap-3 backdrop-blur-md shadow-sm hover:shadow-md transition-all duration-200 ${severityStyles[item.notif.severity]}`}
                    >
                      <motion.div
                        className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${iconBubbleStyles[item.notif.severity]}`}
                        whileHover={{ scale: 1.1, rotate: 5 }}
                        transition={{ type: 'spring', stiffness: 400 }}
                      >
                        {iconMap[item.notif.type]}
                      </motion.div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold leading-tight tracking-tight">{item.notif.title}</p>
                        <p className="text-[11.5px] text-muted-foreground mt-1 leading-snug break-words">{item.notif.message}</p>
                        <DuePill notif={item.notif} locale={locale} />
                        <ActionLink action={item.notif.action} onNavigate={handleNavigate} />
                      </div>
                      <motion.button
                        whileHover={{ scale: 1.15 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleDismiss(item.notif.id)}
                        className="flex-shrink-0 p-1.5 rounded-lg hover:bg-foreground/10 transition-colors"
                        aria-label="Dismiss"
                      >
                        <X className="w-3.5 h-3.5 text-muted-foreground" />
                      </motion.button>
                    </motion.div>
                  ),
                )}
              </AnimatePresence>
            </div>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
};
