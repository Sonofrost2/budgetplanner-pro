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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Plus, Trash2, AlertTriangle, PieChart, Inbox, Calendar, Tag, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import ConfirmDeleteDialog from '@/components/dashboard/ConfirmDeleteDialog';
import UpgradeBanner from '@/components/dashboard/UpgradeBanner';

const BudgetsPage = () => {
  const { user } = useAuth();
  const { locale } = useLanguage();
  const { fmt: fmtCurrency } = useProfile();
  const { limits, isPremium } = useSubscription();
  const t = dashT[locale];
  const { invalidate } = useInvalidate();

  const { data: budgets = [], isLoading: budLoading } = useBudgets();
  const { data: allCategories = [], isLoading: catLoading } = useCategories();
  const { data: allTx = [], isLoading: txLoading } = useAllTransactions();
  const loading = budLoading || catLoading || txLoading;
  const categories = allCategories.filter(c => c.type === 'expense');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', amount: '', category_id: '', period: 'monthly', alert_threshold: '80' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fmt = (n: number) => fmtCurrency(n, locale);

  const spending = useMemo(() => {
    const now = new Date();
    const spendMap: Record<string, number> = {};
    budgets.forEach(b => {
      let start: string, end: string;
      if (b.period === 'weekly') {
        const day = now.getDay();
        const ws = new Date(now); ws.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
        start = ws.toISOString().split('T')[0]; end = now.toISOString().split('T')[0];
      } else if (b.period === 'yearly') {
        start = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
        end = new Date(now.getFullYear(), 11, 31).toISOString().split('T')[0];
      } else {
        start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      }
      const spent = allTx.filter(tx => tx.type === 'expense' && tx.category_id === b.category_id && tx.date >= start && tx.date <= end)
        .reduce((s, tx) => s + Number(tx.amount), 0);
      if (b.category_id) spendMap[b.category_id] = spent;
    });
    return spendMap;
  }, [budgets, allTx]);

  const refreshData = () => invalidate('budgets', 'all-transactions');

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

  const openNew = () => {
    if (budgetLimitReached) { toast.error(t.limitBudgetsToast(limits.budgets)); return; }
    setErrors({}); setEditId(null);
    setForm({ name: '', amount: '', category_id: categories[0]?.id || '', period: 'monthly', alert_threshold: '80' });
    setDialogOpen(true);
  };

  const openEdit = (b: any) => {
    setErrors({}); setEditId(b.id);
    setForm({ name: b.name, amount: String(b.amount), category_id: b.category_id || '', period: b.period || 'monthly', alert_threshold: String(b.alert_threshold ?? 80) });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!user || !validate()) return;
    setSaving(true);
    const payload = { name: form.name.trim(), amount: Number(form.amount), category_id: form.category_id || null, period: form.period, alert_threshold: Number(form.alert_threshold) || 80 };
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
    setDeleteId(null);
    refreshData();
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between"><Skeleton className="h-8 w-32" /><Skeleton className="h-9 w-36" /></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}</div>
      </div>
    );
  }

  const periodLabels: Record<string, string> = { weekly: t.weekly, monthly: t.monthly, yearly: t.yearly };

  return (
    <div className="space-y-6">
      {budgetLimitReached && <UpgradeBanner message={t.limitBudgetsReached(limits.budgets)} />}

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold font-display">{t.budgets}</h2>
        <Button size="sm" className="text-primary-foreground rounded-xl" style={{ background: 'var(--gradient-primary)' }} onClick={openNew} disabled={budgetLimitReached}>
          <Plus className="w-4 h-4 mr-1" />{t.addBudget}
        </Button>
      </div>

      {budgets.length === 0 ? (
        <Card className="border border-border/50 shadow-[var(--shadow-card)] rounded-2xl">
          <CardContent className="py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted mx-auto mb-4 flex items-center justify-center"><PieChart className="w-7 h-7 text-muted-foreground/40" /></div>
            <p className="text-lg font-semibold text-muted-foreground mb-2">{t.noBudgets}</p>
            <p className="text-sm text-muted-foreground/70 mb-4">{t.createBudgetDesc}</p>
            <Button size="sm" className="text-primary-foreground rounded-xl" style={{ background: 'var(--gradient-primary)' }} onClick={openNew}><Plus className="w-4 h-4 mr-1" />{t.addBudget}</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {budgets.map(b => {
            const spent = spending[b.category_id || ''] || 0;
            const amount = Number(b.amount);
            const pct = amount > 0 ? Math.min((spent / amount) * 100, 100) : 0;
            const over = spent > amount;
            const remaining = amount - spent;
            return (
              <Card key={b.id} className={`border border-border/50 shadow-[var(--shadow-card)] rounded-2xl hover:shadow-[var(--shadow-soft)] transition-shadow ${over ? 'ring-1 ring-destructive/20' : ''}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-bold flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ backgroundColor: ((b as any).categories?.color || '#6C63FF') + '20' }}>{(b as any).categories?.icon || '📁'}</div>
                      <div><span>{b.name}</span><p className="text-[11px] font-normal text-muted-foreground">{(b as any).categories?.name || '-'} · {periodLabels[b.period] || b.period}</p></div>
                    </CardTitle>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-primary" onClick={() => openEdit(b)}><Pencil className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive" onClick={() => setDeleteId(b.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-baseline"><span className="text-2xl font-extrabold">{fmt(spent)}</span><span className="text-sm text-muted-foreground">/ {fmt(amount)}</span></div>
                  <Progress value={pct} className={`h-3 rounded-full ${over ? '[&>div]:bg-destructive' : pct >= (b.alert_threshold ?? 80) ? '[&>div]:bg-accent' : '[&>div]:bg-secondary'}`} />
                  {over ? (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-destructive/5 border border-destructive/10">
                      <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" />
                      <p className="text-xs font-semibold text-destructive">{t.overBudget} — {t.exceeded} {fmt(spent - amount)}</p>
                    </div>
                  ) : (
                    <p className="text-xs font-medium text-secondary px-1">✓ {t.onTrack} — {t.remaining}: {fmt(remaining)}</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditId(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">{editId ? ((t as any).editBudget || 'Modifier le budget') : t.addBudget}</DialogTitle>
            <DialogDescription>{t.createBudgetDesc}</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t.budgetName}</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} maxLength={100} placeholder={t.budgetPlaceholder} className={`rounded-xl h-11 ${errors.name ? 'border-destructive' : ''}`} />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><Tag className="w-3 h-3" />{t.category}</Label>
              <Select value={form.category_id} onValueChange={v => setForm(f => ({ ...f, category_id: v }))}>
                <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder={t.selectCategory} /></SelectTrigger>
                <SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{(t as any).alertThreshold || "Seuil d'alerte (%)"}</Label>
              <Input type="number" min="1" max="100" value={form.alert_threshold} onChange={e => setForm(f => ({ ...f, alert_threshold: e.target.value }))} className="rounded-xl h-11 w-24" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t.budgetAmount}</Label>
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

      <ConfirmDeleteDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)} onConfirm={handleDelete} title={t.confirmDelete} description={t.confirmDeleteMessage} cancelLabel={t.cancel} confirmLabel={t.delete} />
    </div>
  );
};

export default BudgetsPage;
