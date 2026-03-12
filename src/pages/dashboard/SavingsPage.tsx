import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useLanguage } from '@/i18n/LanguageContext';
import { dashT } from '@/i18n/dashTranslations';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Plus, PiggyBank } from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import ConfirmDeleteDialog from '@/components/dashboard/ConfirmDeleteDialog';
import { AccountCombobox } from '@/components/dashboard/AccountCombobox';
import { recalculateAccountBalance } from '@/hooks/useAccountBalance';
import { SavingsGoalCard } from '@/components/dashboard/savings/SavingsGoalCard';

const SavingsPage = () => {
  const { user } = useAuth();
  const { locale } = useLanguage();
  const { fmt: fmtCurrency } = useProfile();
  const t = dashT[locale];
  const [goals, setGoals] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [contributions, setContributions] = useState<Record<string, any[]>>({});
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
    const [goalsRes, accRes, txRes] = await Promise.all([
      supabase.from('savings_goals').select('*, payment_accounts(name, icon, real_balance)').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('payment_accounts').select('*').eq('user_id', user.id),
      // Fetch all savings-related transactions (they have notes starting with 🎯)
      supabase.from('transactions').select('id, amount, date, notes, account_id, description, payment_accounts:account_id(name, icon)')
        .eq('user_id', user.id)
        .like('notes', '🎯 %')
        .order('date', { ascending: false })
        .limit(500),
    ]);

    const goalsData = goalsRes.data || [];
    setGoals(goalsData);
    setAccounts(accRes.data || []);

    // Group contributions by goal name
    const contribMap: Record<string, any[]> = {};
    for (const goal of goalsData) {
      contribMap[goal.id] = [];
    }
    for (const tx of (txRes.data || [])) {
      // Match transaction to goal by notes pattern "🎯 GoalName"
      const goalName = tx.notes?.replace('🎯 ', '') || '';
      const matchedGoal = goalsData.find((g: any) => g.name === goalName);
      if (matchedGoal) {
        contribMap[matchedGoal.id] = contribMap[matchedGoal.id] || [];
        // Only count expense transactions (money going out from source account = contribution)
        if (tx.description?.startsWith(`${t.savings}:`)) {
          contribMap[matchedGoal.id].push({
            id: tx.id,
            amount: tx.amount,
            date: tx.date,
            account_name: (tx.payment_accounts as any)?.name,
            account_icon: (tx.payment_accounts as any)?.icon,
          });
        }
      }
    }
    setContributions(contribMap);
    setLoading(false);
  }, [user, t.savings]);

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

      if (sourceAccountId) {
        const { error: txError } = await supabase.from('transactions').insert({
          user_id: user.id, type: 'expense', amount: amountToAdd,
          description: `${t.savings}: ${goal.name}`, account_id: sourceAccountId,
          date: today, notes: `🎯 ${goal.name}`,
        });
        if (txError) throw txError;
        await recalculateAccountBalance(sourceAccountId);
      }

      if (goal.account_id && goal.account_id !== sourceAccountId) {
        const { error: txError } = await supabase.from('transactions').insert({
          user_id: user.id, type: 'income', amount: amountToAdd,
          description: `${t.savings}: ${goal.name}`, account_id: goal.account_id,
          date: today, notes: `🎯 ${goal.name}`,
        });
        if (txError) throw txError;
        await recalculateAccountBalance(goal.account_id);
      }

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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-80 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold font-display">{t.savings}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {goals.length} {locale === 'fr' ? 'objectif(s)' : 'goal(s)'}
            {goals.length > 0 && ` · ${fmt(goals.reduce((s, g) => s + Number(g.current_amount), 0))} ${locale === 'fr' ? 'épargnés' : 'saved'}`}
          </p>
        </div>
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {goals.map(g => (
            <SavingsGoalCard
              key={g.id}
              goal={g}
              contributions={contributions[g.id] || []}
              fmt={fmt}
              t={t}
              locale={locale}
              onAddSaving={() => { setAddAmountDialog(g.id); setAddAmount(''); setSourceAccountId(''); }}
              onDelete={() => setDeleteId(g.id)}
            />
          ))}
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
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t.account} ({t.optional})</Label>
              <AccountCombobox accounts={accounts} value={form.account_id} onValueChange={v => setForm(f => ({ ...f, account_id: v }))} placeholder={t.selectAccount} />
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

      {/* Add Amount Dialog */}
      <Dialog open={!!addAmountDialog} onOpenChange={() => { setAddAmountDialog(null); setSourceAccountId(''); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">{t.addSaving}</DialogTitle>
            <DialogDescription>
              {locale === 'fr' ? 'Ajoutez un versement à cet objectif' : 'Add a contribution to this goal'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t.amount}</Label>
              <Input type="number" min="0.01" step="0.01" value={addAmount} onChange={e => setAddAmount(e.target.value)} className="rounded-xl h-11 text-lg font-bold" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {locale === 'fr' ? 'Compte source' : 'Source account'} ({t.optional})
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
