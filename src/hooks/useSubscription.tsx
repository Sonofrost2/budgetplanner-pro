import { useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';

const FREE_LIMITS = {
  transactionsPerMonth: 15,
  accounts: 1,
  budgets: 1,
};

const PAID_LIMITS = {
  transactionsPerMonth: Infinity,
  accounts: Infinity,
  budgets: Infinity,
};

export type PlanTier = 'free' | 'pro' | 'premium';

export const useSubscription = () => {
  const { user } = useAuth();
  const [planTier, setPlanTier] = useState<PlanTier>('free');
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
        const name = sub?.subscription_plans?.name;
        if (name === 'premium') setPlanTier('premium');
        else if (name === 'pro') setPlanTier('pro');
        else setPlanTier('free');
        setLoading(false);
      });
  }, [user]);

  const isPremium = planTier === 'premium';
  const isPro = planTier === 'pro';
  const isPaid = isPro || isPremium;

  const limits = isPaid ? PAID_LIMITS : FREE_LIMITS;

  return { isPremium, isPro, isPaid, planTier, loading, limits };
};
