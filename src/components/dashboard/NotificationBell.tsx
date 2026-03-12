import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/i18n/LanguageContext';
import { dashT } from '@/i18n/dashTranslations';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, CheckCircle2, Bell, PiggyBank } from 'lucide-react';
import { toast } from 'sonner';

interface Notification {
  id: string;
  type: 'budget_exceeded' | 'savings_reached' | 'savings_behind';
  title: string;
  message: string;
}

export const useBudgetNotifications = () => {
  const { user } = useAuth();
  const { locale } = useLanguage();
  const t = dashT[locale];
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (!user) return;

    const checkNotifications = async () => {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

      const [budgetsRes, txRes, savingsRes] = await Promise.all([
        supabase.from('budgets').select('*, categories(name, icon)').eq('user_id', user.id),
        supabase.from('transactions').select('category_id, amount').eq('user_id', user.id).eq('type', 'expense')
          .gte('date', monthStart).lte('date', monthEnd),
        supabase.from('savings_goals').select('*').eq('user_id', user.id),
      ]);

      const budgets = budgetsRes.data || [];
      const txs = txRes.data || [];
      const savings = savingsRes.data || [];
      const notifs: Notification[] = [];

      // Check budgets
      for (const budget of budgets) {
        const spent = txs
          .filter(tx => tx.category_id === budget.category_id)
          .reduce((sum, tx) => sum + Number(tx.amount), 0);
        
        if (spent > budget.amount) {
          notifs.push({
            id: `budget-${budget.id}`,
            type: 'budget_exceeded',
            title: t.budgetExceeded || 'Budget dépassé',
            message: `${(budget.categories as any)?.icon || '📁'} ${budget.name}: ${t.exceeded} ${Math.round(spent - budget.amount).toLocaleString()}`,
          });
        }
      }

      // Check savings goals
      for (const goal of savings) {
        if (Number(goal.current_amount) >= Number(goal.target_amount)) {
          notifs.push({
            id: `savings-${goal.id}`,
            type: 'savings_reached',
            title: t.goalReached || 'Objectif atteint !',
            message: `${goal.icon} ${goal.name}: ${t.goalReachedDesc || 'Félicitations, vous avez atteint votre objectif !'}`,
          });
        }
      }

      // Check savings behind schedule
      const { data: savingsTxs } = await supabase.from('transactions')
        .select('amount, date, notes')
        .eq('user_id', user.id).eq('type', 'expense')
        .like('notes', '🎯 %')
        .gte('date', monthStart).lte('date', monthEnd);

      for (const goal of savings) {
        if (Number(goal.current_amount) >= Number(goal.target_amount)) continue;
        if (!goal.deadline) continue;
        const dl = new Date(goal.deadline);
        const nowDate = new Date();
        if (dl <= nowDate) continue; // already late, handled by status
        const remaining = Number(goal.target_amount) - Number(goal.current_amount);
        const monthsLeft = Math.max(1, (dl.getFullYear() - nowDate.getFullYear()) * 12 + dl.getMonth() - nowDate.getMonth());
        const monthlyNeeded = remaining / monthsLeft;

        const goalContribs = (savingsTxs || []).filter(tx => tx.notes === `🎯 ${goal.name}`);
        const monthlyActual = goalContribs.reduce((s, tx) => s + Number(tx.amount), 0);

        if (goalContribs.length === 0) {
          notifs.push({
            id: `savings-behind-nocontrib-${goal.id}`,
            type: 'savings_behind',
            title: (t as any).savingsReminder || 'Rappel épargne',
            message: `${goal.icon} ${(t as any).savingsNoContribThisMonth || 'Aucun versement ce mois pour'} ${goal.name}`,
          });
        } else if (monthlyActual < monthlyNeeded * 0.9) {
          notifs.push({
            id: `savings-behind-${goal.id}`,
            type: 'savings_behind',
            title: (t as any).savingsReminder || 'Rappel épargne',
            message: `${goal.icon} ${(t as any).savingsReminderBehind || 'Versement insuffisant pour'} ${goal.name}`,
          });
        }
      }

      setNotifications(notifs);
    };

    checkNotifications();
  }, [user, locale]);

  return { notifications };
};

export const NotificationBell = () => {
  const { notifications } = useBudgetNotifications();
  const [open, setOpen] = useState(false);

  if (notifications.length === 0) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg hover:bg-muted transition-colors"
      >
        <Bell className="w-5 h-5 text-muted-foreground" />
        <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
          {notifications.length}
        </span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-80 bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <p className="text-sm font-semibold">Notifications ({notifications.length})</p>
            </div>
            <div className="max-h-64 overflow-y-auto divide-y divide-border">
              {notifications.map(n => (
                <div key={n.id} className="px-4 py-3 flex items-start gap-3">
                  {n.type === 'budget_exceeded' ? (
                    <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-secondary flex-shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{n.title}</p>
                    <p className="text-xs text-muted-foreground">{n.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
