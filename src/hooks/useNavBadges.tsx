import { useQuery } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';

export interface NavBadges {
  transactionsToday: number;
  budgetsExceeded: number;
  debtsOverdue: number;
}

export function useNavBadges() {
  const { user } = useAuth();

  return useQuery<NavBadges>({
    queryKey: ['nav-badges', user?.id],
    enabled: !!user,
    refetchInterval: 60_000,
    staleTime: 30_000,
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const monthStart = new Date();
      monthStart.setDate(1);
      const monthStartIso = monthStart.toISOString().split('T')[0];

      const [txRes, budRes, debtRes] = await Promise.all([
        supabase
          .from('transactions')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user!.id)
          .eq('date', today)
          .is('deleted_at', null),
        supabase.rpc('get_budgets_spending', {
          p_user_id: user!.id,
          p_start_date: monthStartIso,
          p_end_date: today,
        }),
        supabase
          .from('debts')
          .select('id, due_date, total_amount, paid_amount')
          .eq('user_id', user!.id)
          .is('deleted_at', null)
          .not('due_date', 'is', null),
      ]);

      // Count exceeded budgets via separate budgets fetch
      let budgetsExceeded = 0;
      if (budRes.data && Array.isArray(budRes.data)) {
        const { data: budgets } = await supabase
          .from('budgets')
          .select('id, amount, category_id, budget_type, period')
          .eq('user_id', user!.id)
          .is('deleted_at', null)
          .is('paused_at', null);
        const spendMap = new Map<string, number>();
        (budRes.data as any[]).forEach(r => {
          if (r.category_id) spendMap.set(`${r.category_id}_${r.type}`, Number(r.total));
        });
        budgets?.forEach(b => {
          if (b.category_id && b.budget_type === 'expense') {
            const spent = spendMap.get(`${b.category_id}_expense`) || 0;
            if (spent > Number(b.amount)) budgetsExceeded += 1;
          }
        });
      }

      const todayDate = new Date(today);
      const debtsOverdue = (debtRes.data || []).filter(d => {
        const remaining = Number(d.total_amount) - Number(d.paid_amount || 0);
        return remaining > 0 && d.due_date && new Date(d.due_date) < todayDate;
      }).length;

      return {
        transactionsToday: txRes.count || 0,
        budgetsExceeded,
        debtsOverdue,
      };
    },
  });
}
