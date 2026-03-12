import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useLanguage } from '@/i18n/LanguageContext';
import { dashT } from '@/i18n/dashTranslations';
import { supabase } from '@/integrations/supabase/client';
import { useDebts, useInvalidate } from '@/hooks/useDashboardData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Plus, Landmark, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import ConfirmDeleteDialog from '@/components/dashboard/ConfirmDeleteDialog';

const DebtsPage = () => {
  const { user } = useAuth();
  const { locale } = useLanguage();
  const { fmt: fmtCurrency } = useProfile();
  const t = dashT[locale];
  const { invalidate } = useInvalidate();

  const { data: debts = [], isLoading: loading } = useDebts();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ creditor_name: '', total_amount: '', paid_amount: '', due_date: '', notes: '' });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [payDialog, setPayDialog] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState('');

  const fmt = (n: number) => fmtCurrency(n, locale);
  const refreshData = () => invalidate('debts');

  const handleSave = async () => {
    if (!user || !form.creditor_name.trim() || Number(form.total_amount) <= 0) return;
    const payload = { creditor_name: form.creditor_name.trim(), total_amount: Number(form.total_amount), paid_amount: Number(form.paid_amount) || 0, due_date: form.due_date || null, notes: form.notes || null };
    const { error } = editId
      ? await supabase.from('debts').update(payload).eq('id', editId)
      : await supabase.from('debts').insert({ ...payload, user_id: user.id });
    if (error) { toast.error(error.message); return; }
    setDialogOpen(false); setEditId(null);
    refreshData();
    toast.success(t.saved);
  };

  const handlePay = async () => {
    if (!payDialog || Number(payAmount) <= 0) return;
    const debt = debts.find(d => d.id === payDialog);
    if (!debt) return;
    const newPaid = Math.min(Number(debt.paid_amount) + Number(payAmount), Number(debt.total_amount));
    await supabase.from('debts').update({ paid_amount: newPaid }).eq('id', payDialog);
    setPayDialog(null); setPayAmount('');
    refreshData();
    toast.success(t.saved);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await supabase.from('debts').delete().eq('id', deleteId);
    setDeleteId(null);
    refreshData();
  };

  const openNew = () => { setEditId(null); setForm({ creditor_name: '', total_amount: '', paid_amount: '', due_date: '', notes: '' }); setDialogOpen(true); };
  const openEdit = (d: any) => { setEditId(d.id); setForm({ creditor_name: d.creditor_name, total_amount: String(d.total_amount), paid_amount: String(d.paid_amount), due_date: d.due_date || '', notes: d.notes || '' }); setDialogOpen(true); };

  const totalDebt = debts.reduce((s, d) => s + Number(d.total_amount), 0);
  const totalPaid = debts.reduce((s, d) => s + Number(d.paid_amount), 0);

  if (loading) return <div className="space-y-6"><div className="flex items-center justify-between"><Skeleton className="h-8 w-32" /><Skeleton className="h-9 w-36" /></div><div className="grid grid-cols-1 md:grid-cols-2 gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}</div></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold font-display">{t.debts}</h2>
          {debts.length > 0 && <p className="text-sm text-muted-foreground mt-1">{fmt(totalPaid)} / {fmt(totalDebt)} {locale === 'fr' ? 'remboursé' : 'repaid'}</p>}
        </div>
        <Button size="sm" className="text-primary-foreground rounded-xl" style={{ background: 'var(--gradient-primary)' }} onClick={openNew}><Plus className="w-4 h-4 mr-1" />{t.addDebt}</Button>
      </div>

      {debts.length === 0 ? (
        <Card className="border border-border/50 shadow-[var(--shadow-card)] rounded-2xl"><CardContent className="py-16 text-center"><Landmark className="w-16 h-16 text-muted-foreground/40 mx-auto mb-4" /><p className="text-lg font-semibold text-muted-foreground mb-2">{locale === 'fr' ? 'Aucune dette enregistrée' : 'No debts recorded'}</p><Button size="sm" className="text-primary-foreground mt-2 rounded-xl" style={{ background: 'var(--gradient-primary)' }} onClick={openNew}><Plus className="w-4 h-4 mr-1" />{t.addDebt}</Button></CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {debts.map(d => {
            const total = Number(d.total_amount); const paid = Number(d.paid_amount); const remaining = total - paid;
            const pct = total > 0 ? Math.round((paid / total) * 100) : 0;
            const isOverdue = d.due_date && new Date(d.due_date) < new Date() && remaining > 0;
            return (
              <Card key={d.id} className={`border border-border/50 shadow-[var(--shadow-card)] rounded-2xl ${isOverdue ? 'ring-1 ring-destructive/20' : ''}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-bold flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><Landmark className="w-5 h-5 text-primary" /></div>
                      <div><span>{d.creditor_name}</span>{d.due_date && <p className={`text-[11px] font-normal ${isOverdue ? 'text-destructive' : 'text-muted-foreground'}`}>{locale === 'fr' ? 'Échéance' : 'Due'}: {new Date(d.due_date).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US')}</p>}</div>
                    </CardTitle>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-primary" onClick={() => openEdit(d)}><Pencil className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive" onClick={() => setDeleteId(d.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-baseline"><span className="text-2xl font-extrabold">{fmt(paid)}</span><span className="text-sm text-muted-foreground">/ {fmt(total)}</span></div>
                  <Progress value={pct} className={`h-3 rounded-full ${pct >= 100 ? '[&>div]:bg-secondary' : '[&>div]:bg-primary'}`} />
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">{t.remainingDebt}: <span className="font-semibold text-foreground">{fmt(remaining)}</span></p>
                    {remaining > 0 && <Button size="sm" variant="outline" className="h-7 text-xs rounded-lg" onClick={() => { setPayDialog(d.id); setPayAmount(''); }}>{locale === 'fr' ? 'Rembourser' : 'Pay'}</Button>}
                    {remaining <= 0 && <span className="text-xs font-bold text-secondary">✓ {locale === 'fr' ? 'Soldé' : 'Paid off'}</span>}
                  </div>
                  {d.notes && <p className="text-xs text-muted-foreground">{d.notes}</p>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditId(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle className="text-xl font-bold">{editId ? t.edit : ((t as any).addDebt || 'Ajouter une dette')}</DialogTitle><DialogDescription>{locale === 'fr' ? 'Enregistrez une dette à suivre' : 'Record a debt to track'}</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{(t as any).creditor || 'Créancier'}</Label><Input value={form.creditor_name} onChange={e => setForm(f => ({ ...f, creditor_name: e.target.value }))} className="rounded-xl h-11" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{(t as any).totalDebt || 'Montant total'}</Label><Input type="number" min="1" value={form.total_amount} onChange={e => setForm(f => ({ ...f, total_amount: e.target.value }))} className="rounded-xl h-11" /></div>
              <div className="space-y-2"><Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{(t as any).paidAmount || 'Déjà payé'}</Label><Input type="number" min="0" value={form.paid_amount} onChange={e => setForm(f => ({ ...f, paid_amount: e.target.value }))} className="rounded-xl h-11" /></div>
            </div>
            <div className="space-y-2"><Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t.deadline} ({t.optional})</Label><Input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} className="rounded-xl h-11" /></div>
            <div className="space-y-2"><Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t.notes} ({t.optional})</Label><Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="rounded-xl h-11" /></div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0"><Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl">{t.cancel}</Button><Button className="text-primary-foreground rounded-xl" style={{ background: 'var(--gradient-primary)' }} onClick={handleSave}>{t.save}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!payDialog} onOpenChange={() => setPayDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{locale === 'fr' ? 'Rembourser' : 'Make payment'}</DialogTitle></DialogHeader>
          <div className="space-y-4"><div className="space-y-2"><Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t.amount}</Label><Input type="number" min="0.01" value={payAmount} onChange={e => setPayAmount(e.target.value)} className="rounded-xl h-11 text-lg font-bold" /></div></div>
          <DialogFooter className="gap-2 sm:gap-0"><Button variant="outline" onClick={() => setPayDialog(null)} className="rounded-xl">{t.cancel}</Button><Button className="text-primary-foreground rounded-xl" style={{ background: 'var(--gradient-primary)' }} onClick={handlePay}>{t.save}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)} onConfirm={handleDelete} title={t.confirmDelete} description={t.confirmDeleteMessage} cancelLabel={t.cancel} confirmLabel={t.delete} />
    </div>
  );
};

export default DebtsPage;
