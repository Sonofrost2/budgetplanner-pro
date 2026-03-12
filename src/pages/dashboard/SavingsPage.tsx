import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useLanguage } from '@/i18n/LanguageContext';
import { dashT } from '@/i18n/dashTranslations';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Plus, Trash2, PiggyBank, Minus } from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import ConfirmDeleteDialog from '@/components/dashboard/ConfirmDeleteDialog';
import { AccountCombobox } from '@/components/dashboard/AccountCombobox';
import { recalculateAccountBalance } from '@/hooks/useAccountBalance';

const SavingsPage = () => {
  const { user } = useAuth();
  const { locale } = useLanguage();
  const { fmt: fmtCurrency } = useProfile();
  const t = dashT[locale];
  const [goals, setGoals] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [addAmountDialog, setAddAmountDialog] = useState<string | null>(null);
  const [addAmount, setAddAmount] = useState('');
  const [sourceAccountId, setSourceAccountId] = useState('');
  const [form, setForm] = useState({ name: '', target_amount: '', icon: '🎯', deadline: '', account_id: '' });
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fmt = (n: number) => fmtCurrency(n, locale);

  const fetchData = useCallback(async () => {
    if (!user) return;
    const [goalsRes, accRes] = await Promise.all([
      supabase.from('savings_goals').select('*, payment_accounts(name, icon, real_balance)').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('payment_accounts').select('*').eq('user_id', user.id),
    ]);
    setGoals(goalsRes.data || []);
    setAccounts(accRes.data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = async () => {
    if (!user || !form.name.trim() || Number(form.target_amount) <= 0) return;
    const { error } = await supabase.from('savings_goals').insert({
      user_id: user.id, name: form.name.trim(), target_amount: Number(form.target_amount),
      icon: form.icon || '🎯', deadline: form.deadline || null, account_id: form.account_id || null,
    });
    if (error) { toast.error(error.message); return; }
    setDialogOpen(false);
    fetchData();
    toast.success(t.saved);
  };

  const handleAddAmount = async () => {
    if (!addAmountDialog || Number(addAmount) <= 0 || !user) return;
    const goal = goals.find(g => g.id === addAmountDialog);
    if (!goal) return;

    setSaving(true);
    try {
      const amountToAdd = Number(addAmount);
      const today = new Date().toISOString().split('T')[0];

      // If a source account is selected, create a real transaction (expense on source)
      if (sourceAccountId) {
        const { error: txError } = await supabase.from('transactions').insert({
          user_id: user.id,
          type: 'expense',
          amount: amountToAdd,
          description: `${t.savings}: ${goal.name}`,
          account_id: sourceAccountId,
          date: today,
          notes: `🎯 ${goal.name}`,
        });
        if (txError) throw txError;
        await recalculateAccountBalance(sourceAccountId);
      }

      // If the goal is linked to a destination account, create income on it
      if (goal.account_id && goal.account_id !== sourceAccountId) {
        const { error: txError } = await supabase.from('transactions').insert({
          user_id: user.id,
          type: 'income',
          amount: amountToAdd,
          description: `${t.savings}: ${goal.name}`,
          account_id: goal.account_id,
          date: today,
          notes: `🎯 ${goal.name}`,
        });
        if (txError) throw txError;
        await recalculateAccountBalance(goal.account_id);
      }

      // Update savings goal
      const { error } = await supabase.from('savings_goals').update({
        current_amount: Number(goal.current_amount) + amountToAdd,
      }).eq('id', addAmountDialog);
      if (error) throw error;

      setAddAmountDialog(null);
      setAddAmount('');
      setSourceAccountId('');
      fetchData();
      toast.success(t.saved);
    } catch (err: any) {
      console.error('Add savings error:', err);
      toast.error(err.message || 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await supabase.from('savings_goals').delete().eq('id', deleteId);
    setDeleteId(null);
    fetchData();
  };

  const icons = ['🎯', '🏖️', '🏠', '🚗', '💻', '📚', '💍', '🎓', '🛡️', '✈️'];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-9 w-36" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold font-display">{t.savings}</h2>
        <Button size="sm" className="text-primary-foreground rounded-xl" style={{ background: 'var(--gradient-primary)' }} onClick={() => {
          setForm({ name: '', target_amount: '', icon: '🎯', deadline: '', account_id: '' });
          setDialogOpen(true);
        }}>
          <Plus className="w-4 h-4 mr-1" />{t.addGoal}
        </Button>
      </div>

      {goals.length === 0 ? (
        <Card className="border border-border/50 shadow-[var(--shadow-card)] rounded-2xl">
          <CardContent className="py-16 text-center">
            <PiggyBank className="w-16 h-16 text-muted-foreground/40 mx-auto mb-4" />
            <p className="text-lg font-medium text-muted-foreground mb-2">{t.noGoals}</p>
            <Button size="sm" className="text-primary-foreground mt-2 rounded-xl" style={{ background: 'var(--gradient-primary)' }} onClick={() => {
              setForm({ name: '', target_amount: '', icon: '🎯', deadline: '', account_id: '' });
              setDialogOpen(true);
            }}>
              <Plus className="w-4 h-4 mr-1" />{t.addGoal}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {goals.map(g => {
            const pct = Math.min((Number(g.current_amount) / Number(g.target_amount)) * 100, 100);
            const done = pct >= 100;
            return (
              <Card key={g.id} className={`border border-border/50 shadow-[var(--shadow-card)] rounded-2xl hover:shadow-[var(--shadow-soft)] transition-shadow ${done ? 'ring-2 ring-secondary/30' : ''}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <span className="text-xl">{g.icon}</span>{g.name}
                    </CardTitle>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => setDeleteId(g.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  {g.payment_accounts && (
                    <span className="text-xs text-muted-foreground">{g.payment_accounts.icon} {g.payment_accounts.name}</span>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="font-bold">{fmt(Number(g.current_amount))}</span>
                    <span className="text-muted-foreground">{fmt(Number(g.target_amount))}</span>
                  </div>
                  <Progress value={pct} className={`h-3 rounded-full ${done ? '[&>div]:bg-secondary' : '[&>div]:bg-primary'}`} />
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">{pct.toFixed(0)}%{g.deadline ? ` · ${new Date(g.deadline).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US')}` : ''}</span>
                    {!done && (
                      <Button variant="outline" size="sm" className="text-xs h-7 rounded-lg" onClick={() => { setAddAmountDialog(g.id); setAddAmount(''); setSourceAccountId(''); }}>
                        {t.addSaving}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Goal Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">{t.addGoal}</DialogTitle>
            <DialogDescription>{locale === 'fr' ? 'Définissez un objectif d\'épargne' : 'Set a savings goal'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t.goalName}</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} maxLength={100} className="rounded-xl h-11" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t.iconLabel}</Label>
              <div className="flex flex-wrap gap-2">
                {icons.map(ic => (
                  <button key={ic} onClick={() => setForm(f => ({ ...f, icon: ic }))}
                    className={`text-xl p-1.5 rounded-lg border-2 transition-colors ${form.icon === ic ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted'}`}>
                    {ic}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t.account} ({(t as any).optional || 'optionnel'})</Label>
              <AccountCombobox
                accounts={accounts}
                value={form.account_id}
                onValueChange={v => setForm(f => ({ ...f, account_id: v }))}
                placeholder={t.selectAccount}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t.targetAmount}</Label>
                <Input type="number" min="1" step="0.01" value={form.target_amount} onChange={e => setForm(f => ({ ...f, target_amount: e.target.value }))} className="rounded-xl h-11" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t.deadline}</Label>
                <Input type="date" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} className="rounded-xl h-11" />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl">{t.cancel}</Button>
            <Button className="text-primary-foreground rounded-xl" style={{ background: 'var(--gradient-primary)' }} onClick={handleCreate}>{t.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Amount Dialog - now with source account */}
      <Dialog open={!!addAmountDialog} onOpenChange={() => { setAddAmountDialog(null); setSourceAccountId(''); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">{t.addSaving}</DialogTitle>
            <DialogDescription>
              {locale === 'fr' ? 'Choisissez le compte source pour débiter le montant' : 'Choose the source account to debit the amount'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t.amount}</Label>
              <Input type="number" min="0.01" step="0.01" value={addAmount} onChange={e => setAddAmount(e.target.value)} className="rounded-xl h-11 text-lg font-bold" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {locale === 'fr' ? 'Compte source' : 'Source account'} ({(t as any).optional || 'optionnel'})
              </Label>
              <AccountCombobox
                accounts={accounts}
                value={sourceAccountId}
                onValueChange={setSourceAccountId}
                placeholder={locale === 'fr' ? 'Débiter depuis...' : 'Debit from...'}
                excludeId={goals.find(g => g.id === addAmountDialog)?.account_id}
              />
              <p className="text-xs text-muted-foreground">
                {locale === 'fr' ? 'Si sélectionné, une transaction sera créée automatiquement.' : 'If selected, a transaction will be created automatically.'}
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setAddAmountDialog(null); setSourceAccountId(''); }} className="rounded-xl">{t.cancel}</Button>
            <Button className="text-primary-foreground rounded-xl" style={{ background: 'var(--gradient-primary)' }} onClick={handleAddAmount} disabled={saving}>
              {saving ? t.saving : t.save}
            </Button>
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

export default SavingsPage;
