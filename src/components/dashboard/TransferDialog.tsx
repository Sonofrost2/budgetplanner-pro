import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AccountCombobox } from '@/components/dashboard/AccountCombobox';
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
    if (fromAccountId === toAccountId) errs.to = t.transferSameAccount;
    if (!amount || Number(amount) <= 0) errs.amount = t.invalidAmount;
    if (Number(amount) > 999999999) errs.amount = t.amountTooHigh;
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleTransfer = async () => {
    if (!validate()) return;
    setSaving(true);

    try {
      const { data, error } = await supabase.rpc('perform_transfer', {
        p_user_id: userId,
        p_from_account_id: fromAccountId,
        p_to_account_id: toAccountId,
        p_amount: Number(amount),
        p_description: description.trim(),
      });

      if (error) throw error;

      toast.success(t.transferSuccess);
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
          <DialogTitle className="text-xl font-bold">{t.transfer}</DialogTitle>
          <DialogDescription>{t.transferDesc}</DialogDescription>
        </DialogHeader>
        <div className="space-y-5 py-2">
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

          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {t.fromAccount}
            </Label>
            <AccountCombobox
              accounts={accounts}
              value={fromAccountId}
              onValueChange={setFromAccountId}
              placeholder={t.selectAccount}
              error={!!errors.from}
            />
            {errors.from && <p className="text-xs text-destructive">{errors.from}</p>}
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {(t as any).toAccount || 'Compte destination'}
            </Label>
            <AccountCombobox
              accounts={accounts}
              value={toAccountId}
              onValueChange={setToAccountId}
              placeholder={t.selectAccount}
              excludeId={fromAccountId}
              error={!!errors.to}
            />
            {errors.to && <p className="text-xs text-destructive">{errors.to}</p>}
          </div>

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
