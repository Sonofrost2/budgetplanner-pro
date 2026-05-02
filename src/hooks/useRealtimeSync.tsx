import { useEffect, useCallback, useRef, useSyncExternalStore } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useInvalidate } from '@/hooks/useDashboardData';

const TABLES_TO_WATCH = [
  'transactions',
  'payment_accounts',
  'budgets',
  'categories',
  'savings_goals',
  'debts',
  'recurring_transactions',
  'cash_counts',
] as const;

const TABLE_TO_QUERY_KEYS: Record<string, string[]> = {
  transactions: ['transactions', 'all-transactions', 'paginated-transactions', 'chart-data', 'reports-data', 'forecast-raw-tx', 'budget-spending', 'tx-month-count'],
  payment_accounts: ['accounts'],
  budgets: ['budgets', 'budget-spending'],
  categories: ['categories', 'category-tx-counts'],
  savings_goals: ['savings-goals'],
  debts: ['debts'],
  recurring_transactions: ['recurring'],
  cash_counts: ['accounts'],
};

// ─── Sync status store (lightweight external store) ──────────────────────────
export type SyncChannelStatus = 'idle' | 'connecting' | 'live' | 'error' | 'closed';
export type SyncState = {
  online: boolean;
  channel: SyncChannelStatus;
  lastRefetchAt: number | null;
  lastChangeAt: number | null;
};

let syncState: SyncState = {
  online: typeof navigator !== 'undefined' ? navigator.onLine : true,
  channel: 'idle',
  lastRefetchAt: null,
  lastChangeAt: null,
};
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const setSyncState = (patch: Partial<SyncState>) => {
  syncState = { ...syncState, ...patch };
  emit();
};

export const useSyncStatus = (): SyncState =>
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => syncState,
    () => syncState,
  );

export const useRealtimeSync = () => {
  const { user } = useAuth();
  const { invalidate, invalidateAll } = useInvalidate();

  // Coalesce rapid bursts (bulk imports, multi-row updates) into a single
  // invalidate call per table within a 2-second window.
  const pendingRef = useRef<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = useCallback((table: string) => {
    pendingRef.current.add(table);
    setSyncState({ lastChangeAt: Date.now() });
    if (timerRef.current) return;
    timerRef.current = setTimeout(() => {
      const tables = Array.from(pendingRef.current);
      pendingRef.current.clear();
      timerRef.current = null;
      const keys = new Set<string>();
      for (const t of tables) for (const k of TABLE_TO_QUERY_KEYS[t] || []) keys.add(k);
      if (keys.size) {
        invalidate(...Array.from(keys));
        setSyncState({ lastRefetchAt: Date.now() });
      }
    }, 2000);
  }, [invalidate]);

  // Subscribe to realtime changes
  useEffect(() => {
    if (!user) return;
    setSyncState({ channel: 'connecting' });

    const channel = supabase
      .channel('dashboard-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions', filter: `user_id=eq.${user.id}` }, () => handleChange('transactions'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_accounts', filter: `user_id=eq.${user.id}` }, () => handleChange('payment_accounts'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'budgets', filter: `user_id=eq.${user.id}` }, () => handleChange('budgets'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories', filter: `user_id=eq.${user.id}` }, () => handleChange('categories'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'savings_goals', filter: `user_id=eq.${user.id}` }, () => handleChange('savings_goals'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'debts', filter: `user_id=eq.${user.id}` }, () => handleChange('debts'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recurring_transactions', filter: `user_id=eq.${user.id}` }, () => handleChange('recurring_transactions'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cash_counts', filter: `user_id=eq.${user.id}` }, () => handleChange('cash_counts'))
      .subscribe((status) => {
        // Supabase status: SUBSCRIBED | TIMED_OUT | CLOSED | CHANNEL_ERROR
        if (status === 'SUBSCRIBED') setSyncState({ channel: 'live' });
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setSyncState({ channel: 'error' });
        else if (status === 'CLOSED') setSyncState({ channel: 'closed' });
      });

    return () => {
      supabase.removeChannel(channel);
      setSyncState({ channel: 'idle' });
    };
  }, [user, handleChange]);

  // Refetch on focus/visibility/online
  useEffect(() => {
    if (!user) return;

    let lastRefetch = 0;
    const THROTTLE_MS = 5000;

    const refetchIfStale = () => {
      const now = Date.now();
      if (now - lastRefetch < THROTTLE_MS) return;
      lastRefetch = now;
      invalidateAll();
      setSyncState({ lastRefetchAt: Date.now() });
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') refetchIfStale();
    };

    const handleOnline = () => { setSyncState({ online: true }); refetchIfStale(); };
    const handleOffline = () => setSyncState({ online: false });

    window.addEventListener('focus', refetchIfStale);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('focus', refetchIfStale);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [user, invalidateAll]);
};
