import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface DormantAccount {
  id: string;
  name: string;
  icon: string;
  days_inactive: number;
  real_balance: number;
}

export interface AccountDrilldown {
  velocity: number;
  avg_amount: number;
  top_categories: { category_id: string; name: string; icon: string; total: number }[];
  monthly_evolution: { month: string; income: number; expense: number }[];
}

export const useDormantAccounts = (days = 90) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['dormant-accounts', user?.id, days],
    queryFn: async (): Promise<DormantAccount[]> => {
      if (!user) return [];
      const { data, error } = await supabase.rpc('get_dormant_accounts', {
        p_user_id: user.id,
        p_days: days,
      });
      if (error) throw error;
      return (data ?? []) as DormantAccount[];
    },
    enabled: !!user,
    staleTime: 60_000,
  });
};

export const useAccountDrilldown = (accountId: string | null) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['account-drilldown', user?.id, accountId],
    queryFn: async (): Promise<AccountDrilldown | null> => {
      if (!user || !accountId) return null;
      const { data, error } = await supabase.rpc('get_account_drilldown', {
        p_user_id: user.id,
        p_account_id: accountId,
      });
      if (error) throw error;
      return data as unknown as AccountDrilldown;
    },
    enabled: !!user && !!accountId,
  });
};
