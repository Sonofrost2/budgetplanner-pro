import { useEffect, useCallback, useRef, useSyncExternalStore } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useInvalidate } from '@/hooks/useDashboardData';

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

  // Subscribe to realtime changes — only core tables (INSERT/UPDATE/DELETE),
  // and auto-disconnect when the tab stays hidden > 60s to save Realtime quota.
  useEffect(() => {
    if (!user) return;

    let channel: ReturnType<typeof supabase.channel> | null = null;
    let hideTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (channel) return;
      setSyncState({ channel: 'connecting' });
      channel = supabase
        .channel('dashboard-sync')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transactions', filter: `user_id=eq.${user.id}` }, () => handleChange('transactions'))
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'transactions', filter: `user_id=eq.${user.id}` }, () => handleChange('transactions'))
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'transactions', filter: `user_id=eq.${user.id}` }, () => handleChange('transactions'))
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'payment_accounts', filter: `user_id=eq.${user.id}` }, () => handleChange('payment_accounts'))
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') setSyncState({ channel: 'live' });
          else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setSyncState({ channel: 'error' });
          else if (status === 'CLOSED') setSyncState({ channel: 'closed' });
        });
    };

    const disconnect = () => {
      if (channel) {
        supabase.removeChannel(channel);
        channel = null;
        setSyncState({ channel: 'idle' });
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        if (hideTimer) clearTimeout(hideTimer);
        hideTimer = setTimeout(disconnect, 60_000);
      } else {
        if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
        connect();
      }
    };

    connect();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      if (hideTimer) clearTimeout(hideTimer);
      disconnect();
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
