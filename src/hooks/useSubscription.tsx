import { useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';

const FREE_LIMITS = {
  transactionsPerMonth: 15,
  accounts: 1,
  budgets: 1,
};

export const useSubscription = () => {
  const { user } = useAuth();
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    supabase
      .from('subscriptions')
      .select('status, plan_id, subscription_plans(name)')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        const sub = data?.[0] as any;
        setIsPremium(sub?.subscription_plans?.name === 'premium');
        setLoading(false);
      });
  }, [user]);

  const limits = isPremium
    ? { transactionsPerMonth: Infinity, accounts: Infinity, budgets: Infinity }
    : FREE_LIMITS;

  return { isPremium, loading, limits };
};
