import { useState } from 'react';
import { ResponsiveFormDialog } from '@/components/ui/responsive-form-dialog';
import { Button } from '@/components/ui/button';
import { InputField } from '@/components/ui/input-field';
import { AccountCombobox } from '@/components/dashboard/AccountCombobox';
import { Label } from '@/components/ui/label';
import { ArrowDownToLine } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { coachToast } from '@/lib/coachToast';
import { exampleAmount } from '@/lib/currency';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  goal: { id: string; name: string; current_amount: number; user_id: string };
  accounts: any[];
  onWithdrawn: () => void;
  locale?: string;
  currency?: string;
}

export const PartialWithdrawDialog = ({ open, onOpenChange, goal, accounts, onWithdrawn, locale = 'fr', currency = 'EUR' }: Props) => {
  const fr = locale === 'fr';
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState('');
  const [saving, setSaving] = useState(false);

  const handleWithdraw = async () => {
    const n = parseFloat(amount);
    if (!n || n <= 0) { coachToast.warn(fr ? 'Montant invalide' : 'Invalid amount'); return; }
    if (n > goal.current_amount) { coachToast.warn(fr ? 'Solde insuffisant' : 'Insufficient balance'); return; }
    if (!accountId) { coachToast.warn(fr ? 'Compte requis' : 'Account required'); return; }
    setSaving(true);
    try {
      const { error: e1 } = await supabase.from('savings_goals')
        .update({ current_amount: goal.current_amount - n } as never).eq('id', goal.id);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from('transactions').insert({
        user_id: goal.user_id, type: 'income', amount: n,
        description: `${fr ? 'Retrait épargne' : 'Savings withdrawal'}: ${goal.name}`,
        account_id: accountId, date: new Date().toISOString().slice(0, 10),
      } as never);
      if (e2) throw e2;
      coachToast.money(fr ? 'Puisé dans votre épargne' : 'Withdrawn from your savings');
      onOpenChange(false);
      onWithdrawn();
    } catch (e: any) {
      coachToast.fail(e.message);
    } finally { setSaving(false); }
  };

  return (
    <ResponsiveFormDialog open={open} onOpenChange={onOpenChange}
      title={fr ? 'Puiser dans mon épargne' : 'Tap into my savings'}
      description={`${goal.name} — ${fr ? 'Disponible' : 'Available'}: ${goal.current_amount}`}
      footer={<>
        <Button variant="outline" onClick={() => onOpenChange(false)}>{fr ? 'Annuler' : 'Cancel'}</Button>
        <Button onClick={handleWithdraw} disabled={saving} className="gap-1">
          <ArrowDownToLine className="w-3 h-3" />{saving ? '...' : (fr ? 'Retirer' : 'Withdraw')}
        </Button>
      </>}>
      <div className="space-y-3">
        <InputField type="number" min="0.01" step="0.01" value={amount}
          onChange={e => setAmount((e.target as HTMLInputElement).value)}
          label={fr ? 'Montant' : 'Amount'} placeholder={exampleAmount(currency, locale)} />
        <div className="space-y-2">
          <Label className="form-label">{fr ? 'Compte de destination' : 'Destination account'}</Label>
          <AccountCombobox accounts={accounts} value={accountId} onValueChange={setAccountId}
            placeholder={fr ? 'Choisir un compte...' : 'Choose account...'} />
        </div>
      </div>
    </ResponsiveFormDialog>
  );
};
