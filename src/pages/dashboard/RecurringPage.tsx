import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useLanguage } from '@/i18n/LanguageContext';
import { dashT } from '@/i18n/dashTranslations';
import { supabase } from '@/integrations/supabase/client';
import { useRecurring, useCategories, useAccounts, useInvalidate } from '@/hooks/useDashboardData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Plus, RefreshCw, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import ConfirmDeleteDialog from '@/components/dashboard/ConfirmDeleteDialog';
import { AccountCombobox } from '@/components/dashboard/AccountCombobox';

const RecurringPage = () => {
  const { user } = useAuth();
  const { locale } = useLanguage();
  const { fmt: fmtCurrency } = useProfile();
  const t = dashT[locale];
  const { invalidate } = useInvalidate();

  const { data: items = [], isLoading: recLoading } = useRecurring();
  const { data: categories = [], isLoading: catLoading } = useCategories();
  const { data: accounts = [], isLoading: accLoading } = useAccounts();
  const loading = recLoading || catLoading || accLoading;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ description: '', amount: '', type: 'expense', category_id: '', account_id: '', frequency: 'monthly', next_date: '', active: true });
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fmt = (n: number) => fmtCurrency(n, locale);
  const refreshData = () => invalidate('recurring');

  const handleSave = async () => {
    if (!user || !form.description.trim() || Number(form.amount) <= 0 || !form.next_date) return;
    const payload = { description: form.description.trim(), amount: Number(form.amount), type: form.type, category_id: form.category_id || null, account_id: form.account_id || null, frequency: form.frequency, next_date: form.next_date, active: form.active };
    const { error } = editId
      ? await supabase.from('recurring_transactions').update(payload).eq('id', editId)
      : await supabase.from('recurring_transactions').insert({ ...payload, user_id: user.id });
    if (error) { toast.error(error.message); return; }
    setDialogOpen(false); setEditId(null);
    refreshData();
    toast.success(t.saved);
  };

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from('recurring_transactions').update({ active: !active }).eq('id', id);
    refreshData();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await supabase.from('recurring_transactions').delete().eq('id', deleteId);
    setDeleteId(null); refreshData();
  };

  const openNew = () => { setEditId(null); setForm({ description: '', amount: '', type: 'expense', category_id: '', account_id: '', frequency: 'monthly', next_date: new Date().toISOString().split('T')[0], active: true }); setDialogOpen(true); };
  const openEdit = (r: any) => { setEditId(r.id); setForm({ description: r.description, amount: String(r.amount), type: r.type, category_id: r.category_id || '', account_id: r.account_id || '', frequency: r.frequency, next_date: r.next_date, active: r.active }); setDialogOpen(true); };

  const totalFixedExpenses = items.filter(i => i.active && i.type === 'expense').reduce((s, i) => s + Number(i.amount), 0);
  const totalFixedIncome = items.filter(i => i.active && i.type === 'income').reduce((s, i) => s + Number(i.amount), 0);
  const freqLabel: Record<string, Record<string, string>> = { fr: { weekly: 'Hebdo', monthly: 'Mensuel', yearly: 'Annuel' }, en: { weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly' } };

  if (loading) return <div className="space-y-6"><div className="flex items-center justify-between"><Skeleton className="h-8 w-32" /><Skeleton className="h-9 w-36" /></div><div className="grid grid-cols-1 md:grid-cols-2 gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}</div></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold font-display">{t.recurring}</h2>
          {items.length > 0 && <p className="text-sm text-muted-foreground mt-1">{t.fixedCharges}: <span className="text-destructive font-semibold">{fmt(totalFixedExpenses)}</span>{totalFixedIncome > 0 && <> · {t.income}: <span className="text-secondary font-semibold">{fmt(totalFixedIncome)}</span></>}</p>}
        </div>
        <Button size="sm" className="text-primary-foreground rounded-xl" style={{ background: 'var(--gradient-primary)' }} onClick={openNew}><Plus className="w-4 h-4 mr-1" />{t.addRecurring}</Button>
      </div>

      {items.length === 0 ? (
        <Card className="border border-border/50 shadow-[var(--shadow-card)] rounded-2xl"><CardContent className="py-16 text-center"><RefreshCw className="w-16 h-16 text-muted-foreground/40 mx-auto mb-4" /><p className="text-lg font-semibold text-muted-foreground mb-2">{locale === 'fr' ? 'Aucune charge récurrente' : 'No recurring transactions'}</p><Button size="sm" className="text-primary-foreground mt-2 rounded-xl" style={{ background: 'var(--gradient-primary)' }} onClick={openNew}><Plus className="w-4 h-4 mr-1" />{t.addRecurring}</Button></CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map(r => (
            <Card key={r.id} className={`border border-border/50 shadow-[var(--shadow-card)] rounded-2xl ${!r.active ? 'opacity-50' : ''}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-bold flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ backgroundColor: (r.categories?.color || '#6C63FF') + '20' }}>{r.categories?.icon || '📁'}</div>
                    <div><span>{r.description}</span><p className="text-[11px] font-normal text-muted-foreground">{(freqLabel[locale] || freqLabel.en)[r.frequency || 'monthly'] || r.frequency}</p></div>
                  </CardTitle>
                  <div className="flex items-center gap-1">
                    <Switch checked={r.active ?? true} onCheckedChange={() => toggleActive(r.id, r.active ?? true)} className="scale-75" />
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-primary" onClick={() => openEdit(r)}><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive" onClick={() => setDeleteId(r.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className={`text-xl font-extrabold ${r.type === 'income' ? 'text-secondary' : 'text-destructive'}`}>{r.type === 'income' ? '+' : '-'}{fmt(Number(r.amount))}</span>
                  <Badge variant="outline" className="text-[10px]">{t.nextDate}: {new Date(r.next_date).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short' })}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditId(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle className="text-xl font-bold">{editId ? t.edit : t.addRecurring}</DialogTitle><DialogDescription>{locale === 'fr' ? 'Configurez une transaction récurrente' : 'Configure a recurring transaction'}</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t.description}</Label><Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="rounded-xl h-11" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t.amount}</Label><Input type="number" min="1" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className="rounded-xl h-11 text-lg font-bold" /></div>
              <div className="space-y-2"><Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t.type}</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}><SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="expense">{t.expenseType}</SelectItem><SelectItem value="income">{t.incomeType}</SelectItem></SelectContent></Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t.frequency}</Label>
                <Select value={form.frequency} onValueChange={v => setForm(f => ({ ...f, frequency: v }))}><SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="weekly">{t.weekly}</SelectItem><SelectItem value="monthly">{t.monthly}</SelectItem><SelectItem value="yearly">{t.yearly}</SelectItem></SelectContent></Select>
              </div>
              <div className="space-y-2"><Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t.nextDate}</Label><Input type="date" value={form.next_date} onChange={e => setForm(f => ({ ...f, next_date: e.target.value }))} className="rounded-xl h-11" /></div>
            </div>
            <div className="space-y-2"><Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t.category} ({t.optional})</Label>
              <Select value={form.category_id} onValueChange={v => setForm(f => ({ ...f, category_id: v }))}><SelectTrigger className="rounded-xl h-11"><SelectValue placeholder={t.selectCategory} /></SelectTrigger><SelectContent>{categories.filter(c => c.type === form.type).map(c => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="space-y-2"><Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t.account} ({t.optional})</Label>
              <AccountCombobox accounts={accounts} value={form.account_id} onValueChange={v => setForm(f => ({ ...f, account_id: v }))} placeholder={t.selectAccount} />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0"><Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl">{t.cancel}</Button><Button className="text-primary-foreground rounded-xl" style={{ background: 'var(--gradient-primary)' }} onClick={handleSave}>{t.save}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)} onConfirm={handleDelete} title={t.confirmDelete} description={t.confirmDeleteMessage} cancelLabel={t.cancel} confirmLabel={t.delete} />
    </div>
  );
};

export default RecurringPage;
