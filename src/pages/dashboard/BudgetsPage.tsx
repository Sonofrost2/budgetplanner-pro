import { useState, useMemo, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getBudgetPeriodBounds, formatDateStr, computeAnnualizedAmount, computeDaysRemaining, computeOnceStatus } from '@/lib/budgetProjection';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useLanguage } from '@/i18n/LanguageContext';
import { useSubscription } from '@/hooks/useSubscription';
import { dashT } from '@/i18n/dashTranslations';
import { supabase } from '@/integrations/supabase/client';
import { invokeAuthedEdgeFunction } from '@/lib/aiEdge';
import { useBudgets, useCategories, useInvalidate, useSavingsGoals, useAccounts } from '@/hooks/useDashboardData';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ResponsiveFormDialog } from '@/components/ui/responsive-form-dialog';
import { ScrollReveal } from '@/hooks/useScrollReveal';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2, AlertTriangle, PieChart, Calendar, Tag, Pencil, TrendingUp, TrendingDown, CheckCircle, Search, Sparkles, Loader2, Clock, Repeat, BarChart3, Target, Archive, ArchiveRestore } from 'lucide-react';
import { FilterToolbar } from '@/components/dashboard/FilterToolbar';
import { CategoryCombobox } from '@/components/dashboard/CategoryCombobox';
import { toast } from 'sonner';
import { showApiError } from '@/lib/apiError';
import { coachToast } from '@/lib/coachToast';
import { BudgetsHeroHeader } from '@/components/dashboard/budgets/BudgetsHeroHeader';
import { BudgetCoachInsights } from '@/components/dashboard/budgets/BudgetCoachInsights';
import { Skeleton } from '@/components/ui/skeleton';
import ConfirmDeleteDialog from '@/components/dashboard/ConfirmDeleteDialog';
import UpgradeBanner from '@/components/dashboard/UpgradeBanner';
import BulkActionBar from '@/components/dashboard/BulkActionBar';
import { useBulkSelection } from '@/hooks/useBulkSelection';
import { exportToCSV, exportToExcel } from '@/lib/export';
import BudgetGlobalStats from '@/components/dashboard/budgets/BudgetGlobalStats';
import BudgetAnalysisTab from '@/components/dashboard/tabs/BudgetAnalysisTab';
import BudgetEvolutionTab from '@/components/dashboard/tabs/BudgetEvolutionTab';
import { BudgetForm } from '@/components/dashboard/budgets/BudgetForm';
import { budgetSchema, validateForm } from '@/lib/validationSchemas';

const PERIOD_MULTIPLIER: Record<string, number> = {
  daily: 365, weekly: 52, monthly: 12, quarterly: 4, semi_annual: 2, yearly: 1,
};

const BudgetsPage = () => {
  const { user } = useAuth();
  const { locale } = useLanguage();
  const { fmt: fmtCurrency, currency } = useProfile();
  const { limits, isPremium, canExportAdvanced } = useSubscription();
  const t = dashT[locale];
  const isFr = locale === 'fr';
  const { invalidate } = useInvalidate();
  const [searchParams] = useSearchParams();
  const initialSearch = searchParams.get('q') || '';

  const { data: budgets = [], isLoading: budLoading } = useBudgets({ includeArchived: true });
  const { data: allCategories = [], isLoading: catLoading } = useCategories();
  const { data: savingsGoals = [] } = useSavingsGoals();
  const { data: accounts = [] } = useAccounts();
  const loading = budLoading || catLoading;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const EMPTY_FORM = {
    name: '', amount: '', category_id: '', period: 'monthly', alert_threshold: '80',
    budget_type: 'expense', control_type: 'max', expected_day: '', occurrence_frequency: '',
    reference_date: '', active_days: '', linked_savings_goal_id: '',
    is_renewable: true, carry_over: false, notes: '', priority: 'medium' as 'low'|'medium'|'high',
    tags: '', payment_account_id: '',
  };
  const [form, setForm] = useState<typeof EMPTY_FORM>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('expense');
  const [activeMainTab, setActiveMainTab] = useState('manage');
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkModifyOpen, setBulkModifyOpen] = useState(false);
  const [bulkModifyForm, setBulkModifyForm] = useState({ period: '', category_id: '' });
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [sortField, setSortField] = useState<'name' | 'amount' | 'spent'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [filterPeriod, setFilterPeriod] = useState('');
  // Archived budgets are hidden by default and excluded from every stat.
  // The toggle exposes them so the user can restore or delete them.
  const [showArchived, setShowArchived] = useState(false);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<any[]>([]);
  const [aiLoading, setAiLoading] = useState(false);

  const fmt = (n: number) => fmtCurrency(n, locale);

  const filteredCategories = useMemo(() =>
    allCategories.filter(c => c.type === form.budget_type),
    [allCategories, form.budget_type]
  );

  // Server-side spending calculation using RPC — period + annual
  const budgetPeriodRanges = useMemo(() => {
    const now = new Date();
    return budgets.map(b => {
      const { periodStart, periodEnd } = getBudgetPeriodBounds(b.period || 'monthly', now, b.reference_date);
      const start = periodStart.toISOString().split('T')[0];
      const end = periodEnd.toISOString().split('T')[0];
      const bType = (b as any).budget_type || 'expense';
      return { id: b.id, category_id: b.category_id, type: bType === 'income' ? 'income' : 'expense', start, end };
    });
  }, [budgets]);

  const yearStart = `${new Date().getFullYear()}-01-01`;
  const yearEnd = `${new Date().getFullYear()}-12-31`;

  const { data: spending = {} } = useQuery({
    queryKey: ['budget-spending', user?.id, budgetPeriodRanges.map(r => `${r.id}-${r.start}-${r.end}`).join(',')],
    queryFn: async () => {
      const spendMap: Record<string, number> = {};
      const promises = budgetPeriodRanges
        .filter(r => r.category_id)
        .map(async (r) => {
          const { data, error } = await supabase.rpc('get_budget_spending', {
            p_user_id: user!.id,
            p_category_id: r.category_id!,
            p_type: r.type,
            p_start_date: r.start,
            p_end_date: r.end,
          });
          if (!error && data !== null) {
            spendMap[r.category_id!] = Number(data);
          }
        });
      await Promise.all(promises);
      return spendMap;
    },
    enabled: !!user && budgetPeriodRanges.length > 0,
    // Conso budget = donnée critique (dépassement, alertes) → staleTime court.
    staleTime: 10_000,
  });

  // Annual spending per category (Jan 1 → Dec 31 of current year)
  const { data: annualSpending = {} } = useQuery({
    queryKey: ['budget-annual-spending', user?.id, yearStart, yearEnd],
    queryFn: async () => {
      const uniqueCats = [...new Set(budgetPeriodRanges.filter(r => r.category_id).map(r => ({ cid: r.category_id!, type: r.type })))];
      const map: Record<string, number> = {};
      await Promise.all(uniqueCats.map(async ({ cid, type }) => {
        const { data } = await supabase.rpc('get_budget_spending', {
          p_user_id: user!.id, p_category_id: cid, p_type: type,
          p_start_date: yearStart, p_end_date: yearEnd,
        });
        if (data !== null) map[cid] = Number(data);
      }));
      return map;
    },
    enabled: !!user && budgetPeriodRanges.length > 0,
    staleTime: 30_000,
  });

  // Base list every stat/section works from: excludes archived unless the
  // user explicitly toggled "Afficher archivés". Keeps global KPIs,
  // coach insights and analysis tabs in agreement with the visible cards.
  const activeBudgets = useMemo(
    () => budgets.filter(b => showArchived ? true : !(b as any).archived_at),
    [budgets, showArchived],
  );
  const archivedCount = useMemo(
    () => budgets.filter(b => !!(b as any).archived_at).length,
    [budgets],
  );

  const expenseBudgets = useMemo(() => {
    let result = activeBudgets.filter(b => (b as any).budget_type !== 'income');
    if (searchQuery) { const terms = searchQuery.split(';').map(s => s.trim().toLowerCase()).filter(Boolean); result = result.filter(b => terms.some(q => b.name.toLowerCase().includes(q) || b.categories?.name?.toLowerCase().includes(q))); }
    if (filterPeriod) result = result.filter(b => b.period === filterPeriod);
    result = [...result].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortField === 'amount') cmp = Number(a.amount) - Number(b.amount);
      else if (sortField === 'spent') cmp = (spending[a.category_id || ''] || 0) - (spending[b.category_id || ''] || 0);
      return sortOrder === 'desc' ? -cmp : cmp;
    });
    return result;
  }, [activeBudgets, searchQuery, filterPeriod, sortField, sortOrder, spending]);

  const incomeBudgets = useMemo(() => {
    let result = activeBudgets.filter(b => (b as any).budget_type === 'income');
    if (searchQuery) { const terms = searchQuery.split(';').map(s => s.trim().toLowerCase()).filter(Boolean); result = result.filter(b => terms.some(q => b.name.toLowerCase().includes(q) || b.categories?.name?.toLowerCase().includes(q))); }
    if (filterPeriod) result = result.filter(b => b.period === filterPeriod);
    result = [...result].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortField === 'amount') cmp = Number(a.amount) - Number(b.amount);
      else if (sortField === 'spent') cmp = (spending[a.category_id || ''] || 0) - (spending[b.category_id || ''] || 0);
      return sortOrder === 'desc' ? -cmp : cmp;
    });
    return result;
  }, [activeBudgets, searchQuery, filterPeriod, sortField, sortOrder, spending]);

  const currentBudgets = activeTab === 'expense' ? expenseBudgets : incomeBudgets;

  const bulk = useBulkSelection(currentBudgets);

  const refreshData = () => {
    invalidate('budgets', 'budget-spending', 'budget-annual-spending');
    bulk.clear();
  };

  // Archived budgets don't consume the free-plan quota — only active ones.
  const budgetLimitReached =
    !isPremium && budgets.filter(b => !(b as any).archived_at).length >= limits.budgets;

  const validate = () => {
    const result = validateForm(budgetSchema(t, locale), form);
    if (result.success === false) { setErrors(result.errors); return false; }
    // Extra contextual validations
    const errs: Record<string, string> = {};
    if (['quarterly', 'semi_annual', 'yearly'].includes(form.period) && !form.reference_date) {
      errs.reference_date = locale === 'fr' ? 'Date de référence requise pour cette période' : 'Reference date required for this period';
    }
    if (form.period === 'daily') {
      const days = form.active_days.split(',').filter(Boolean);
      if (days.length === 0) errs.active_days = locale === 'fr' ? 'Sélectionnez au moins un jour actif' : 'Select at least one active day';
    }
    if (Object.keys(errs).length > 0) { setErrors(errs); return false; }
    setErrors({});
    return true;
  };

  const openNew = (budgetType: string = 'expense') => {
    if (budgetLimitReached) { coachToast.warn(t.limitBudgetsToast(limits.budgets)); return; }
    const cats = allCategories.filter(c => c.type === budgetType);
    setErrors({}); setEditId(null);
    setForm({ ...EMPTY_FORM, category_id: cats[0]?.id || '', budget_type: budgetType, control_type: budgetType === 'income' ? 'min' : 'max' });
    setDialogOpen(true);
  };

  const openEdit = (b: any) => {
    setErrors({}); setEditId(b.id);
    setForm({
      ...EMPTY_FORM,
      name: b.name, amount: String(b.amount), category_id: b.category_id || '',
      period: b.period || 'monthly', alert_threshold: String(b.alert_threshold ?? 80),
      budget_type: b.budget_type || 'expense', control_type: b.control_type || 'max',
      expected_day: b.expected_day ? String(b.expected_day) : '',
      occurrence_frequency: b.occurrence_frequency || '',
      reference_date: b.reference_date || '', active_days: b.active_days || '',
      linked_savings_goal_id: b.linked_savings_goal_id || '',
      is_renewable: b.is_renewable !== false,
      carry_over: !!b.carry_over,
      notes: b.notes || '',
      priority: (b.priority as any) || 'medium',
      tags: Array.isArray(b.tags) ? b.tags.join(', ') : (b.tags || ''),
      payment_account_id: b.payment_account_id || '',
    });
    setDialogOpen(true);
  };

  // Open the edit dialog automatically when a notification deep-links here
  // with `?edit=<budget_id>` (e.g. link-mismatch alert from the bell).
  useEffect(() => {
    const editParam = searchParams.get('edit');
    if (!editParam || budgets.length === 0 || dialogOpen) return;
    const target = budgets.find((b: any) => b.id === editParam);
    if (target) openEdit(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, budgets]);

  const handleSave = async () => {
    if (!user || !validate()) return;
    setSaving(true);
    const payload = { name: form.name.trim(), amount: Number(form.amount), category_id: form.category_id || null, period: form.period, alert_threshold: Number(form.alert_threshold) || 80, budget_type: form.budget_type, control_type: form.control_type, expected_day: form.expected_day ? Number(form.expected_day) : null, occurrence_frequency: form.occurrence_frequency || null, reference_date: form.reference_date || null, active_days: form.active_days || null, linked_savings_goal_id: form.linked_savings_goal_id || null };
    const enriched = {
      ...payload,
      is_renewable: form.is_renewable !== false,
      carry_over: !!form.carry_over,
      notes: form.notes?.trim() || null,
      priority: form.priority || 'medium',
      tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : null,
      payment_account_id: form.payment_account_id || null,
    };
    const { error } = editId
      ? await (supabase.from('budgets') as any).update(enriched).eq('id', editId)
      : await (supabase.from('budgets') as any).insert({ ...enriched, user_id: user.id });
    if (error) { coachToast.fail(error.message); setSaving(false); return; }
    setSaving(false); setDialogOpen(false); setEditId(null);
    refreshData();
    coachToast.saved(editId ? (isFr ? 'Cadre mis à jour 🎯' : 'Budget updated 🎯') : (isFr ? 'Nouveau cadre créé 🎯' : 'New budget created 🎯'));
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from('budgets').delete().eq('id', deleteId);
    if (error) { coachToast.fail(error.message); return; }
    setDeleteId(null); refreshData();
    coachToast.warn(isFr ? 'Cadre supprimé 🗑️' : 'Budget deleted 🗑️');
  };

  const handleToggleArchive = async (b: any) => {
    const isArchived = !!b.archived_at;
    // Soft archive: keep the row (with history) but hide it from stats.
    const { error } = await supabase
      .from('budgets')
      .update({ archived_at: isArchived ? null : new Date().toISOString() } as any)
      .eq('id', b.id);
    if (error) { coachToast.fail(error.message); return; }
    refreshData();
    if (isArchived) {
      coachToast.saved(isFr ? 'Cadre restauré ♻️' : 'Budget restored ♻️');
    } else {
      coachToast.warn(isFr ? 'Cadre archivé 📦' : 'Budget archived 📦');
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(bulk.selectedIds);
    const { error } = await supabase.from('budgets').delete().in('id', ids);
    if (error) { coachToast.fail(error.message); setBulkDeleteOpen(false); return; }
    setBulkDeleteOpen(false); refreshData();
    coachToast.warn(t.bulkDeleted(ids.length));
  };

  const handleBulkModify = async () => {
    const ids = Array.from(bulk.selectedIds);
    const updates: Record<string, any> = {};
    if (bulkModifyForm.period) updates.period = bulkModifyForm.period;
    if (bulkModifyForm.category_id) updates.category_id = bulkModifyForm.category_id;
    if (Object.keys(updates).length === 0) { coachToast.remind(t.noChange); return; }
    const { error } = await supabase.from('budgets').update(updates as any).in('id', ids);
    if (error) { coachToast.fail(error.message); return; }
    setBulkModifyOpen(false); setBulkModifyForm({ period: '', category_id: '' });
    refreshData();
    coachToast.saved(t.bulkModified(ids.length));
  };

  const handleBulkDuplicate = async () => {
    if (!user) return;
    const selected = bulk.selectedItems;
    const inserts = selected.map(b => ({
      user_id: user.id, name: b.name + ' (copie)', amount: Number(b.amount),
      category_id: b.category_id, period: b.period, alert_threshold: b.alert_threshold,
      budget_type: (b as any).budget_type || 'expense', control_type: (b as any).control_type || 'max',
    }));
    const { error } = await supabase.from('budgets').insert(inserts);
    if (error) { coachToast.fail(error.message); return; }
    refreshData();
    coachToast.saved(t.bulkDuplicated(inserts.length));
  };

  const handleBulkExport = (format: 'csv' | 'excel') => {
    const data = bulk.selectedItems.map(b => ({
      [t.budgetName]: b.name,
      [t.budgetAmount]: b.amount,
      [t.category]: b.categories?.name || '-',
      [t.period]: b.period,
      [t.budgetType]: (b as any).budget_type || 'expense',
      [t.controlType]: (b as any).control_type || 'max',
    }));
    const ok = format === 'csv' ? exportToCSV(data, 'budgets') : exportToExcel(data, 'budgets');
    if (ok) coachToast.saved(isFr ? 'Export prêt 📤' : 'Export ready 📤');
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between"><Skeleton className="h-8 w-32" /><Skeleton className="h-9 w-36" /></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}</div>
      </div>
    );
  }

  const periodLabels: Record<string, string> = { daily: t.daily, weekly: t.weekly, monthly: t.monthly, quarterly: t.quarterly, semi_annual: t.semiAnnual, yearly: t.yearly };




  const handleAiSuggest = async () => {
    if (!user) return;
    setAiLoading(true);
    setAiDialogOpen(true);
    try {
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      const startDate = threeMonthsAgo.toISOString().split('T')[0];
      const endDate = new Date().toISOString().split('T')[0];

      const { data: txs } = await supabase.from('transactions').select('category_id, amount, type')
        .eq('user_id', user.id).gte('date', startDate).lte('date', endDate);

      const summary: Record<string, { expense: number; income: number; count: number }> = {};
      for (const tx of txs || []) {
        if (!tx.category_id) continue;
        if (!summary[tx.category_id]) summary[tx.category_id] = { expense: 0, income: 0, count: 0 };
        summary[tx.category_id][tx.type as 'expense' | 'income'] += Number(tx.amount);
        summary[tx.category_id].count++;
      }

      const fnData = await invokeAuthedEdgeFunction<any>('ai-budget-suggest', {
        locale,
        body: {
          categories: allCategories.map(c => ({ id: c.id, name: c.name, type: c.type, icon: c.icon })),
          existingBudgets: budgets.map(b => ({ name: b.name, category_id: b.category_id, amount: b.amount, period: b.period, budget_type: (b as any).budget_type })),
          transactionSummary: Object.entries(summary).map(([cid, s]) => ({ category_id: cid, ...s })),
          locale,
        },
      });

      setAiSuggestions(fnData?.suggestions || []);
    } catch (e: any) {
      coachToast.fail(e.message || 'AI error');
      setAiSuggestions([]);
    } finally {
      setAiLoading(false);
    }
  };

  const acceptSuggestion = (s: any) => {
    setAiDialogOpen(false);
    setErrors({});
    setEditId(null);
    setForm({
      ...EMPTY_FORM,
      name: s.name,
      amount: String(s.amount),
      category_id: s.category_id,
      period: s.period || 'monthly',
      budget_type: s.budget_type || 'expense',
      control_type: s.budget_type === 'income' ? 'min' : 'max',
    });
    setDialogOpen(true);
  };

  const renderBudgetCard = (b: any) => {
    const actual = spending[b.category_id || ''] || 0;
    const amount = Number(b.amount);
    const pct = amount > 0 ? Math.min((actual / amount) * 100, 100) : 0;
    const controlType = b.control_type || 'max';
    const isIncome = b.budget_type === 'income';
    const isMax = controlType === 'max';
    const isAlert = isMax ? actual > amount : actual < amount;
    const remaining = isMax ? amount - actual : actual - amount;
    const isSelected = bulk.selectedIds.has(b.id);

    // Annualized calculation — cap both bars at 100% so the visual scale is
    // consistent with the period progress bar above. Overrun is signalled via
    // color + numeric % label, not a longer bar.
    const annualized = computeAnnualizedAmount(amount, b.period, b.active_days);
    const annualActual = annualSpending[b.category_id || ''] || 0;
    const annualPctRaw = annualized > 0 ? (annualActual / annualized) * 100 : 0;
    const annualPct = Math.min(annualPctRaw, 100);

    // Period calculations — smart days remaining
    const range = budgetPeriodRanges.find(r => r.id === b.id);
    const periodStart = range ? new Date(range.start) : new Date();
    const periodEnd = range ? new Date(range.end) : new Date();
    const today = new Date();
    const { daysLeft, label: daysLabel, targetDate } = computeDaysRemaining(b.period, today, {
      expectedDay: b.expected_day,
      occurrenceFrequency: b.occurrence_frequency,
      referenceDate: b.reference_date,
      activeDays: b.active_days,
      periodStart,
      periodEnd,
    });

    const targetDateStr = targetDate
      ? targetDate.toLocaleDateString(locale === 'en' ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'short' })
      : '';

    const occFreqLabels: Record<string, string> = { once: t.occurrenceOnce, daily: t.daily, weekly: t.weekly, biweekly: t.occurrenceBiweekly, monthly: t.monthly, quarterly: t.quarterly, semi_annual: t.semiAnnual, yearly: t.yearly };

    // ── One-shot budget status (P1 + P2 + P3) ──
    const isOnce = b.occurrence_frequency === 'once' && !!b.reference_date;
    const onceStatus = isOnce
      ? computeOnceStatus(today, b.period || 'yearly', b.reference_date!, amount, actual)
      : null;
    const dateFmt = (d: Date) =>
      d.toLocaleDateString(locale === 'en' ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'short' });
    const onceBadge = (() => {
      if (!onceStatus) return null;
      const base = 'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wide';
      switch (onceStatus.kind) {
        case 'upcoming': return <span className={`${base} bg-primary/10 text-primary`}>{isFr ? 'Prévu' : 'Planned'}</span>;
        case 'today': return <span className={`${base} bg-accent/15 text-accent-foreground`}>{isFr ? "Aujourd'hui" : 'Today'}</span>;
        case 'fulfilled': return <span className={`${base} bg-secondary/15 text-secondary`}>{isFr ? 'Réalisé' : 'Fulfilled'} ✓</span>;
        case 'exceeded': return <span className={`${base} bg-destructive/15 text-destructive`}>{isFr ? 'Dépassé' : 'Exceeded'}</span>;
        case 'partial': return <span className={`${base} bg-accent/15 text-accent`}>{isFr ? 'Partiel' : 'Partial'}</span>;
        case 'missed': return <span className={`${base} bg-destructive/15 text-destructive`}>{isFr ? 'Manqué' : 'Missed'}</span>;
      }
    })();
    const onceCountdown = (() => {
      if (!onceStatus) return null;
      switch (onceStatus.kind) {
        case 'upcoming': return `${onceStatus.daysLeft} ${t.daysRemaining} · ${dateFmt(onceStatus.refDate)}`;
        case 'today': return isFr ? `📍 Échéance aujourd'hui` : `📍 Due today`;
        case 'fulfilled':
          return onceStatus.nextRefDate
            ? (isFr ? `✅ Réalisé · Prochaine : ${dateFmt(onceStatus.nextRefDate)} (J-${onceStatus.daysToNext})`
                    : `✅ Fulfilled · Next: ${dateFmt(onceStatus.nextRefDate)} (in ${onceStatus.daysToNext}d)`)
            : (isFr ? '✅ Réalisé' : '✅ Fulfilled');
        case 'exceeded':
          return onceStatus.nextRefDate
            ? (isFr ? `🔴 Dépassé de ${fmt(onceStatus.overshoot)} · Prochaine ${dateFmt(onceStatus.nextRefDate)}`
                    : `🔴 Over by ${fmt(onceStatus.overshoot)} · Next ${dateFmt(onceStatus.nextRefDate)}`)
            : (isFr ? `🔴 Dépassé de ${fmt(onceStatus.overshoot)}` : `🔴 Over by ${fmt(onceStatus.overshoot)}`);
        case 'partial':
          return isFr ? `⚠️ Partiel (${Math.round(onceStatus.pct)}%) · Retard ${onceStatus.daysLate}j`
                     : `⚠️ Partial (${Math.round(onceStatus.pct)}%) · ${onceStatus.daysLate}d late`;
        case 'missed':
          return isFr ? `❌ En retard de ${onceStatus.daysLate}j · ${dateFmt(onceStatus.refDate)}`
                     : `❌ ${onceStatus.daysLate}d overdue · ${dateFmt(onceStatus.refDate)}`;
      }
    })();

    return (
      <ScrollReveal key={b.id}>
      <Card className={`card-interactive hover:-translate-y-1 glow-primary ${(b as any).archived_at ? 'opacity-60' : ''} ${isAlert ? 'ring-1 ring-destructive/20' : ''} ${isSelected ? 'ring-2 ring-primary/40' : ''}`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-bold flex items-center gap-2.5">
              <Checkbox checked={isSelected} onCheckedChange={() => bulk.toggle(b.id)} className="mr-1" />
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ backgroundColor: (b.categories?.color || '#6C63FF') + '20' }}>{b.categories?.icon || '📁'}</div>
              <div>
                <span className="flex items-center gap-1.5">
                  {b.name}
                  {onceBadge}
                  {(b as any).archived_at && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-muted text-[9px] font-semibold text-muted-foreground uppercase tracking-wide">
                      <Archive className="w-2.5 h-2.5" />{isFr ? 'Archivé' : 'Archived'}
                    </span>
                  )}
                </span>
                <p className="text-[11px] font-normal text-muted-foreground">
                  {b.categories?.name || '-'} · {periodLabels[b.period] || b.period}
                  {isIncome && <span className="ml-1 text-secondary">↗</span>}
                  {' · '}{isMax ? (isFr ? 'Plafond' : 'Cap') : (isFr ? 'Objectif' : 'Target')}
                </p>
              </div>
            </CardTitle>
            <div className="flex gap-1">
              <Button aria-label="Modifier" variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-primary" onClick={() => openEdit(b)}><Pencil className="w-3.5 h-3.5" /></Button>
              <Button
                aria-label={(b as any).archived_at ? (isFr ? 'Restaurer' : 'Restore') : (isFr ? 'Archiver' : 'Archive')}
                title={(b as any).archived_at ? (isFr ? 'Restaurer' : 'Restore') : (isFr ? 'Archiver' : 'Archive')}
                variant="ghost" size="icon"
                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-accent"
                onClick={() => handleToggleArchive(b)}
              >
                {(b as any).archived_at ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
              </Button>
              <Button aria-label="Supprimer" variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive" onClick={() => setDeleteId(b.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Period budget — main display */}
          <div className="flex justify-between items-baseline">
            <span className="text-2xl font-extrabold amount-display">{fmt(actual)}</span>
            <span className="text-sm text-muted-foreground amount-display">/ {fmt(amount)}</span>
          </div>
          <Progress value={pct} className={`h-3 rounded-full ${isAlert ? '[&>div]:bg-destructive' : pct >= (b.alert_threshold ?? 80) ? (isMax ? '[&>div]:bg-accent' : '[&>div]:bg-secondary') : (isMax ? '[&>div]:bg-secondary' : '[&>div]:bg-accent')}`} />

          <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
            <span className="font-semibold">{Math.round(pct)}% {isMax ? (isFr ? 'consommé' : 'consumed') : (isFr ? 'atteint' : 'reached')}</span>
            <span>
              {onceCountdown ? onceCountdown
                : daysLabel === 'today' ? (isFr ? "📍 Aujourd'hui" : '📍 Today')
                : daysLabel === 'passed' ? (isFr ? '✅ Échéance passée' : '✅ Due date passed')
                : daysLabel === 'thisWeek' ? (isFr ? '📅 Cette semaine' : '📅 This week')
                : targetDateStr
                  ? `${daysLeft} ${t.daysRemaining} · ${targetDateStr}`
                  : `${daysLeft} ${t.daysRemaining}`}
            </span>
          </div>

          {/* Annualized summary — secondary display */}
          <div className="rounded-xl bg-muted/30 border border-border/30 px-3 py-2 space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground font-medium flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                {isFr ? 'Annualisé' : 'Annualized'}
              </span>
              <span className="font-bold amount-display text-primary">{fmt(annualized)}{isFr ? '/an' : '/yr'}</span>
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-muted-foreground">{isFr ? 'Consommé cette année' : 'Consumed this year'}</span>
              <span className="font-semibold amount-display">{fmt(annualActual)} <span className={`${annualPctRaw > 100 ? 'text-destructive' : annualPctRaw > 75 ? 'text-accent' : 'text-secondary'}`}>({Math.round(annualPctRaw)}%)</span></span>
            </div>
            <Progress value={Math.min(annualPct, 100)} className="h-1.5 rounded-full" />
          </div>

          {isAlert ? (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-destructive/5 border border-destructive/10">
              {isMax ? <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" /> : <TrendingDown className="w-4 h-4 text-destructive flex-shrink-0" />}
              <p className="text-xs font-semibold text-destructive">
                {isMax ? `${t.overBudget} — ${t.exceeded} ${fmt(actual - amount)}` : `${t.belowTarget} — ${isFr ? 'Manque' : 'Missing'} ${fmt(amount - actual)}`}
              </p>
            </div>
          ) : pct >= (b.alert_threshold ?? 80) && isMax ? (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-accent/5 border border-accent/10">
              <AlertTriangle className="w-4 h-4 text-accent flex-shrink-0" />
              <p className="text-xs font-semibold text-accent">
                {isFr ? `Seuil d'alerte atteint (${Math.round(pct)}%)` : `Alert threshold reached (${Math.round(pct)}%)`}
              </p>
            </div>
          ) : (
            <p className="text-xs font-medium text-secondary px-1 flex items-center gap-1">
              {isMax ? (
                <>✓ {t.onTrack} — {t.remaining}: {fmt(remaining)}</>
              ) : (
                <><CheckCircle className="w-3.5 h-3.5" /> {t.targetReached} {remaining > 0 ? `— +${fmt(remaining)}` : ''}</>
              )}
            </p>
          )}

          {/* Scheduling indicators */}
          {(b.expected_day || b.occurrence_frequency || b.reference_date || b.active_days) && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {b.reference_date && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/8 text-primary text-[10px] font-semibold border border-primary/15">
                  <Calendar className="w-3 h-3" />
                  {new Date(b.reference_date).toLocaleDateString(locale === 'en' ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'short' })}
                </span>
              )}
              {!b.reference_date && b.expected_day && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/8 text-primary text-[10px] font-semibold border border-primary/15">
                  <Clock className="w-3 h-3" />
                  {locale === 'fr' ? `Jour ${b.expected_day}` : `Day ${b.expected_day}`}
                </span>
              )}
              {b.occurrence_frequency && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent/10 text-accent-foreground text-[10px] font-semibold border border-accent/15">
                  <Repeat className="w-3 h-3" />
                  {occFreqLabels[b.occurrence_frequency] || b.occurrence_frequency}
                </span>
              )}
              {b.active_days && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary/10 text-secondary text-[10px] font-semibold border border-secondary/15">
                  <Calendar className="w-3 h-3" />
                  {b.active_days === '1,2,3,4,5,6,7' ? (locale === 'fr' ? '7j/7' : '7d/7') :
                   b.active_days === '1,2,3,4,5' ? (locale === 'fr' ? 'Lun-Ven' : 'Mon-Fri') :
                   b.active_days.split(',').map((d: string) => {
                     const labels: Record<string, string> = locale === 'fr' ? { '1': 'L', '2': 'M', '3': 'Me', '4': 'J', '5': 'V', '6': 'S', '7': 'D' } : { '1': 'M', '2': 'T', '3': 'W', '4': 'T', '5': 'F', '6': 'S', '7': 'S' };
                     return labels[d] || d;
                   }).join('·')}
                </span>
              )}
              {b.reference_date && ['quarterly', 'semi_annual', 'yearly'].includes(b.period) && (() => {
                const refDate = new Date(b.reference_date);
                const increment = b.period === 'quarterly' ? 3 : b.period === 'semi_annual' ? 6 : 12;
                const now = new Date();
                let d = new Date(refDate);
                while (d < now) { d.setMonth(d.getMonth() + increment); }
                return (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[10px] font-medium border border-border/50">
                    {locale === 'fr' ? 'Prochain' : 'Next'}: {d.toLocaleDateString(locale === 'en' ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'short' })}
                  </span>
                );
              })()}
            </div>
          )}
        </CardContent>
      </Card>
      </ScrollReveal>
    );
  };

  const renderEmptyState = (budgetType: string) => (
    <div className="relative overflow-hidden rounded-3xl border border-border/40 bg-gradient-to-br from-primary/5 via-background to-accent/5 backdrop-blur-sm">
      <div className="pointer-events-none absolute -top-16 -right-16 w-56 h-56 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 w-56 h-56 rounded-full bg-accent/10 blur-3xl" />
      <div className="relative py-14 px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 mx-auto mb-4 flex items-center justify-center text-3xl">
          {budgetType === 'income' ? '🎯' : '🧭'}
        </div>
        <p className="text-lg font-bold mb-1">{t.noBudgets}</p>
        <p className="text-sm text-muted-foreground/80 mb-5 max-w-sm mx-auto">
          {budgetType === 'income'
            ? t.createBudgetDescIncome
            : (isFr ? 'Donnez un cadre à vos dépenses — votre Coach vous guide en temps réel.' : 'Frame your spending — your Coach guides you in real time.')}
        </p>
        <Button size="sm" className="text-primary-foreground rounded-xl gap-1.5" style={{ background: 'var(--gradient-primary)' }} onClick={() => openNew(budgetType)}>
          <Plus className="w-4 h-4" />{t.addBudget}
        </Button>
      </div>
    </div>
  );

  const renderTabContent = (budgetsList: any[]) => (
    <>
      {bulk.hasSelection && (
        <BulkActionBar
          count={bulk.count}
          onDelete={() => setBulkDeleteOpen(true)}
          onModify={() => { setBulkModifyForm({ period: '', category_id: '' }); setBulkModifyOpen(true); }}
          onDuplicate={handleBulkDuplicate}
          onExportCSV={canExportAdvanced ? () => handleBulkExport('csv') : undefined}
          onExportExcel={canExportAdvanced ? () => handleBulkExport('excel') : undefined}
          onClear={bulk.clear}
        />
      )}
      {budgetsList.length === 0 ? renderEmptyState(activeTab) : (
        <div className="space-y-2">
          {budgetsList.length > 1 && (
            <div className="flex items-center gap-2 px-1">
              <Checkbox checked={bulk.isAllSelected} onCheckedChange={bulk.toggleAll} />
              <span className="text-xs text-muted-foreground">{locale === 'fr' ? 'Tout sélectionner' : 'Select all'}</span>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {budgetsList.map(renderBudgetCard)}
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className="space-y-6">
      <Tabs defaultValue="manage" value={activeMainTab} onValueChange={setActiveMainTab}>
        <TabsList className="rounded-xl mb-4 flex-wrap">
          <TabsTrigger value="manage" className="rounded-lg gap-1.5"><PieChart className="w-4 h-4" />{t.management}</TabsTrigger>
          <TabsTrigger value="evolution" className="rounded-lg gap-1.5"><BarChart3 className="w-4 h-4" />{isFr ? 'Évolution' : 'Evolution'}</TabsTrigger>
          <TabsTrigger value="analysis" className="rounded-lg gap-1.5"><TrendingUp className="w-4 h-4" />{t.budgetAnalysis}</TabsTrigger>
        </TabsList>

        <TabsContent value="evolution">
          <BudgetEvolutionTab />
        </TabsContent>

        <TabsContent value="analysis">
          <BudgetAnalysisTab />
        </TabsContent>

        <TabsContent value="manage" className="space-y-5">
      {budgetLimitReached && <UpgradeBanner message={t.limitBudgetsReached(limits.budgets)} />}

      <BudgetsHeroHeader
        budgets={activeBudgets}
        spending={spending}
        fmt={fmt}
        locale={locale as 'fr' | 'en'}
        t={t}
        onAddNew={() => openNew(activeTab)}
        onAiSuggest={handleAiSuggest}
        aiLoading={aiLoading}
        onAlertClick={() => setActiveMainTab('analysis')}
      />

      {activeBudgets.length > 0 && (
        <BudgetCoachInsights budgets={activeBudgets} spending={spending} fmt={fmt} locale={locale as 'fr' | 'en'} />
      )}

      {activeBudgets.length > 0 && <BudgetGlobalStats budgets={activeBudgets} spending={spending} fmt={fmt} onCardClick={(action) => {
        if (action === 'evolution') setActiveMainTab('evolution');
        else if (action === 'analysis') setActiveMainTab('analysis');
      }} />}

      {budgets.length > 0 && (
        <FilterToolbar
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder={locale === 'fr' ? 'Rechercher un budget...' : 'Search budgets...'}
          sortOptions={[
            { value: 'name', label: locale === 'fr' ? 'Nom' : 'Name' },
            { value: 'amount', label: t.amount },
            { value: 'spent', label: locale === 'fr' ? 'Consommé' : 'Spent' },
          ]}
          sortValue={sortField}
          onSortChange={v => setSortField(v as any)}
          sortOrder={sortOrder}
          onSortOrderToggle={() => setSortOrder(o => o === 'asc' ? 'desc' : 'asc')}
          filterChips={[
            { value: 'daily', label: t.daily, count: budgets.filter(b => b.period === 'daily').length },
            { value: 'weekly', label: t.weekly, count: budgets.filter(b => b.period === 'weekly').length },
            { value: 'monthly', label: t.monthly, count: budgets.filter(b => b.period === 'monthly').length },
            { value: 'quarterly', label: t.quarterly, count: budgets.filter(b => b.period === 'quarterly').length },
            { value: 'semi_annual', label: t.semiAnnual, count: budgets.filter(b => b.period === 'semi_annual').length },
            { value: 'yearly', label: t.yearly, count: budgets.filter(b => b.period === 'yearly').length },
          ]}
          activeFilter={filterPeriod}
          onFilterChange={setFilterPeriod}
          allLabel={locale === 'fr' ? 'Toutes périodes' : 'All periods'}
          totalCount={budgets.length}
        />
      )}

      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); bulk.clear(); }}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <TabsList className="rounded-xl">
            <TabsTrigger value="expense" className="rounded-lg gap-1.5">
              <TrendingDown className="w-3.5 h-3.5" />{t.expenseBudgets}
            </TabsTrigger>
            <TabsTrigger value="income" className="rounded-lg gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" />{t.incomeBudgets}
            </TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            {archivedCount > 0 && (
              <Button
                size="sm"
                variant={showArchived ? 'default' : 'outline'}
                className="rounded-xl gap-1.5"
                onClick={() => setShowArchived(v => !v)}
                title={isFr ? 'Afficher les cadres archivés' : 'Show archived budgets'}
              >
                <Archive className="w-3.5 h-3.5" />
                {showArchived
                  ? (isFr ? 'Masquer archivés' : 'Hide archived')
                  : (isFr ? `Archivés (${archivedCount})` : `Archived (${archivedCount})`)}
              </Button>
            )}
            <Button size="sm" className="text-primary-foreground rounded-xl" style={{ background: 'var(--gradient-primary)' }} onClick={() => openNew(activeTab)} disabled={budgetLimitReached}>
              <Plus className="w-4 h-4 mr-1" />{t.addBudget}
            </Button>
          </div>
        </div>

        <TabsContent value="expense" className="mt-4">
          {renderTabContent(expenseBudgets)}
        </TabsContent>
        <TabsContent value="income" className="mt-4">
          {renderTabContent(incomeBudgets)}
        </TabsContent>
      </Tabs>

      <BudgetForm
        open={dialogOpen}
        onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditId(null); }}
        editId={editId}
        form={form}
        setForm={setForm}
        errors={errors}
        saving={saving}
        onSave={handleSave}
        allCategories={allCategories}
        savingsGoals={savingsGoals}
        accounts={accounts}
        fmt={fmt}
        t={t}
        locale={locale}
        currency={currency}
      />

      {/* Bulk Modify Dialog */}
      <Dialog open={bulkModifyOpen} onOpenChange={setBulkModifyOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">{t.bulkModify}</DialogTitle>
            <DialogDescription>{bulk.count} {locale === 'fr' ? 'sélectionné(s)' : 'selected'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="form-label">{t.bulkModifyPeriod}</Label>
              <Select value={bulkModifyForm.period} onValueChange={v => setBulkModifyForm(f => ({ ...f, period: v }))}>
                <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder={locale === 'fr' ? 'Ne pas changer' : 'No change'} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">{t.daily}</SelectItem>
                  <SelectItem value="weekly">{t.weekly}</SelectItem>
                  <SelectItem value="monthly">{t.monthly}</SelectItem>
                  <SelectItem value="quarterly">{t.quarterly}</SelectItem>
                  <SelectItem value="semi_annual">{t.semiAnnual}</SelectItem>
                  <SelectItem value="yearly">{t.yearly}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="form-label">{t.bulkModifyCategory}</Label>
              <CategoryCombobox
                categories={allCategories.filter(c => c.type === activeTab)}
                value={bulkModifyForm.category_id}
                onValueChange={v => setBulkModifyForm(f => ({ ...f, category_id: v }))}
                placeholder={locale === 'fr' ? 'Ne pas changer' : 'No change'}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setBulkModifyOpen(false)} className="rounded-xl">{t.cancel}</Button>
            <Button className="text-primary-foreground rounded-xl" style={{ background: 'var(--gradient-primary)' }} onClick={handleBulkModify}>{t.applyChanges}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)} onConfirm={handleDelete} title={t.confirmDelete} description={t.confirmDeleteMessage} cancelLabel={t.cancel} confirmLabel={t.delete} />
      <ConfirmDeleteDialog open={bulkDeleteOpen} onOpenChange={() => setBulkDeleteOpen(false)} onConfirm={handleBulkDelete} title={t.deleteSelection} description={t.bulkDeleteConfirm(bulk.count)} cancelLabel={t.cancel} confirmLabel={t.delete} />

      {/* AI Suggestions Dialog */}
      <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2"><Sparkles className="w-5 h-5 text-primary" />{t.aiBudgetSuggestTitle}</DialogTitle>
            <DialogDescription>{t.aiBudgetSuggestDesc}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 max-h-[400px] overflow-y-auto">
            {aiLoading ? (
              <div className="flex flex-col items-center py-8 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">{t.aiBudgetSuggesting}</p>
              </div>
            ) : aiSuggestions.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">{t.aiBudgetNoSuggestions}</p>
            ) : (
              aiSuggestions.map((s, i) => {
                const cat = allCategories.find(c => c.id === s.category_id);
                return (
                  <Card key={i} className="border border-border/50 rounded-xl">
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{cat?.icon || '📁'}</span>
                          <div>
                            <p className="font-bold text-sm">{s.name}</p>
                            <p className="text-[11px] text-muted-foreground">{cat?.name || '-'} · {periodLabels[s.period] || s.period} · {s.budget_type === 'income' ? t.budgetTypeIncome : t.budgetTypeExpense}</p>
                          </div>
                        </div>
                        <span className="font-extrabold text-lg">{fmt(s.amount)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">{t.aiBudgetReason}: {s.reason}</p>
                      <Button size="sm" className="w-full rounded-xl text-primary-foreground" style={{ background: 'var(--gradient-primary)' }} onClick={() => acceptSuggestion(s)}>
                        <Plus className="w-3.5 h-3.5 mr-1" />{t.aiBudgetAccept}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BudgetsPage;
