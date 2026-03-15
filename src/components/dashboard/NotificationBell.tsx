import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/i18n/LanguageContext';
import { dashT } from '@/i18n/dashTranslations';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, CheckCircle2, Bell, PiggyBank, X, TrendingDown, Info } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

interface Notification {
  id: string;
  type: 'budget_exceeded' | 'budget_warning' | 'savings_reached' | 'savings_behind';
  title: string;
  message: string;
  severity: 'critical' | 'warning' | 'success' | 'info';
}

export const useBudgetNotifications = () => {
  const { user } = useAuth();
  const { locale } = useLanguage();
  const t = dashT[locale];
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const checkNotifications = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

    const [budgetsRes, txRes, savingsRes, savingsTxRes, importedSavingsTxRes] = await Promise.all([
      supabase.from('budgets').select('*, categories(name, icon)').eq('user_id', user.id),
      supabase.from('transactions').select('category_id, amount').eq('user_id', user.id).eq('type', 'expense')
        .gte('date', monthStart).lte('date', monthEnd),
      supabase.from('savings_goals').select('*').eq('user_id', user.id),
      supabase.from('transactions').select('amount, date, notes')
        .eq('user_id', user.id).eq('type', 'expense')
        .like('notes', '🎯 %')
        .gte('date', monthStart).lte('date', monthEnd),
      supabase.from('transactions').select('amount, description, account_id')
        .eq('user_id', user.id).eq('type', 'income')
        .ilike('description', '%cotisation epargne%')
        .gte('date', monthStart).lte('date', monthEnd),
    ]);

    const budgets = budgetsRes.data || [];
    const txs = txRes.data || [];
    const savings = savingsRes.data || [];
    const savingsTxs = savingsTxRes.data || [];
    const importedSavingsTxs = importedSavingsTxRes.data || [];
    const notifs: Notification[] = [];

    // Check budgets — exceeded + threshold warning
    for (const budget of budgets) {
      const spent = txs
        .filter(tx => tx.category_id === budget.category_id)
        .reduce((sum, tx) => sum + Number(tx.amount), 0);
      const pct = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;
      const threshold = budget.alert_threshold ?? 80;

      if (spent > budget.amount) {
        notifs.push({
          id: `budget-exceeded-${budget.id}`,
          type: 'budget_exceeded',
          severity: 'critical',
          title: locale === 'fr' ? 'Budget dépassé' : 'Budget exceeded',
          message: `${(budget.categories as any)?.icon || '📁'} ${budget.name}: ${Math.round(pct)}% — +${Math.round(spent - budget.amount).toLocaleString()}`,
        });
      } else if (pct >= threshold) {
        notifs.push({
          id: `budget-warning-${budget.id}`,
          type: 'budget_warning',
          severity: 'warning',
          title: locale === 'fr' ? `Budget à ${Math.round(pct)}%` : `Budget at ${Math.round(pct)}%`,
          message: `${(budget.categories as any)?.icon || '📁'} ${budget.name}: ${locale === 'fr' ? 'seuil atteint' : 'threshold reached'} (${threshold}%)`,
        });
      }
    }

    // Check savings goals reached
    for (const goal of savings) {
      if (Number(goal.current_amount) >= Number(goal.target_amount)) {
        notifs.push({
          id: `savings-reached-${goal.id}`,
          type: 'savings_reached',
          severity: 'success',
          title: locale === 'fr' ? 'Objectif atteint !' : 'Goal reached!',
          message: `${goal.icon} ${goal.name}`,
        });
      }
    }

    // Check savings behind schedule
    for (const goal of savings) {
      if (Number(goal.current_amount) >= Number(goal.target_amount)) continue;

      // Determine monthly needed: explicit or calculated
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
          title: locale === 'fr' ? 'Rappel épargne' : 'Savings reminder',
          message: `${goal.icon} ${locale === 'fr' ? 'Aucun versement ce mois pour' : 'No contribution this month for'} ${goal.name}`,
        });
      } else if (monthlyActual < monthlyNeeded * 0.9) {
        notifs.push({
          id: `savings-behind-${goal.id}`,
          type: 'savings_behind',
          severity: 'info',
          title: locale === 'fr' ? 'Versement insuffisant' : 'Insufficient contribution',
          message: `${goal.icon} ${goal.name}: ${Math.round(monthlyActual).toLocaleString()} / ${Math.round(monthlyNeeded).toLocaleString()}`,
        });
      }
    }

    // Sort: critical first, then warning, then info, then success
    const order = { critical: 0, warning: 1, info: 2, success: 3 };
    notifs.sort((a, b) => order[a.severity] - order[b.severity]);

    setNotifications(notifs);
    setLoading(false);
  }, [user, locale]);

  useEffect(() => { checkNotifications(); }, [checkNotifications]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(checkNotifications, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [checkNotifications]);

  return { notifications, loading, refresh: checkNotifications };
};

const iconMap = {
  budget_exceeded: <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" />,
  budget_warning: <TrendingDown className="w-4 h-4 text-amber-500 flex-shrink-0" />,
  savings_behind: <PiggyBank className="w-4 h-4 text-amber-500 flex-shrink-0" />,
  savings_reached: <CheckCircle2 className="w-4 h-4 text-secondary flex-shrink-0" />,
};

const severityDot = {
  critical: 'bg-destructive',
  warning: 'bg-amber-500',
  info: 'bg-primary',
  success: 'bg-secondary',
};

export const NotificationBell = () => {
  const { notifications, refresh } = useBudgetNotifications();
  const { locale } = useLanguage();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const visible = notifications.filter(n => !dismissed.has(n.id));
  const criticalCount = visible.filter(n => n.severity === 'critical' || n.severity === 'warning').length;

  const handleDismiss = (id: string) => {
    setDismissed(prev => new Set([...prev, id]));
  };

  const handleDismissAll = () => {
    setDismissed(new Set(notifications.map(n => n.id)));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="relative p-2 rounded-xl hover:bg-muted transition-colors">
          <Bell className={`w-5 h-5 ${visible.length > 0 ? 'text-foreground' : 'text-muted-foreground'}`} />
          {visible.length > 0 && (
            <span className={`absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 ${criticalCount > 0 ? 'bg-destructive' : 'bg-primary'} text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center`}>
              {visible.length}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end" sideOffset={8}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold">Notifications</p>
            {visible.length > 0 && (
              <Badge variant="secondary" className="text-[10px] h-5 px-1.5">{visible.length}</Badge>
            )}
          </div>
          {visible.length > 0 && (
            <Button variant="ghost" size="sm" className="text-xs h-7 text-muted-foreground" onClick={handleDismissAll}>
              {locale === 'fr' ? 'Tout effacer' : 'Clear all'}
            </Button>
          )}
        </div>

        {/* Body */}
        {visible.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <Bell className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              {locale === 'fr' ? 'Aucune notification' : 'No notifications'}
            </p>
          </div>
        ) : (
          <ScrollArea className="max-h-80">
            <div className="divide-y divide-border">
              {visible.map(n => (
                <div key={n.id} className="px-4 py-3 flex items-start gap-3 hover:bg-muted/40 transition-colors group">
                  <div className="mt-0.5 relative">
                    {iconMap[n.type]}
                    <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ${severityDot[n.severity]}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-tight">{n.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{n.message}</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDismiss(n.id); }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted"
                  >
                    <X className="w-3 h-3 text-muted-foreground" />
                  </button>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
};
