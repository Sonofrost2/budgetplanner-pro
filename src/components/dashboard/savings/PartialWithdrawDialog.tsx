import { useState } from 'react';
import { ResponsiveFormDialog } from '@/components/ui/responsive-form-dialog';
import { Button } from '@/components/ui/button';
import { InputField } from '@/components/ui/input-field';
import { AccountCombobox } from '@/components/dashboard/AccountCombobox';
import { Label } from '@/components/ui/label';
import { ArrowDownToLine } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { coachToast } from '@/lib/coachToast';
import { DEFAULT_CURRENCY, exampleAmount, amountLabel } from '@/lib/currency';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  goal: { id: string; name: string; current_amount: number; user_id: string; is_locked?: boolean };
  accounts: any[];
  onWithdrawn: () => void;
  locale?: string;
  currency?: string;
}

export const PartialWithdrawDialog = ({ open, onOpenChange, goal, accounts, onWithdrawn, locale = 'fr', currency = DEFAULT_CURRENCY }: Props) => {
  const fr = locale === 'fr';
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState('');
  const [saving, setSaving] = useState(false);

  const handleWithdraw = async () => {
    const n = parseFloat(amount);
    if (!n || n <= 0) { coachToast.warn(fr ? 'Montant invalide' : 'Invalid amount'); return; }
    if (goal.is_locked) { coachToast.warn(fr ? 'Objectif verrouillé — retrait impossible' : 'Locked goal — withdrawal blocked'); return; }
    if (n > goal.current_amount) { coachToast.warn(fr ? 'Solde insuffisant' : 'Insufficient balance'); return; }
    if (!accountId) { coachToast.warn(fr ? 'Compte requis' : 'Account required'); return; }
    setSaving(true);
    try {
      // Retrait atomique + contrôle serveur (verrou, solde, ownership, ledger d'audit)
      const { data, error } = await supabase.rpc('withdraw_from_goal' as any, {
        p_goal_id: goal.id,
        p_amount: n,
        p_destination_account_id: accountId,
        p_note: `${fr ? 'Retrait épargne' : 'Savings withdrawal'}: ${goal.name}`,
      });
      if (error) {
        const code = (error.message || '').match(/GOAL_LOCKED|INSUFFICIENT_BALANCE|GOAL_DELETED|DESTINATION_ACCOUNT_INVALID|INVALID_AMOUNT|GOAL_NOT_FOUND/)?.[0];
        const map: Record<string, string> = {
          GOAL_LOCKED: fr ? 'Objectif verrouillé' : 'Goal locked',
          INSUFFICIENT_BALANCE: fr ? 'Solde insuffisant' : 'Insufficient balance',
          GOAL_DELETED: fr ? 'Objectif supprimé' : 'Goal deleted',
          DESTINATION_ACCOUNT_INVALID: fr ? 'Compte destination invalide' : 'Invalid destination account',
          INVALID_AMOUNT: fr ? 'Montant invalide' : 'Invalid amount',
          GOAL_NOT_FOUND: fr ? 'Objectif introuvable' : 'Goal not found',
        };
        throw new Error(code ? map[code] : error.message);
      }
      void data;
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
          label={amountLabel(fr ? 'Montant' : 'Amount', currency)} placeholder={exampleAmount(currency, locale)} />
        <div className="space-y-2">
          <Label className="form-label">{fr ? 'Compte de destination' : 'Destination account'}</Label>
          <AccountCombobox accounts={accounts} value={accountId} onValueChange={setAccountId}
            placeholder={fr ? 'Choisir un compte...' : 'Choose account...'} />
        </div>
      </div>
    </ResponsiveFormDialog>
  );
};
