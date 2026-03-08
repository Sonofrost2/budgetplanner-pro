import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/i18n/LanguageContext';
import { dashT } from '@/i18n/dashTranslations';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Tag, Inbox } from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import ConfirmDeleteDialog from '@/components/dashboard/ConfirmDeleteDialog';

const ICONS = ['🛒', '🚗', '🏠', '🎮', '💊', '💰', '💻', '📚', '👗', '🍽️', '✈️', '🎬', '📱', '💡', '🏥', '🎁', '🔧', '📁'];
const COLORS = ['#22C55E', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444', '#10B981', '#6366F1', '#EC4899', '#14B8A6', '#F97316'];

const CategoriesPage = () => {
  const { user } = useAuth();
  const { locale } = useLanguage();
  const t = dashT[locale];
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', icon: '📁', color: '#6C63FF', type: 'expense' });

  const fetchData = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('categories').select('*').eq('user_id', user.id).order('type').order('name');
    setCategories(data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openNew = () => {
    setEditing(null);
    setForm({ name: '', icon: '📁', color: '#6C63FF', type: 'expense' });
    setDialogOpen(true);
  };

  const openEdit = (cat: any) => {
    setEditing(cat);
    setForm({ name: cat.name, icon: cat.icon, color: cat.color, type: cat.type });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!user || !form.name.trim()) return;
    const payload = { user_id: user.id, name: form.name.trim(), icon: form.icon, color: form.color, type: form.type };
    if (editing) {
      const { error } = await supabase.from('categories').update(payload).eq('id', editing.id);
      if (error) { toast.error(error.message); return; }
    } else {
      const { error } = await supabase.from('categories').insert(payload);
      if (error) { toast.error(error.message); return; }
    }
    setDialogOpen(false);
    fetchData();
    toast.success(t.saved);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await supabase.from('categories').delete().eq('id', deleteId);
    setDeleteId(null);
    fetchData();
    toast.success(t.delete + ' ✓');
  };

  const expenseCategories = categories.filter(c => c.type === 'expense');
  const incomeCategories = categories.filter(c => c.type === 'income');

  const renderGroup = (title: string, cats: any[]) => (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{title}</h3>
      {cats.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">{t.noCategories}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {cats.map(cat => (
            <Card key={cat.id} className="border-none shadow-[var(--shadow-card)]">
              <CardContent className="flex items-center justify-between py-4 px-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ background: cat.color + '20' }}>
                    {cat.icon}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{cat.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: cat.color }} />
                      <span className="text-xs text-muted-foreground">{cat.color}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(cat)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(cat.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-9 w-36" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold font-display">{t.categories}</h2>
        <Button size="sm" className="text-primary-foreground" style={{ background: 'var(--gradient-primary)' }} onClick={openNew}>
          <Plus className="w-4 h-4 mr-1" />{t.addCategory}
        </Button>
      </div>

      {categories.length === 0 ? (
        <Card className="border-none shadow-[var(--shadow-card)]">
          <CardContent className="py-16 text-center">
            <Inbox className="w-16 h-16 text-muted-foreground/40 mx-auto mb-4" />
            <p className="text-lg font-medium text-muted-foreground mb-2">{t.noCategories}</p>
            <Button size="sm" className="text-primary-foreground mt-2" style={{ background: 'var(--gradient-primary)' }} onClick={openNew}>
              <Plus className="w-4 h-4 mr-1" />{t.addCategory}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {renderGroup(t.expenseType, expenseCategories)}
          {renderGroup(t.incomeType, incomeCategories)}
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? t.edit : t.addCategory}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t.categoryName}</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} maxLength={50} />
            </div>
            <div className="space-y-2">
              <Label>{t.type}</Label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">{t.expenseType}</SelectItem>
                  <SelectItem value="income">{t.incomeType}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t.iconLabel}</Label>
              <div className="flex flex-wrap gap-2">
                {ICONS.map(ic => (
                  <button key={ic} onClick={() => setForm(f => ({ ...f, icon: ic }))}
                    className={`text-xl p-1.5 rounded-lg border transition-colors ${form.icon === ic ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted'}`}>
                    {ic}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t.colorLabel}</Label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map(c => (
                  <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                    className={`w-8 h-8 rounded-full border-2 transition-transform ${form.color === c ? 'border-foreground scale-110' : 'border-transparent hover:scale-105'}`}
                    style={{ background: c }} />
                ))}
              </div>
              <Input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} className="w-16 h-8 p-0 border-none" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t.cancel}</Button>
            <Button className="text-primary-foreground" style={{ background: 'var(--gradient-primary)' }} onClick={handleSave}>{t.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={!!deleteId}
        onOpenChange={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title={t.confirmDelete}
        description={t.confirmDeleteMessage}
        cancelLabel={t.cancel}
        confirmLabel={t.delete}
      />
    </div>
  );
};

export default CategoriesPage;
