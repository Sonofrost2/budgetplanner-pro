import { useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useLanguage } from '@/i18n/LanguageContext';
import { useSubscription } from '@/hooks/useSubscription';
import { dashT } from '@/i18n/dashTranslations';
import { supabase } from '@/integrations/supabase/client';
import { useBudgets, useCategories, useAllTransactions, useInvalidate } from '@/hooks/useDashboardData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2, AlertTriangle, PieChart, Calendar, Tag, Pencil, TrendingUp, TrendingDown, CheckCircle, Search } from 'lucide-react';
import { FilterToolbar } from '@/components/dashboard/FilterToolbar';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import ConfirmDeleteDialog from '@/components/dashboard/ConfirmDeleteDialog';
import UpgradeBanner from '@/components/dashboard/UpgradeBanner';
import BulkActionBar from '@/components/dashboard/BulkActionBar';
import { useBulkSelection } from '@/hooks/useBulkSelection';
import { exportToCSV, exportToExcel } from '@/lib/export';

const BudgetsPage = () => {
  const { user } = useAuth();
  const { locale } = useLanguage();
  const { fmt: fmtCurrency } = useProfile();
  const { limits, isPremium, canExportAdvanced } = useSubscription();
  const t = dashT[locale];
  const { invalidate } = useInvalidate();

  const { data: budgets = [], isLoading: budLoading } = useBudgets();
  const { data: allCategories = [], isLoading: catLoading } = useCategories();
  const { data: allTx = [], isLoading: txLoading } = useAllTransactions();
  const loading = budLoading || catLoading || txLoading;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', amount: '', category_id: '', period: 'monthly', alert_threshold: '80', budget_type: 'expense', control_type: 'max' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('expense');
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkModifyOpen, setBulkModifyOpen] = useState(false);
  const [bulkModifyForm, setBulkModifyForm] = useState({ period: '', category_id: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<'name' | 'amount' | 'spent'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [filterPeriod, setFilterPeriod] = useState('');

  const fmt = (n: number) => fmtCurrency(n, locale);

  const filteredCategories = useMemo(() =>
    allCategories.filter(c => c.type === form.budget_type),
    [allCategories, form.budget_type]
  );

  const spending = useMemo(() => {
    const now = new Date();
    const spendMap: Record<string, number> = {};
    budgets.forEach(b => {
      const bType = (b as any).budget_type || 'expense';
      const txType = bType === 'income' ? 'income' : 'expense';
      let start: string, end: string;
      if (b.period === 'daily') {
        start = now.toISOString().split('T')[0]; end = start;
      } else if (b.period === 'weekly') {
        const day = now.getDay();
        const ws = new Date(now); ws.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
        start = ws.toISOString().split('T')[0]; end = now.toISOString().split('T')[0];
      } else if (b.period === 'quarterly') {
        const q = Math.floor(now.getMonth() / 3);
        start = new Date(now.getFullYear(), q * 3, 1).toISOString().split('T')[0];
        end = new Date(now.getFullYear(), q * 3 + 3, 0).toISOString().split('T')[0];
      } else if (b.period === 'semi_annual') {
        const s = now.getMonth() < 6 ? 0 : 6;
        start = new Date(now.getFullYear(), s, 1).toISOString().split('T')[0];
        end = new Date(now.getFullYear(), s + 6, 0).toISOString().split('T')[0];
      } else if (b.period === 'yearly') {
        start = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
        end = new Date(now.getFullYear(), 11, 31).toISOString().split('T')[0];
      } else {
        start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      }
      const actual = allTx.filter(tx => tx.type === txType && tx.category_id === b.category_id && tx.date >= start && tx.date <= end)
        .reduce((s, tx) => s + Number(tx.amount), 0);
      if (b.category_id) spendMap[b.category_id] = actual;
    });
    return spendMap;
  }, [budgets, allTx]);

  const expenseBudgets = useMemo(() => {
    let result = budgets.filter(b => (b as any).budget_type !== 'income');
    if (searchQuery) { const q = searchQuery.toLowerCase(); result = result.filter(b => b.name.toLowerCase().includes(q) || b.categories?.name?.toLowerCase().includes(q)); }
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
    if (searchQuery) { const q = searchQuery.toLowerCase(); result = result.filter(b => b.name.toLowerCase().includes(q) || b.categories?.name?.toLowerCase().includes(q)); }
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

  const refreshData = () => { invalidate('budgets', 'all-transactions'); bulk.clear(); };

  const budgetLimitReached = !isPremium && budgets.length >= limits.budgets;

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = t.nameRequired;
    if (form.name.trim().length > 100) errs.name = t.maxChars(100);
    if (!form.amount || Number(form.amount) <= 0) errs.amount = t.invalidAmount;
    if (Number(form.amount) > 999999999) errs.amount = t.amountTooHigh;
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const openNew = (budgetType: string = 'expense') => {
    if (budgetLimitReached) { toast.error(t.limitBudgetsToast(limits.budgets)); return; }
    const cats = allCategories.filter(c => c.type === budgetType);
    setErrors({}); setEditId(null);
    setForm({ name: '', amount: '', category_id: cats[0]?.id || '', period: 'monthly', alert_threshold: '80', budget_type: budgetType, control_type: budgetType === 'income' ? 'min' : 'max' });
    setDialogOpen(true);
  };

  const openEdit = (b: any) => {
    setErrors({}); setEditId(b.id);
    setForm({ name: b.name, amount: String(b.amount), category_id: b.category_id || '', period: b.period || 'monthly', alert_threshold: String(b.alert_threshold ?? 80), budget_type: b.budget_type || 'expense', control_type: b.control_type || 'max' });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!user || !validate()) return;
    setSaving(true);
    const payload = { name: form.name.trim(), amount: Number(form.amount), category_id: form.category_id || null, period: form.period, alert_threshold: Number(form.alert_threshold) || 80, budget_type: form.budget_type, control_type: form.control_type };
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

    return (
      <Card key={b.id} className={`border border-border/50 shadow-[var(--shadow-card)] rounded-2xl hover:shadow-[var(--shadow-soft)] transition-shadow ${isAlert ? 'ring-1 ring-destructive/20' : ''} ${isSelected ? 'ring-2 ring-primary/40' : ''}`}>
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
                  {' · '}{isMax ? (locale === 'fr' ? 'Plafond' : 'Cap') : (locale === 'fr' ? 'Objectif' : 'Target')}
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
          <div className="flex justify-between items-baseline">
            <span className="text-2xl font-extrabold">{fmt(actual)}</span>
            <span className="text-sm text-muted-foreground">/ {fmt(amount)}</span>
          </div>
          <Progress value={pct} className={`h-3 rounded-full ${isAlert ? '[&>div]:bg-destructive' : pct >= (b.alert_threshold ?? 80) ? (isMax ? '[&>div]:bg-accent' : '[&>div]:bg-secondary') : (isMax ? '[&>div]:bg-secondary' : '[&>div]:bg-accent')}`} />
          {isAlert ? (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-destructive/5 border border-destructive/10">
              {isMax ? <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" /> : <TrendingDown className="w-4 h-4 text-destructive flex-shrink-0" />}
              <p className="text-xs font-semibold text-destructive">
                {isMax ? `${t.overBudget} — ${t.exceeded} ${fmt(actual - amount)}` : `${t.belowTarget} — ${locale === 'fr' ? 'Manque' : 'Missing'} ${fmt(amount - actual)}`}
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
        </CardContent>
      </Card>
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
      {budgetLimitReached && <UpgradeBanner message={t.limitBudgetsReached(limits.budgets)} />}

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold font-display">{t.budgets}</h2>
      </div>

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
            { value: 'weekly', label: t.weekly, count: budgets.filter(b => b.period === 'weekly').length },
            { value: 'monthly', label: t.monthly, count: budgets.filter(b => b.period === 'monthly').length },
            { value: 'yearly', label: t.yearly, count: budgets.filter(b => b.period === 'yearly').length },
          ].filter(c => c.count > 0)}
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

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditId(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">{editId ? t.editBudget : t.addBudget}</DialogTitle>
            <DialogDescription>{form.budget_type === 'income' ? t.createBudgetDescIncome : t.createBudgetDesc}</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t.budgetName}</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} maxLength={100} placeholder={t.budgetPlaceholder} className={`rounded-xl h-11 ${errors.name ? 'border-destructive' : ''}`} />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>

            {!editId && (
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t.budgetType}</Label>
                <div className="grid grid-cols-2 gap-2">
                  {['expense', 'income'].map(bt => (
                    <button key={bt} type="button" onClick={() => {
                      const cats = allCategories.filter(c => c.type === bt);
                      setForm(f => ({ ...f, budget_type: bt, category_id: cats[0]?.id || '', control_type: bt === 'income' ? 'min' : 'max' }));
                    }}
                      className={`px-3 py-2.5 rounded-xl border text-sm font-semibold transition-all flex items-center gap-2 justify-center ${form.budget_type === bt ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted/50'}`}>
                      {bt === 'expense' ? <TrendingDown className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
                      {bt === 'expense' ? t.budgetTypeExpense : t.budgetTypeIncome}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t.controlType}</Label>
              <div className="grid grid-cols-1 gap-1.5">
                {['max', 'min'].map(ct => (
                  <button key={ct} type="button" onClick={() => setForm(f => ({ ...f, control_type: ct }))}
                    className={`px-3 py-2 rounded-lg border text-xs font-semibold transition-all text-left ${form.control_type === ct ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted/50'}`}>
                    {ct === 'max' ? t.controlTypeMax : t.controlTypeMin}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><Tag className="w-3 h-3" />{t.category}</Label>
              <Select value={form.category_id} onValueChange={v => setForm(f => ({ ...f, category_id: v }))}>
                <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder={t.selectCategory} /></SelectTrigger>
                <SelectContent>{filteredCategories.map(c => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t.alertThreshold}</Label>
              <Input type="number" min="1" max="100" value={form.alert_threshold} onChange={e => setForm(f => ({ ...f, alert_threshold: e.target.value }))} className="rounded-xl h-11 w-24" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{form.control_type === 'min' ? t.target : t.budgetAmount}</Label>
                <Input type="number" min="1" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" className={`rounded-xl h-11 text-lg font-bold ${errors.amount ? 'border-destructive' : ''}`} />
                {errors.amount && <p className="text-xs text-destructive">{errors.amount}</p>}
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><Calendar className="w-3 h-3" />{t.period}</Label>
                <div className="grid grid-cols-1 gap-1.5">
                  {['weekly', 'monthly', 'yearly'].map(p => (
                    <button key={p} type="button" onClick={() => setForm(f => ({ ...f, period: p }))}
                      className={`px-3 py-2 rounded-lg border text-xs font-semibold transition-all text-left ${form.period === p ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted/50'}`}>
                      {p === 'weekly' ? t.weekly : p === 'monthly' ? t.monthly : t.yearly}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl">{t.cancel}</Button>
            <Button className="text-primary-foreground rounded-xl min-w-[120px]" style={{ background: 'var(--gradient-primary)' }} onClick={handleSave} disabled={saving}>{saving ? t.creating : t.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Modify Dialog */}
      <Dialog open={bulkModifyOpen} onOpenChange={setBulkModifyOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">{t.bulkModify}</DialogTitle>
            <DialogDescription>{bulk.count} {locale === 'fr' ? 'sélectionné(s)' : 'selected'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t.bulkModifyPeriod}</Label>
              <Select value={bulkModifyForm.period} onValueChange={v => setBulkModifyForm(f => ({ ...f, period: v }))}>
                <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder={locale === 'fr' ? 'Ne pas changer' : 'No change'} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">{t.weekly}</SelectItem>
                  <SelectItem value="monthly">{t.monthly}</SelectItem>
                  <SelectItem value="yearly">{t.yearly}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t.bulkModifyCategory}</Label>
              <Select value={bulkModifyForm.category_id} onValueChange={v => setBulkModifyForm(f => ({ ...f, category_id: v }))}>
                <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder={locale === 'fr' ? 'Ne pas changer' : 'No change'} /></SelectTrigger>
                <SelectContent>{allCategories.filter(c => c.type === activeTab).map(c => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>)}</SelectContent>
              </Select>
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
    </div>
  );
};

export default BudgetsPage;
