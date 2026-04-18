import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface DashboardInsight {
  key: string;
  icon: string;
  text: string;
  tone: 'streak' | 'warn' | 'good' | 'info' | 'primary';
}

/**
 * Computes contextual insights for the Coach bar on the dashboard home.
 * - streak: number of consecutive days with at least one transaction
 * - exceededBudgets: count of budgets over their limit this month
 * - savingsProgress: avg progress % across active goals
 * - cashFlowTrend: % evolution vs previous month
 */
export function useDashboardInsights(locale: 'fr' | 'en') {
  const { user } = useAuth();
  const isFr = locale === 'fr';

  return useQuery<DashboardInsight[]>({
    queryKey: ['dashboard-insights', user?.id, locale],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
      const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
      const streakWindow = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 60).toISOString().split('T')[0];

      const [{ data: streakRows }, { data: curMonthTx }, { data: prevMonthTx }, { data: budgets }, { data: goals }] = await Promise.all([
        supabase.from('transactions').select('date').eq('user_id', user!.id).is('deleted_at', null).gte('date', streakWindow).order('date', { ascending: false }),
        supabase.from('transactions').select('amount, type, category_id').eq('user_id', user!.id).is('deleted_at', null).gte('date', monthStart),
        supabase.from('transactions').select('amount, type').eq('user_id', user!.id).is('deleted_at', null).gte('date', prevMonthStart).lte('date', prevMonthEnd),
        supabase.from('budgets').select('id, amount, category_id, budget_type').eq('user_id', user!.id).is('deleted_at', null).is('paused_at', null),
        supabase.from('savings_goals').select('current_amount, target_amount').eq('user_id', user!.id).is('deleted_at', null).eq('status', 'active'),
      ]);

      const insights: DashboardInsight[] = [];

      // Streak
      const days = new Set((streakRows ?? []).map(r => r.date));
      let streak = 0;
      const cursor = new Date();
      cursor.setHours(0, 0, 0, 0);
      while (days.has(cursor.toISOString().split('T')[0])) {
        streak += 1;
        cursor.setDate(cursor.getDate() - 1);
      }
      if (streak >= 2) {
        insights.push({
          key: 'streak',
          icon: '🔥',
          text: isFr ? `${streak} jours de suite` : `${streak}-day streak`,
          tone: 'streak',
        });
      }

      // Exceeded budgets
      const spendByCat: Record<string, number> = {};
      (curMonthTx ?? []).forEach(tx => {
        if (tx.type === 'expense' && tx.category_id) {
          spendByCat[tx.category_id] = (spendByCat[tx.category_id] || 0) + Number(tx.amount);
        }
      });
      const exceeded = (budgets ?? []).filter(b => {
        if (b.budget_type !== 'expense' || !b.category_id) return false;
        return (spendByCat[b.category_id] || 0) > Number(b.amount);
      }).length;
      if (exceeded > 0) {
        insights.push({
          key: 'exceeded',
          icon: '⚠️',
          text: isFr ? `${exceeded} budget${exceeded > 1 ? 's' : ''} dépassé${exceeded > 1 ? 's' : ''}` : `${exceeded} budget${exceeded > 1 ? 's' : ''} over limit`,
          tone: 'warn',
        });
      }

      // Savings progress
      if ((goals ?? []).length > 0) {
        const totalTarget = goals!.reduce((s, g) => s + Number(g.target_amount), 0);
        const totalCur = goals!.reduce((s, g) => s + Number(g.current_amount), 0);
        const pct = totalTarget > 0 ? Math.round((totalCur / totalTarget) * 100) : 0;
        insights.push({
          key: 'savings',
          icon: '🎯',
          text: isFr ? `${pct}% des objectifs atteints` : `${pct}% of goals reached`,
          tone: pct >= 50 ? 'good' : 'info',
        });
      }

      // Cash flow trend
      const curIn = (curMonthTx ?? []).filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
      const curOut = (curMonthTx ?? []).filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
      const prevIn = (prevMonthTx ?? []).filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
      const prevOut = (prevMonthTx ?? []).filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
      const curNet = curIn - curOut;
      const prevNet = prevIn - prevOut;
      if (prevNet !== 0) {
        const evol = Math.round(((curNet - prevNet) / Math.abs(prevNet)) * 100);
        if (Math.abs(evol) >= 5) {
          insights.push({
            key: 'evol',
            icon: evol >= 0 ? '📈' : '📉',
            text: isFr
              ? `Cash-flow ${evol >= 0 ? '+' : ''}${evol}% vs mois dernier`
              : `Cash-flow ${evol >= 0 ? '+' : ''}${evol}% vs last month`,
            tone: evol >= 0 ? 'good' : 'warn',
          });
        }
      }

      // Always include a tip if nothing else
      if (insights.length === 0) {
        insights.push({
          key: 'tip',
          icon: '💡',
          text: isFr ? 'Ajoute une transaction pour commencer ton streak' : 'Add a transaction to start your streak',
          tone: 'primary',
        });
      }

      return insights;
    },
  });
}
