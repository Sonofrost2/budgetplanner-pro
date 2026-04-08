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
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ResponsiveFormDialog } from '@/components/ui/responsive-form-dialog';
import { InputField } from '@/components/ui/input-field';
import { FormSection } from '@/components/ui/form-section';
import { Plus, Pencil, Trash2, Inbox, Tag, Palette } from 'lucide-react';
import CategoryEvolutionChart from '@/components/dashboard/categories/CategoryEvolutionChart';
import { FilterToolbar } from '@/components/dashboard/FilterToolbar';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import ConfirmDeleteDialog from '@/components/dashboard/ConfirmDeleteDialog';
import BulkActionBar from '@/components/dashboard/BulkActionBar';
import { useBulkSelection } from '@/hooks/useBulkSelection';
import { exportToCSV, exportToExcel } from '@/lib/export';

const ICONS = ['🛒', '🚗', '🏠', '🎮', '💊', '💰', '💻', '📚', '👗', '🍽️', '✈️', '🎬', '📱', '💡', '🏥', '🎁', '🔧', '📁'];
const COLORS = ['#22C55E', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444', '#10B981', '#6366F1', '#EC4899', '#14B8A6', '#F97316'];

const CategoriesPage = () => {
  const { user } = useAuth();
  const { locale } = useLanguage();
  const t = dashT[locale];
  const { invalidate } = useInvalidate();

  const { data: categories = [], isLoading: catLoading } = useCategories();

  // Lightweight count query instead of loading all transactions
  const { data: txCounts = {}, isLoading: txCountLoading } = useQuery({
    queryKey: ['category-tx-counts', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('category_id')
        .eq('user_id', user!.id)
        .not('category_id', 'is', null);
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data ?? []).forEach(tx => {
        if (tx.category_id) counts[tx.category_id] = (counts[tx.category_id] || 0) + 1;
      });
      return counts;
    },
    enabled: !!user,
    staleTime: 30_000,
  });
  const loading = catLoading || txCountLoading;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteWarning, setDeleteWarning] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', icon: '📁', color: '#6C63FF', type: 'expense' });
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkModifyOpen, setBulkModifyOpen] = useState(false);
  const [bulkModifyForm, setBulkModifyForm] = useState({ type: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<'name' | 'txCount'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const bulk = useBulkSelection(categories);

  const refreshData = () => { invalidate('categories', 'category-tx-counts', 'budgets'); bulk.clear(); };

  const openNew = () => { setEditing(null); setFormErrors({}); setForm({ name: '', icon: '📁', color: '#6C63FF', type: 'expense' }); setDialogOpen(true); };
  const openEdit = (cat: any) => { setEditing(cat); setFormErrors({}); setForm({ name: cat.name, icon: cat.icon, color: cat.color, type: cat.type }); setDialogOpen(true); };

  const handleSave = async () => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = locale === 'fr' ? 'Le nom est requis' : 'Name is required';
    else if (form.name.trim().length > 50) errs.name = locale === 'fr' ? 'Max 50 caractères' : 'Max 50 characters';
    else {
      const duplicate = categories.find(c => c.name.toLowerCase() === form.name.trim().toLowerCase() && c.id !== editing?.id);
      if (duplicate) errs.name = locale === 'fr' ? 'Ce nom existe déjà' : 'This name already exists';
    }
    setFormErrors(errs);
    if (Object.keys(errs).length > 0) return;
    if (!user) return;
    const payload = { user_id: user.id, name: form.name.trim(), icon: form.icon, color: form.color, type: form.type };
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
      ? (locale === 'fr' ? `Cette catégorie est utilisée par ${count} transaction(s). Les transactions ne seront pas supprimées mais perdront leur catégorie.` : `This category is used by ${count} transaction(s). Transactions won't be deleted but will lose their category.`)
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
    const inserts = bulk.selectedItems.map(c => ({
      user_id: user.id, name: c.name + ' (copie)', icon: c.icon, color: c.color, type: c.type,
    }));
    const { error } = await supabase.from('categories').insert(inserts);
    if (error) { toast.error(error.message); return; }
    refreshData(); toast.success(t.bulkDuplicated(inserts.length));
  };

  const handleBulkExport = (format: 'csv' | 'excel') => {
    const data = bulk.selectedItems.map(c => ({
      [locale === 'fr' ? 'Nom' : 'Name']: c.name,
      [t.type]: c.type === 'expense' ? t.expenseType : t.incomeType,
      [locale === 'fr' ? 'Icône' : 'Icon']: c.icon,
      [locale === 'fr' ? 'Couleur' : 'Color']: c.color,
      ['Transactions']: txCounts[c.id] || 0,
    }));
    const ok = format === 'csv' ? exportToCSV(data, 'categories') : exportToExcel(data, 'categories');
    if (ok) toast.success(t.saved);
  };

  const sortAndFilter = (cats: Category[]) => {
    let result = cats;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(c => c.name.toLowerCase().includes(q));
    }
    result = [...result].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortField === 'txCount') cmp = (txCounts[a.id] || 0) - (txCounts[b.id] || 0);
      return sortOrder === 'desc' ? -cmp : cmp;
    });
    return result;
  };

  const expenseCategories = sortAndFilter(categories.filter(c => c.type === 'expense'));
  const incomeCategories = sortAndFilter(categories.filter(c => c.type === 'income'));

  const renderGroup = (title: string, cats: Category[]) => (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{title}</h3>
        {cats.length > 1 && (
          <label className="flex items-center gap-1.5 cursor-pointer">
            <Checkbox
              checked={cats.every(c => bulk.selectedIds.has(c.id))}
              onCheckedChange={() => cats.forEach(c => bulk.toggle(c.id))}
            />
            <span className="text-xs text-muted-foreground">{locale === 'fr' ? 'Tout' : 'All'}</span>
          </label>
        )}
      </div>
      {cats.length === 0 ? <p className="text-sm text-muted-foreground py-4 text-center">{t.noCategories}</p> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {cats.map(cat => {
            const isSelected = bulk.selectedIds.has(cat.id);
            return (
              <Card key={cat.id} className={`card-interactive ${isSelected ? 'ring-2 ring-primary/40' : ''}`}>
                <CardContent className="flex items-center justify-between py-4 px-4">
                  <div className="flex items-center gap-3">
                    <Checkbox checked={isSelected} onCheckedChange={() => bulk.toggle(cat.id)} />
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ background: cat.color + '20' }}>{cat.icon}</div>
                    <div><p className="font-medium text-sm">{cat.name}</p><div className="flex items-center gap-1.5 mt-0.5"><div className="w-2.5 h-2.5 rounded-full" style={{ background: cat.color }} /><span className="text-xs text-muted-foreground">{txCounts[cat.id] ? `${txCounts[cat.id]} tx` : locale === 'fr' ? 'Aucune tx' : 'No tx'}</span></div></div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => openEdit(cat)}><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-destructive" onClick={() => handleDeleteRequest(cat.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );

  if (loading) return <div className="space-y-6"><div className="flex items-center justify-between"><Skeleton className="h-8 w-40" /><Skeleton className="h-9 w-36" /></div><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold font-display">{t.categories}</h2>
        <Button size="sm" className="text-primary-foreground rounded-xl" style={{ background: 'var(--gradient-primary)' }} onClick={openNew}><Plus className="w-4 h-4 mr-1" />{t.addCategory}</Button>
      </div>

      <Tabs defaultValue="list">
        <TabsList className="flex-wrap">
          <TabsTrigger value="list">{locale === 'fr' ? 'Gestion' : 'Manage'}</TabsTrigger>
          <TabsTrigger value="evolution">{locale === 'fr' ? 'Évolution' : 'Evolution'}</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-6 mt-4">
          {categories.length > 0 && (
            <FilterToolbar
              searchValue={searchQuery}
              onSearchChange={setSearchQuery}
              searchPlaceholder={locale === 'fr' ? 'Rechercher une catégorie...' : 'Search categories...'}
              sortOptions={[
                { value: 'name', label: locale === 'fr' ? 'Nom' : 'Name' },
                { value: 'txCount', label: 'Transactions' },
              ]}
              sortValue={sortField}
              onSortChange={v => setSortField(v as any)}
              sortOrder={sortOrder}
              onSortOrderToggle={() => setSortOrder(o => o === 'asc' ? 'desc' : 'asc')}
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
            />
          )}

          {categories.length === 0 ? (
            <Card className="border border-border/50 shadow-[var(--shadow-card)] rounded-2xl"><CardContent className="py-16 text-center"><Inbox className="w-16 h-16 text-muted-foreground/40 mx-auto mb-4" /><p className="text-lg font-medium text-muted-foreground mb-2">{t.noCategories}</p><Button size="sm" className="text-primary-foreground mt-2 rounded-xl" style={{ background: 'var(--gradient-primary)' }} onClick={openNew}><Plus className="w-4 h-4 mr-1" />{t.addCategory}</Button></CardContent></Card>
          ) : (<>{renderGroup(t.expenseType, expenseCategories)}{renderGroup(t.incomeType, incomeCategories)}</>)}
        </TabsContent>

        <TabsContent value="evolution" className="mt-4">
          <CategoryEvolutionChart />
        </TabsContent>
      </Tabs>

      <ResponsiveFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? t.edit : t.addCategory}
        description={locale === 'fr' ? 'Configurez votre catégorie' : 'Configure your category'}
        footer={
          <>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl">{t.cancel}</Button>
            <Button className="text-primary-foreground rounded-xl" style={{ background: 'var(--gradient-primary)' }} onClick={handleSave}>{t.save}</Button>
          </>
        }
      >
        <div className="space-y-5 form-animate">
          {/* Live preview */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/50">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl" style={{ background: form.color + '20' }}>{form.icon}</div>
            <div>
              <p className="font-semibold text-sm">{form.name || (locale === 'fr' ? 'Nom de la catégorie' : 'Category name')}</p>
              <div className="flex items-center gap-1.5 mt-0.5"><div className="w-2.5 h-2.5 rounded-full" style={{ background: form.color }} /><span className="text-xs text-muted-foreground">{form.type === 'expense' ? t.expenseType : t.incomeType}</span></div>
            </div>
          </div>

          <FormSection title={locale === 'fr' ? 'Informations' : 'Details'} icon={<Tag className="w-3.5 h-3.5" />}>
            <InputField
              label={t.categoryName}
              icon={<Tag className="w-3.5 h-3.5" />}
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              maxLength={50}
              charCount
              error={formErrors.name}
              placeholder={locale === 'fr' ? 'Ex: Alimentation, Transport...' : 'E.g: Food, Transport...'}
            />
            <div className="space-y-1.5">
              <Label className="form-label">{t.type}</Label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">📉 {t.expenseType}</SelectItem>
                  <SelectItem value="income">📈 {t.incomeType}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </FormSection>

          <FormSection title={locale === 'fr' ? 'Apparence' : 'Appearance'} icon={<Palette className="w-3.5 h-3.5" />}>
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

      {/* Bulk Modify Dialog */}
      <Dialog open={bulkModifyOpen} onOpenChange={setBulkModifyOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">{t.bulkModify}</DialogTitle>
            <DialogDescription>{bulk.count} {locale === 'fr' ? 'sélectionné(s)' : 'selected'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t.bulkModifyType}</Label>
              <Select value={bulkModifyForm.type} onValueChange={v => setBulkModifyForm({ type: v })}>
                <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder={locale === 'fr' ? 'Choisir...' : 'Select...'} /></SelectTrigger>
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

      <ConfirmDeleteDialog open={!!deleteId} onOpenChange={() => { setDeleteId(null); setDeleteWarning(null); }} onConfirm={handleDelete} title={t.confirmDelete} description={deleteWarning || t.confirmDeleteMessage} cancelLabel={t.cancel} confirmLabel={t.delete} />
      <ConfirmDeleteDialog open={bulkDeleteOpen} onOpenChange={() => setBulkDeleteOpen(false)} onConfirm={handleBulkDelete} title={t.deleteSelection} description={t.bulkDeleteConfirm(bulk.count)} cancelLabel={t.cancel} confirmLabel={t.delete} />
    </div>
  );
};

export default CategoriesPage;
