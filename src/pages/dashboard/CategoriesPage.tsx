import { useState, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/i18n/LanguageContext';
import { dashT } from '@/i18n/dashTranslations';
import { supabase } from '@/integrations/supabase/client';
import { useCategories, useInvalidate, type Category } from '@/hooks/useDashboardData';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ResponsiveFormDialog } from '@/components/ui/responsive-form-dialog';
import { InputField } from '@/components/ui/input-field';
import { FormSection } from '@/components/ui/form-section';
import { Plus, Tag, Palette, Inbox, Merge, FolderTree, Download, Upload } from 'lucide-react';
import CategoryEvolutionChart from '@/components/dashboard/categories/CategoryEvolutionChart';
import { CategoriesHeroHeader } from '@/components/dashboard/categories/CategoriesHeroHeader';
import { CategoryTreeView } from '@/components/dashboard/categories/CategoryTreeView';
import { CategoryCoachTab } from '@/components/dashboard/categories/CategoryCoachTab';
import { CategoryTemplatesDialog } from '@/components/dashboard/categories/CategoryTemplatesDialog';
import { MergeCategoriesDialog } from '@/components/dashboard/categories/MergeCategoriesDialog';
import { FilterToolbar } from '@/components/dashboard/FilterToolbar';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import ConfirmDeleteDialog from '@/components/dashboard/ConfirmDeleteDialog';
import BulkActionBar from '@/components/dashboard/BulkActionBar';
import { useBulkSelection } from '@/hooks/useBulkSelection';
import { exportToCSV, exportToExcel } from '@/lib/export';
import { fetchCategoryAnalytics, type CategoryStats } from '@/lib/categoryAnalytics';

const ICONS = ['🛒', '🚗', '🏠', '🎮', '💊', '💰', '💻', '📚', '👗', '🍽️', '✈️', '🎬', '📱', '💡', '🏥', '🎁', '🔧', '📁'];
const COLORS = ['#22C55E', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444', '#10B981', '#6366F1', '#EC4899', '#14B8A6', '#F97316'];

const CategoriesPage = () => {
  const { user } = useAuth();
  const { locale } = useLanguage();
  const t = dashT[locale];
  const isFr = locale === 'fr';
  const { invalidate } = useInvalidate();

  const { data: categories = [], isLoading: catLoading } = useCategories();

  const { data: txCounts = {}, isLoading: txCountLoading } = useQuery({
    queryKey: ['category-tx-counts', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('transactions').select('category_id').eq('user_id', user!.id).not('category_id', 'is', null);
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data ?? []).forEach(tx => { if (tx.category_id) counts[tx.category_id] = (counts[tx.category_id] || 0) + 1; });
      return counts;
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  const { data: analytics = {}, isLoading: anaLoading } = useQuery<Record<string, CategoryStats>>({
    queryKey: ['category-analytics', user?.id],
    queryFn: () => fetchCategoryAnalytics(user!.id),
    enabled: !!user,
    staleTime: 60_000,
  });

  const loading = catLoading || txCountLoading || anaLoading;

  // dialogs
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteWarning, setDeleteWarning] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', icon: '📁', color: '#6C63FF', type: 'expense', parent_category_id: '' });
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkModifyOpen, setBulkModifyOpen] = useState(false);
  const [bulkModifyForm, setBulkModifyForm] = useState({ type: '' });
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeTab, setTypeTab] = useState<'expense' | 'income'>('expense');

  const bulk = useBulkSelection(categories);

  const refreshData = () => { invalidate('categories', 'category-tx-counts', 'category-analytics', 'budgets'); bulk.clear(); };

  const filteredCategories = useMemo(() => {
    let result = categories.filter(c => c.type === typeTab);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(c => c.name.toLowerCase().includes(q));
    }
    return result;
  }, [categories, typeTab, searchQuery]);

  // Possible parents = root cats of same type
  const parentCandidates = useMemo(
    () => categories.filter(c => c.type === form.type && !c.parent_category_id && c.id !== editing?.id),
    [categories, form.type, editing?.id]
  );

  const openNew = () => {
    setEditing(null); setFormErrors({});
    setForm({ name: '', icon: '📁', color: '#6C63FF', type: typeTab, parent_category_id: '' });
    setDialogOpen(true);
  };
  const openEdit = (cat: Category) => {
    setEditing(cat); setFormErrors({});
    setForm({ name: cat.name, icon: cat.icon, color: cat.color, type: cat.type, parent_category_id: cat.parent_category_id ?? '' });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = isFr ? 'Le nom est requis' : 'Name is required';
    else if (form.name.trim().length > 50) errs.name = isFr ? 'Max 50 caractères' : 'Max 50 characters';
    else {
      const dup = categories.find(c => c.name.toLowerCase() === form.name.trim().toLowerCase() && c.id !== editing?.id);
      if (dup) errs.name = isFr ? 'Ce nom existe déjà' : 'This name already exists';
    }
    setFormErrors(errs);
    if (Object.keys(errs).length > 0 || !user) return;

    const payload = {
      user_id: user.id,
      name: form.name.trim(),
      icon: form.icon,
      color: form.color,
      type: form.type,
      parent_category_id: form.parent_category_id || null,
    };
    if (editing) {
      const { error } = await supabase.from('categories').update(payload).eq('id', editing.id);
      if (error) { toast.error(error.message); return; }
    } else {
      const { error } = await supabase.from('categories').insert(payload);
      if (error) { toast.error(error.message); return; }
    }
    setDialogOpen(false); refreshData(); toast.success(t.saved);
  };

  const handleDeleteRequest = (id: string) => {
    const count = txCounts[id] || 0;
    setDeleteWarning(count > 0
      ? (isFr ? `Cette catégorie est utilisée par ${count} transaction(s). Les transactions perdront leur catégorie.` : `This category is used by ${count} transaction(s). Transactions will lose their category.`)
      : null);
    setDeleteId(id);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await supabase.from('categories').delete().eq('id', deleteId);
    setDeleteId(null); setDeleteWarning(null); refreshData(); toast.success(t.delete + ' ✓');
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(bulk.selectedIds);
    const { error } = await supabase.from('categories').delete().in('id', ids);
    if (error) { toast.error(error.message); setBulkDeleteOpen(false); return; }
    setBulkDeleteOpen(false); refreshData();
    toast.success(t.bulkDeleted(ids.length));
  };

  const handleBulkModify = async () => {
    const ids = Array.from(bulk.selectedIds);
    if (!bulkModifyForm.type) { toast.error(t.noChange); return; }
    const { error } = await supabase.from('categories').update({ type: bulkModifyForm.type }).in('id', ids);
    if (error) { toast.error(error.message); return; }
    setBulkModifyOpen(false); setBulkModifyForm({ type: '' }); refreshData();
    toast.success(t.bulkModified(ids.length));
  };

  const handleBulkDuplicate = async () => {
    if (!user) return;
    const inserts = bulk.selectedItems.map(c => ({ user_id: user.id, name: c.name + ' (copie)', icon: c.icon, color: c.color, type: c.type }));
    const { error } = await supabase.from('categories').insert(inserts);
    if (error) { toast.error(error.message); return; }
    refreshData(); toast.success(t.bulkDuplicated(inserts.length));
  };

  const handleBulkExport = (format: 'csv' | 'excel') => {
    const data = bulk.selectedItems.map(c => ({
      [isFr ? 'Nom' : 'Name']: c.name,
      [t.type]: c.type === 'expense' ? t.expenseType : t.incomeType,
      [isFr ? 'Icône' : 'Icon']: c.icon,
      [isFr ? 'Couleur' : 'Color']: c.color,
      ['Transactions']: txCounts[c.id] || 0,
    }));
    const ok = format === 'csv' ? exportToCSV(data, 'categories') : exportToExcel(data, 'categories');
    if (ok) toast.success(t.saved);
  };

  const handleReparent = async (childId: string, newParentId: string | null) => {
    if (!user) return;
    // Block: cannot put a parent under another category
    const child = categories.find(c => c.id === childId);
    if (!child) return;
    if (newParentId) {
      const target = categories.find(c => c.id === newParentId);
      if (!target || target.type !== child.type) {
        toast.error(isFr ? 'Type incompatible' : 'Incompatible type');
        return;
      }
      if (target.parent_category_id) {
        toast.error(isFr ? 'Hiérarchie max 2 niveaux' : 'Max 2-level hierarchy');
        return;
      }
    }
    const { error } = await supabase.rpc('bulk_reparent_categories', {
      p_user_id: user.id,
      p_category_ids: [childId],
      p_new_parent_id: newParentId,
    });
    if (error) { toast.error(error.message); return; }
    refreshData();
    toast.success(newParentId ? (isFr ? 'Déplacée' : 'Moved') : (isFr ? 'Mise à la racine' : 'Moved to root'));
  };

  const handleExportAll = () => {
    const data = categories.map(c => ({
      id: c.id, name: c.name, icon: c.icon, color: c.color, type: c.type, parent_category_id: c.parent_category_id ?? null,
    }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `categories-${new Date().toISOString().slice(0, 10)}.json`;
    a.click(); URL.revokeObjectURL(url);
    toast.success(isFr ? 'Exporté' : 'Exported');
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    try {
      const text = await file.text();
      const arr = JSON.parse(text);
      if (!Array.isArray(arr)) throw new Error('Invalid file');
      const inserts = arr.map((it: any) => ({
        user_id: user.id,
        name: String(it.name).slice(0, 50),
        icon: String(it.icon ?? '📁'),
        color: String(it.color ?? '#6C63FF'),
        type: it.type === 'income' ? 'income' : 'expense',
      }));
      const { error } = await supabase.from('categories').insert(inserts);
      if (error) throw error;
      refreshData();
      toast.success(isFr ? `${inserts.length} catégories importées` : `${inserts.length} categories imported`);
    } catch (err: any) {
      toast.error(err.message ?? 'Import failed');
    } finally {
      e.target.value = '';
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-44 rounded-3xl" />
        <Skeleton className="h-10 w-72 rounded-xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <CategoriesHeroHeader
        categories={categories}
        stats={analytics}
        onCreate={openNew}
        onOpenTemplates={() => setTemplatesOpen(true)}
        isFr={isFr}
      />

      <Tabs defaultValue="tree" className="space-y-4">
        <TabsList className="bg-[hsl(var(--glass))] backdrop-blur-xl border border-[hsl(var(--glass-border))] rounded-2xl p-1 h-auto flex-wrap">
          <TabsTrigger value="tree" className="rounded-xl data-[state=active]:bg-[var(--gradient-primary)] data-[state=active]:text-primary-foreground gap-1.5">
            <FolderTree className="w-4 h-4" />{isFr ? 'Arborescence' : 'Tree'}
          </TabsTrigger>
          <TabsTrigger value="evolution" className="rounded-xl data-[state=active]:bg-[var(--gradient-primary)] data-[state=active]:text-primary-foreground">
            {isFr ? 'Évolution' : 'Evolution'}
          </TabsTrigger>
          <TabsTrigger value="coach" className="rounded-xl data-[state=active]:bg-[var(--gradient-primary)] data-[state=active]:text-primary-foreground">
            {isFr ? 'Coach IA' : 'AI Coach'}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tree" className="space-y-4 mt-0">
          {/* Type pills + actions */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="inline-flex rounded-xl border border-border/60 bg-muted/30 p-1">
              <button onClick={() => setTypeTab('expense')} className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-all ${typeTab === 'expense' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}>
                📉 {t.expenseType}
              </button>
              <button onClick={() => setTypeTab('income')} className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-all ${typeTab === 'income' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}>
                📈 {t.incomeType}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={handleExportAll}>
                <Download className="w-3.5 h-3.5" />JSON
              </Button>
              <label className="cursor-pointer">
                <input type="file" accept="application/json" className="hidden" onChange={handleImport} />
                <span className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-border bg-background hover:bg-muted/50 text-xs">
                  <Upload className="w-3.5 h-3.5" />Import
                </span>
              </label>
            </div>
          </div>

          {categories.length > 0 && (
            <FilterToolbar
              searchValue={searchQuery}
              onSearchChange={setSearchQuery}
              searchPlaceholder={isFr ? 'Rechercher une catégorie...' : 'Search categories...'}
              sortOptions={[]}
              sortValue=""
              onSortChange={() => {}}
              sortOrder="asc"
              onSortOrderToggle={() => {}}
            />
          )}

          {bulk.hasSelection && (
            <BulkActionBar
              count={bulk.count}
              onDelete={() => setBulkDeleteOpen(true)}
              onModify={() => { setBulkModifyForm({ type: '' }); setBulkModifyOpen(true); }}
              onDuplicate={handleBulkDuplicate}
              onExportCSV={() => handleBulkExport('csv')}
              onExportExcel={() => handleBulkExport('excel')}
              onClear={bulk.clear}
              extraActions={
                bulk.count >= 2 ? (
                  <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={() => setMergeOpen(true)}>
                    <Merge className="w-3.5 h-3.5" />{isFr ? 'Fusionner' : 'Merge'}
                  </Button>
                ) : null
              }
            />
          )}

          {categories.length === 0 ? (
            <Card className="border border-border/50 shadow-[var(--shadow-card)] rounded-2xl">
              <CardContent className="py-16 text-center">
                <Inbox className="w-16 h-16 text-muted-foreground/40 mx-auto mb-4" />
                <p className="text-lg font-medium text-muted-foreground mb-2">{t.noCategories}</p>
                <div className="flex justify-center gap-2 mt-3">
                  <Button size="sm" className="text-primary-foreground rounded-xl" style={{ background: 'var(--gradient-primary)' }} onClick={openNew}>
                    <Plus className="w-4 h-4 mr-1" />{t.addCategory}
                  </Button>
                  <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setTemplatesOpen(true)}>
                    {isFr ? 'Templates' : 'Templates'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <CategoryTreeView
              categories={filteredCategories}
              stats={analytics}
              txCounts={txCounts}
              selectedIds={bulk.selectedIds}
              onToggleSelect={bulk.toggle}
              onEdit={openEdit}
              onDelete={handleDeleteRequest}
              onReparent={handleReparent}
              isFr={isFr}
            />
          )}
        </TabsContent>

        <TabsContent value="evolution" className="mt-0">
          <CategoryEvolutionChart />
        </TabsContent>

        <TabsContent value="coach" className="mt-0">
          <CategoryCoachTab categories={categories} stats={analytics} isFr={isFr} onRefresh={refreshData} />
        </TabsContent>
      </Tabs>

      <ResponsiveFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? t.edit : t.addCategory}
        description={isFr ? 'Configurez votre catégorie' : 'Configure your category'}
        footer={
          <>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl">{t.cancel}</Button>
            <Button className="text-primary-foreground rounded-xl" style={{ background: 'var(--gradient-primary)' }} onClick={handleSave}>{t.save}</Button>
          </>
        }
      >
        <div className="space-y-5 form-animate">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/50">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl" style={{ background: form.color + '20' }}>{form.icon}</div>
            <div>
              <p className="font-semibold text-sm">{form.name || (isFr ? 'Nom de la catégorie' : 'Category name')}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: form.color }} />
                <span className="text-xs text-muted-foreground">{form.type === 'expense' ? t.expenseType : t.incomeType}</span>
              </div>
            </div>
          </div>

          <FormSection title={isFr ? 'Informations' : 'Details'} icon={<Tag className="w-3.5 h-3.5" />}>
            <InputField
              label={t.categoryName}
              icon={<Tag className="w-3.5 h-3.5" />}
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              maxLength={50} charCount error={formErrors.name}
              placeholder={isFr ? 'Ex: Alimentation, Transport...' : 'E.g: Food, Transport...'}
            />
            <div className="space-y-1.5">
              <Label className="form-label">{t.type}</Label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v, parent_category_id: '' }))}>
                <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">📉 {t.expenseType}</SelectItem>
                  <SelectItem value="income">📈 {t.incomeType}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="form-label">{isFr ? 'Catégorie parente (optionnel)' : 'Parent category (optional)'}</Label>
              <Select value={form.parent_category_id || '__none__'} onValueChange={v => setForm(f => ({ ...f, parent_category_id: v === '__none__' ? '' : v }))}>
                <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— {isFr ? 'Aucune (racine)' : 'None (root)'} —</SelectItem>
                  {parentCandidates.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </FormSection>

          <FormSection title={isFr ? 'Apparence' : 'Appearance'} icon={<Palette className="w-3.5 h-3.5" />}>
            <div className="space-y-1.5">
              <Label className="form-label">{t.iconLabel}</Label>
              <div className="grid grid-cols-9 gap-1.5">
                {ICONS.map(ic => (
                  <button key={ic} onClick={() => setForm(f => ({ ...f, icon: ic }))}
                    className={`text-xl p-2 rounded-xl border-2 transition-all ${form.icon === ic ? 'border-primary bg-primary/10 scale-110 shadow-sm' : 'border-border hover:bg-muted hover:scale-105'}`}>
                    {ic}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="form-label">{t.colorLabel}</Label>
              <div className="flex flex-wrap gap-2.5">
                {COLORS.map(c => (
                  <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                    className={`w-9 h-9 rounded-full border-[3px] transition-all ${form.color === c ? 'border-foreground scale-110 shadow-md' : 'border-transparent hover:scale-110'}`}
                    style={{ background: c }} />
                ))}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} className="w-10 h-8 p-0 border-none cursor-pointer rounded-lg" />
                <span className="text-[10px] text-muted-foreground font-mono">{form.color}</span>
              </div>
            </div>
          </FormSection>
        </div>
      </ResponsiveFormDialog>

      <Dialog open={bulkModifyOpen} onOpenChange={setBulkModifyOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">{t.bulkModify}</DialogTitle>
            <DialogDescription>{bulk.count} {isFr ? 'sélectionné(s)' : 'selected'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t.bulkModifyType}</Label>
              <Select value={bulkModifyForm.type} onValueChange={v => setBulkModifyForm({ type: v })}>
                <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder={isFr ? 'Choisir...' : 'Select...'} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">{t.expenseType}</SelectItem>
                  <SelectItem value="income">{t.incomeType}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setBulkModifyOpen(false)} className="rounded-xl">{t.cancel}</Button>
            <Button className="text-primary-foreground rounded-xl" style={{ background: 'var(--gradient-primary)' }} onClick={handleBulkModify}>{t.applyChanges}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CategoryTemplatesDialog open={templatesOpen} onOpenChange={setTemplatesOpen} isFr={isFr} onApplied={refreshData} />

      <MergeCategoriesDialog
        open={mergeOpen}
        onOpenChange={setMergeOpen}
        sources={bulk.selectedItems}
        candidates={categories.filter(c => c.type === (bulk.selectedItems[0]?.type ?? 'expense'))}
        isFr={isFr}
        onDone={refreshData}
      />

      <ConfirmDeleteDialog open={!!deleteId} onOpenChange={() => { setDeleteId(null); setDeleteWarning(null); }} onConfirm={handleDelete} title={t.confirmDelete} description={deleteWarning || t.confirmDeleteMessage} cancelLabel={t.cancel} confirmLabel={t.delete} />
      <ConfirmDeleteDialog open={bulkDeleteOpen} onOpenChange={() => setBulkDeleteOpen(false)} onConfirm={handleBulkDelete} title={t.deleteSelection} description={t.bulkDeleteConfirm(bulk.count)} cancelLabel={t.cancel} confirmLabel={t.delete} />
    </div>
  );
};

export default CategoriesPage;
