import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useLanguage } from '@/i18n/LanguageContext';
import { useSubscription } from '@/hooks/useSubscription';
import { dashT } from '@/i18n/dashTranslations';
import { supabase } from '@/integrations/supabase/client';
import { usePaginatedTransactions, useCategories, useAccounts, useInvalidate, type Transaction } from '@/hooks/useDashboardData';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ResponsiveFormDialog } from '@/components/ui/responsive-form-dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, Search, ChevronLeft, ChevronRight, Inbox, TrendingUp, TrendingDown, Calendar, FileText, CreditCard, Tag, ArrowUpDown, Download, X, Sparkles, ArrowLeftRight, AlertTriangle, BarChart3, Loader2, Filter, Clock } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import TransactionsStatsTab from '@/components/dashboard/tabs/TransactionsStatsTab';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import ConfirmDeleteDialog from '@/components/dashboard/ConfirmDeleteDialog';
import UpgradeBanner from '@/components/dashboard/UpgradeBanner';
import BulkActionBar from '@/components/dashboard/BulkActionBar';
import { useSearchParams } from 'react-router-dom';
import { exportToCSV, exportToExcel } from '@/lib/export';
import { TransferDialog } from '@/components/dashboard/TransferDialog';
import { CategoryCombobox } from '@/components/dashboard/CategoryCombobox';
import { AccountCombobox } from '@/components/dashboard/AccountCombobox';
import { motion, AnimatePresence } from 'framer-motion';

const PAGE_SIZE = 20;
type SortField = 'date' | 'amount' | 'description';
type SortOrder = 'asc' | 'desc';

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.04 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 8, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.25, ease: 'easeOut' as const } },
  exit: { opacity: 0, x: -20, transition: { duration: 0.2 } },
};

const fadeScale = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1, transition: { duration: 0.3 } },
  exit: { opacity: 0, scale: 0.95, transition: { duration: 0.2 } },
};

const TransactionsPage = () => {
  const { user } = useAuth();
  const { locale } = useLanguage();
  const { fmt: fmtCurrency } = useProfile();
  const { limits, isPremium, isPaid, canExportAdvanced, canUseAISuggestions } = useSubscription();
  const t = dashT[locale];
  const [searchParams] = useSearchParams();
  const { invalidate } = useInvalidate();

  // Local UI state
  const [filterType, setFilterType] = useState<string>(searchParams.get('type') || 'all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterAccount, setFilterAccount] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkModifyOpen, setBulkModifyOpen] = useState(false);
  const [bulkModifyForm, setBulkModifyForm] = useState({ category_id: '', account_id: '' });
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ description: '', amount: '', type: 'expense', category_id: '', account_id: '', date: new Date().toISOString().split('T')[0], notes: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [aiSuggesting, setAiSuggesting] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();
  const [transferOpen, setTransferOpen] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [budgetOverspendOpen, setBudgetOverspendOpen] = useState(false);
  const [overspendBudgetName, setOverspendBudgetName] = useState('');

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

  const transactions = paginatedResult?.data ?? [];
  const totalCount = paginatedResult?.totalCount ?? 0;
  const totalPages = paginatedResult?.totalPages ?? 1;

  const { data: categories = [], isLoading: catLoading } = useCategories();
  const { data: accounts = [], isLoading: accLoading } = useAccounts();

  // Lightweight count query for this month's transactions (limit checking)
  const monthStart = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  }, []);

  const { data: thisMonthCount = 0 } = useQuery({
    queryKey: ['tx-month-count', user?.id, monthStart],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user!.id)
        .gte('date', monthStart);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!user,
    staleTime: 30_000,
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

  const refreshData = () => {
    invalidate('paginated-transactions', 'accounts', 'chart-data', 'transactions', 'all-transactions', 'budget-spending', 'category-tx-counts');
    invalidate('tx-month-count', 'tx-descriptions');
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
      [t.type]: tx.type === 'income' ? t.incomeType : t.expenseType,
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
    const { error } = await supabase.from('transactions').delete().in('id', ids);
    if (error) { toast.error(error.message); setBulkDeleteOpen(false); return; }
    setSelectedIds(new Set());
    setBulkDeleteOpen(false);
    refreshData();
    toast.success(t.bulkDeleted(ids.length));
  };

  const handleBulkModify = async () => {
    const ids = Array.from(selectedIds);
    const updates: Record<string, any> = {};
    if (bulkModifyForm.category_id) updates.category_id = bulkModifyForm.category_id;
    if (bulkModifyForm.account_id) updates.account_id = bulkModifyForm.account_id;
    if (Object.keys(updates).length === 0) { toast.error(t.noChange); return; }
    const { error } = await supabase.from('transactions').update(updates).in('id', ids);
    if (error) { toast.error(error.message); return; }
    if (updates.account_id) {
      const affectedAccounts = new Set<string>();
      ids.forEach(id => { const tx = transactions.find(t => t.id === id); if (tx?.account_id) affectedAccounts.add(tx.account_id); });
      affectedAccounts.add(updates.account_id);
      for (const accId of affectedAccounts) await supabase.rpc('recalculate_account_balance', { p_account_id: accId });
    }
    setBulkModifyOpen(false); setBulkModifyForm({ category_id: '', account_id: '' });
    setSelectedIds(new Set()); refreshData();
    toast.success(t.bulkModified(ids.length));
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
    if (error) { toast.error(error.message); return; }
    setSelectedIds(new Set()); refreshData();
    toast.success(t.bulkDuplicated(inserts.length));
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortOrder('desc'); }
    setPage(0);
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.description.trim()) errs.description = t.descriptionRequired;
    if (form.description.trim().length > 200) errs.description = t.maxChars(200);
    if (!form.amount || Number(form.amount) <= 0) errs.amount = t.invalidAmount;
    if (Number(form.amount) > 999999999) errs.amount = t.amountTooHigh;
    if (!form.date) errs.date = t.dateRequired;
    if (form.notes && form.notes.length > 500) errs.notes = t.maxChars(500);
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const openNew = () => {
    if (limitReached) { toast.error(t.limitTransactionsToast(limits.transactionsPerMonth)); return; }
    setEditing(null); setErrors({});
    setForm({ description: '', amount: '', type: 'expense', category_id: categories[0]?.id || '', account_id: accounts[0]?.id || '', date: new Date().toISOString().split('T')[0], notes: '' });
    setDialogOpen(true);
  };

  const openEdit = (tx: any) => {
    setEditing(tx); setErrors({});
    setForm({ description: tx.description, amount: String(tx.amount), type: tx.type, category_id: tx.category_id || '', account_id: tx.account_id || '', date: tx.date, notes: tx.notes || '' });
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

    const budget = budgets[0];
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
    return true;
  };

  const handleSave = async () => {
    if (!user || !validate()) return;
    setSaving(true);
    const payload = {
      user_id: user.id, description: form.description.trim(), amount: Number(form.amount),
      type: form.type, category_id: form.category_id || null, account_id: form.account_id || null,
      date: form.date, notes: form.notes.trim() || null,
    };

    if (!editing && form.type === 'expense') {
      const canProceed = await checkBudgetOverspend();
      if (!canProceed) { setSaving(false); return; }
    }

    if (editing) {
      const { error } = await supabase.from('transactions').update(payload).eq('id', editing.id);
      if (error) { toast.error(error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase.from('transactions').insert(payload);
      if (error) { toast.error(error.message); setSaving(false); return; }
    }
    setSaving(false);
    setDialogOpen(false);
    refreshData();
    toast.success(t.saved);
  };

  const handleForceOverspend = async () => {
    setBudgetOverspendOpen(false);
    if (!user) return;
    setSaving(true);
    const payload = {
      user_id: user.id, description: form.description.trim(), amount: Number(form.amount),
      type: form.type, category_id: form.category_id || null, account_id: form.account_id || null,
      date: form.date, notes: form.notes.trim() ? form.notes.trim() + ' [Dépassement volontaire]' : '[Dépassement volontaire]',
    };
    const { error } = await supabase.from('transactions').insert(payload);
    if (error) { toast.error(error.message); setSaving(false); return; }
    setSaving(false);
    setDialogOpen(false);
    refreshData();
    toast.success(t.saved);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from('transactions').delete().eq('id', deleteId);
    if (error) { toast.error(error.message); setDeleteId(null); return; }
    setDeleteId(null);
    refreshData();
    toast.success(t.delete + ' ✓');
  };

  const handleAISuggest = async () => {
    if (!canUseAISuggestions) return;
    setAiSuggesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-suggest', {
        body: {
          description: form.description, type: form.type,
          categories: categories.filter(c => c.type === form.type).map(c => ({ id: c.id, name: c.name })),
          accounts: accounts.map(a => ({ id: a.id, name: a.name })), locale,
        },
      });
      if (error) throw error;
      if (data?.description) setForm(f => ({ ...f, description: data.description }));
      if (data?.category_id) setForm(f => ({ ...f, category_id: data.category_id }));
      if (data?.amount) setForm(f => ({ ...f, amount: String(data.amount) }));
      if (data?.account_id) setForm(f => ({ ...f, account_id: data.account_id }));
      toast.success(t.aiSuggest);
    } catch (e: any) {
      toast.error(e.message || 'AI error');
    } finally {
      setAiSuggesting(false);
    }
  };

  const descriptionSuggestions = useMemo(() => {
    if (!form.description || form.description.length < 2) return [];
    const q = form.description.toLowerCase();
    return recentDescriptions
      .filter(tx => tx.description.toLowerCase().includes(q))
      .slice(0, 5);
  }, [form.description, recentDescriptions]);

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

  const activeFilterCount = [
    filterType !== 'all',
    filterCategory !== 'all',
    filterAccount !== 'all',
    !!startDate,
    !!endDate,
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
          <TabsList className="rounded-xl mb-4 bg-muted/50 p-1">
            <TabsTrigger value="manage" className="rounded-lg gap-1.5 data-[state=active]:shadow-sm transition-all"><ArrowUpDown className="w-4 h-4" />{t.management}</TabsTrigger>
            <TabsTrigger value="stats" className="rounded-lg gap-1.5 data-[state=active]:shadow-sm transition-all"><BarChart3 className="w-4 h-4" />{t.transactionsStats}</TabsTrigger>
          </TabsList>
        </motion.div>

        <TabsContent value="stats">
          <TransactionsStatsTab />
        </TabsContent>

        <TabsContent value="manage">
      {limitReached && <UpgradeBanner message={t.limitReachedTransactions(thisMonthCount, limits.transactionsPerMonth)} />}

      {/* Header */}
      <motion.div
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.15, duration: 0.3 }}
      >
        <div>
          <h2 className="text-2xl font-bold font-display">{t.allTransactions}
            {!isPremium && <span className="text-sm font-normal text-muted-foreground ml-2">({thisMonthCount}/{limits.transactionsPerMonth})</span>}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">{totalCount} {t.results}</p>
        </div>
        <div className="flex gap-2">
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setTransferOpen(true)} disabled={accounts.length < 2}>
              <ArrowLeftRight className="w-4 h-4 mr-1" />{t.makeTransfer}
            </Button>
          </motion.div>
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button size="sm" className="text-primary-foreground rounded-xl shadow-md hover:shadow-lg transition-shadow" style={{ background: 'var(--gradient-primary)' }} onClick={openNew} disabled={limitReached}>
              <Plus className="w-4 h-4 mr-1" />{t.addTransaction}
            </Button>
          </motion.div>
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.3 }}
      >
        <Card className="border border-border/40 rounded-2xl bg-card/80 backdrop-blur-sm overflow-hidden">
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row gap-2">
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

                {/* Category popover */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={`h-10 rounded-xl text-xs gap-1.5 border-border/40 bg-background/60 hover:bg-background/80 transition-all duration-200 min-w-[140px] justify-start font-medium ${filterCategory !== 'all' ? 'border-primary/30 bg-primary/5 text-primary' : ''}`}>
                      <Tag className="w-3.5 h-3.5" />
                      {filterCategory !== 'all'
                        ? (() => { const cat = categories.find(c => c.id === filterCategory); return cat ? `${cat.icon} ${cat.name}` : t.category; })()
                        : t.category
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

                {/* Account popover */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={`h-10 rounded-xl text-xs gap-1.5 border-border/40 bg-background/60 hover:bg-background/80 transition-all duration-200 min-w-[140px] justify-start font-medium ${filterAccount !== 'all' ? 'border-primary/30 bg-primary/5 text-primary' : ''}`}>
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

              {/* Date range + active filter badge + clear */}
              <div className="flex flex-wrap gap-2 items-center">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                  <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-40 rounded-xl h-9 border-border/40 bg-background/60 hover:bg-background/80 text-xs transition-colors" />
                  <span className="text-xs text-muted-foreground">→</span>
                  <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-40 rounded-xl h-9 border-border/40 bg-background/60 hover:bg-background/80 text-xs transition-colors" />
                </div>
                <AnimatePresence>
                  {hasActiveFilters && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8, x: -8 }}
                      animate={{ opacity: 1, scale: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.8, x: -8 }}
                      className="flex items-center gap-2"
                    >
                      {activeFilterCount > 0 && (
                        <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                          {activeFilterCount} {locale === 'fr' ? 'filtre(s)' : 'filter(s)'}
                        </span>
                      )}
                      <Button variant="ghost" size="sm" className="rounded-full text-muted-foreground hover:text-destructive gap-1 transition-all h-7 text-xs" onClick={clearFilters}>
                        <X className="w-3.5 h-3.5" />{t.clearFilters}
                      </Button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
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
        <Card className={`border border-border/40 rounded-2xl overflow-hidden shadow-[var(--shadow-card)] transition-all duration-300 ${txFetching && !txLoading ? 'opacity-60' : ''}`}>
          <CardContent className="p-0">
            {transactions.length === 0 ? (
              <motion.div
                className="py-20 text-center"
                {...fadeScale}
              >
                <motion.div
                  className="w-16 h-16 rounded-2xl bg-muted/50 mx-auto mb-4 flex items-center justify-center"
                  animate={{ rotate: [0, -5, 5, 0] }}
                  transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
                >
                  <Inbox className="w-7 h-7 text-muted-foreground/40" />
                </motion.div>
                {isEmpty ? (
                  <>
                    <p className="text-lg font-semibold text-muted-foreground mb-2">{t.noTransactions}</p>
                    <p className="text-sm text-muted-foreground/70 mb-5">{t.addFirstTransaction}</p>
                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                      <Button size="sm" className="text-primary-foreground rounded-xl shadow-md" style={{ background: 'var(--gradient-primary)' }} onClick={openNew}>
                        <Plus className="w-4 h-4 mr-1" />{t.addTransaction}
                      </Button>
                    </motion.div>
                  </>
                ) : (
                  <p className="text-lg font-semibold text-muted-foreground">{t.noResults}</p>
                )}
              </motion.div>
            ) : (
              <>
                {/* Sort header */}
                <div className="flex items-center gap-4 px-5 py-2.5 bg-muted/20 border-b border-border/30 text-xs font-semibold text-muted-foreground">
                  <div className="w-8 flex-shrink-0"><Checkbox checked={allPageSelected} onCheckedChange={toggleSelectAll} /></div>
                  <SortButton field="date" current={sortField} order={sortOrder} onSort={toggleSort} label={t.date} />
                  <div className="flex-1" />
                  <SortButton field="description" current={sortField} order={sortOrder} onSort={toggleSort} label={t.description} />
                  <div className="flex-1" />
                  <SortButton field="amount" current={sortField} order={sortOrder} onSort={toggleSort} label={t.amount} />
                </div>

                {/* Transaction rows */}
                <motion.div
                  className="divide-y divide-border/30"
                  variants={containerVariants}
                  initial="hidden"
                  animate="show"
                  key={`${page}-${sortField}-${sortOrder}-${debouncedSearch}`}
                >
                  {transactions.map((tx, index) => (
                    <motion.div
                      key={tx.id}
                      variants={itemVariants}
                      layout
                      className={`group flex items-center justify-between px-5 py-3 transition-all duration-200 cursor-default ${
                        selectedIds.has(tx.id)
                          ? 'bg-primary/5 border-l-2 border-l-primary'
                          : 'hover:bg-muted/20 border-l-2 border-l-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-8 flex-shrink-0">
                          <Checkbox checked={selectedIds.has(tx.id)} onCheckedChange={() => toggleSelect(tx.id)} />
                        </div>

                        {/* Category icon with color accent */}
                        <motion.div
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 relative"
                          style={{
                            background: tx.categories?.color
                              ? `${tx.categories.color}15`
                              : 'hsl(var(--muted) / 0.5)',
                          }}
                          whileHover={{ scale: 1.1, rotate: 5 }}
                          transition={{ type: 'spring', stiffness: 400 }}
                        >
                          {tx.categories?.icon || '📁'}
                          {/* Type indicator dot */}
                          <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-background ${tx.type === 'income' ? 'bg-secondary' : 'bg-destructive'}`} />
                        </motion.div>

                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate leading-tight">{tx.description}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {tx.categories?.name || '-'} · {tx.payment_accounts?.icon} {tx.payment_accounts?.name || '-'} · {new Date(tx.date).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                          <p className="text-[10px] text-muted-foreground/50 flex items-center gap-1 mt-0.5">
                            <Clock className="w-2.5 h-2.5" />
                            {locale === 'fr' ? 'Saisi le' : 'Created'} {new Date(tx.created_at).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                        <motion.span
                          className={`text-sm font-bold tabular-nums amount-display px-2 py-1 rounded-lg ${
                            tx.type === 'income'
                              ? 'text-secondary bg-secondary/8 amount-glow-green'
                              : 'text-destructive bg-destructive/8 amount-glow-red'
                          }`}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: index * 0.02 + 0.1 }}
                        >
                          <span className="text-[0.85em] opacity-70 mr-0.5">{tx.type === 'income' ? '+' : '-'}</span>{fmt(Number(tx.amount))}
                        </motion.span>

                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-muted/60" onClick={() => openEdit(tx)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10" onClick={() => setDeleteId(tx.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>

                {/* Pagination */}
                <div className="flex items-center justify-between px-5 py-3 border-t border-border/30 bg-muted/10">
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {totalCount} {t.results} — {t.page} {page + 1}/{totalPages}
                  </span>
                  <div className="flex gap-1.5">
                    <motion.div whileHover={{ x: -2 }} whileTap={{ scale: 0.95 }}>
                      <Button variant="outline" size="sm" className="rounded-xl h-8 text-xs border-border/40" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                        <ChevronLeft className="w-3.5 h-3.5 mr-0.5" />{t.previous}
                      </Button>
                    </motion.div>
                    <motion.div whileHover={{ x: 2 }} whileTap={{ scale: 0.95 }}>
                      <Button variant="outline" size="sm" className="rounded-xl h-8 text-xs border-border/40" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                        {t.next}<ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                      </Button>
                    </motion.div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Add/Edit Dialog */}
      <ResponsiveFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? t.edit : t.addTransaction}
        description={t.fillTransactionDetails}
        footer={
          <>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl">{t.cancel}</Button>
            <Button className="text-primary-foreground rounded-xl min-w-[120px] shadow-md" style={{ background: 'var(--gradient-primary)' }} onClick={handleSave} disabled={saving}>
              {saving ? (locale === 'fr' ? 'Enregistrement...' : 'Saving...') : t.save}
            </Button>
          </>
        }
      >
          <div className="space-y-4 py-2 form-animate">
            <div className="space-y-2">
              <Label className="form-label">{t.type}</Label>
              <div className="grid grid-cols-2 gap-2">
                <motion.button type="button" onClick={() => setForm(f => ({ ...f, type: 'expense', category_id: '' }))}
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${form.type === 'expense' ? 'border-destructive bg-destructive/10 text-destructive shadow-sm' : 'border-border bg-card text-muted-foreground hover:bg-muted/50'}`}>
                  <TrendingDown className="w-4 h-4" />{t.expenseType}
                </motion.button>
                <motion.button type="button" onClick={() => setForm(f => ({ ...f, type: 'income', category_id: '' }))}
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${form.type === 'income' ? 'border-secondary bg-secondary/10 text-secondary shadow-sm' : 'border-border bg-card text-muted-foreground hover:bg-muted/50'}`}>
                  <TrendingUp className="w-4 h-4" />{t.incomeType}
                </motion.button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="form-label">{t.amount}</Label>
                <Input type="number" min="0.01" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  className={`rounded-xl h-11 text-lg font-bold pl-4 ${errors.amount ? 'border-destructive' : ''}`} placeholder="0" />
                {errors.amount && <p className="text-xs text-destructive">{errors.amount}</p>}
              </div>
              <div className="space-y-2">
                <Label className="form-label flex items-center gap-1.5"><Calendar className="w-3 h-3" />{t.date}</Label>
                <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className={`rounded-xl h-11 ${errors.date ? 'border-destructive' : ''}`} />
                {errors.date && <p className="text-xs text-destructive">{errors.date}</p>}
              </div>
            </div>
            <div className="space-y-2 relative">
              <div className="flex items-center justify-between">
                <Label className="form-label flex items-center gap-1.5"><FileText className="w-3 h-3" />{t.description}</Label>
                {canUseAISuggestions && (
                  <Button type="button" variant="ghost" size="sm" className="h-7 text-xs rounded-lg text-primary" onClick={handleAISuggest} disabled={aiSuggesting}>
                    <Sparkles className="w-3 h-3 mr-1" />{aiSuggesting ? t.aiSuggesting : t.aiSuggest}
                  </Button>
                )}
              </div>
              <Input value={form.description} maxLength={200}
                onChange={e => { setForm(f => ({ ...f, description: e.target.value })); setShowSuggestions(true); }}
                onBlur={() => {
                  setTimeout(() => setShowSuggestions(false), 200);
                  if (canUseAISuggestions && form.description.trim().length >= 3 && !form.category_id && !aiSuggesting) {
                    (async () => {
                      try {
                        const { data } = await supabase.functions.invoke('ai-categorize', {
                          body: {
                            description: form.description.trim(),
                            type: form.type,
                            categories: categories.filter(c => c.type === form.type).map(c => ({ id: c.id, name: c.name })),
                            recentTransactions: recentDescriptions.slice(0, 30).map(tx => ({
                              description: tx.description,
                              category_name: categories.find(c => c.id === tx.category_id)?.name || null,
                            })),
                            locale,
                          },
                        });
                        if (data?.category_id && data.confidence >= 0.5) {
                          setForm(f => ({ ...f, category_id: data.category_id }));
                          toast.success(locale === 'fr' ? '🏷️ Catégorie détectée automatiquement' : '🏷️ Category auto-detected', { duration: 2000 });
                        }
                      } catch { /* silent */ }
                    })();
                  }
                  if (canUseAISuggestions && form.description.trim().length >= 3 && !form.amount && !aiSuggesting) {
                    handleAISuggest();
                  }
                }}
                onFocus={() => setShowSuggestions(true)}
                placeholder={locale === 'fr' ? 'Ex: Courses supermarché' : 'E.g: Grocery shopping'}
                className={`rounded-xl h-11 ${errors.description ? 'border-destructive' : ''}`} />
              {aiSuggesting && (
                <div className="absolute right-3 top-[calc(100%-2rem)] flex items-center gap-1 text-xs text-primary">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>{locale === 'fr' ? 'IA...' : 'AI...'}</span>
                </div>
              )}
              {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
              <AnimatePresence>
                {showSuggestions && descriptionSuggestions.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -4, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.98 }}
                    className="absolute top-full left-0 right-0 z-[60] mt-1 bg-popover border border-border rounded-xl shadow-xl max-h-48 overflow-y-auto"
                  >
                    {descriptionSuggestions.map((s, i) => {
                      const cat = categories.find(c => c.id === s.category_id);
                      const acc = accounts.find(a => a.id === s.account_id);
                      return (
                        <button key={i} type="button" className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted/50 transition-colors flex items-center gap-2"
                          onMouseDown={(e) => { e.preventDefault(); setForm(f => ({ ...f, description: s.description, category_id: s.category_id || f.category_id, account_id: s.account_id || f.account_id })); setShowSuggestions(false); }}>
                          <span className="truncate flex-1">{s.description}</span>
                          <span className="flex items-center gap-1.5 shrink-0 text-xs text-muted-foreground">
                            {cat && <span className="flex items-center gap-0.5" title={cat.name}><span>{cat.icon}</span><span className="hidden sm:inline max-w-[80px] truncate">{cat.name}</span></span>}
                            {acc && <span className="flex items-center gap-0.5 border-l border-border pl-1.5" title={acc.name}><span>{acc.icon}</span><span className="hidden sm:inline max-w-[80px] truncate">{acc.name}</span></span>}
                          </span>
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className="space-y-2">
              <Label className="form-label flex items-center gap-1.5"><    Tag className="w-3 h-3" />{t.category}</Label>
              <CategoryCombobox
                categories={filteredCategories}
                value={form.category_id}
                onValueChange={v => setForm(f => ({ ...f, category_id: v }))}
                placeholder={locale === 'fr' ? 'Rechercher une catégorie...' : 'Search category...'}
              />
            </div>
            <div className="space-y-2">
              <Label className="form-label flex items-center gap-1.5"><CreditCard className="w-3 h-3" />{t.account}</Label>
              <AccountCombobox
                accounts={accounts}
                value={form.account_id}
                onValueChange={v => setForm(f => ({ ...f, account_id: v }))}
                placeholder={locale === 'fr' ? 'Rechercher un compte...' : 'Search account...'}
              />
            </div>
            <div className="space-y-2">
              <Label className="form-label">{t.notes} <span className="text-muted-foreground/50 font-normal normal-case">({locale === 'fr' ? 'optionnel' : 'optional'})</span></Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} maxLength={500} rows={2}
                className={`rounded-xl resize-none ${errors.notes ? 'border-destructive' : ''}`} placeholder={locale === 'fr' ? 'Ajoutez une note...' : 'Add a note...'} />
              {errors.notes && <p className="text-xs text-destructive">{errors.notes}</p>}
            </div>
          </div>
      </ResponsiveFormDialog>

      <ConfirmDeleteDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)} onConfirm={handleDelete} title={t.confirmDelete} description={t.confirmDeleteMessage} cancelLabel={t.cancel} confirmLabel={t.delete} />
      <ConfirmDeleteDialog open={bulkDeleteOpen} onOpenChange={() => setBulkDeleteOpen(false)} onConfirm={handleBulkDelete} title={t.deleteSelection} description={t.bulkDeleteConfirm(selectedIds.size)} cancelLabel={t.cancel} confirmLabel={t.delete} />

      {user && <TransferDialog open={transferOpen} onOpenChange={setTransferOpen} accounts={accounts} userId={user.id} t={t} onSuccess={refreshData} />}

      {/* Bulk Modify Dialog */}
      <Dialog open={bulkModifyOpen} onOpenChange={setBulkModifyOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">{t.bulkModify}</DialogTitle>
            <DialogDescription>{t.selectedCount(selectedIds.size)}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
             <div className="space-y-2">
              <Label className="form-label">{t.bulkModifyCategory}</Label>
              <CategoryCombobox
                categories={categories}
                value={bulkModifyForm.category_id}
                onValueChange={v => setBulkModifyForm(f => ({ ...f, category_id: v }))}
                placeholder={t.selectCategory}
                groupByType
              />
            </div>
            <div className="space-y-2">
              <Label className="form-label">{t.bulkModifyAccount}</Label>
              <AccountCombobox
                accounts={accounts}
                value={bulkModifyForm.account_id}
                onValueChange={v => setBulkModifyForm(f => ({ ...f, account_id: v }))}
                placeholder={locale === 'fr' ? 'Rechercher...' : 'Search...'}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setBulkModifyOpen(false)} className="rounded-xl">{t.cancel}</Button>
            <Button className="text-primary-foreground rounded-xl" style={{ background: 'var(--gradient-primary)' }} onClick={handleBulkModify}>{t.applyChanges}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Budget Overspend Confirmation */}
      <AlertDialog open={budgetOverspendOpen} onOpenChange={setBudgetOverspendOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              {locale === 'fr' ? 'Budget dépassé' : 'Budget exceeded'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {locale === 'fr'
                ? `Le budget "${overspendBudgetName}" est déjà consommé à 100%. Souhaitez-vous quand même imputer cette dépense ? Cela créera un dépassement volontaire.`
                : `The budget "${overspendBudgetName}" is already 100% consumed. Do you still want to record this expense? This will create a voluntary overspend.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">{t.cancel}</AlertDialogCancel>
            <AlertDialogAction className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleForceOverspend}>
              {locale === 'fr' ? 'Confirmer le dépassement' : 'Confirm overspend'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
};

/* Sort button sub-component */
const SortButton = ({ field, current, order, onSort, label }: {
  field: SortField; current: SortField; order: SortOrder;
  onSort: (f: SortField) => void; label: string;
}) => (
  <button
    className={`flex items-center gap-1 transition-colors duration-200 ${current === field ? 'text-primary font-bold' : 'hover:text-foreground'}`}
    onClick={() => onSort(field)}
  >
    {label}
    <ArrowUpDown className={`w-3 h-3 transition-transform duration-200 ${current === field ? 'text-primary' : ''}`} />
    {current === field && (
      <motion.span
        key={order}
        initial={{ opacity: 0, y: order === 'asc' ? 4 : -4 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-primary text-xs"
      >
        {order === 'asc' ? '↑' : '↓'}
      </motion.span>
    )}
  </button>
);

export default TransactionsPage;
