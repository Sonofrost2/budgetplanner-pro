import { useState, useMemo, useRef, useEffect } from 'react';
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
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, Search, ChevronLeft, ChevronRight, Inbox, TrendingUp, TrendingDown, Calendar, FileText, CreditCard, Tag, ArrowUpDown, Download, X, Sparkles, ArrowLeftRight, AlertTriangle, BarChart3 } from 'lucide-react';
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

const PAGE_SIZE = 20;
type SortField = 'date' | 'amount' | 'description';
type SortOrder = 'asc' | 'desc';

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
      // Deduplicate by description
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
    // Also invalidate month count
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
    const affectedAccounts = new Set<string>();
    ids.forEach(id => {
      const tx = transactions.find(t => t.id === id);
      if (tx?.account_id) affectedAccounts.add(tx.account_id);
    });
    const { error } = await supabase.from('transactions').delete().in('id', ids);
    if (error) { toast.error(error.message); setBulkDeleteOpen(false); return; }
    for (const accId of affectedAccounts) await supabase.rpc('recalculate_account_balance', { p_account_id: accId });
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
    const affectedAccounts = new Set<string>();
    selectedTxs.forEach(tx => { if (tx.account_id) affectedAccounts.add(tx.account_id); });
    for (const accId of affectedAccounts) await supabase.rpc('recalculate_account_balance', { p_account_id: accId });
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
    // Check if there's a budget for this category
    const { data: budgets } = await supabase
      .from('budgets')
      .select('id, name, amount, period, control_type')
      .eq('user_id', user.id)
      .eq('category_id', form.category_id)
      .eq('budget_type', 'expense')
      .eq('control_type', 'max');
    if (!budgets || budgets.length === 0) return true;

    const budget = budgets[0];
    // Calculate period dates
    const now = new Date();
    let startDate: string, endDate: string;
    if (budget.period === 'weekly') {
      const d = new Date(now); d.setDate(d.getDate() - d.getDay());
      startDate = d.toISOString().split('T')[0];
      const e = new Date(d); e.setDate(e.getDate() + 6);
      endDate = e.toISOString().split('T')[0];
    } else if (budget.period === 'yearly') {
      startDate = `${now.getFullYear()}-01-01`;
      endDate = `${now.getFullYear()}-12-31`;
    } else {
      startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      endDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${lastDay}`;
    }

    const { data: spentData } = await supabase.rpc('get_budget_spending', {
      p_user_id: user.id, p_category_id: form.category_id, p_type: 'expense',
      p_start_date: startDate, p_end_date: endDate,
    });
    const spent = Number(spentData) || 0;
    const newTotal = spent + Number(form.amount);

    if (newTotal > Number(budget.amount)) {
      setOverspendBudgetName(budget.name);
      setBudgetOverspendOpen(true);
      return false; // Don't save yet
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

    // Check budget overspend only for new expenses (not editing)
    if (!editing && form.type === 'expense') {
      const canProceed = await checkBudgetOverspend();
      if (!canProceed) { setSaving(false); return; }
    }

    if (editing) {
      const { error } = await supabase.from('transactions').update(payload).eq('id', editing.id);
      if (error) { toast.error(error.message); setSaving(false); return; }
      const affectedAccounts = new Set([editing.account_id, payload.account_id].filter(Boolean));
      for (const accId of affectedAccounts) await supabase.rpc('recalculate_account_balance', { p_account_id: accId });
    } else {
      const { error } = await supabase.from('transactions').insert(payload);
      if (error) { toast.error(error.message); setSaving(false); return; }
      if (payload.account_id) await supabase.rpc('recalculate_account_balance', { p_account_id: payload.account_id });
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
    if (payload.account_id) await supabase.rpc('recalculate_account_balance', { p_account_id: payload.account_id });
    setSaving(false);
    setDialogOpen(false);
    refreshData();
    toast.success(t.saved);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const txToDelete = transactions.find(tx => tx.id === deleteId);
    const { error } = await supabase.from('transactions').delete().eq('id', deleteId);
    if (error) { toast.error(error.message); setDeleteId(null); return; }
    if (txToDelete?.account_id) await supabase.rpc('recalculate_account_balance', { p_account_id: txToDelete.account_id });
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
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  const filteredCategories = categories.filter(c => c.type === form.type);
  const isEmpty = totalCount === 0 && !hasActiveFilters;

  return (
    <div className="space-y-6">
      {limitReached && <UpgradeBanner message={t.limitReachedTransactions(thisMonthCount, limits.transactionsPerMonth)} />}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-2xl font-bold font-display">{t.allTransactions}
          {!isPremium && <span className="text-sm font-normal text-muted-foreground ml-2">({thisMonthCount}/{limits.transactionsPerMonth})</span>}
        </h2>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setTransferOpen(true)} disabled={accounts.length < 2}>
            <ArrowLeftRight className="w-4 h-4 mr-1" />{t.makeTransfer}
          </Button>
          <Button size="sm" className="text-primary-foreground rounded-xl" style={{ background: 'var(--gradient-primary)' }} onClick={openNew} disabled={limitReached}>
            <Plus className="w-4 h-4 mr-1" />{t.addTransaction}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder={t.search + '...'} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10 rounded-xl" />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-36 rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.all}</SelectItem>
            <SelectItem value="income">{t.incomeType}</SelectItem>
            <SelectItem value="expense">{t.expenseType}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-44 rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.all} {t.category}</SelectItem>
            {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterAccount} onValueChange={setFilterAccount}>
          <SelectTrigger className="w-44 rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.allAccounts}</SelectItem>
            {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.icon} {a.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-40 rounded-xl" />
        <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-40 rounded-xl" />
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" className="rounded-xl text-muted-foreground" onClick={clearFilters}>
            <X className="w-3.5 h-3.5 mr-1" />{t.clearFilters}
          </Button>
        )}
      </div>

      {someSelected && (
        <BulkActionBar
          count={selectedIds.size}
          onDelete={() => setBulkDeleteOpen(true)}
          onModify={() => { setBulkModifyForm({ category_id: '', account_id: '' }); setBulkModifyOpen(true); }}
          onDuplicate={handleBulkDuplicate}
          onExportCSV={canExportAdvanced ? () => handleExportSelection('csv') : undefined}
          onExportExcel={canExportAdvanced ? () => handleExportSelection('excel') : undefined}
          onClear={() => setSelectedIds(new Set())}
        />
      )}

      {/* Transactions list */}
      <Card className={`border border-border/50 shadow-[var(--shadow-card)] rounded-2xl overflow-hidden ${txFetching && !txLoading ? 'opacity-70 transition-opacity' : ''}`}>
        <CardContent className="p-0">
          {transactions.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-muted mx-auto mb-4 flex items-center justify-center"><Inbox className="w-7 h-7 text-muted-foreground/40" /></div>
              {isEmpty ? (
                <>
                  <p className="text-lg font-semibold text-muted-foreground mb-2">{t.noTransactions}</p>
                  <p className="text-sm text-muted-foreground/70 mb-4">{t.addFirstTransaction}</p>
                  <Button size="sm" className="text-primary-foreground rounded-xl" style={{ background: 'var(--gradient-primary)' }} onClick={openNew}><Plus className="w-4 h-4 mr-1" />{t.addTransaction}</Button>
                </>
              ) : (
                <p className="text-lg font-semibold text-muted-foreground">{t.noResults}</p>
              )}
            </div>
          ) : (
            <>
              <div className="flex items-center gap-4 px-5 py-2.5 bg-muted/30 border-b border-border/50 text-xs font-semibold text-muted-foreground">
                <div className="w-8 flex-shrink-0"><Checkbox checked={allPageSelected} onCheckedChange={toggleSelectAll} /></div>
                <button className="flex items-center gap-1 hover:text-foreground transition-colors" onClick={() => toggleSort('date')}>
                  {t.date} <ArrowUpDown className="w-3 h-3" />{sortField === 'date' && <span className="text-primary">{sortOrder === 'asc' ? '↑' : '↓'}</span>}
                </button>
                <div className="flex-1" />
                <button className="flex items-center gap-1 hover:text-foreground transition-colors" onClick={() => toggleSort('description')}>
                  {t.description} <ArrowUpDown className="w-3 h-3" />{sortField === 'description' && <span className="text-primary">{sortOrder === 'asc' ? '↑' : '↓'}</span>}
                </button>
                <div className="flex-1" />
                <button className="flex items-center gap-1 hover:text-foreground transition-colors" onClick={() => toggleSort('amount')}>
                  {t.amount} <ArrowUpDown className="w-3 h-3" />{sortField === 'amount' && <span className="text-primary">{sortOrder === 'asc' ? '↑' : '↓'}</span>}
                </button>
              </div>
              <div className="divide-y divide-border/50">
                {transactions.map(tx => (
                  <div key={tx.id} className={`flex items-center justify-between px-5 py-3.5 hover:bg-muted/30 transition-colors ${selectedIds.has(tx.id) ? 'bg-primary/5' : ''}`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 flex-shrink-0"><Checkbox checked={selectedIds.has(tx.id)} onCheckedChange={() => toggleSelect(tx.id)} /></div>
                      <div className="w-10 h-10 rounded-xl bg-muted/60 flex items-center justify-center text-lg flex-shrink-0">{tx.categories?.icon || '📁'}</div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{tx.description}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {tx.categories?.name || '-'} · {tx.payment_accounts?.icon} {tx.payment_accounts?.name || '-'} · {new Date(tx.date).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-sm font-bold ${tx.type === 'income' ? 'text-secondary' : 'text-destructive'}`}>
                        {tx.type === 'income' ? '+' : '-'}{fmt(Number(tx.amount))}
                      </span>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => openEdit(tx)}><Pencil className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-destructive" onClick={() => setDeleteId(tx.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between px-5 py-3.5 border-t border-border/50 bg-muted/20">
                <span className="text-xs text-muted-foreground">{totalCount} {t.results} — {t.page} {page + 1}/{totalPages}</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="rounded-xl h-8" disabled={page === 0} onClick={() => setPage(p => p - 1)}><ChevronLeft className="w-3.5 h-3.5 mr-1" />{t.previous}</Button>
                  <Button variant="outline" size="sm" className="rounded-xl h-8" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>{t.next}<ChevronRight className="w-3.5 h-3.5 ml-1" /></Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">{editing ? t.edit : t.addTransaction}</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">{t.fillTransactionDetails}</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t.type}</Label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setForm(f => ({ ...f, type: 'expense', category_id: '' }))}
                  className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${form.type === 'expense' ? 'border-destructive bg-destructive/10 text-destructive' : 'border-border bg-card text-muted-foreground hover:bg-muted/50'}`}>
                  <TrendingDown className="w-4 h-4" />{t.expenseType}
                </button>
                <button type="button" onClick={() => setForm(f => ({ ...f, type: 'income', category_id: '' }))}
                  className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${form.type === 'income' ? 'border-secondary bg-secondary/10 text-secondary' : 'border-border bg-card text-muted-foreground hover:bg-muted/50'}`}>
                  <TrendingUp className="w-4 h-4" />{t.incomeType}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t.amount}</Label>
                <Input type="number" min="0.01" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  className={`rounded-xl h-11 text-lg font-bold pl-4 ${errors.amount ? 'border-destructive' : ''}`} placeholder="0" />
                {errors.amount && <p className="text-xs text-destructive">{errors.amount}</p>}
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><Calendar className="w-3 h-3" />{t.date}</Label>
                <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className={`rounded-xl h-11 ${errors.date ? 'border-destructive' : ''}`} />
                {errors.date && <p className="text-xs text-destructive">{errors.date}</p>}
              </div>
            </div>
            <div className="space-y-2 relative">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><FileText className="w-3 h-3" />{t.description}</Label>
                {canUseAISuggestions && (
                  <Button type="button" variant="ghost" size="sm" className="h-7 text-xs rounded-lg text-primary" onClick={handleAISuggest} disabled={aiSuggesting}>
                    <Sparkles className="w-3 h-3 mr-1" />{aiSuggesting ? t.aiSuggesting : t.aiSuggest}
                  </Button>
                )}
              </div>
              <Input value={form.description} maxLength={200}
                onChange={e => { setForm(f => ({ ...f, description: e.target.value })); setShowSuggestions(true); }}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                onFocus={() => setShowSuggestions(true)}
                placeholder={locale === 'fr' ? 'Ex: Courses supermarché' : 'E.g: Grocery shopping'}
                className={`rounded-xl h-11 ${errors.description ? 'border-destructive' : ''}`} />
              {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
              {showSuggestions && descriptionSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-popover border border-border rounded-xl shadow-lg overflow-hidden">
                  {descriptionSuggestions.map((s, i) => (
                    <button key={i} type="button" className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted/50 transition-colors"
                      onMouseDown={(e) => { e.preventDefault(); setForm(f => ({ ...f, description: s.description, category_id: s.category_id || f.category_id, account_id: s.account_id || f.account_id })); setShowSuggestions(false); }}>
                      {s.description}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><Tag className="w-3 h-3" />{t.category}</Label>
                <Select value={form.category_id} onValueChange={v => setForm(f => ({ ...f, category_id: v }))}>
                  <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder={locale === 'fr' ? 'Choisir...' : 'Select...'} /></SelectTrigger>
                  <SelectContent>{filteredCategories.map(c => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><CreditCard className="w-3 h-3" />{t.account}</Label>
                <Select value={form.account_id} onValueChange={v => setForm(f => ({ ...f, account_id: v }))}>
                  <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder={locale === 'fr' ? 'Choisir...' : 'Select...'} /></SelectTrigger>
                  <SelectContent>{accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.icon} {a.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t.notes} <span className="text-muted-foreground/50 font-normal normal-case">({locale === 'fr' ? 'optionnel' : 'optional'})</span></Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} maxLength={500} rows={2}
                className={`rounded-xl resize-none ${errors.notes ? 'border-destructive' : ''}`} placeholder={locale === 'fr' ? 'Ajoutez une note...' : 'Add a note...'} />
              {errors.notes && <p className="text-xs text-destructive">{errors.notes}</p>}
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl">{t.cancel}</Button>
            <Button className="text-primary-foreground rounded-xl min-w-[120px]" style={{ background: 'var(--gradient-primary)' }} onClick={handleSave} disabled={saving}>
              {saving ? (locale === 'fr' ? 'Enregistrement...' : 'Saving...') : t.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t.bulkModifyCategory}</Label>
              <Select value={bulkModifyForm.category_id} onValueChange={v => setBulkModifyForm(f => ({ ...f, category_id: v }))}>
                <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder={t.selectCategory} /></SelectTrigger>
                <SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t.bulkModifyAccount}</Label>
              <Select value={bulkModifyForm.account_id} onValueChange={v => setBulkModifyForm(f => ({ ...f, account_id: v }))}>
                <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder={locale === 'fr' ? 'Choisir...' : 'Select...'} /></SelectTrigger>
                <SelectContent>{accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.icon} {a.name}</SelectItem>)}</SelectContent>
              </Select>
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
    </div>
  );
};

export default TransactionsPage;
