import { useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';
import { isDemoUserEmail } from '@/lib/demo';

const FREE_LIMITS = {
  transactionsPerMonth: 15,
  accounts: 1,
  budgets: 1,
  categories: 5,
};

const PRO_LIMITS = {
  transactionsPerMonth: Infinity,
  accounts: Infinity,
  budgets: Infinity,
  categories: Infinity,
};

const PREMIUM_LIMITS = {
  transactionsPerMonth: Infinity,
  accounts: Infinity,
  budgets: Infinity,
  categories: Infinity,
};

export type PlanTier = 'free' | 'pro' | 'premium';

// Admin QA override — session-only, never persisted to DB / billing.
export const ADMIN_TEST_PLAN_KEY = 'bp_admin_test_plan';
export const ADMIN_TEST_PLAN_EVENT = 'bp:admin-test-plan-changed';

const readAdminOverride = (): PlanTier | null => {
  try {
    const v = sessionStorage.getItem(ADMIN_TEST_PLAN_KEY);
    return v === 'free' || v === 'pro' || v === 'premium' ? v : null;
  } catch { return null; }
};

export const getTransferQuotaState = (transactionCount: number, transactionLimit: number) => {
  const transferCost = 2;

  if (!Number.isFinite(transactionLimit)) {
    return {
      transferCost,
      canCreateTransfer: true,
      nextTransferCount: transactionCount + transferCost,
      remainingBeforeLimit: Infinity,
    };
  }

  const remainingBeforeLimit = Math.max(0, transactionLimit - transactionCount);

  return {
    transferCost,
    remainingBeforeLimit,
    nextTransferCount: transactionCount + transferCost,
    canCreateTransfer: remainingBeforeLimit >= transferCost,
  };
};

export const useSubscription = () => {
  const { user } = useAuth();
  const [planTier, setPlanTier] = useState<PlanTier>('free');
  const [loading, setLoading] = useState(true);
  const demo = isDemoUserEmail(user?.email);
  const [override, setOverride] = useState<PlanTier | null>(readAdminOverride);

  useEffect(() => {
    const onChange = () => setOverride(readAdminOverride());
    window.addEventListener(ADMIN_TEST_PLAN_EVENT, onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener(ADMIN_TEST_PLAN_EVENT, onChange);
      window.removeEventListener('storage', onChange);
    };
  }, []);

  const refresh = () => {
    if (!user) { setLoading(false); return; }
    // Compte démo : vitrine complète des fonctionnalités payantes.
    // Traité comme Premium pour rester cohérent avec les données affichées
    // (5 comptes, budgets multiples, etc.) et éviter les bandeaux de limite.
    if (isDemoUserEmail(user.email)) {
      setPlanTier('premium');
      setLoading(false);
      return;
    }
    setLoading(true);
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
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const effectiveTier: PlanTier = override ?? planTier;
  const isPremium = effectiveTier === 'premium';
  const isPro = effectiveTier === 'pro';
  const isPaid = isPro || isPremium;

  const limits = isPremium ? PREMIUM_LIMITS : isPro ? PRO_LIMITS : FREE_LIMITS;

  // ── Granular capabilities matrix ──
  // Free: limits + CSV simple only
  // Pro: unlimited + smart notifications + recurring + AI basique + chat
  // Premium: tout Pro + IA avancée + Receipts + Wealth + Family + Forecasts + Exports PDF/Excel
  const canUseRecurring = isPaid;
  const canUseAIBasic = isPaid; // catégorisation, suggest, quick-parse
  const canUseAIPremium = isPremium; // forecasts, budget-suggest, debt-plan, savings-simulate, report-insights, detect-recurring, wealth-valuation
  const canUseChatCoach = isPaid;
  const canUseReceipts = isPremium;
  const canUseWealth = isPremium;
  const canUseFamily = isPremium;
  const canUseForecast = isPremium;
  const canExportAdvanced = isPremium; // PDF/Excel — CSV reste accessible à tous
  // Backward compat: many components still read canUseAISuggestions
  const canUseAISuggestions = canUseAIBasic;

  return {
    isPremium, isPro, isPaid, planTier: effectiveTier, loading, limits, refresh, isDemo: demo,
    isAdminOverride: !!override,
    canUseRecurring, canUseAIBasic, canUseAIPremium, canUseChatCoach,
    canUseReceipts, canUseWealth, canUseFamily, canUseForecast,
    canExportAdvanced, canUseAISuggestions,
  };
};
