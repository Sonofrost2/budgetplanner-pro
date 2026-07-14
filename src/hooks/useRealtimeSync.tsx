import { useEffect, useCallback, useRef, useSyncExternalStore } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useInvalidate } from '@/hooks/useDashboardData';

// NOTE — Alertes serveur (`check-alerts` edge function) : elles tournent en
// cron (toutes les X minutes), donc les notifications push ne sont PAS
// instantanées. Pour refléter en direct un dépassement de budget dans l'UI,
// on s'appuie sur ces invalidations React Query côté client (calcul local
// live à partir des transactions), pas sur l'arrivée des notifs.
const TABLE_TO_QUERY_KEYS: Record<string, string[]> = {
  // Une transaction touche soldes, comptes, épargnes, rapports, dashboard, …
  transactions: [
    'transactions', 'all-transactions', 'paginated-transactions',
    'chart-data', 'reports-data', 'forecast-raw-tx',
    'budget-spending', 'budget-annual-spending', 'tx-month-count',
    'account-theoretical-balances', 'account-transactions',
    'savings-page-data', 'savings-goals',
  ],
  payment_accounts: ['accounts', 'account-theoretical-balances', 'savings-page-data'],
  budgets: ['budgets', 'budget-spending', 'budget-annual-spending'],
  categories: ['categories', 'category-tx-counts'],
  savings_goals: ['savings-goals', 'savings-page-data'],
  debts: ['debts'],
  recurring_transactions: ['recurring'],
  cash_counts: ['accounts', 'account-cash-counts', 'account-theoretical-balances'],
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
      const f = `user_id=eq.${user.id}`;
      channel = supabase
        .channel('dashboard-sync')
        // Transactions — INSERT/UPDATE/DELETE (déclenchent tableau de bord, soldes, rapports)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions', filter: f }, () => handleChange('transactions'))
        // Comptes — UPDATE (solde théorique / réel)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_accounts', filter: f }, () => handleChange('payment_accounts'))
        // Budgets / épargnes / dettes / catégories / récurrentes — synchro cross-tabs
        .on('postgres_changes', { event: '*', schema: 'public', table: 'budgets', filter: f }, () => handleChange('budgets'))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'savings_goals', filter: f }, () => handleChange('savings_goals'))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'debts', filter: f }, () => handleChange('debts'))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'categories', filter: f }, () => handleChange('categories'))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'recurring_transactions', filter: f }, () => handleChange('recurring_transactions'))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'cash_counts', filter: f }, () => handleChange('cash_counts'))
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
