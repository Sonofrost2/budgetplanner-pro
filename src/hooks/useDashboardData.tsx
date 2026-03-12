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

export const useAccounts = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.accounts(user?.id ?? ''),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_accounts').select('*')
        .eq('user_id', user!.id).order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as Account[];
    },
    enabled: !!user,
    staleTime: 30_000,
  });
};

export const useCategories = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.categories(user?.id ?? ''),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories').select('*')
        .eq('user_id', user!.id).order('type').order('name');
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
        .eq('user_id', user!.id).order('created_at', { ascending: false });
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
      const { data, error } = await supabase
        .from('savings_goals').select('*, payment_accounts(name, icon, real_balance)')
        .eq('user_id', user!.id).order('created_at', { ascending: false });
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
        .eq('user_id', user!.id).order('created_at', { ascending: false });
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
        .eq('user_id', user!.id).order('next_date', { ascending: true });
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
        supabase.from('transactions').select('type, amount, date, description, categories(name)')
          .eq('user_id', user!.id).gte('date', twelveAgo).order('date', { ascending: false }),
        supabase.from('transactions').select('amount, categories(name, color)')
          .eq('user_id', user!.id).eq('type', 'expense').gte('date', monthStart).lte('date', monthEnd),
      ]);
      if (txRes.error) throw txRes.error;

      const allTx = txRes.data || [];
      const months: any[] = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const label = d.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', { month: 'short' });
        const txs = allTx.filter(tx => {
          const td = new Date(tx.date);
          return td.getMonth() === d.getMonth() && td.getFullYear() === d.getFullYear();
        });
        months.push({
          name: label,
          income: txs.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0),
          expenses: txs.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0),
        });
      }

      const catMap: Record<string, { name: string; value: number; color: string }> = {};
      (catRes.data || []).forEach(tx => {
        const name = (tx.categories as any)?.name || 'Other';
        const color = (tx.categories as any)?.color || '#6C63FF';
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
        .eq('user_id', user!.id).gte('date', sixAgo);
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
        .eq('user_id', user!.id);

      if (type && type !== 'all') query = query.eq('type', type);
      if (categoryId && categoryId !== 'all') query = query.eq('category_id', categoryId);
      if (accountId && accountId !== 'all') query = query.eq('account_id', accountId);
      if (startDate) query = query.gte('date', startDate);
      if (endDate) query = query.lte('date', endDate);
      if (search) query = query.or(`description.ilike.%${search}%,notes.ilike.%${search}%`);

      query = query.order(sortField as any, { ascending: sortOrder === 'asc' });
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
        .from('transactions').select('type, amount, date')
        .eq('user_id', user!.id).gte('date', sixMonthsAgo);
      if (error) throw error;
      return months.map(m => {
        const monthTxs = (data || []).filter((tx: any) => {
          const txDate = new Date(tx.date);
          return txDate.getMonth() === m.date.getMonth() && txDate.getFullYear() === m.date.getFullYear();
        });
        return {
          name: m.label,
          income: monthTxs.filter((t: any) => t.type === 'income').reduce((s: number, t: any) => s + Number(t.amount), 0),
          expenses: monthTxs.filter((t: any) => t.type === 'expense').reduce((s: number, t: any) => s + Number(t.amount), 0),
        };
      });
    },
    enabled: !!user,
    staleTime: 60_000,
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
     'chart-data', 'receipts', 'reports-data', 'forecast-raw-tx'].forEach(k =>
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
