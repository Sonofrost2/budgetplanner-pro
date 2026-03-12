import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { DashTranslations } from '@/i18n/dashTranslations';

interface Account {
  id: string;
  name: string;
  icon: string;
}

interface TransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: Account[];
  userId: string;
  t: DashTranslations;
  onSuccess: () => void;
  defaultFromAccountId?: string;
}

export const TransferDialog = ({ open, onOpenChange, accounts, userId, t, onSuccess, defaultFromAccountId }: TransferDialogProps) => {
  const [fromAccountId, setFromAccountId] = useState(defaultFromAccountId || '');
  const [toAccountId, setToAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const resetForm = () => {
    setFromAccountId(defaultFromAccountId || '');
    setToAccountId('');
    setAmount('');
    setDescription('');
    setErrors({});
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) resetForm();
    onOpenChange(v);
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!fromAccountId) errs.from = t.nameRequired;
    if (!toAccountId) errs.to = t.nameRequired;
    if (fromAccountId === toAccountId) errs.to = (t as any).transferSameAccount || 'Comptes identiques';
    if (!amount || Number(amount) <= 0) errs.amount = t.invalidAmount;
    if (Number(amount) > 999999999) errs.amount = t.amountTooHigh;
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const updateAccountBalance = async (accountId: string) => {
    const [accRes, txRes] = await Promise.all([
      supabase.from('payment_accounts').select('opening_balance').eq('id', accountId).single(),
      supabase.from('transactions').select('type, amount').eq('user_id', userId).eq('account_id', accountId),
    ]);
    if (accRes.error || txRes.error) return;
    const opening = Number(accRes.data.opening_balance) || 0;
    const income = (txRes.data || []).filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
    const expense = (txRes.data || []).filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
    await supabase.from('payment_accounts').update({ real_balance: opening + income - expense }).eq('id', accountId);
  };

  const handleTransfer = async () => {
    if (!validate()) return;
    setSaving(true);

    const fromAcc = accounts.find(a => a.id === fromAccountId);
    const toAcc = accounts.find(a => a.id === toAccountId);
    const transferAmount = Number(amount);
    const desc = description.trim() || `${(t as any).transfer || 'Transfert'}: ${fromAcc?.name} → ${toAcc?.name}`;
    const today = new Date().toISOString().split('T')[0];

    try {
      // Create expense on source account
      const { data: expenseTx, error: e1 } = await supabase.from('transactions').insert({
        user_id: userId,
        type: 'expense',
        amount: transferAmount,
        description: desc,
        account_id: fromAccountId,
        date: today,
        notes: `↗ ${toAcc?.name}`,
      }).select('id').single();

      if (e1) throw e1;

      // Create income on destination account
      const { data: incomeTx, error: e2 } = await supabase.from('transactions').insert({
        user_id: userId,
        type: 'income',
        amount: transferAmount,
        description: desc,
        account_id: toAccountId,
        date: today,
        notes: `↙ ${fromAcc?.name}`,
      }).select('id').single();

      if (e2) throw e2;

      // Link them together
      if (expenseTx && incomeTx) {
        await Promise.all([
          supabase.from('transactions').update({ linked_transfer_id: incomeTx.id } as any).eq('id', expenseTx.id),
          supabase.from('transactions').update({ linked_transfer_id: expenseTx.id } as any).eq('id', incomeTx.id),
        ]);
      }

      // Update both account balances
      await Promise.all([
        updateAccountBalance(fromAccountId),
        updateAccountBalance(toAccountId),
      ]);

      toast.success((t as any).transferSuccess || 'Transfert effectué !');
      handleOpenChange(false);
      onSuccess();
    } catch (err: any) {
      console.error('Transfer error:', err);
      toast.error(err.message || 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const fromAcc = accounts.find(a => a.id === fromAccountId);
  const toAcc = accounts.find(a => a.id === toAccountId);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">{(t as any).transfer || 'Transfert'}</DialogTitle>
          <DialogDescription>{(t as any).transferDesc || 'Transférer des fonds entre vos comptes'}</DialogDescription>
        </DialogHeader>
        <div className="space-y-5 py-2">
          {/* Visual transfer indicator */}
          {fromAcc && toAcc && (
            <div className="flex items-center justify-center gap-3 p-3 rounded-xl bg-muted/50">
              <div className="text-center">
                <span className="text-2xl">{fromAcc.icon}</span>
                <p className="text-xs font-medium mt-1">{fromAcc.name}</p>
              </div>
              <ArrowRight className="w-5 h-5 text-primary flex-shrink-0" />
              <div className="text-center">
                <span className="text-2xl">{toAcc.icon}</span>
                <p className="text-xs font-medium mt-1">{toAcc.name}</p>
              </div>
            </div>
          )}

          {/* From account */}
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {(t as any).fromAccount || 'Compte source'}
            </Label>
            <Select value={fromAccountId} onValueChange={setFromAccountId}>
              <SelectTrigger className={`rounded-xl h-11 ${errors.from ? 'border-destructive' : ''}`}>
                <SelectValue placeholder={t.selectAccount} />
              </SelectTrigger>
              <SelectContent>
                {accounts.map(a => (
                  <SelectItem key={a.id} value={a.id}>{a.icon} {a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.from && <p className="text-xs text-destructive">{errors.from}</p>}
          </div>

          {/* To account */}
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {(t as any).toAccount || 'Compte destination'}
            </Label>
            <Select value={toAccountId} onValueChange={setToAccountId}>
              <SelectTrigger className={`rounded-xl h-11 ${errors.to ? 'border-destructive' : ''}`}>
                <SelectValue placeholder={t.selectAccount} />
              </SelectTrigger>
              <SelectContent>
                {accounts.filter(a => a.id !== fromAccountId).map(a => (
                  <SelectItem key={a.id} value={a.id}>{a.icon} {a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.to && <p className="text-xs text-destructive">{errors.to}</p>}
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t.amount}</Label>
            <Input
              type="number"
              step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0"
              className={`rounded-xl h-11 text-lg font-bold ${errors.amount ? 'border-destructive' : ''}`}
            />
            {errors.amount && <p className="text-xs text-destructive">{errors.amount}</p>}
          </div>

          {/* Description (optional) */}
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t.description} ({(t as any).optional || 'optionnel'})</Label>
            <Input
              value={description}
              onChange={e => setDescription(e.target.value)}
              maxLength={200}
              placeholder={(t as any).transferDescPlaceholder || 'Ex: Recharge Wave depuis banque'}
              className="rounded-xl h-11"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => handleOpenChange(false)} className="rounded-xl">{t.cancel}</Button>
          <Button
            className="text-primary-foreground rounded-xl min-w-[120px]"
            style={{ background: 'var(--gradient-primary)' }}
            onClick={handleTransfer}
            disabled={saving || accounts.length < 2}
          >
            {saving ? t.saving : (t as any).transfer || 'Transférer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
