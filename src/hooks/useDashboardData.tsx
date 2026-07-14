import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { Tables } from '@/integrations/supabase/types';

// ─── Types ───────────────────────────────────────────────────────────────────
export type Account = Tables<'payment_accounts'>;
export type Transaction = Tables<'transactions'> & {
  categories?: { name: string; icon: string; color: string } | null;
  payment_accounts?: { name: string; icon: string } | null;
};
export type Category = Tables<'categories'>;
export type Budget = Tables<'budgets'> & {
  categories?: { name: string; icon: string; color: string } | null;
  spent?: number;
};
export type SavingsGoal = Tables<'savings_goals'> & {
  payment_accounts?: { name: string; icon: string; real_balance: number } | null;
};
export type Debt = Tables<'debts'>;
export type RecurringTransaction = Tables<'recurring_transactions'> & {
  categories?: { name: string; icon: string; color: string } | null;
};
export type Profile = Tables<'profiles'>;

// ─── Query Keys ──────────────────────────────────────────────────────────────
export const queryKeys = {
  accounts: (userId: string) => ['accounts', userId] as const,
  transactions: (userId: string) => ['transactions', userId] as const,
  allTransactions: (userId: string) => ['all-transactions', userId] as const,
  transactionsRange: (userId: string, start: string, end: string) => ['transactions', userId, start, end] as const,
  categories: (userId: string) => ['categories', userId] as const,
  budgets: (userId: string) => ['budgets', userId] as const,
  savingsGoals: (userId: string) => ['savings-goals', userId] as const,
  debts: (userId: string) => ['debts', userId] as const,
  recurring: (userId: string) => ['recurring', userId] as const,
  profile: (userId: string) => ['profile', userId] as const,
  chartData: (userId: string) => ['chart-data', userId] as const,
  receipts: (userId: string) => ['receipts', userId] as const,
  reportsData: (userId: string) => ['reports-data', userId] as const,
  forecastRawTx: (userId: string) => ['forecast-raw-tx', userId] as const,
};

// ─── Read Hooks ──────────────────────────────────────────────────────────────

/**
 * Fetch user payment accounts.
 * By default, archived accounts are EXCLUDED to keep widgets (Wealth, Health, Forecast,
 * StatsCards, AccountsSummary…) consistent: an archived account must not inflate the
 * net worth, the diversification score, or the active-accounts count.
 * Pass `{ includeArchived: true }` only on screens dedicated to managing archives
 * (e.g. AccountsPage with the "show archived" toggle).
 */
export const useAccounts = (opts?: { includeArchived?: boolean }) => {
  const { user } = useAuth();
  const includeArchived = opts?.includeArchived ?? false;
  return useQuery({
    queryKey: [...queryKeys.accounts(user?.id ?? ''), includeArchived ? 'all' : 'active'],
    queryFn: async () => {
      let q = supabase
        .from('payment_accounts').select('*')
        .eq('user_id', user!.id).is('deleted_at', null);
      if (!includeArchived) q = q.is('archived_at', null);
      const { data, error } = await q.order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as Account[];
    },
    enabled: !!user,
    staleTime: 30_000,
  });
};

export const useCategories = (opts: { includeArchived?: boolean } = {}) => {
  const { user } = useAuth();
  const { includeArchived = false } = opts;
  return useQuery({
    queryKey: [...queryKeys.categories(user?.id ?? ''), { includeArchived }],
    queryFn: async () => {
      let q = supabase
        .from('categories').select('*')
        .eq('user_id', user!.id).is('deleted_at', null);
      if (!includeArchived) q = q.is('archived_at', null);
      const { data, error } = await q.order('type').order('name');
      if (error) throw error;
      return (data ?? []) as Category[];
    },
    enabled: !!user,
    staleTime: 60_000,
  });
};

export const useBudgets = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.budgets(user?.id ?? ''),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('budgets').select('*, categories(name, icon, color)')
        .eq('user_id', user!.id).is('deleted_at', null).order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Budget[];
    },
    enabled: !!user,
    staleTime: 30_000,
  });
};

export const useSavingsGoals = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.savingsGoals(user?.id ?? ''),
    queryFn: async () => {
      // Note: returns ALL non-deleted goals (active/completed/paused/archived).
      // Consumers (widgets, KPIs) MUST filter through `liveSavingsTotal` /
      // `isLiveGoal` from `@/lib/savingsLogic` to avoid inflating totals.
      // Pages dedicated to managing archives/atteints (SavingsPage) consume the
      // raw list and partition it themselves.
      const { data, error } = await supabase
        .from('savings_goals').select('*, payment_accounts(name, icon, real_balance)')
        .eq('user_id', user!.id).is('deleted_at', null).order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as SavingsGoal[];
    },
    enabled: !!user,
    staleTime: 30_000,
  });
};

export const useDebts = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.debts(user?.id ?? ''),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('debts').select('*')
        .eq('user_id', user!.id).is('deleted_at', null).order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Debt[];
    },
    enabled: !!user,
    staleTime: 30_000,
  });
};

export const useRecurring = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.recurring(user?.id ?? ''),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recurring_transactions').select('*, categories(name, icon, color)')
        .eq('user_id', user!.id).is('deleted_at', null).order('next_date', { ascending: true });
      if (error) throw error;
      return (data ?? []) as RecurringTransaction[];
    },
    enabled: !!user,
    staleTime: 30_000,
  });
};

export const useUserProfile = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.profile(user?.id ?? ''),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles').select('*')
        .eq('user_id', user!.id).maybeSingle();
      if (error) throw error;
      return data as Profile | null;
    },
    enabled: !!user,
    staleTime: 60_000,
  });
};

// All transactions with relations (for TransactionsPage)
export const useAllTransactions = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.allTransactions(user?.id ?? ''),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*, categories(name, icon, color), payment_accounts(name, icon)')
        .eq('user_id', user!.id)
        .is('deleted_at', null)
        .order('date', { ascending: false })
        .limit(10000);
      if (error) throw error;
      return (data ?? []) as Transaction[];
    },
    enabled: !!user,
    staleTime: 15_000,
  });
};

// Receipts
export const useReceipts = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.receipts(user?.id ?? ''),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_receipts').select('*')
        .eq('user_id', user!.id).order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
    staleTime: 60_000,
  });
};

// Reports data
export const useReportsData = (locale: string) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.reportsData(user?.id ?? ''),
    queryFn: async () => {
      const now = new Date();
      const twelveAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1).toISOString().split('T')[0];
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

      const [txRes, catRes] = await Promise.all([
        supabase.from('transactions').select('type, amount, date, description, is_transfer, categories(name)')
          .eq('user_id', user!.id).is('deleted_at', null).gte('date', twelveAgo).order('date', { ascending: false }),
        supabase.from('transactions').select('amount, categories(name, color)')
          .eq('user_id', user!.id).is('deleted_at', null).eq('is_transfer', false).eq('type', 'expense').gte('date', monthStart).lte('date', monthEnd),
      ]);
      if (txRes.error) throw txRes.error;

      const allTx = txRes.data || [];
      const months: { name: string; income: number; expenses: number }[] = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const label = d.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', { month: 'short' });
        const txs = allTx.filter(tx => {
          const td = new Date(tx.date);
          return td.getMonth() === d.getMonth() && td.getFullYear() === d.getFullYear();
        });
        months.push({
          name: label,
          income: txs.filter(t => t.type === 'income' && (t as any).is_transfer !== true).reduce((s, t) => s + Number(t.amount), 0),
          expenses: txs.filter(t => t.type === 'expense' && (t as any).is_transfer !== true).reduce((s, t) => s + Number(t.amount), 0),
        });
      }

      const catMap: Record<string, { name: string; value: number; color: string }> = {};
      (catRes.data || []).forEach(tx => {
        const cat = tx.categories as { name: string; color: string } | null;
        const name = cat?.name || 'Other';
        const color = cat?.color || '#6C63FF';
        if (!catMap[name]) catMap[name] = { name, value: 0, color };
        catMap[name].value += Number(tx.amount);
      });

      return {
        allTransactions: allTx,
        monthlyData: months,
        categoryData: Object.values(catMap).sort((a, b) => b.value - a.value),
      };
    },
    enabled: !!user,
    staleTime: 30_000,
  });
};

// Forecast raw transactions
export const useForecastRawTx = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.forecastRawTx(user?.id ?? ''),
    queryFn: async () => {
      const now = new Date();
      const sixAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('transactions').select('type, amount, date, category_id, categories(name)')
        .eq('user_id', user!.id).is('deleted_at', null).gte('date', sixAgo);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
    staleTime: 60_000,
  });
};

// Server-side paginated transactions
export const usePaginatedTransactions = (options: {
  page: number;
  pageSize: number;
  type?: string;
  categoryId?: string;
  accountId?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  sortField?: string;
  sortOrder?: 'asc' | 'desc';
}) => {
  const { user } = useAuth();
  const { page, pageSize, type, categoryId, accountId, search, startDate, endDate, sortField = 'date', sortOrder = 'desc' } = options;

  return useQuery({
    queryKey: ['paginated-transactions', user?.id, page, pageSize, type, categoryId, accountId, search, startDate, endDate, sortField, sortOrder],
    queryFn: async () => {
      let query = supabase
        .from('transactions')
        .select('*, categories(name, icon, color), payment_accounts(name, icon)', { count: 'exact' })
        .eq('user_id', user!.id)
        .is('deleted_at', null);

      if (type && type !== 'all') query = query.eq('type', type);
      if (categoryId && categoryId !== 'all') query = query.eq('category_id', categoryId);
      if (accountId && accountId !== 'all') query = query.eq('account_id', accountId);
      if (startDate) query = query.gte('date', startDate);
      if (endDate) query = query.lte('date', endDate);
      if (search) {
        const terms = search.split(';').map(s => s.trim()).filter(Boolean);
        if (terms.length === 1) {
          query = query.or(`description.ilike.%${terms[0]}%,notes.ilike.%${terms[0]}%`);
        } else {
          const orClauses = terms.map(t => `description.ilike.%${t}%`).join(',');
          query = query.or(orClauses);
        }
      }

      query = query.order(sortField as any, { ascending: sortOrder === 'asc' });
      // Secondary sort: within same date, most recently created first
      if (sortField === 'date') {
        query = query.order('created_at', { ascending: false });
      }
      query = query.range(page * pageSize, (page + 1) * pageSize - 1);

      const { data, error, count } = await query;
      if (error) throw error;
      return {
        data: (data ?? []) as Transaction[],
        totalCount: count ?? 0,
        totalPages: Math.max(1, Math.ceil((count ?? 0) / pageSize)),
      };
    },
    enabled: !!user,
    staleTime: 10_000,
    placeholderData: (prev) => prev,
  });
};

// Dashboard: transactions for a date range
export const useTransactionsRange = (start: string, end: string) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.transactionsRange(user?.id ?? '', start, end),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*, categories(name, icon, color)')
        .eq('user_id', user!.id)
        .is('deleted_at', null)
        .gte('date', start).lte('date', end)
        .order('date', { ascending: false }).limit(5000);
      if (error) throw error;
      return (data ?? []) as Transaction[];
    },
    enabled: !!user,
    staleTime: 30_000,
  });
};

// Chart data: last 6 months
export const useChartData = (locale: string) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.chartData(user?.id ?? ''),
    queryFn: async () => {
      const now = new Date();
      const months: { date: Date; label: string }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push({ date: d, label: d.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', { month: 'short' }) });
      }
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('transactions').select('type, amount, date, is_transfer')
        .eq('user_id', user!.id).is('deleted_at', null).gte('date', sixMonthsAgo);
      if (error) throw error;
      return months.map(m => {
        const monthTxs = (data || []).filter(tx => {
          const txDate = new Date(tx.date);
          return txDate.getMonth() === m.date.getMonth() && txDate.getFullYear() === m.date.getFullYear();
        });
        return {
          name: m.label,
          income: monthTxs.filter(t => t.type === 'income' && (t as any).is_transfer !== true).reduce((s, t) => s + Number(t.amount), 0),
          expenses: monthTxs.filter(t => t.type === 'expense' && (t as any).is_transfer !== true).reduce((s, t) => s + Number(t.amount), 0),
        };
      });
    },
    enabled: !!user,
    staleTime: 60_000,
  });
};

// ─── Account page data (theoretical balances + cash counts) ──────────────────
export const useAccountTheoreticalBalances = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['account-theoretical-balances', user?.id ?? ''],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_account_theoretical_balances', { p_user_id: user!.id });
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const row of (data || [])) {
        map[row.account_id] = Number(row.theoretical_balance);
      }
      return map;
    },
    enabled: !!user,
    staleTime: 15_000,
  });
};

// All transactions for account stats (period stats component)
export const useAccountTransactions = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['account-transactions', user?.id ?? ''],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('id, date, amount, type, account_id, description, category_id, is_transfer, linked_transfer_id')
        .eq('user_id', user!.id)
        .is('deleted_at', null)
        .order('date', { ascending: false });
      if (error) throw error;
      return (data || []) as Transaction[];
    },
    enabled: !!user,
    staleTime: 30_000,
  });
};

export const useAccountCashCounts = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['account-cash-counts', user?.id ?? ''],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cash_counts')
        .select('account_id, counted_at, total_counted')
        .eq('user_id', user!.id)
        .order('counted_at', { ascending: false });
      if (error) throw error;
      const map: Record<string, { counted_at: string; total_counted: number }> = {};
      (data || []).forEach(cc => {
        if (cc.account_id && !map[cc.account_id]) {
          map[cc.account_id] = { counted_at: cc.counted_at!, total_counted: Number(cc.total_counted) };
        }
      });
      return map;
    },
    enabled: !!user,
    staleTime: 30_000,
  });
};

// ─── Savings page data (goals + contributions from transactions) ─────────────
export const useSavingsPageData = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['savings-page-data', user?.id ?? ''],
    queryFn: async () => {
      const [goalsRes, accRes] = await Promise.all([
        supabase.from('savings_goals').select('*, payment_accounts(name, icon, real_balance, opening_balance)').eq('user_id', user!.id).is('deleted_at', null).order('created_at', { ascending: false }),
        supabase.from('payment_accounts').select('*').eq('user_id', user!.id).is('deleted_at', null),
      ]);
      if (goalsRes.error) throw goalsRes.error;

      const goalsData = goalsRes.data || [];
      const accounts = accRes.data || [];
      const savingsAccountIds = goalsData.map(g => g.account_id).filter((id): id is string => !!id);
      const accountToGoal = new Map<string, any>();
      for (const g of goalsData) { if (g.account_id) accountToGoal.set(g.account_id, g); }
      const goalsWithoutAccount = goalsData.filter(g => !g.account_id);

      const txPromises: PromiseLike<any>[] = [];
      if (savingsAccountIds.length > 0) {
        txPromises.push(
          supabase.from('transactions')
            .select('id, amount, date, notes, type, account_id, description, payment_accounts:account_id(name, icon)')
            .eq('user_id', user!.id).is('deleted_at', null).in('account_id', savingsAccountIds)
            .order('date', { ascending: false }).limit(2000)
        );
      }
      if (goalsWithoutAccount.length > 0) {
        txPromises.push(
          supabase.from('transactions')
            .select('id, amount, date, notes, type, account_id, description, payment_accounts:account_id(name, icon)')
            .eq('user_id', user!.id).is('deleted_at', null).like('notes', '🎯 %')
            .order('date', { ascending: false }).limit(500)
        );
      }

      const txResults = await Promise.all(txPromises);
      const contribMap: Record<string, { id: string; amount: number; date: string; type: 'deposit' | 'withdrawal'; account_name?: string; account_icon?: string; description?: string }[]> = {};
      const seenTxIds = new Set<string>();
      for (const goal of goalsData) contribMap[goal.id] = [];

      if (txResults.length > 0 && savingsAccountIds.length > 0) {
        const accountTxs = txResults[0]?.data || [];
        for (const tx of accountTxs) {
          const goal = accountToGoal.get(tx.account_id);
          if (!goal) continue;
          seenTxIds.add(tx.id);
          contribMap[goal.id].push({
            id: tx.id, amount: tx.amount, date: tx.date,
            type: tx.type === 'income' ? 'deposit' : 'withdrawal',
            account_name: (tx.payment_accounts as any)?.name,
            account_icon: (tx.payment_accounts as any)?.icon,
            description: tx.description,
          });
        }
      }

      const noteResultIdx = savingsAccountIds.length > 0 ? 1 : 0;
      if (goalsWithoutAccount.length > 0 && txResults[noteResultIdx]) {
        const noteTxs = txResults[noteResultIdx]?.data || [];
        for (const tx of noteTxs) {
          if (seenTxIds.has(tx.id)) continue;
          if (!tx.notes?.startsWith('🎯 ')) continue;
          const goalNameFromNote = tx.notes.replace('🎯 ', '');
          const goal = goalsWithoutAccount.find(g => g.name === goalNameFromNote);
          if (!goal) continue;
          seenTxIds.add(tx.id);
          contribMap[goal.id].push({
            id: tx.id, amount: tx.amount, date: tx.date,
            type: tx.type === 'income' ? 'deposit' : 'withdrawal',
            account_name: (tx.payment_accounts as any)?.name,
            account_icon: (tx.payment_accounts as any)?.icon,
            description: tx.description,
          });
        }
      }

      for (const goalId of Object.keys(contribMap)) {
        contribMap[goalId].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      }

      // Recalculate current_amount for account-linked goals
      const updatedGoals = [];
      for (const goal of goalsData) {
        if (goal.account_id) {
          const contribs = contribMap[goal.id];
          const openingBalance = Number((goal.payment_accounts as any)?.opening_balance) || 0;
          const netFromTx = contribs.reduce((sum, c) => sum + (c.type === 'deposit' ? c.amount : -c.amount), 0);
          const computedAmount = openingBalance + netFromTx;
          if (Math.abs(computedAmount - Number(goal.current_amount)) > 0.5) {
            await supabase.from('savings_goals').update({ current_amount: computedAmount }).eq('id', goal.id);
            updatedGoals.push({ ...goal, current_amount: computedAmount });
          } else {
            updatedGoals.push(goal);
          }
        } else {
          updatedGoals.push(goal);
        }
      }

      return { goals: updatedGoals as SavingsGoal[], accounts: accounts as Account[], contributions: contribMap };
    },
    enabled: !!user,
    staleTime: 15_000,
  });
};

// ─── Invalidation helper ─────────────────────────────────────────────────────
export const useInvalidate = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const invalidate = (...keys: string[]) => {
    if (!user) return;
    keys.forEach(k => queryClient.invalidateQueries({ queryKey: [k, user.id] }));
  };

  const invalidateAll = () => {
    if (!user) return;
    ['accounts', 'transactions', 'all-transactions', 'paginated-transactions',
     'categories', 'budgets', 'savings-goals', 'debts', 'recurring',
     'chart-data', 'receipts', 'reports-data', 'forecast-raw-tx',
     'account-theoretical-balances', 'account-cash-counts', 'savings-page-data'].forEach(k =>
      queryClient.invalidateQueries({ queryKey: [k, user.id] })
    );
    // Also invalidate range-based transaction queries
    queryClient.invalidateQueries({ predicate: q => q.queryKey[0] === 'transactions' && q.queryKey[1] === user.id });
  };

  return { invalidate, invalidateAll };
};

// Legacy alias
export const useInvalidateAll = () => {
  const { invalidateAll } = useInvalidate();
  return invalidateAll;
};
