import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { usePersistedState } from '@/hooks/usePersistedState';
import { useLanguage } from '@/i18n/LanguageContext';
import { getTransferQuotaState, useSubscription } from '@/hooks/useSubscription';
import { dashT } from '@/i18n/dashTranslations';
import { supabase } from '@/integrations/supabase/client';
import { usePaginatedTransactions, useCategories, useAccounts, useInvalidate, useBudgets, useSavingsGoals, type Transaction } from '@/hooks/useDashboardData';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Search, TrendingUp, TrendingDown, Calendar, CreditCard, Tag, ArrowUpDown, X, ArrowLeftRight, BarChart3, Filter, Scale, Lock, Users, SlidersHorizontal } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger, SheetFooter, SheetClose } from '@/components/ui/sheet';
import TransactionsStatsTab from '@/components/dashboard/tabs/TransactionsStatsTab';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import ConfirmDeleteDialog from '@/components/dashboard/ConfirmDeleteDialog';
import UpgradeBanner from '@/components/dashboard/UpgradeBanner';
import BulkActionBar from '@/components/dashboard/BulkActionBar';
import { useSearchParams } from 'react-router-dom';
import { exportToCSV, exportToExcel } from '@/lib/export';
import { motion, AnimatePresence } from 'framer-motion';
import { TransactionForm } from '@/components/dashboard/transactions/TransactionForm';
import { TransactionList } from '@/components/dashboard/transactions/TransactionList';
import { BulkModifyDialog, BudgetOverspendDialog } from '@/components/dashboard/transactions/TransactionDialogs';
import { TransactionsHeroHeader } from '@/components/dashboard/transactions/TransactionsHeroHeader';
import { TransactionInsightsBar } from '@/components/dashboard/transactions/TransactionInsightsBar';
import { transactionSchema, transferSchema, validateForm } from '@/lib/validationSchemas';
import { coachToast } from '@/lib/coachToast';
import { showApiError } from '@/lib/apiError';
import { sumIncome, sumExpense } from '@/lib/transactionMath';

const PAGE_SIZE = 20;
type SortField = 'date' | 'amount' | 'description';
type SortOrder = 'asc' | 'desc';


const TransactionsPage = () => {
  const { user } = useAuth();
  const { locale } = useLanguage();
  const { fmt: fmtCurrency, currency } = useProfile();
  const { limits, isPremium, isPaid, canExportAdvanced, canUseAISuggestions } = useSubscription();
  const t = dashT[locale];
  const [searchParams, setSearchParams] = useSearchParams();
  const { invalidate } = useInvalidate();

  // Local UI state — persisted per user so filters survive navigation.
  const [filterType, setFilterType] = usePersistedState<string>('tx:filterType', searchParams.get('type') || 'all');
  const [filterCategory, setFilterCategory] = usePersistedState<string>('tx:filterCategory', 'all');
  const [filterAccount, setFilterAccount] = usePersistedState<string>('tx:filterAccount', 'all');
  const [searchQuery, setSearchQuery] = usePersistedState<string>('tx:search', searchParams.get('q') || '');
  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);
  const [startDate, setStartDate] = usePersistedState<string>('tx:startDate', '');
  const [endDate, setEndDate] = usePersistedState<string>('tx:endDate', '');
  const [page, setPage] = usePersistedState<number>('tx:page', 0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkModifyOpen, setBulkModifyOpen] = useState(false);
  const [bulkModifyForm, setBulkModifyForm] = useState({ category_id: '', account_id: '' });
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ description: '', amount: '', type: 'expense', category_id: '', account_id: '', date: new Date().toISOString().split('T')[0], notes: '', family_category_id: '', from_account_id: '', to_account_id: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sortField, setSortField] = usePersistedState<SortField>('tx:sortField', 'date');
  const [sortOrder, setSortOrder] = usePersistedState<SortOrder>('tx:sortOrder', 'desc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();
  const [budgetOverspendOpen, setBudgetOverspendOpen] = useState(false);
  const [overspendBudgetName, setOverspendBudgetName] = useState('');
  const [hideTransfers, setHideTransfers] = usePersistedState<boolean>('tx:hideTransfers', false);
  const [filtersSheetOpen, setFiltersSheetOpen] = useState(false);

  // Server-side paginated transactions
  const { data: paginatedResult, isLoading: txLoading, isFetching: txFetching } = usePaginatedTransactions({
    page,
    pageSize: PAGE_SIZE,
    type: filterType !== 'all' ? filterType : undefined,
    categoryId: filterCategory !== 'all' ? filterCategory : undefined,
    accountId: filterAccount !== 'all' ? filterAccount : undefined,
    search: debouncedSearch || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    sortField,
    sortOrder,
  });

  const [privacyFilter, setPrivacyFilter] = usePersistedState<'all' | 'family' | 'private'>('tx:privacy', 'all');
  const rawTransactions = paginatedResult?.data ?? [];
  const transactions = useMemo(() => {
    let list = rawTransactions;
    if (hideTransfers) list = list.filter(tx => !tx.linked_transfer_id);
    if (privacyFilter === 'family') list = list.filter(tx => !!tx.family_category_id);
    else if (privacyFilter === 'private') list = list.filter(tx => !tx.family_category_id);
    return list;
  }, [rawTransactions, hideTransfers, privacyFilter]);
  const totalCount = paginatedResult?.totalCount ?? 0;
  const totalPages = paginatedResult?.totalPages ?? 1;

  const pageTotals = useMemo(() => {
    const inc = sumIncome(transactions as any);
    const exp = sumExpense(transactions as any);
    return { income: inc, expense: exp, net: inc - exp };
  }, [transactions]);

  const { data: categories = [], isLoading: catLoading } = useCategories();
  const { data: accounts = [], isLoading: accLoading } = useAccounts();
  const { data: budgets = [] } = useBudgets();
  const { data: savingsGoals = [] } = useSavingsGoals();

  // Lightweight count query for this month's transactions (limit checking)
  const monthStart = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  }, []);

  const { data: thisMonthCount = 0 } = useQuery({
    queryKey: ['tx-month-count', user?.id, monthStart],
    queryFn: async () => {
      // Must mirror the backend trigger `enforce_free_plan_monthly_limit`:
      // count by `created_at` (not user-picked `date`) and exclude soft-deleted rows.
      const { count, error } = await supabase
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user!.id)
        .is('deleted_at', null)
        .gte('created_at', monthStart);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!user,
    staleTime: 10_000,
  });

  // Lightweight description suggestions query (last 200 unique descriptions)
  const { data: recentDescriptions = [] } = useQuery({
    queryKey: ['tx-descriptions', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('description, category_id, account_id, amount')
        .eq('user_id', user!.id)
        .order('date', { ascending: false })
        .limit(500);
      if (error) throw error;
      const seen = new Set<string>();
      return (data ?? []).filter(tx => {
        const key = tx.description.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).slice(0, 200);
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const loading = txLoading || catLoading || accLoading;

  const fmt = (n: number) => fmtCurrency(n, locale);

  // Quick-Add hand-off from Dashboard: ?quickAdd=1&description=…&amount=…&type=…&category_id=…&account_id=…
  // (or &from_account_id / &to_account_id for transfers).
  // We wait until categories + accounts are loaded so the form has valid fallbacks.
  const quickAddHandledRef = useRef(false);
  useEffect(() => {
    if (quickAddHandledRef.current) return;
    if (searchParams.get('quickAdd') !== '1') return;
    if (catLoading || accLoading) return;

    quickAddHandledRef.current = true;
    const description = searchParams.get('description') || '';
    const amountStr = searchParams.get('amount') || '';
    const type = (searchParams.get('type') as 'expense' | 'income' | 'transfer') || 'expense';
    const amountNum = Number(amountStr);

    if (type === 'transfer') {
      if (accounts.length < 2) {
        toast.error(locale === 'fr' ? 'Crée au moins 2 comptes pour transférer' : 'Create at least 2 accounts to transfer');
      } else {
        const fromId = searchParams.get('from_account_id') || accounts[0]?.id;
        const toId = searchParams.get('to_account_id') || accounts.find(a => a.id !== fromId)?.id;
        setEditing(null);
        setErrors({});
        setForm({
          description,
          amount: Number.isFinite(amountNum) ? String(amountNum) : '',
          type: 'transfer',
          category_id: '',
          account_id: '',
          date: new Date().toISOString().split('T')[0],
          notes: '',
          family_category_id: '',
          from_account_id: fromId || '',
          to_account_id: toId || '',
        });
        setDialogOpen(true);
      }
    } else {
      const catParam = searchParams.get('category_id') || '';
      const accParam = searchParams.get('account_id') || '';
      const fallbackCatId = (categories.find((c: any) => c.type === type)?.id) || categories[0]?.id || '';
      setEditing(null);
      setErrors({});
      setForm({
        description,
        amount: Number.isFinite(amountNum) ? String(amountNum) : '',
        type,
        category_id: catParam || fallbackCatId,
        account_id: accParam || accounts[0]?.id || '',
        date: new Date().toISOString().split('T')[0],
        notes: '',
        family_category_id: '',
        from_account_id: '',
        to_account_id: '',
      });
      setDialogOpen(true);
    }

    // Strip the quickAdd params from the URL so a refresh doesn't reopen the dialog.
    const next = new URLSearchParams(searchParams);
    ['quickAdd', 'description', 'amount', 'type', 'category_id', 'account_id', 'from_account_id', 'to_account_id']
      .forEach(k => next.delete(k));
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, catLoading, accLoading, categories, accounts, locale]);

  const refreshData = () => {
    // Invalidation large : chaque saisie/édition/suppression peut impacter
    // soldes, budgets, épargnes, rapports et alertes calculées client-side.
    invalidate(
      'paginated-transactions', 'accounts', 'chart-data', 'transactions',
      'all-transactions', 'account-transactions', 'account-theoretical-balances',
      'budget-spending', 'budget-annual-spending', 'category-tx-counts',
      'tx-month-count', 'tx-descriptions', 'reports-data', 'forecast-raw-tx',
      'savings-page-data', 'savings-goals',
    );
  };

  // Debounced search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [searchQuery]);

  const hasActiveFilters = filterType !== 'all' || filterCategory !== 'all' || filterAccount !== 'all' || debouncedSearch || startDate || endDate;

  const clearFilters = () => {
    setFilterType('all'); setFilterCategory('all'); setFilterAccount('all');
    setSearchQuery(''); setDebouncedSearch(''); setStartDate(''); setEndDate('');
  };

  // Reset page on filter change
  useEffect(() => { setPage(0); }, [filterType, filterCategory, filterAccount, debouncedSearch, startDate, endDate]);
  useEffect(() => { setSelectedIds(new Set()); }, [filterType, filterCategory, filterAccount, debouncedSearch, startDate, endDate, page]);

  const limitReached = !isPremium && thisMonthCount >= limits.transactionsPerMonth;
  const transferQuota = useMemo(
    () => getTransferQuotaState(thisMonthCount, limits.transactionsPerMonth),
    [thisMonthCount, limits.transactionsPerMonth]
  );
  const transferLimitMessage = t.transferNeedsTwoSlotsToast(
    transferQuota.remainingBeforeLimit,
    transferQuota.transferCost,
    limits.transactionsPerMonth,
  );

  // Régularisation / Adjustment categories (auto-created by ReconciliationDialog)
  const regularizationCategoryIds = useMemo(
    () => categories
      .filter(c => {
        const n = c.name.toLowerCase();
        return n.includes('régularisation') || n.includes('regularisation') || n.includes('adjustment');
      })
      .map(c => c.id),
    [categories]
  );

  const allPageSelected = transactions.length > 0 && transactions.every(tx => selectedIds.has(tx.id));
  const someSelected = selectedIds.size > 0;

  const toggleSelectAll = () => {
    if (allPageSelected) {
      const next = new Set(selectedIds);
      transactions.forEach(tx => next.delete(tx.id));
      setSelectedIds(next);
    } else {
      const next = new Set(selectedIds);
      transactions.forEach(tx => next.add(tx.id));
      setSelectedIds(next);
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const handleExportSelection = (format: 'csv' | 'excel') => {
    if (!canExportAdvanced) { toast.error(t.upgradeExport); return; }
    const selectedTxs = transactions.filter(tx => selectedIds.has(tx.id));
    const data = selectedTxs.map(tx => ({
      [t.date]: tx.date, [t.description]: tx.description,
      [t.type]: tx.type === 'income' ? t.incomeType : tx.type === 'transfer' ? (t.transfer || 'Transfert') : t.expenseType,
      [t.amount]: tx.amount,
      [t.category]: tx.categories?.name || '-',
      [t.account]: tx.payment_accounts?.name || '-',
      [t.notes]: tx.notes || '',
    }));
    const ok = format === 'csv' ? exportToCSV(data, 'transactions-selection') : exportToExcel(data, 'transactions-selection');
    if (ok) toast.success(t.saved); else toast.error(t.noResults);
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    // Collect affected account IDs before deleting
    const affectedAccountIds = new Set<string>();
    ids.forEach(id => { const tx = transactions.find(t => t.id === id); if (tx?.account_id) affectedAccountIds.add(tx.account_id); });
    
    const { error } = await supabase.from('transactions').delete().in('id', ids);
    if (error) { showApiError(error, locale); setBulkDeleteOpen(false); return; }
    setSelectedIds(new Set());
    setBulkDeleteOpen(false);
    refreshData();
    coachToast.saved(t.bulkDeleted(ids.length));
  };

  const handleBulkModify = async () => {
    const ids = Array.from(selectedIds);
    const updates: Record<string, any> = {};
    if (bulkModifyForm.category_id) updates.category_id = bulkModifyForm.category_id;
    if (bulkModifyForm.account_id) updates.account_id = bulkModifyForm.account_id;
    if (Object.keys(updates).length === 0) { toast.error(t.noChange); return; }
    const { error } = await supabase.from('transactions').update(updates as any).in('id', ids);
    if (error) { showApiError(error, locale); return; }
    if (updates.account_id) {
      const affectedAccounts = new Set<string>();
      ids.forEach(id => { const tx = transactions.find(t => t.id === id); if (tx?.account_id) affectedAccounts.add(tx.account_id); });
      affectedAccounts.add(updates.account_id);
      for (const accId of affectedAccounts) await supabase.rpc('recalculate_account_balance', { p_account_id: accId });
    }
    setBulkModifyOpen(false); setBulkModifyForm({ category_id: '', account_id: '' });
    setSelectedIds(new Set()); refreshData();
    coachToast.saved(t.bulkModified(ids.length));
  };

  const handleBulkDuplicate = async () => {
    if (!user) return;
    const selectedTxs = transactions.filter(tx => selectedIds.has(tx.id));
    const inserts = selectedTxs.map(tx => ({
      user_id: user.id, description: tx.description, amount: Number(tx.amount),
      type: tx.type, category_id: tx.category_id, account_id: tx.account_id,
      date: new Date().toISOString().split('T')[0], notes: tx.notes,
    }));
    const { error } = await supabase.from('transactions').insert(inserts);
    if (error) { showApiError(error, locale); return; }
    setSelectedIds(new Set()); refreshData();
    coachToast.saved(t.bulkDuplicated(inserts.length));
  };

  const handleDuplicateOne = async (tx: typeof transactions[number]) => {
    if (!user || tx.linked_transfer_id) return;
    const { error } = await supabase.from('transactions').insert({
      user_id: user.id, description: tx.description, amount: Number(tx.amount),
      type: tx.type, category_id: tx.category_id, account_id: tx.account_id,
      date: new Date().toISOString().split('T')[0], notes: tx.notes,
    });
    if (error) { showApiError(error, locale); return; }
    refreshData();
    coachToast.saved(t.bulkDuplicated(1));
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortOrder('desc'); }
    setPage(0);
  };

  const validate = () => {
    const result = validateForm(transactionSchema(t, locale), form);
    if (result.success === false) { setErrors(result.errors); return false; }
    setErrors({});
    return true;
  };

  const openNew = () => {
    if (limitReached) { toast.error(t.limitTransactionsToast(limits.transactionsPerMonth)); return; }
    setEditing(null); setErrors({});
    setForm({ description: '', amount: '', type: 'expense', category_id: categories[0]?.id || '', account_id: accounts[0]?.id || '', date: new Date().toISOString().split('T')[0], notes: '', family_category_id: '', from_account_id: '', to_account_id: '' });
    setDialogOpen(true);
  };

  const openEdit = (tx: any) => {
    setEditing(tx); setErrors({});
    setForm({ description: tx.description, amount: String(tx.amount), type: tx.type, category_id: tx.category_id || '', account_id: tx.account_id || '', date: tx.date, notes: tx.notes || '', family_category_id: tx.family_category_id || '', from_account_id: '', to_account_id: '' });
    setDialogOpen(true);
  };

  const checkBudgetOverspend = async (): Promise<boolean> => {
    if (!user || form.type !== 'expense' || !form.category_id) return true;
    const { data: budgets } = await supabase
      .from('budgets')
      .select('id, name, amount, period, control_type')
      .eq('user_id', user.id)
      .eq('category_id', form.category_id)
      .eq('budget_type', 'expense')
      .eq('control_type', 'max');
    if (!budgets || budgets.length === 0) return true;

    // Check ALL budgets for this category, not just the first one
    for (const budget of budgets) {
      const now = new Date();
      let sd: string, ed: string;
      if (budget.period === 'weekly') {
        const d = new Date(now); d.setDate(d.getDate() - d.getDay());
        sd = d.toISOString().split('T')[0];
        const e = new Date(d); e.setDate(e.getDate() + 6);
        ed = e.toISOString().split('T')[0];
      } else if (budget.period === 'yearly') {
        sd = `${now.getFullYear()}-01-01`;
        ed = `${now.getFullYear()}-12-31`;
      } else {
        sd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        ed = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${lastDay}`;
      }

      const { data: spentData } = await supabase.rpc('get_budget_spending', {
        p_user_id: user.id, p_category_id: form.category_id, p_type: 'expense',
        p_start_date: sd, p_end_date: ed,
      });
      const spent = Number(spentData) || 0;
      const newTotal = spent + Number(form.amount);

      if (newTotal > Number(budget.amount)) {
        setOverspendBudgetName(budget.name);
        setBudgetOverspendOpen(true);
        return false;
      }
    }
    return true;
  };

  const handleSave = async () => {
    if (!user) return;
    if (form.type === 'transfer') { await handleTransferSubmit(); return; }
    if (!validate()) return;
    setSaving(true);
    const payload = {
      user_id: user.id, description: form.description.trim(), amount: Number(form.amount),
      type: form.type, category_id: form.category_id || null, account_id: form.account_id || null,
      date: form.date, notes: form.notes.trim() || null,
      family_category_id: form.family_category_id || null,
    };

    if (!editing && form.type === 'expense') {
      const canProceed = await checkBudgetOverspend();
      if (!canProceed) { setSaving(false); return; }
    }

    if (editing) {
      const { error } = await supabase.from('transactions').update(payload).eq('id', editing.id);
      if (error) { showApiError(error, locale); setSaving(false); return; }
    } else {
      const { error } = await supabase.from('transactions').insert(payload);
      if (error) { showApiError(error, locale); setSaving(false); return; }
    }
    setSaving(false);
    setDialogOpen(false);
    refreshData();
    coachToast.money(locale === 'fr' ? 'Transaction enregistrée 💸' : 'Transaction saved 💸');
  };

  const handleForceOverspend = async () => {
    setBudgetOverspendOpen(false);
    if (!user) return;
    setSaving(true);
    const payload = {
      user_id: user.id, description: form.description.trim(), amount: Number(form.amount),
      type: form.type, category_id: form.category_id || null, account_id: form.account_id || null,
      date: form.date, notes: form.notes.trim() ? form.notes.trim() + ' [Dépassement volontaire]' : '[Dépassement volontaire]',
      family_category_id: form.family_category_id || null,
    };
    const { error } = await supabase.from('transactions').insert(payload);
    if (error) { showApiError(error, locale); setSaving(false); return; }
    setSaving(false);
    setDialogOpen(false);
    refreshData();
    coachToast.warn(locale === 'fr' ? 'Dépassement enregistré' : 'Overspend recorded');
  };

  const handleTransferSubmit = async () => {
    if (!user) return;
    const result = validateForm(transferSchema(t, locale), {
      description: form.description,
      amount: form.amount,
      date: form.date,
      from_account_id: form.from_account_id,
      to_account_id: form.to_account_id,
      notes: form.notes,
    });
    if (result.success === false) { setErrors(result.errors); return; }
    setErrors({});
    const amt = Number(form.amount);
    setSaving(true);
    try {
      const trimmedDesc = (form.description ?? '').trim();
      const { error } = await supabase.rpc('perform_transfer', {
        p_user_id: user.id,
        p_from_account_id: form.from_account_id,
        p_to_account_id: form.to_account_id,
        p_amount: amt,
        p_description: trimmedDesc.length > 0 ? trimmedDesc : null,
      });
      if (error) throw error;
      setDialogOpen(false);
      refreshData();
      coachToast.money(t.transferSuccess);
    } catch (err: any) {
      showApiError(err, locale);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from('transactions').delete().eq('id', deleteId);
    if (error) { showApiError(error, locale); setDeleteId(null); return; }
    setDeleteId(null);
    refreshData();
    coachToast.saved(locale === 'fr' ? 'Transaction supprimée' : 'Transaction deleted');
  };

  // AI suggest and description suggestions are handled inside TransactionForm component

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between"><Skeleton className="h-8 w-48" /><Skeleton className="h-9 w-40" /></div>
        <div className="flex gap-3"><Skeleton className="h-10 w-40" /><Skeleton className="h-10 w-48" /></div>
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" style={{ animationDelay: `${i * 100}ms` }} />
          ))}
        </div>
      </div>
    );
  }

  const filteredCategories = categories.filter(c => c.type === form.type);
  const isEmpty = totalCount === 0 && !hasActiveFilters;

  const isRegularizationActive = regularizationCategoryIds.length > 0 && regularizationCategoryIds.includes(filterCategory);
  const toggleRegularization = () => {
    if (!regularizationCategoryIds.length) {
      coachToast.remind(locale === 'fr' ? 'Aucune transaction de régularisation pour le moment' : 'No adjustment transactions yet');
      return;
    }
    setFilterCategory(isRegularizationActive ? 'all' : regularizationCategoryIds[0]);
  };

  const activeFilterCount = [
    filterType !== 'all',
    filterCategory !== 'all',
    filterAccount !== 'all',
    !!startDate,
    !!endDate,
    hideTransfers,
    privacyFilter !== 'all',
  ].filter(Boolean).length;

  const advancedActiveCount = [
    filterCategory !== 'all',
    filterAccount !== 'all',
    !!startDate,
    !!endDate,
    hideTransfers,
    privacyFilter !== 'all',
    isRegularizationActive,
  ].filter(Boolean).length;

  return (
    <motion.div
      className="space-y-5"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      <Tabs defaultValue="manage">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.3 }}
        >
          <TabsList className="inline-flex mb-4 p-1 h-auto rounded-xl bg-[hsl(var(--glass))] backdrop-blur-xl border border-[hsl(var(--glass-border))] shadow-sm">
            <TabsTrigger
              value="manage"
              className="rounded-lg gap-1.5 px-4 py-1.5 text-xs font-semibold text-muted-foreground data-[state=active]:text-foreground data-[state=active]:bg-background/80 data-[state=active]:shadow-sm transition-all"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />{t.management}
            </TabsTrigger>
            <TabsTrigger
              value="stats"
              className="rounded-lg gap-1.5 px-4 py-1.5 text-xs font-semibold text-muted-foreground data-[state=active]:text-foreground data-[state=active]:bg-background/80 data-[state=active]:shadow-sm transition-all"
            >
              <BarChart3 className="w-3.5 h-3.5" />{t.transactionsStats}
            </TabsTrigger>
          </TabsList>
        </motion.div>

        <TabsContent value="stats">
          <TransactionsStatsTab />
        </TabsContent>

        <TabsContent value="manage">
          <div className="tx-ivory rounded-3xl border border-border shadow-[var(--shadow-card)] p-4 sm:p-6 lg:p-8 space-y-5">
      {limitReached && <UpgradeBanner message={t.limitReachedTransactions(thisMonthCount, limits.transactionsPerMonth)} />}

      <div className="lg:grid lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-6 space-y-5 lg:space-y-0">
        {/* Sidebar filtres */}
        <aside className="lg:sticky lg:top-4 lg:self-start space-y-4 order-2 lg:order-1">
          <div className="rounded-2xl border border-border bg-card shadow-[var(--shadow-card)] overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                {locale === 'fr' ? 'Filtres' : 'Filters'}
              </p>
              <h3 className="font-heading text-lg font-bold text-foreground mt-1">
                {locale === 'fr' ? 'Affiner la vue' : 'Refine view'}
              </h3>
            </div>
            <div id="tx-ivory-filters" className="p-4">
              {/* placeholder — the Filters block below is portalled visually via CSS grid ordering */}
            </div>
          </div>
        </aside>

        {/* Zone principale */}
        <div className="min-w-0 space-y-5 order-1 lg:order-2">
      {/* Hero Header — premium */}
      <TransactionsHeroHeader
        userId={user?.id}
        fmt={fmt}
        locale={locale as 'fr' | 'en'}
        t={t}
        onAddNew={openNew}
        onTransfer={() => {
          if (!transferQuota.canCreateTransfer) { toast.error(transferLimitMessage); return; }
          if (accounts.length < 2) { toast.error(locale === 'fr' ? 'Crée au moins 2 comptes pour transférer' : 'Create at least 2 accounts to transfer'); return; }
          setEditing(null);
          setErrors({});
          setForm({
            description: '', amount: '', type: 'transfer',
            category_id: '', account_id: '',
            date: new Date().toISOString().split('T')[0], notes: '', family_category_id: '',
            from_account_id: accounts[0]?.id || '',
            to_account_id: accounts.find(a => a.id !== accounts[0]?.id)?.id || '',
          });
          setDialogOpen(true);
        }}
        canTransfer={accounts.length >= 2 && transferQuota.canCreateTransfer}
        limitReached={limitReached}
        transferDisabledReason={
          accounts.length < 2
            ? (locale === 'fr' ? 'Crée au moins 2 comptes pour transférer' : 'Create at least 2 accounts to transfer')
            : transferLimitMessage
        }
        thisMonthCount={thisMonthCount}
        monthlyLimit={limits.transactionsPerMonth}
        isPremium={isPremium}
        canUseAI={canUseAISuggestions}
        onQuickAdd={(parsed) => {
          if (parsed.type === 'transfer' && !transferQuota.canCreateTransfer) { toast.error(transferLimitMessage); return; }
          if (limitReached) { toast.error(t.limitTransactionsToast(limits.transactionsPerMonth)); return; }
          setEditing(null);
          setErrors({});
          if (parsed.type === 'transfer') {
            if (accounts.length < 2) { toast.error(locale === 'fr' ? 'Crée au moins 2 comptes pour transférer' : 'Create at least 2 accounts to transfer'); return; }
            const fromId = parsed.from_account_id || accounts[0]?.id || '';
            const toId = parsed.to_account_id || accounts.find(a => a.id !== fromId)?.id || '';
            setForm({
              description: parsed.description || '',
              amount: parsed.amount != null ? String(parsed.amount) : '',
              type: 'transfer',
              category_id: '', account_id: '',
              date: new Date().toISOString().split('T')[0], notes: '', family_category_id: '',
              from_account_id: fromId, to_account_id: toId,
            });
            setDialogOpen(true);
            return;
          }
          const fallbackCatId = (categories.find((c: any) => c.type === parsed.type)?.id) || categories[0]?.id || '';
          setForm({
            description: parsed.description || '',
            amount: parsed.amount != null ? String(parsed.amount) : '',
            type: parsed.type || 'expense',
            category_id: parsed.category_id || fallbackCatId,
            account_id: parsed.account_id || accounts[0]?.id || '',
            date: new Date().toISOString().split('T')[0],
            notes: '',
            family_category_id: '',
            from_account_id: '', to_account_id: '',
          });
          setDialogOpen(true);
        }}
      />

      {/* Coach insights chips */}
      <TransactionInsightsBar
        userId={user?.id}
        fmt={fmt}
        locale={locale as 'fr' | 'en'}
        categories={categories as any}
      />

      {/* Filters */}
      <motion.div
        id="tx-filters-block"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.3 }}
        className="lg:hidden"
      >
        <Card className="border border-border/40 rounded-2xl bg-card/80 backdrop-blur-sm overflow-hidden">
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                {/* Search with enhanced animation */}
                <div className="relative flex-1 min-w-[200px] group">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors duration-300" />
                  <Input
                    placeholder={t.search + '...'}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-10 pr-9 rounded-xl h-10 bg-background/60 border-border/40 transition-all duration-300 focus:bg-background focus:border-primary/40 focus:shadow-[0_0_0_3px_hsl(var(--primary)/0.08)] hover:border-border/60 hover:bg-background/80 text-sm"
                  />
                  <AnimatePresence>
                    {searchQuery && (
                      <motion.button
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.5 }}
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded-full hover:bg-muted/50"
                      >
                        <X className="w-3.5 h-3.5" />
                      </motion.button>
                    )}
                  </AnimatePresence>
                </div>

                {/* Type filter pills */}
                <div className="flex gap-1 p-0.5 bg-muted/40 rounded-xl">
                  {[
                    { value: 'all', label: t.all, icon: null },
                    { value: 'income', label: t.incomeType, icon: <TrendingUp className="w-3.5 h-3.5" /> },
                    { value: 'expense', label: t.expenseType, icon: <TrendingDown className="w-3.5 h-3.5" /> },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setFilterType(opt.value)}
                      className={`relative flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                        filterType === opt.value
                          ? 'text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {filterType === opt.value && (
                        <motion.div
                          layoutId="typeFilter"
                          className="absolute inset-0 bg-background rounded-lg shadow-sm border border-border/50"
                          transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }}
                        />
                      )}
                      <span className="relative flex items-center gap-1">
                        {opt.icon}
                        <span className="hidden sm:inline">{opt.label}</span>
                      </span>
                    </button>
                  ))}
                </div>

                {/* Advanced filters trigger */}
                <Sheet open={filtersSheetOpen} onOpenChange={setFiltersSheetOpen}>
                  <SheetTrigger asChild>
                    <Button
                      variant="outline"
                      className={`h-10 rounded-xl text-xs gap-1.5 border-border/40 bg-background/60 hover:bg-background/80 transition-all duration-200 font-medium ${advancedActiveCount > 0 ? 'border-primary/40 bg-primary/5 text-primary' : ''}`}
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">{locale === 'fr' ? 'Filtres avancés' : 'Advanced filters'}</span>
                      {advancedActiveCount > 0 && (
                        <span className="ml-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold bg-primary text-primary-foreground inline-flex items-center justify-center">
                          {advancedActiveCount}
                        </span>
                      )}
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
                    <SheetHeader>
                      <SheetTitle>{locale === 'fr' ? 'Filtres avancés' : 'Advanced filters'}</SheetTitle>
                      <SheetDescription>
                        {locale === 'fr' ? 'Affinez la liste avec des filtres additionnels.' : 'Refine the list with additional filters.'}
                      </SheetDescription>
                    </SheetHeader>

                    <div className="mt-6 space-y-6">
                      {/* Category */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                            <Tag className="w-3 h-3" /> {t.category}
                          </label>
                          {filterCategory !== 'all' && (
                            <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 text-muted-foreground hover:text-destructive" onClick={() => setFilterCategory('all')}>
                              <X className="w-3 h-3 mr-0.5" />{locale === 'fr' ? 'Réinitialiser' : 'Reset'}
                            </Button>
                          )}
                        </div>
                        <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={`w-full h-10 rounded-xl text-xs gap-1.5 border-border/40 bg-background/60 hover:bg-background/80 transition-all duration-200 justify-start font-medium ${filterCategory !== 'all' ? 'border-primary/30 bg-primary/5 text-primary' : ''}`}>
                      <Tag className="w-3.5 h-3.5" />
                      {filterCategory !== 'all'
                        ? (() => { const cat = categories.find(c => c.id === filterCategory); return cat ? `${cat.icon} ${cat.name}` : t.category; })()
                        : (locale === 'fr' ? 'Toutes les catégories' : 'All categories')
                      }
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-0 rounded-xl overflow-hidden" align="start">
                    <div className="p-3 border-b border-border/50 bg-muted/30">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-muted-foreground">{locale === 'fr' ? 'Filtrer par catégorie' : 'Filter by category'}</span>
                        {filterCategory !== 'all' && (
                          <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 text-muted-foreground hover:text-destructive" onClick={() => setFilterCategory('all')}>
                            <X className="w-3 h-3 mr-0.5" />{locale === 'fr' ? 'Réinitialiser' : 'Reset'}
                          </Button>
                        )}
                      </div>
                    </div>
                    <ScrollArea className="h-72">
                      <div className="p-2">
                        <button
                          onClick={() => setFilterCategory('all')}
                          className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 ${filterCategory === 'all' ? 'bg-primary/10 text-primary font-semibold shadow-sm' : 'hover:bg-muted/50'}`}
                        >
                          <span className="text-base">📋</span>
                          <span>{t.all} {t.category}</span>
                        </button>

                        {categories.filter(c => c.type === 'income').length > 0 && (
                          <>
                            <div className="px-3 py-2 mt-3 text-[10px] font-bold uppercase tracking-wider text-secondary flex items-center gap-1.5">
                              <TrendingUp className="w-3 h-3" /> {t.incomeType}
                            </div>
                            {categories.filter(c => c.type === 'income').map(c => (
                              <button
                                key={c.id}
                                onClick={() => setFilterCategory(filterCategory === c.id ? 'all' : c.id)}
                                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 ${filterCategory === c.id ? 'bg-primary/10 text-primary font-semibold shadow-sm' : 'hover:bg-muted/50'}`}
                              >
                                <span className="text-base">{c.icon}</span>
                                <span className="truncate">{c.name}</span>
                              </button>
                            ))}
                          </>
                        )}

                        {categories.filter(c => c.type === 'expense').length > 0 && (
                          <>
                            <div className="px-3 py-2 mt-3 text-[10px] font-bold uppercase tracking-wider text-destructive flex items-center gap-1.5">
                              <TrendingDown className="w-3 h-3" /> {t.expenseType}
                            </div>
                            {categories.filter(c => c.type === 'expense').map(c => (
                              <button
                                key={c.id}
                                onClick={() => setFilterCategory(filterCategory === c.id ? 'all' : c.id)}
                                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 ${filterCategory === c.id ? 'bg-primary/10 text-primary font-semibold shadow-sm' : 'hover:bg-muted/50'}`}
                              >
                                <span className="text-base">{c.icon}</span>
                                <span className="truncate">{c.name}</span>
                              </button>
                            ))}
                          </>
                        )}
                      </div>
                    </ScrollArea>
                  </PopoverContent>
                </Popover>
                        <button
                          type="button"
                          onClick={toggleRegularization}
                          className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs border transition-all duration-200 ${
                            isRegularizationActive
                              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/40'
                              : 'bg-background/60 text-muted-foreground border-border/40 hover:border-amber-500/30 hover:text-amber-600 dark:hover:text-amber-400'
                          }`}
                        >
                          <span className="flex items-center gap-1.5">
                            <Scale className="w-3.5 h-3.5" />
                            {locale === 'fr' ? 'Uniquement les régularisations' : 'Only adjustments'}
                          </span>
                          {isRegularizationActive && <X className="w-3 h-3 opacity-70" />}
                        </button>
                      </div>

                      {/* Account */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                            <CreditCard className="w-3 h-3" /> {t.account}
                          </label>
                          {filterAccount !== 'all' && (
                            <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 text-muted-foreground hover:text-destructive" onClick={() => setFilterAccount('all')}>
                              <X className="w-3 h-3 mr-0.5" />{locale === 'fr' ? 'Réinitialiser' : 'Reset'}
                            </Button>
                          )}
                        </div>
                        <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={`w-full h-10 rounded-xl text-xs gap-1.5 border-border/40 bg-background/60 hover:bg-background/80 transition-all duration-200 justify-start font-medium ${filterAccount !== 'all' ? 'border-primary/30 bg-primary/5 text-primary' : ''}`}>
                      <CreditCard className="w-3.5 h-3.5" />
                      {filterAccount !== 'all'
                        ? (() => { const acc = accounts.find(a => a.id === filterAccount); return acc ? `${acc.icon} ${acc.name}` : t.allAccounts; })()
                        : t.allAccounts
                      }
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-0 rounded-xl overflow-hidden" align="start">
                    <div className="p-3 border-b border-border/50 bg-muted/30">
                      <span className="text-xs font-semibold text-muted-foreground">{locale === 'fr' ? 'Filtrer par compte' : 'Filter by account'}</span>
                    </div>
                    <ScrollArea className="h-64">
                      <div className="p-2">
                        <button
                          onClick={() => setFilterAccount('all')}
                          className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 ${filterAccount === 'all' ? 'bg-primary/10 text-primary font-semibold shadow-sm' : 'hover:bg-muted/50'}`}
                        >
                          <span className="text-base">🏦</span>
                          <span>{t.allAccounts}</span>
                        </button>
                        {accounts.map(a => (
                          <button
                            key={a.id}
                            onClick={() => setFilterAccount(filterAccount === a.id ? 'all' : a.id)}
                            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 ${filterAccount === a.id ? 'bg-primary/10 text-primary font-semibold shadow-sm' : 'hover:bg-muted/50'}`}
                          >
                            <span className="text-base">{a.icon}</span>
                            <span className="truncate">{a.name}</span>
                          </button>
                        ))}
                      </div>
                    </ScrollArea>
                  </PopoverContent>
                </Popover>
                      </div>

                      {/* Visibility toggles */}
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          {locale === 'fr' ? 'Visibilité' : 'Visibility'}
                        </label>
                        <button
                          type="button"
                          onClick={() => setHideTransfers(v => !v)}
                          className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-xs border transition-all duration-200 ${
                            hideTransfers
                              ? 'bg-primary/15 text-primary border-primary/40'
                              : 'bg-background/60 text-muted-foreground border-border/40 hover:border-primary/30 hover:text-primary'
                          }`}
                        >
                          <span className="flex items-center gap-1.5">
                            <ArrowLeftRight className="w-3.5 h-3.5" />
                            {locale === 'fr' ? 'Masquer les transferts' : 'Hide transfers'}
                          </span>
                          {hideTransfers && <X className="w-3 h-3 opacity-70" />}
                        </button>

                        <div className="grid grid-cols-3 gap-1 p-0.5 bg-muted/40 rounded-xl">
                          {[
                            { value: 'all' as const, label: t.all, icon: null },
                            { value: 'family' as const, label: locale === 'fr' ? 'Famille' : 'Family', icon: <Users className="w-3.5 h-3.5" /> },
                            { value: 'private' as const, label: locale === 'fr' ? 'Privées' : 'Private', icon: <Lock className="w-3.5 h-3.5" /> },
                          ].map(opt => (
                            <button
                              key={opt.value}
                              onClick={() => setPrivacyFilter(opt.value)}
                              className={`flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                                privacyFilter === opt.value ? 'bg-background text-foreground shadow-sm border border-border/50' : 'text-muted-foreground hover:text-foreground'
                              }`}
                            >
                              {opt.icon}<span>{opt.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Date range */}
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                          <Calendar className="w-3 h-3" /> {locale === 'fr' ? 'Période' : 'Period'}
                        </label>
                <div className="flex items-center gap-1.5">
                  <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="flex-1 rounded-xl h-9 border-border/40 bg-background/60 hover:bg-background/80 text-xs transition-colors" />
                  <span className="text-xs text-muted-foreground">→</span>
                  <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="flex-1 rounded-xl h-9 border-border/40 bg-background/60 hover:bg-background/80 text-xs transition-colors" />
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 rounded-lg text-[10px] px-2 border-border/40"
                    onClick={() => {
                      const now = new Date();
                      setStartDate(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`);
                      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
                      setEndDate(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${lastDay}`);
                    }}
                  >
                    {t.thisMonth}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 rounded-lg text-[10px] px-2 border-border/40"
                    onClick={() => {
                      const now = new Date();
                      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                      setStartDate(`${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-01`);
                      const lastDay = new Date(prev.getFullYear(), prev.getMonth() + 1, 0).getDate();
                      setEndDate(`${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-${lastDay}`);
                    }}
                  >
                    {t.lastMonth}
                  </Button>
                  {(startDate || endDate) && (
                    <Button variant="ghost" size="sm" className="h-7 rounded-lg text-[10px] px-2 text-muted-foreground hover:text-destructive" onClick={() => { setStartDate(''); setEndDate(''); }}>
                      <X className="w-3 h-3 mr-0.5" />{locale === 'fr' ? 'Effacer' : 'Clear'}
                    </Button>
                  )}
                </div>
                      </div>
                    </div>

                    <SheetFooter className="mt-8 flex-row gap-2 sm:justify-between">
                      <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive gap-1" onClick={clearFilters}>
                        <X className="w-4 h-4" />{t.clearFilters}
                      </Button>
                      <SheetClose asChild>
                        <Button size="sm" className="rounded-xl">
                          {locale === 'fr' ? 'Appliquer' : 'Apply'}
                        </Button>
                      </SheetClose>
                    </SheetFooter>
                  </SheetContent>
                </Sheet>

                {/* Clear all (only when filters active) */}
                <AnimatePresence>
                  {hasActiveFilters && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8, x: -8 }}
                      animate={{ opacity: 1, scale: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.8, x: -8 }}
                    >
                      <Button variant="ghost" size="sm" className="h-10 rounded-xl text-muted-foreground hover:text-destructive gap-1 transition-all text-xs" onClick={clearFilters} title={t.clearFilters}>
                        <X className="w-3.5 h-3.5" />
                        <span className="hidden md:inline">{t.clearFilters}</span>
                      </Button>
                    </motion.div>
                  )}
                </AnimatePresence>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Bulk actions */}
      <AnimatePresence>
        {someSelected && (
          <motion.div
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -10, height: 0 }}
          >
            <BulkActionBar
              count={selectedIds.size}
              onDelete={() => setBulkDeleteOpen(true)}
              onModify={() => { setBulkModifyForm({ category_id: '', account_id: '' }); setBulkModifyOpen(true); }}
              onDuplicate={handleBulkDuplicate}
              onExportCSV={canExportAdvanced ? () => handleExportSelection('csv') : undefined}
              onExportExcel={canExportAdvanced ? () => handleExportSelection('excel') : undefined}
              onClear={() => setSelectedIds(new Set())}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transaction list */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.35 }}
      >
        {/* Unified results + net summary bar (page slice) */}
        {transactions.length > 0 && (
          <div className="mb-2 flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-primary/[0.04] border border-primary/15 backdrop-blur-sm">
            <p className="text-[11px] text-muted-foreground font-medium tabular-nums">
              <span className="text-foreground font-bold">{totalCount}</span> {t.results}
              <span className="text-muted-foreground/50 mx-2">·</span>
              <span className="text-muted-foreground/70">
                {locale === 'fr' ? 'Page' : 'Page'} {page + 1}/{totalPages}
              </span>
            </p>
            <div className="flex items-center gap-4 text-[11px] font-bold tabular-nums">
              <span className="text-secondary">+{fmt(pageTotals.income)}</span>
              <span className="text-destructive">-{fmt(pageTotals.expense)}</span>
              <span className={`pl-4 border-l border-border/40 ${pageTotals.net >= 0 ? 'text-secondary' : 'text-destructive'}`}>
                {locale === 'fr' ? 'Solde' : 'Net'}: {pageTotals.net >= 0 ? '+' : '-'}{fmt(Math.abs(pageTotals.net))}
              </span>
            </div>
          </div>
        )}
        <TransactionList
          transactions={transactions}
          totalCount={totalCount}
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
          allPageSelected={allPageSelected}
          sortField={sortField}
          sortOrder={sortOrder}
          onSort={toggleSort}
          onEdit={openEdit}
          onDelete={(id) => setDeleteId(id)}
          onAddNew={openNew}
          isEmpty={isEmpty}
          fmt={fmt}
          t={t}
          locale={locale}
          isFetching={txFetching && !txLoading}
          onFilterCategory={(id) => { setFilterCategory(id); setPage(0); }}
          onFilterAccount={(id) => { setFilterAccount(id); setPage(0); }}
          onDuplicate={handleDuplicateOne}
        />
      </motion.div>

      {/* Add/Edit Dialog */}
      <TransactionForm
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        form={form}
        setForm={setForm}
        errors={errors}
        saving={saving}
        onSave={handleSave}
        onTransfer={handleTransferSubmit}
        allowTransfer={accounts.length >= 2}
        transferDisabledReason={
          accounts.length < 2
            ? (locale === 'fr' ? 'Crée au moins 2 comptes pour transférer' : 'Create at least 2 accounts to transfer')
            : (!transferQuota.canCreateTransfer ? transferLimitMessage : undefined)
        }
        categories={categories}
        accounts={accounts}
        recentDescriptions={recentDescriptions}
        savingsGoals={savingsGoals}
        budgets={budgets}
        canUseAISuggestions={canUseAISuggestions}
        t={t}
        locale={locale}
        currency={currency}
      />

      <ConfirmDeleteDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)} onConfirm={handleDelete} title={t.confirmDelete} description={t.confirmDeleteMessage} cancelLabel={t.cancel} confirmLabel={t.delete} />
      <ConfirmDeleteDialog open={bulkDeleteOpen} onOpenChange={() => setBulkDeleteOpen(false)} onConfirm={handleBulkDelete} title={t.deleteSelection} description={t.bulkDeleteConfirm(selectedIds.size)} cancelLabel={t.cancel} confirmLabel={t.delete} />

      <BulkModifyDialog
        open={bulkModifyOpen}
        onOpenChange={setBulkModifyOpen}
        categories={categories}
        accounts={accounts}
        form={bulkModifyForm}
        setForm={setBulkModifyForm}
        onApply={handleBulkModify}
        selectedCount={selectedIds.size}
        t={t}
        locale={locale}
      />

      <BudgetOverspendDialog
        open={budgetOverspendOpen}
        onOpenChange={setBudgetOverspendOpen}
        budgetName={overspendBudgetName}
        onConfirm={handleForceOverspend}
        t={t}
        locale={locale}
      />
        </TabsContent>
      </Tabs>
    </motion.div>
  );
};

export default TransactionsPage;
