import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/i18n/LanguageContext';
import { dashT } from '@/i18n/dashTranslations';
import { supabase } from '@/integrations/supabase/client';
import { getBudgetPeriodBounds, shouldAlertForExpectedDay } from '@/lib/budgetProjection';
import { AlertTriangle, CheckCircle2, Bell, PiggyBank, X, TrendingDown, ChevronDown, ChevronUp, Calendar, Search, Trophy, Clock, ExternalLink } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { motion, AnimatePresence } from 'framer-motion';

interface Notification {
  id: string;
  type: 'budget_exceeded' | 'budget_warning' | 'savings_reached' | 'savings_behind' | 'budget_savings' | 'budget_upcoming' | 'savings_upcoming' | 'balance_discrepancy' | 'recurring_upcoming' | 'week_summary';
  title: string;
  message: string;
  severity: 'critical' | 'warning' | 'success' | 'info';
  action?: { label: string; path: string };
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
    const todayStr = now.toISOString().split('T')[0];
    const sevenDaysAgo = new Date(now); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];
    const sevenDaysLater = new Date(now); sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
    const sevenDaysLaterStr = sevenDaysLater.toISOString().split('T')[0];
    const yearStart = `${now.getFullYear()}-01-01`;

    const [budgetsRes, allTxRes, savingsRes, savingsTxRes, importedSavingsTxRes, accountsRes, recurringRes, accountTxRes] = await Promise.all([
      supabase.from('budgets').select('*, categories(name, icon)').eq('user_id', user.id),
      supabase.from('transactions').select('category_id, amount, type, date').eq('user_id', user.id)
        .gte('date', yearStart).lte('date', todayStr),
      supabase.from('savings_goals').select('*').eq('user_id', user.id),
      supabase.from('transactions').select('amount, date, notes')
        .eq('user_id', user.id).eq('type', 'expense')
        .like('notes', '🎯 %')
        .gte('date', new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0])
        .lte('date', todayStr),
      supabase.from('transactions').select('amount, description, account_id')
        .eq('user_id', user.id).eq('type', 'income')
        .ilike('description', '%cotisation epargne%')
        .gte('date', new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0])
        .lte('date', todayStr),
      supabase.from('payment_accounts').select('id, name, icon, real_balance, opening_balance').eq('user_id', user.id),
      supabase.from('recurring_transactions').select('*').eq('user_id', user.id).eq('active', true)
        .lte('next_date', sevenDaysLaterStr),
      // Fetch ALL transactions with account_id for balance discrepancy calculation
      supabase.from('transactions').select('account_id, amount, type').eq('user_id', user.id)
        .not('account_id', 'is', null).limit(100000),
    ]);

    const budgets = budgetsRes.data || [];
    const allTxs = allTxRes.data || [];
    const savings = savingsRes.data || [];
    const savingsTxs = savingsTxRes.data || [];
    const importedSavingsTxs = importedSavingsTxRes.data || [];
    const accounts = accountsRes.data || [];
    const recurringTxs = recurringRes.data || [];
    const accountTxs = accountTxRes.data || [];
    const notifs: Notification[] = [];

    // ────── Budget alerts (simplified — no projections) ──────
    for (const budget of budgets) {
      const { periodStart, periodEnd } = getBudgetPeriodBounds(budget.period || 'monthly', now, budget.reference_date);
      const periodStartStr = periodStart.toISOString().split('T')[0];
      const periodEndStr = periodEnd.toISOString().split('T')[0];

      const budgetType = budget.budget_type || 'expense';
      const periodTxs = allTxs.filter(tx =>
        tx.category_id === budget.category_id &&
        tx.type === budgetType &&
        tx.date >= periodStartStr && tx.date <= periodEndStr
      );
      const spent = periodTxs.reduce((sum, tx) => sum + Number(tx.amount), 0);
      const amount = Number(budget.amount);
      const pct = amount > 0 ? (spent / amount) * 100 : 0;
      const threshold = budget.alert_threshold ?? 80;
      const controlType = budget.control_type || 'max';
      const isMax = controlType === 'max';

      const daysElapsed = Math.max(1, Math.floor((now.getTime() - periodStart.getTime()) / 86400000) + 1);
      const daysTotal = Math.max(1, Math.floor((periodEnd.getTime() - periodStart.getTime()) / 86400000) + 1);

      if (isMax) {
        if (spent > amount) {
          notifs.push({
            id: `budget-exceeded-${budget.id}`,
            type: 'budget_exceeded',
            severity: 'critical',
            title: isFr ? 'Budget dépassé' : 'Budget exceeded',
            message: `${(budget.categories as any)?.icon || '📁'} ${budget.name}: ${Math.round(pct)}% — +${Math.round(spent - amount).toLocaleString()}`,
            action: { label: isFr ? 'Voir transactions' : 'View transactions', path: `/dashboard/transactions?category=${budget.category_id}` },
          });
        } else if (pct >= threshold) {
          notifs.push({
            id: `budget-warning-${budget.id}`,
            type: 'budget_warning',
            severity: 'warning',
            title: isFr ? `Budget à ${Math.round(pct)}%` : `Budget at ${Math.round(pct)}%`,
            message: `${(budget.categories as any)?.icon || '📁'} ${budget.name}: ${isFr ? 'seuil atteint' : 'threshold reached'} (${threshold}%)`,
            action: { label: isFr ? 'Voir budget' : 'View budget', path: '/dashboard/budgets' },
          });
        } else if (pct < 50 && daysElapsed > daysTotal * 0.7) {
          notifs.push({
            id: `budget-savings-${budget.id}`,
            type: 'budget_savings',
            severity: 'success',
            title: isFr ? '🎉 Budget maîtrisé' : '🎉 Budget under control',
            message: `${(budget.categories as any)?.icon || '📁'} ${budget.name}: ${Math.round(amount - spent).toLocaleString()} ${isFr ? 'économisés' : 'saved'}`,
            action: { label: isFr ? 'Voir budget' : 'View budget', path: '/dashboard/budgets' },
          });
        }
      } else {
        // Min budget (income target)
        if (spent >= amount) {
          notifs.push({
            id: `budget-target-reached-${budget.id}`,
            type: 'budget_savings',
            severity: 'success',
            title: isFr ? '🎉 Objectif atteint' : '🎉 Target reached',
            message: `${(budget.categories as any)?.icon || '📁'} ${budget.name}: +${Math.round(spent - amount).toLocaleString()} ${isFr ? 'au-dessus' : 'above'}`,
            action: { label: isFr ? 'Voir budget' : 'View budget', path: '/dashboard/budgets' },
          });
        } else if (shouldAlertForExpectedDay(budget.expected_day, now, daysElapsed, daysTotal)) {
          notifs.push({
            id: `budget-below-${budget.id}`,
            type: 'budget_warning',
            severity: 'info',
            title: isFr ? 'Objectif non atteint' : 'Target not reached',
            message: `${(budget.categories as any)?.icon || '📁'} ${budget.name}: ${Math.round(pct)}% — ${isFr ? 'manque' : 'missing'} ${Math.round(amount - spent).toLocaleString()}`,
            action: { label: isFr ? 'Voir budget' : 'View budget', path: '/dashboard/budgets' },
          });
        }
      }
    }

    // ────── Recurring transaction reminders ──────
    for (const rec of recurringTxs) {
      const nextDate = new Date(rec.next_date);
      const daysUntil = Math.max(0, Math.floor((nextDate.getTime() - now.getTime()) / 86400000));
      if (daysUntil <= 7) {
        notifs.push({
          id: `recurring-upcoming-${rec.id}`,
          type: 'recurring_upcoming',
          severity: 'info',
          title: daysUntil === 0
            ? (isFr ? "📋 Échéance aujourd'hui" : '📋 Due today')
            : (isFr ? `📋 Échéance dans ${daysUntil}j` : `📋 Due in ${daysUntil}d`),
          message: `${rec.description}: ${Math.round(Number(rec.amount)).toLocaleString()} (${rec.type === 'income' ? (isFr ? 'revenu' : 'income') : (isFr ? 'dépense' : 'expense')})`,
          action: { label: isFr ? 'Voir récurrences' : 'View recurring', path: '/dashboard/recurring' },
        });
      }
    }

    // ────── Savings alerts ──────
    for (const goal of savings) {
      if (Number(goal.current_amount) >= Number(goal.target_amount)) {
        notifs.push({
          id: `savings-reached-${goal.id}`,
          type: 'savings_reached',
          severity: 'success',
          title: isFr ? 'Objectif atteint !' : 'Goal reached!',
          message: `${goal.icon} ${goal.name}`,
          action: { label: isFr ? 'Voir épargne' : 'View savings', path: '/dashboard/savings' },
        });
        continue;
      }

      const contribDay = (goal as any).contribution_day;
      if (contribDay) {
        const todayDay = now.getDate();
        const daysUntil = contribDay >= todayDay ? contribDay - todayDay : 0;
        if (daysUntil > 0 && daysUntil <= 5) {
          notifs.push({
            id: `savings-upcoming-${goal.id}`,
            type: 'savings_upcoming',
            severity: 'info',
            title: isFr ? `🐷 Cotisation dans ${daysUntil}j` : `🐷 Contribution in ${daysUntil}d`,
            message: `${goal.icon} ${goal.name}: ${Math.round(Number(goal.monthly_contribution || 0)).toLocaleString()}`,
            action: { label: isFr ? 'Voir épargne' : 'View savings', path: '/dashboard/savings' },
          });
        }
      }

      let monthlyNeeded = Number(goal.monthly_contribution) || 0;
      if (monthlyNeeded <= 0 && goal.deadline) {
        const dl = new Date(goal.deadline);
        if (dl <= now) continue;
        const remaining = Number(goal.target_amount) - Number(goal.current_amount);
        const monthsLeft = Math.max(1, (dl.getFullYear() - now.getFullYear()) * 12 + dl.getMonth() - now.getMonth());
        monthlyNeeded = remaining / monthsLeft;
      }
      if (monthlyNeeded <= 0) continue;

      const goalContribs = savingsTxs.filter(tx => tx.notes === `🎯 ${goal.name}`);
      const importedContribs = importedSavingsTxs.filter(tx =>
        (goal.account_id && tx.account_id === goal.account_id) ||
        tx.description?.toLowerCase().includes(goal.name.toLowerCase().split(' ').slice(0, 2).join(' '))
      );
      const monthlyActual = [
        ...goalContribs.map(tx => Number(tx.amount)),
        ...importedContribs.map(tx => Number(tx.amount)),
      ].reduce((s, a) => s + a, 0);

      if (monthlyActual === 0) {
        notifs.push({
          id: `savings-nocontrib-${goal.id}`,
          type: 'savings_behind',
          severity: 'warning',
          title: isFr ? 'Rappel épargne' : 'Savings reminder',
          message: `${goal.icon} ${isFr ? 'Aucun versement ce mois pour' : 'No contribution this month for'} ${goal.name}`,
          action: { label: isFr ? 'Voir épargne' : 'View savings', path: '/dashboard/savings' },
        });
      } else if (monthlyActual < monthlyNeeded * 0.9) {
        notifs.push({
          id: `savings-behind-${goal.id}`,
          type: 'savings_behind',
          severity: 'info',
          title: isFr ? 'Versement insuffisant' : 'Insufficient contribution',
          message: `${goal.icon} ${goal.name}: ${Math.round(monthlyActual).toLocaleString()} / ${Math.round(monthlyNeeded).toLocaleString()}`,
          action: { label: isFr ? 'Voir épargne' : 'View savings', path: '/dashboard/savings' },
        });
      }
    }

    // ────── Balance discrepancy alerts ──────
    for (const account of accounts) {
      // Compute theoretical balance: opening_balance + income - expenses for this account
      const acctTxs = accountTxs.filter((tx: any) => tx.account_id === account.id);
      const txSum = acctTxs.reduce((sum: number, tx: any) => {
        return sum + (tx.type === 'income' ? Number(tx.amount) : -Number(tx.amount));
      }, 0);
      const theoreticalBalance = Number(account.opening_balance) + txSum;
      const realBalance = Number(account.real_balance);
      const diff = Math.abs(realBalance - theoreticalBalance);
      // Alert if discrepancy > 500 or > 1% of real balance (whichever is smaller)
      const threshold = Math.min(500, Math.abs(realBalance) * 0.01 || 500);

      if (diff > threshold && diff > 0) {
        const sign = realBalance > theoreticalBalance ? '+' : '-';
        notifs.push({
          id: `balance-discrepancy-${account.id}`,
          type: 'balance_discrepancy',
          severity: 'warning',
          title: isFr ? `🔍 Écart de solde détecté` : `🔍 Balance discrepancy`,
          message: `${account.icon} ${account.name}: ${isFr ? 'écart de' : 'difference of'} ${sign}${Math.round(diff).toLocaleString()} (${isFr ? 'réel' : 'actual'}: ${Math.round(realBalance).toLocaleString()} vs ${isFr ? 'théorique' : 'calculated'}: ${Math.round(theoreticalBalance).toLocaleString()})`,
          action: { label: isFr ? 'Corriger le compte' : 'Fix account', path: `/dashboard/accounts` },
        });
      }
    }

    // ────── Sort by severity ──────
    const order = { critical: 0, warning: 1, info: 2, success: 3 };
    notifs.sort((a, b) => order[a.severity] - order[b.severity]);

    setNotifications(notifs);
    setLoading(false);
  }, [user, locale]);

  useEffect(() => { checkNotifications(); }, [checkNotifications]);

  useEffect(() => {
    const interval = setInterval(checkNotifications, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [checkNotifications]);

  return { notifications, loading, refresh: checkNotifications };
};

const iconMap: Record<Notification['type'], React.ReactNode> = {
  budget_exceeded: <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" />,
  budget_warning: <TrendingDown className="w-4 h-4 text-amber-500 flex-shrink-0" />,
  savings_behind: <PiggyBank className="w-4 h-4 text-amber-500 flex-shrink-0" />,
  savings_reached: <CheckCircle2 className="w-4 h-4 text-secondary flex-shrink-0" />,
  budget_savings: <Trophy className="w-4 h-4 text-secondary flex-shrink-0" />,
  budget_upcoming: <Calendar className="w-4 h-4 text-primary flex-shrink-0" />,
  savings_upcoming: <Clock className="w-4 h-4 text-primary flex-shrink-0" />,
  balance_discrepancy: <Search className="w-4 h-4 text-amber-500 flex-shrink-0" />,
  recurring_upcoming: <Calendar className="w-4 h-4 text-primary flex-shrink-0" />,
  week_summary: <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />,
};

const severityStyles: Record<Notification['severity'], string> = {
  critical: 'border-l-destructive bg-destructive/5',
  warning: 'border-l-amber-500 bg-amber-500/5',
  success: 'border-l-secondary bg-secondary/5',
  info: 'border-l-primary bg-primary/5',
};

const GROUP_THRESHOLD = 3;

const groupLabels: Record<string, Record<Notification['type'], string>> = {
  fr: {
    budget_exceeded: 'budgets dépassés',
    budget_warning: 'budgets en alerte',
    savings_reached: 'objectifs atteints',
    savings_behind: 'rappels épargne',
    budget_savings: 'budgets maîtrisés',
    budget_upcoming: 'dépenses à venir',
    savings_upcoming: 'cotisations à venir',
    balance_discrepancy: 'écarts de solde',
    recurring_upcoming: 'échéances à venir',
    week_summary: 'bilans',
  },
  en: {
    budget_exceeded: 'budgets exceeded',
    budget_warning: 'budget warnings',
    savings_reached: 'goals reached',
    savings_behind: 'savings reminders',
    budget_savings: 'budgets on track',
    budget_upcoming: 'upcoming expenses',
    savings_upcoming: 'upcoming contributions',
    balance_discrepancy: 'balance discrepancies',
    recurring_upcoming: 'upcoming due dates',
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
      className={`rounded-xl border-l-[3px] overflow-hidden backdrop-blur-sm ${severityStyles[worstSeverity]} shadow-sm`}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-3 py-2.5 flex items-center gap-2.5 hover:bg-muted/40 transition-all duration-200"
      >
        <motion.div
          className="flex-shrink-0"
          animate={{ rotate: expanded ? 10 : 0 }}
          transition={{ duration: 0.2 }}
        >
          {iconMap[group.type]}
        </motion.div>
        <div className="min-w-0 flex-1 text-left">
          <p className="text-xs font-semibold leading-tight">
            {group.items.length} {labels[group.type] || group.type}
          </p>
        </div>
        <Badge variant="outline" className="text-[10px] h-5 px-1.5 flex-shrink-0 rounded-full">
          {group.items.length}
        </Badge>
        <motion.div
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.25, ease: 'easeInOut' }}
          className="flex-shrink-0"
        >
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
        </motion.div>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="overflow-hidden border-t border-border/50"
          >
            {group.items.map((n, i) => (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.2 }}
                className="px-3 py-2.5 flex items-start gap-2.5 border-b border-border/20 last:border-b-0 hover:bg-muted/20 transition-colors"
              >
                <div className="min-w-0 flex-1 pl-6">
                  <p className="text-xs font-medium leading-tight">{n.title}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug break-words">{n.message}</p>
                  <ActionLink action={n.action} onNavigate={onNavigate} />
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); onDismiss(n.id); }}
                  className="flex-shrink-0 p-1 rounded-lg hover:bg-muted transition-colors"
                  aria-label="Dismiss"
                >
                  <X className="w-3 h-3 text-muted-foreground" />
                </button>
              </motion.div>
            ))}
            <button
              onClick={(e) => { e.stopPropagation(); onDismissGroup(group.items.map(n => n.id)); }}
              className="w-full px-3 py-2 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors text-center"
            >
              {locale === 'fr' ? 'Tout effacer ce groupe' : 'Clear this group'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export const NotificationBell = () => {
  const { notifications, refresh } = useBudgetNotifications();
  const { locale } = useLanguage();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState<Set<string>>(() => getDismissedIds());
  const [isOpen, setIsOpen] = useState(false);

  const visible = notifications.filter(n => !dismissed.has(n.id));
  const criticalCount = visible.filter(n => n.severity === 'critical' || n.severity === 'warning').length;

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

  // Group notifications by type
  const typeGroups = new Map<Notification['type'], Notification[]>();
  for (const n of visible) {
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

  for (const n of visible) {
    if (!rendered.has(n.id)) {
      renderItems.push({ kind: 'single', notif: n });
    }
  }

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
                className={`absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 ${criticalCount > 0 ? 'bg-destructive' : 'bg-primary'} text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center`}
              >
                {visible.length}
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[calc(100vw-2rem)] max-w-sm p-0 rounded-2xl border border-border/60 shadow-[var(--shadow-soft)] overflow-hidden"
        align="end"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-muted/30">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold">Notifications</p>
            <AnimatePresence>
              {visible.length > 0 && (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                  <Badge variant="secondary" className="text-[10px] h-5 px-1.5 rounded-full">{visible.length}</Badge>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          {visible.length > 0 && (
            <Button variant="ghost" size="sm" className="text-xs h-7 text-muted-foreground hover:text-destructive" onClick={handleDismissAll}>
              {locale === 'fr' ? 'Tout effacer' : 'Clear all'}
            </Button>
          )}
        </div>

        {/* Body */}
        {visible.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="px-4 py-10 text-center"
          >
            <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
              <Bell className="w-6 h-6 text-muted-foreground/30" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              {locale === 'fr' ? 'Aucune notification' : 'No notifications'}
            </p>
            <p className="text-[11px] text-muted-foreground/60 mt-1">
              {locale === 'fr' ? 'Tout est en ordre 👍' : 'Everything looks good 👍'}
            </p>
          </motion.div>
        ) : (
          <ScrollArea className="max-h-[65vh] overflow-y-auto">
            <div className="p-2 space-y-1.5">
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
                      className={`relative px-3 py-2.5 rounded-xl border-l-[3px] flex items-start gap-2.5 backdrop-blur-sm shadow-sm hover:shadow-md transition-shadow duration-200 ${severityStyles[item.notif.severity]}`}
                    >
                      <motion.div
                        className="mt-0.5 flex-shrink-0"
                        whileHover={{ scale: 1.15, rotate: 5 }}
                        transition={{ type: 'spring', stiffness: 400 }}
                      >
                        {iconMap[item.notif.type]}
                      </motion.div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold leading-tight">{item.notif.title}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug break-words">{item.notif.message}</p>
                        <ActionLink action={item.notif.action} onNavigate={handleNavigate} />
                      </div>
                      <motion.button
                        whileHover={{ scale: 1.15 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleDismiss(item.notif.id)}
                        className="flex-shrink-0 p-1 rounded-lg hover:bg-muted transition-colors"
                        aria-label="Dismiss"
                      >
                        <X className="w-3 h-3 text-muted-foreground" />
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
