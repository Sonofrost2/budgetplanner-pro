import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

/**
 * Shared budget → spending computation, keyed by BUDGET id (never category).
 * - Two budgets on the same category never double-count.
 * - Budgets linked to a savings goal derive their consumption from
 *   `get_savings_contribution` (incoming transfers to the goal) instead of
 *   categorized expenses.
 * - Transfers (`is_transfer=true`) are excluded server-side by the RPC.
 *
 * Returns a Record<budgetId, number> of consumed amounts over the window.
 */
export interface BudgetSpendingRange {
  id: string;
  category_id: string | null;
  type: 'expense' | 'income';
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
  linked_savings_goal_id?: string | null;
}

export function useBudgetSpending(
  ranges: BudgetSpendingRange[],
  opts?: { staleTime?: number; queryKey?: string },
) {
  const { user } = useAuth();
  const key = ranges
    .map(r => `${r.id}:${r.start}:${r.end}:${r.linked_savings_goal_id ?? ''}`)
    .join(',');

  return useQuery({
    queryKey: ['budget-spending-shared', opts?.queryKey ?? 'default', user?.id, key],
    queryFn: async () => {
      const map: Record<string, number> = {};
      await Promise.all(
        ranges.map(async (r) => {
          if (r.linked_savings_goal_id) {
            const { data, error } = await (supabase.rpc as any)('get_savings_contribution', {
              p_user_id: user!.id,
              p_goal_id: r.linked_savings_goal_id,
              p_start_date: r.start,
              p_end_date: r.end,
            });
            if (!error && data !== null) map[r.id] = Number(data);
            return;
          }
          if (!r.category_id) return;
          const { data, error } = await supabase.rpc('get_budget_spending', {
            p_user_id: user!.id,
            p_category_id: r.category_id,
            p_type: r.type,
            p_start_date: r.start,
            p_end_date: r.end,
          });
          if (!error && data !== null) map[r.id] = Number(data);
        }),
      );
      return map;
    },
    enabled: !!user && ranges.length > 0,
    staleTime: opts?.staleTime ?? 15_000,
  });
}