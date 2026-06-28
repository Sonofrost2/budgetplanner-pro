import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

export type ActivationTaskId = 'categories' | 'account' | 'transactions';

export interface ActivationTask {
  id: ActivationTaskId;
  done: boolean;
  current: number;
  target: number;
}

export interface ActivationState {
  loading: boolean;
  tasks: ActivationTask[];
  progress: number; // 0..1
  doneCount: number;
  totalCount: number;
  complete: boolean;
  dismissed: boolean;
  visible: boolean;
  dismiss: () => Promise<void>;
  markCategoriesVisited: () => Promise<void>;
  refresh: () => void;
}

/**
 * Activation checklist: 3 micro-tâches pour réduire le churn J7.
 *  1. Découvrir les catégories (visite tracée)
 *  2. Créer au moins 1 compte de paiement
 *  3. Saisir au moins 3 transactions
 *
 * Les compteurs viennent du serveur (sources de vérité).
 * Quand les 3 tâches sont validées, `activation_completed_at` est posée
 * automatiquement côté serveur → la card disparaît proprement.
 */
export const useActivationChecklist = (): ActivationState => {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['activation-checklist', user?.id ?? ''],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      const [profileRes, accountsRes, txRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('activation_completed_at, activation_dismissed_at, categories_visited_at, onboarding_completed')
          .eq('user_id', user!.id)
          .maybeSingle(),
        supabase
          .from('payment_accounts')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user!.id)
          .is('deleted_at', null),
        supabase
          .from('transactions')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user!.id)
          .is('deleted_at', null),
      ]);
      return {
        profile: profileRes.data,
        accountsCount: accountsRes.count ?? 0,
        transactionsCount: txRes.count ?? 0,
      };
    },
  });

  const state = useMemo(() => {
    const profile = data?.profile;
    const accountsCount = data?.accountsCount ?? 0;
    const transactionsCount = data?.transactionsCount ?? 0;

    const tasks: ActivationTask[] = [
      {
        id: 'categories',
        done: !!profile?.categories_visited_at,
        current: profile?.categories_visited_at ? 1 : 0,
        target: 1,
      },
      {
        id: 'account',
        done: accountsCount >= 1,
        current: Math.min(accountsCount, 1),
        target: 1,
      },
      {
        id: 'transactions',
        done: transactionsCount >= 3,
        current: Math.min(transactionsCount, 3),
        target: 3,
      },
    ];

    const doneCount = tasks.filter(t => t.done).length;
    const totalCount = tasks.length;
    const allDone = doneCount === totalCount;
    const dismissed = !!profile?.activation_dismissed_at;
    const persistedComplete = !!profile?.activation_completed_at;
    const onboarded = !!profile?.onboarding_completed;

    return {
      tasks,
      doneCount,
      totalCount,
      progress: doneCount / totalCount,
      complete: allDone || persistedComplete,
      dismissed,
      visible: onboarded && !dismissed && !(allDone && persistedComplete),
      allDoneNotYetPersisted: allDone && !persistedComplete,
    };
  }, [data]);

  // Auto-mark completion server-side as soon as the 3 tasks are validated.
  useEffect(() => {
    if (!user || !state.allDoneNotYetPersisted) return;
    supabase
      .from('profiles')
      .update({ activation_completed_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .then(() => qc.invalidateQueries({ queryKey: ['activation-checklist', user.id] }));
  }, [user, state.allDoneNotYetPersisted, qc]);

  const dismiss = async () => {
    if (!user) return;
    await supabase
      .from('profiles')
      .update({ activation_dismissed_at: new Date().toISOString() })
      .eq('user_id', user.id);
    qc.invalidateQueries({ queryKey: ['activation-checklist', user.id] });
  };

  const markCategoriesVisited = async () => {
    if (!user || data?.profile?.categories_visited_at) return;
    await supabase
      .from('profiles')
      .update({ categories_visited_at: new Date().toISOString() })
      .eq('user_id', user.id);
    qc.invalidateQueries({ queryKey: ['activation-checklist', user.id] });
  };

  return {
    loading: isLoading,
    tasks: state.tasks,
    progress: state.progress,
    doneCount: state.doneCount,
    totalCount: state.totalCount,
    complete: state.complete,
    dismissed: state.dismissed,
    visible: state.visible,
    dismiss,
    markCategoriesVisited,
    refresh: () => refetch(),
  };
};