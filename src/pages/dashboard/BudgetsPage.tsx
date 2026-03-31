import { useState, useMemo, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getBudgetPeriodBounds, formatDateStr, computeAnnualizedAmount, computeDaysRemaining } from '@/lib/budgetProjection';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useLanguage } from '@/i18n/LanguageContext';
import { useSubscription } from '@/hooks/useSubscription';
import { dashT } from '@/i18n/dashTranslations';
import { supabase } from '@/integrations/supabase/client';
import { useBudgets, useCategories, useInvalidate } from '@/hooks/useDashboardData';
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
import { Plus, Trash2, AlertTriangle, PieChart, Calendar, Tag, Pencil, TrendingUp, TrendingDown, CheckCircle, Search, Sparkles, Loader2, Clock, Repeat, BarChart3 } from 'lucide-react';
import { FilterToolbar } from '@/components/dashboard/FilterToolbar';
import { CategoryCombobox } from '@/components/dashboard/CategoryCombobox';
import { toast } from 'sonner';
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

const PERIOD_MULTIPLIER: Record<string, number> = {
  daily: 365, weekly: 52, monthly: 12, quarterly: 4, semi_annual: 2, yearly: 1,
};

const BudgetsPage = () => {
  const { user } = useAuth();
  const { locale } = useLanguage();
  const { fmt: fmtCurrency } = useProfile();
  const { limits, isPremium, canExportAdvanced } = useSubscription();
  const t = dashT[locale];
  const isFr = locale === 'fr';
  const { invalidate } = useInvalidate();
  const [searchParams] = useSearchParams();
  const initialSearch = searchParams.get('q') || '';

  const { data: budgets = [], isLoading: budLoading } = useBudgets();
  const { data: allCategories = [], isLoading: catLoading } = useCategories();
  const loading = budLoading || catLoading;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', amount: '', category_id: '', period: 'monthly', alert_threshold: '80', budget_type: 'expense', control_type: 'max', expected_day: '', occurrence_frequency: '', reference_date: '', active_days: '' });
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
    staleTime: 30_000,
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
    staleTime: 60_000,
  });

  const expenseBudgets = useMemo(() => {
    let result = budgets.filter(b => (b as any).budget_type !== 'income');
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
  }, [budgets, searchQuery, filterPeriod, sortField, sortOrder, spending]);

  const incomeBudgets = useMemo(() => {
    let result = budgets.filter(b => (b as any).budget_type === 'income');
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
  }, [budgets, searchQuery, filterPeriod, sortField, sortOrder, spending]);

  const currentBudgets = activeTab === 'expense' ? expenseBudgets : incomeBudgets;

  const bulk = useBulkSelection(currentBudgets);

  const refreshData = () => { invalidate('budgets', 'budget-spending'); bulk.clear(); };

  const budgetLimitReached = !isPremium && budgets.length >= limits.budgets;

  const VALID_PERIODS = ['daily', 'weekly', 'monthly', 'quarterly', 'semi_annual', 'yearly'] as const;

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = t.nameRequired;
    if (form.name.trim().length > 100) errs.name = t.maxChars(100);
    if (!form.amount || Number(form.amount) <= 0) errs.amount = t.invalidAmount;
    if (Number(form.amount) > 999999999) errs.amount = t.amountTooHigh;
    if (!VALID_PERIODS.includes(form.period as any)) errs.period = locale === 'fr' ? 'Période invalide' : 'Invalid period';
    // Validate reference_date for periodic budgets
    if (['quarterly', 'semi_annual', 'yearly'].includes(form.period) && !form.reference_date) {
      errs.reference_date = locale === 'fr' ? 'Date de référence requise pour cette période' : 'Reference date required for this period';
    }
    // Validate active_days for daily budgets
    if (form.period === 'daily') {
      const days = form.active_days.split(',').filter(Boolean);
      if (days.length === 0) {
        errs.active_days = locale === 'fr' ? 'Sélectionnez au moins un jour actif' : 'Select at least one active day';
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const openNew = (budgetType: string = 'expense') => {
    if (budgetLimitReached) { toast.error(t.limitBudgetsToast(limits.budgets)); return; }
    const cats = allCategories.filter(c => c.type === budgetType);
    setErrors({}); setEditId(null);
    setForm({ name: '', amount: '', category_id: cats[0]?.id || '', period: 'monthly', alert_threshold: '80', budget_type: budgetType, control_type: budgetType === 'income' ? 'min' : 'max', expected_day: '', occurrence_frequency: '', reference_date: '', active_days: '' });
    setDialogOpen(true);
  };

  const openEdit = (b: any) => {
    setErrors({}); setEditId(b.id);
    setForm({ name: b.name, amount: String(b.amount), category_id: b.category_id || '', period: b.period || 'monthly', alert_threshold: String(b.alert_threshold ?? 80), budget_type: b.budget_type || 'expense', control_type: b.control_type || 'max', expected_day: b.expected_day ? String(b.expected_day) : '', occurrence_frequency: b.occurrence_frequency || '', reference_date: b.reference_date || '', active_days: b.active_days || '' });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!user || !validate()) return;
    setSaving(true);
    const payload = { name: form.name.trim(), amount: Number(form.amount), category_id: form.category_id || null, period: form.period, alert_threshold: Number(form.alert_threshold) || 80, budget_type: form.budget_type, control_type: form.control_type, expected_day: form.expected_day ? Number(form.expected_day) : null, occurrence_frequency: form.occurrence_frequency || null, reference_date: form.reference_date || null, active_days: form.active_days || null };
    const { error } = editId
      ? await supabase.from('budgets').update(payload).eq('id', editId)
      : await supabase.from('budgets').insert({ ...payload, user_id: user.id });
    if (error) { toast.error(error.message); setSaving(false); return; }
    setSaving(false); setDialogOpen(false); setEditId(null);
    refreshData();
    toast.success(t.saved);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await supabase.from('budgets').delete().eq('id', deleteId);
    setDeleteId(null); refreshData();
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(bulk.selectedIds);
    const { error } = await supabase.from('budgets').delete().in('id', ids);
    if (error) { toast.error(error.message); setBulkDeleteOpen(false); return; }
    setBulkDeleteOpen(false); refreshData();
    toast.success(t.bulkDeleted(ids.length));
  };

  const handleBulkModify = async () => {
    const ids = Array.from(bulk.selectedIds);
    const updates: Record<string, any> = {};
    if (bulkModifyForm.period) updates.period = bulkModifyForm.period;
    if (bulkModifyForm.category_id) updates.category_id = bulkModifyForm.category_id;
    if (Object.keys(updates).length === 0) { toast.error(t.noChange); return; }
    const { error } = await supabase.from('budgets').update(updates).in('id', ids);
    if (error) { toast.error(error.message); return; }
    setBulkModifyOpen(false); setBulkModifyForm({ period: '', category_id: '' });
    refreshData();
    toast.success(t.bulkModified(ids.length));
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
    if (error) { toast.error(error.message); return; }
    refreshData();
    toast.success(t.bulkDuplicated(inserts.length));
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
    if (ok) toast.success(t.saved);
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

      const { data: fnData, error: fnError } = await supabase.functions.invoke('ai-budget-suggest', {
        body: {
          categories: allCategories.map(c => ({ id: c.id, name: c.name, type: c.type, icon: c.icon })),
          existingBudgets: budgets.map(b => ({ name: b.name, category_id: b.category_id, amount: b.amount, period: b.period, budget_type: (b as any).budget_type })),
          transactionSummary: Object.entries(summary).map(([cid, s]) => ({ category_id: cid, ...s })),
          locale,
        },
      });

      if (fnError) throw fnError;
      setAiSuggestions(fnData?.suggestions || []);
    } catch (e: any) {
      toast.error(e.message || 'AI error');
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
      name: s.name,
      amount: String(s.amount),
      category_id: s.category_id,
      period: s.period || 'monthly',
      alert_threshold: '80',
      budget_type: s.budget_type || 'expense',
      control_type: s.budget_type === 'income' ? 'min' : 'max',
      expected_day: '',
      occurrence_frequency: '',
      reference_date: '',
      active_days: '',
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

    // Annualized calculation
    const annualized = computeAnnualizedAmount(amount, b.period, b.active_days);
    const annualActual = annualSpending[b.category_id || ''] || 0;
    const annualPct = annualized > 0 ? Math.min((annualActual / annualized) * 100, 150) : 0;

    // Period calculations — smart days remaining
    const range = budgetPeriodRanges.find(r => r.id === b.id);
    const periodStart = range ? new Date(range.start) : new Date();
    const periodEnd = range ? new Date(range.end) : new Date();
    const today = new Date();
    const { daysLeft, label: daysLabel } = computeDaysRemaining(b.period, today, {
      expectedDay: b.expected_day,
      occurrenceFrequency: b.occurrence_frequency,
      referenceDate: b.reference_date,
      activeDays: b.active_days,
      periodStart,
      periodEnd,
    });

    const occFreqLabels: Record<string, string> = { once: t.occurrenceOnce, daily: t.daily, weekly: t.weekly, biweekly: t.occurrenceBiweekly, monthly: t.monthly, quarterly: t.quarterly, semi_annual: t.semiAnnual, yearly: t.yearly };

    return (
      <ScrollReveal key={b.id}>
      <Card className={`card-interactive hover:-translate-y-1 glow-primary ${isAlert ? 'ring-1 ring-destructive/20' : ''} ${isSelected ? 'ring-2 ring-primary/40' : ''}`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-bold flex items-center gap-2.5">
              <Checkbox checked={isSelected} onCheckedChange={() => bulk.toggle(b.id)} className="mr-1" />
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ backgroundColor: (b.categories?.color || '#6C63FF') + '20' }}>{b.categories?.icon || '📁'}</div>
              <div>
                <span>{b.name}</span>
                <p className="text-[11px] font-normal text-muted-foreground">
                  {b.categories?.name || '-'} · {periodLabels[b.period] || b.period}
                  {isIncome && <span className="ml-1 text-secondary">↗</span>}
                  {' · '}{isMax ? (isFr ? 'Plafond' : 'Cap') : (isFr ? 'Objectif' : 'Target')}
                </p>
              </div>
            </CardTitle>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-primary" onClick={() => openEdit(b)}><Pencil className="w-3.5 h-3.5" /></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive" onClick={() => setDeleteId(b.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
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
              {daysLabel === 'today' ? (isFr ? "📍 Aujourd'hui" : '📍 Today')
                : daysLabel === 'passed' ? (isFr ? '✅ Échéance passée' : '✅ Due date passed')
                : daysLabel === 'thisWeek' ? (isFr ? '📅 Cette semaine' : '📅 This week')
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
              <span className="font-semibold amount-display">{fmt(annualActual)} <span className={`${annualPct > 100 ? 'text-destructive' : annualPct > 75 ? 'text-accent' : 'text-secondary'}`}>({Math.round(annualPct)}%)</span></span>
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
    <Card className="border border-border/50 shadow-[var(--shadow-card)] rounded-2xl">
      <CardContent className="py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-muted mx-auto mb-4 flex items-center justify-center">
          {budgetType === 'income' ? <TrendingUp className="w-7 h-7 text-muted-foreground/40" /> : <PieChart className="w-7 h-7 text-muted-foreground/40" />}
        </div>
        <p className="text-lg font-semibold text-muted-foreground mb-2">{t.noBudgets}</p>
        <p className="text-sm text-muted-foreground/70 mb-4">{budgetType === 'income' ? t.createBudgetDescIncome : t.createBudgetDesc}</p>
        <Button size="sm" className="text-primary-foreground rounded-xl" style={{ background: 'var(--gradient-primary)' }} onClick={() => openNew(budgetType)}><Plus className="w-4 h-4 mr-1" />{t.addBudget}</Button>
      </CardContent>
    </Card>
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

        <TabsContent value="manage">
      {budgetLimitReached && <UpgradeBanner message={t.limitBudgetsReached(limits.budgets)} />}

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold font-display">{t.budgets}</h2>
        <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={handleAiSuggest} disabled={aiLoading}>
          {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {t.aiBudgetSuggest}
        </Button>
      </div>

      {budgets.length > 0 && <BudgetGlobalStats budgets={budgets} spending={spending} fmt={fmt} onCardClick={(action) => {
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
          <Button size="sm" className="text-primary-foreground rounded-xl" style={{ background: 'var(--gradient-primary)' }} onClick={() => openNew(activeTab)} disabled={budgetLimitReached}>
            <Plus className="w-4 h-4 mr-1" />{t.addBudget}
          </Button>
        </div>

        <TabsContent value="expense" className="mt-4">
          {renderTabContent(expenseBudgets)}
        </TabsContent>
        <TabsContent value="income" className="mt-4">
          {renderTabContent(incomeBudgets)}
        </TabsContent>
      </Tabs>

      <ResponsiveFormDialog
        open={dialogOpen}
        onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditId(null); }}
        title={editId ? t.editBudget : t.addBudget}
        description={form.budget_type === 'income' ? t.createBudgetDescIncome : t.createBudgetDesc}
        footer={
          <>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl">{t.cancel}</Button>
            <Button className="text-primary-foreground rounded-xl min-w-[120px]" style={{ background: 'var(--gradient-primary)' }} onClick={handleSave} disabled={saving}>{saving ? t.creating : t.save}</Button>
          </>
        }
      >
          <div className="space-y-4 py-2 form-animate">
            <div className="space-y-1.5">
              <Label className="form-label">{t.budgetName}</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} maxLength={100} placeholder={t.budgetPlaceholder} className={`rounded-xl h-10 ${errors.name ? 'border-destructive' : ''}`} />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>

            {!editId && (
              <div className="space-y-1.5">
                <Label className="form-label">{t.budgetType}</Label>
                <div className="grid grid-cols-2 gap-2">
                  {['expense', 'income'].map(bt => (
                    <button key={bt} type="button" onClick={() => {
                      const cats = allCategories.filter(c => c.type === bt);
                      setForm(f => ({ ...f, budget_type: bt, category_id: cats[0]?.id || '', control_type: bt === 'income' ? 'min' : 'max' }));
                    }}
                      className={`px-3 py-2 rounded-xl border text-sm font-semibold transition-all flex items-center gap-2 justify-center ${form.budget_type === bt ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted/50'}`}>
                      {bt === 'expense' ? <TrendingDown className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
                      {bt === 'expense' ? t.budgetTypeExpense : t.budgetTypeIncome}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground italic">
                  💡 {isFr ? 'Dépense = surveiller un plafond. Revenu = suivre un objectif minimum.' : 'Expense = monitor a cap. Income = track a minimum target.'}
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="form-label">{t.controlType}</Label>
              <div className="grid grid-cols-2 gap-2">
                {['max', 'min'].map(ct => (
                  <button key={ct} type="button" onClick={() => setForm(f => ({ ...f, control_type: ct }))}
                    className={`px-3 py-2 rounded-xl border text-xs font-semibold transition-all text-center ${form.control_type === ct ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted/50'}`}>
                    {ct === 'max' ? t.controlTypeMax : t.controlTypeMin}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground italic">
                💡 {form.control_type === 'max'
                  ? (isFr ? 'Plafond : alerte si vous dépassez le montant défini.' : 'Cap: alerts if you exceed the set amount.')
                  : (isFr ? 'Objectif : alerte si vous n\'atteignez pas le montant défini.' : 'Target: alerts if you don\'t reach the set amount.')}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="form-label flex items-center gap-1.5"><Tag className="w-3 h-3" />{t.category}</Label>
              <CategoryCombobox
                categories={filteredCategories}
                value={form.category_id}
                onValueChange={v => setForm(f => ({ ...f, category_id: v }))}
                placeholder={t.selectCategory}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="form-label">{t.alertThreshold}</Label>
                <Input type="number" min="1" max="100" value={form.alert_threshold} onChange={e => setForm(f => ({ ...f, alert_threshold: e.target.value }))} className="rounded-xl h-10" />
                <p className="text-[10px] text-muted-foreground italic">
                  💡 {isFr ? `Alerte déclenchée à ${form.alert_threshold || 80}% du montant.` : `Alert triggered at ${form.alert_threshold || 80}% of the amount.`}
                </p>
              </div>
            </div>


            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="form-label">{form.control_type === 'min' ? t.target : t.budgetAmount}</Label>
                <Input type="number" min="1" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" className={`rounded-xl h-10 text-lg font-bold ${errors.amount ? 'border-destructive' : ''}`} />
                {errors.amount && <p className="text-xs text-destructive">{errors.amount}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="form-label flex items-center gap-1.5"><Calendar className="w-3 h-3" />{t.period}</Label>
                <Select value={form.period} onValueChange={v => setForm(f => ({ ...f, period: v }))}>
                  <SelectTrigger className={`rounded-xl h-10 ${errors.period ? 'border-destructive' : ''}`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {VALID_PERIODS.map(p => (
                      <SelectItem key={p} value={p}>{periodLabels[p] || p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.period && <p className="text-xs text-destructive">{errors.period}</p>}
              </div>
            </div>

            {/* Period impact explanation */}
            <div className="rounded-xl bg-primary/5 border border-primary/10 px-3 py-2.5 space-y-1">
              <p className="text-[11px] font-bold text-primary flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5" />
                {isFr ? 'Impact du paramétrage' : 'Configuration impact'}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {(() => {
                  const amt = Number(form.amount) || 0;
                  const p = form.period;
                  const annualized = computeAnnualizedAmount(amt, p, form.active_days);
                  const activeDaysArr = form.active_days ? form.active_days.split(',').filter(Boolean) : [];
                  const activeDaysCount = p === 'daily' && activeDaysArr.length > 0 ? activeDaysArr.length : (p === 'daily' ? 7 : 0);

                  if (amt <= 0) return isFr ? 'Saisissez un montant pour voir l\'impact.' : 'Enter an amount to see the impact.';

                  const periodDesc: Record<string, string> = isFr ? {
                    daily: activeDaysCount < 7 && activeDaysCount > 0
                      ? `${fmt(amt)} × ${activeDaysCount} jours/sem × 52 sem = ${fmt(annualized)}/an`
                      : `${fmt(amt)} × 365 jours = ${fmt(annualized)}/an`,
                    weekly: `${fmt(amt)} × 52 semaines = ${fmt(annualized)}/an`,
                    monthly: `${fmt(amt)} × 12 mois = ${fmt(annualized)}/an`,
                    quarterly: `${fmt(amt)} × 4 trimestres = ${fmt(annualized)}/an`,
                    semi_annual: `${fmt(amt)} × 2 semestres = ${fmt(annualized)}/an`,
                    yearly: `${fmt(amt)}/an (budget annuel)`,
                  } : {
                    daily: activeDaysCount < 7 && activeDaysCount > 0
                      ? `${fmt(amt)} × ${activeDaysCount} days/wk × 52 wks = ${fmt(annualized)}/yr`
                      : `${fmt(amt)} × 365 days = ${fmt(annualized)}/yr`,
                    weekly: `${fmt(amt)} × 52 weeks = ${fmt(annualized)}/yr`,
                    monthly: `${fmt(amt)} × 12 months = ${fmt(annualized)}/yr`,
                    quarterly: `${fmt(amt)} × 4 quarters = ${fmt(annualized)}/yr`,
                    semi_annual: `${fmt(amt)} × 2 semesters = ${fmt(annualized)}/yr`,
                    yearly: `${fmt(amt)}/yr (annual budget)`,
                  };
                  return periodDesc[p] || '';
                })()}
              </p>
              {Number(form.amount) > 0 && (
                <p className="text-[11px] font-bold text-primary amount-display mt-1">
                  → {isFr ? 'Coût annuel' : 'Annual cost'}: {fmt(computeAnnualizedAmount(Number(form.amount), form.period, form.active_days))}
                </p>
              )}
            </div>

            {/* Expected day & occurrence frequency */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="form-label flex items-center gap-1.5">
                  <Calendar className="w-3 h-3" />{t.expectedDay}
                </Label>
                <Input
                  type="number"
                  min="1"
                  max={form.period === 'weekly' ? 7 : 31}
                  value={form.expected_day}
                  onChange={e => setForm(f => ({ ...f, expected_day: e.target.value }))}
                  placeholder={form.period === 'weekly' ? '1-7' : '1-31'}
                  className="rounded-xl h-10"
                />
                <p className="text-[10px] text-muted-foreground">
                  {form.period === 'weekly' ? t.expectedDayWeekHint : t.expectedDayMonthHint}
                </p>
                <p className="text-[10px] text-muted-foreground italic">
                  💡 {isFr
                    ? 'Indique QUAND la transaction est attendue. Le planificateur hebdomadaire placera le montant dans la bonne semaine.'
                    : 'Indicates WHEN the transaction is expected. The weekly planner will place the amount in the right week.'}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label className="form-label">{t.occurrenceFrequency}</Label>
                <Select value={form.occurrence_frequency} onValueChange={v => setForm(f => ({ ...f, occurrence_frequency: v }))}>
                  <SelectTrigger className="rounded-xl h-10"><SelectValue placeholder={t.occurrenceAuto} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="once">{t.occurrenceOnce}</SelectItem>
                    <SelectItem value="daily">{t.daily}</SelectItem>
                    <SelectItem value="weekly">{t.weekly}</SelectItem>
                    <SelectItem value="biweekly">{t.occurrenceBiweekly}</SelectItem>
                    <SelectItem value="monthly">{t.monthly}</SelectItem>
                    <SelectItem value="quarterly">{t.quarterly}</SelectItem>
                    <SelectItem value="semi_annual">{t.semiAnnual}</SelectItem>
                    <SelectItem value="yearly">{t.yearly}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground italic">
                  💡 {(() => {
                    const freq = form.occurrence_frequency;
                    const p = form.period;
                    if (!freq) return isFr ? 'Définit COMMENT le budget est réparti dans la période. Laissez vide pour une répartition proportionnelle.' : 'Defines HOW the budget is spread within the period. Leave empty for proportional distribution.';
                    const descs: Record<string, Record<string, string>> = {
                      fr: {
                        once: `Le montant total arrive en une seule fois dans la période ${periodLabels[p]?.toLowerCase() || p}.`,
                        daily: 'Le montant est prévu chaque jour actif.',
                        weekly: `Le montant ${periodLabels[p]?.toLowerCase() || p} est réparti sur chaque semaine.`,
                        biweekly: 'Le montant est réparti toutes les 2 semaines.',
                        monthly: 'Une occurrence par mois.',
                        quarterly: 'Une occurrence par trimestre.',
                        semi_annual: 'Une occurrence par semestre.',
                        yearly: 'Une occurrence par an.',
                      },
                      en: {
                        once: `The total amount arrives once in the ${periodLabels[p]?.toLowerCase() || p} period.`,
                        daily: 'The amount is expected each active day.',
                        weekly: `The ${periodLabels[p]?.toLowerCase() || p} amount is spread across each week.`,
                        biweekly: 'The amount is spread every 2 weeks.',
                        monthly: 'One occurrence per month.',
                        quarterly: 'One occurrence per quarter.',
                        semi_annual: 'One occurrence per semester.',
                        yearly: 'One occurrence per year.',
                      },
                    };
                    return (descs[isFr ? 'fr' : 'en'][freq] || '');
                  })()}
                </p>
              </div>
            </div>

            {/* Reference date for periodic budgets */}
            {['quarterly', 'semi_annual', 'yearly', 'monthly'].includes(form.period) && (
              <div className="space-y-1.5">
                <Label className="form-label flex items-center gap-1.5">
                  <Calendar className="w-3 h-3" />{t.referenceDate}
                </Label>
                <Input
                  type="date"
                  value={form.reference_date}
                  onChange={e => setForm(f => ({ ...f, reference_date: e.target.value }))}
                  className="rounded-xl h-10"
                />
                {errors.reference_date && <p className="text-xs text-destructive">{errors.reference_date}</p>}
                <p className="text-[10px] text-muted-foreground italic">
                  💡 {isFr
                    ? 'Point d\'ancrage pour calculer les cycles budgétaires. Ex: si vous mettez le 15/01, les trimestres seront 15/01, 15/04, 15/07, 15/10.'
                    : 'Anchor point for budget cycles. E.g. if you set Jan 15, quarters will be Jan 15, Apr 15, Jul 15, Oct 15.'}
                </p>
                {form.reference_date && ['quarterly', 'semi_annual', 'yearly'].includes(form.period) && (
                  <div className="bg-muted/50 rounded-lg px-3 py-2 text-[10px] space-y-0.5">
                    <p className="font-semibold text-muted-foreground">{t.nextOccurrence}:</p>
                    {(() => {
                      const refDate = new Date(form.reference_date);
                      const dates: string[] = [];
                      const increment = form.period === 'quarterly' ? 3 : form.period === 'semi_annual' ? 6 : 12;
                      const now = new Date();
                      let d = new Date(refDate);
                      while (d < now) { d.setMonth(d.getMonth() + increment); }
                      for (let i = 0; i < 4; i++) {
                        dates.push(d.toLocaleDateString(locale === 'en' ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }));
                        d = new Date(d); d.setMonth(d.getMonth() + increment);
                      }
                      return dates.map((dt, i) => <span key={i} className="inline-block mr-2 text-foreground font-medium">📅 {dt}</span>);
                    })()}
                  </div>
                )}
              </div>
            )}

            {/* Active days for daily budgets */}
            {form.period === 'daily' && (
              <div className="space-y-1.5">
                <Label className="form-label">{t.activeDays}</Label>
                <div className="flex gap-1.5">
                  {[
                    { key: '1', label: t.activeDaysMon },
                    { key: '2', label: t.activeDaysTue },
                    { key: '3', label: t.activeDaysWed },
                    { key: '4', label: t.activeDaysThu },
                    { key: '5', label: t.activeDaysFri },
                    { key: '6', label: t.activeDaysSat },
                    { key: '7', label: t.activeDaysSun },
                  ].map(day => {
                    const selected = form.active_days.split(',').filter(Boolean).includes(day.key);
                    return (
                      <button
                        key={day.key}
                        type="button"
                        onClick={() => {
                          const current = form.active_days.split(',').filter(Boolean);
                          const next = selected ? current.filter(d => d !== day.key) : [...current, day.key].sort();
                          setForm(f => ({ ...f, active_days: next.join(',') }));
                        }}
                        className={`w-9 h-9 rounded-lg text-[10px] font-bold transition-all border ${selected ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/30 text-muted-foreground border-border hover:bg-muted/50'}`}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-2 mt-1">
                  <button type="button" className="text-[10px] text-primary underline" onClick={() => setForm(f => ({ ...f, active_days: '1,2,3,4,5,6,7' }))}>{t.allDays}</button>
                  <button type="button" className="text-[10px] text-primary underline" onClick={() => setForm(f => ({ ...f, active_days: '1,2,3,4,5' }))}>{t.weekdays}</button>
                </div>
                {errors.active_days && <p className="text-xs text-destructive">{errors.active_days}</p>}
                <p className="text-[10px] text-muted-foreground italic">
                  💡 {isFr
                    ? `Le montant de ${fmt(Number(form.amount) || 0)} s'applique CHAQUE jour sélectionné. ${form.active_days ? `${form.active_days.split(',').filter(Boolean).length} jours × ${fmt(Number(form.amount) || 0)} = ${fmt((Number(form.amount) || 0) * form.active_days.split(',').filter(Boolean).length)}/semaine` : ''}`
                    : `The amount of ${fmt(Number(form.amount) || 0)} applies EACH selected day. ${form.active_days ? `${form.active_days.split(',').filter(Boolean).length} days × ${fmt(Number(form.amount) || 0)} = ${fmt((Number(form.amount) || 0) * form.active_days.split(',').filter(Boolean).length)}/week` : ''}`}
                </p>
              </div>
            )}
          </div>
      </ResponsiveFormDialog>

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
