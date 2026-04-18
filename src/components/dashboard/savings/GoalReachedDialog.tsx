import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { InputField } from '@/components/ui/input-field';
import { Label } from '@/components/ui/label';
import { AccountCombobox } from '@/components/dashboard/AccountCombobox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { coachToast } from '@/lib/coachToast';
import { Sparkles, ArrowRightLeft, Building2, Archive, Trophy, Loader2 } from 'lucide-react';
import type { SavingsGoal, Account } from '@/hooks/useDashboardData';

type Action = 'reinvest' | 'transfer' | 'asset' | 'archive' | null;

interface GoalReachedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal: SavingsGoal | null;
  goals: SavingsGoal[];
  accounts: Account[];
  userId: string;
  fmt: (n: number) => string;
  locale: string;
  onReinvest: (goalId: string) => void; // delegates to existing reinvest form flow
  onSuccess: () => void;
}

const ASSET_CATEGORIES = [
  { value: 'real_estate', label_fr: 'Immobilier 🏠', label_en: 'Real estate 🏠' },
  { value: 'vehicle', label_fr: 'Véhicule 🚗', label_en: 'Vehicle 🚗' },
  { value: 'equipment', label_fr: 'Équipement 🛠️', label_en: 'Equipment 🛠️' },
  { value: 'investment', label_fr: 'Investissement 📈', label_en: 'Investment 📈' },
  { value: 'collectible', label_fr: 'Objet de valeur 💎', label_en: 'Collectible 💎' },
  { value: 'other', label_fr: 'Autre', label_en: 'Other' },
];

export const GoalReachedDialog = ({
  open, onOpenChange, goal, goals, accounts, userId, fmt, locale, onReinvest, onSuccess,
}: GoalReachedDialogProps) => {
  const isFr = locale === 'fr';
  const [action, setAction] = useState<Action>(null);
  const [busy, setBusy] = useState(false);

  // transfer
  const [targetGoalId, setTargetGoalId] = useState('');

  // asset
  const [assetName, setAssetName] = useState('');
  const [assetCategory, setAssetCategory] = useState('other');
  const [assetValue, setAssetValue] = useState('');
  const [debitAccountId, setDebitAccountId] = useState('');

  if (!goal) return null;

  const reset = () => {
    setAction(null);
    setBusy(false);
    setTargetGoalId('');
    setAssetName('');
    setAssetCategory('other');
    setAssetValue('');
    setDebitAccountId('');
  };

  const close = () => {
    reset();
    onOpenChange(false);
  };

  const otherActiveGoals = goals.filter(g =>
    g.id !== goal.id &&
    !g.deleted_at &&
    !(g as any).paused_at &&
    ((g as any).status ?? 'active') === 'active' &&
    g.account_id // can only transfer to a goal with a linked account
  );

  // ── Action 1: Reinvest (delegates to parent reinvest form) ────────────
  const handleReinvest = () => {
    onReinvest(goal.id);
    close();
  };

  // ── Action 2: Transfer to another savings goal ────────────────────────
  const handleTransfer = async () => {
    if (!targetGoalId || !goal.account_id) {
      coachToast.fail(isFr ? 'Sélectionnez un objectif cible' : 'Select a target goal');
      return;
    }
    const target = goals.find(g => g.id === targetGoalId);
    if (!target?.account_id) {
      coachToast.fail(isFr ? 'L\'objectif cible doit avoir un compte lié' : 'Target goal must have a linked account');
      return;
    }
    setBusy(true);
    try {
      const amount = Number(goal.current_amount);
      const desc = isFr
        ? `Transfert épargne: ${goal.name} → ${target.name}`
        : `Savings transfer: ${goal.name} → ${target.name}`;
      const { error } = await supabase.rpc('perform_transfer', {
        p_user_id: userId,
        p_from_account_id: goal.account_id,
        p_to_account_id: target.account_id,
        p_amount: amount,
        p_description: desc,
      });
      if (error) throw error;
      // Archive the now-emptied source goal (trigger will auto-archive linked account)
      await supabase.from('savings_goals').update({ status: 'completed' } as any).eq('id', goal.id);
      coachToast.win(isFr
        ? `${fmt(amount)} transférés vers ${target.name}`
        : `${fmt(amount)} transferred to ${target.name}`);
      onSuccess();
      close();
    } catch (e: any) {
      coachToast.fail(e.message || 'Erreur');
    } finally {
      setBusy(false);
    }
  };

  // ── Action 3: Convert to a Wealth asset ───────────────────────────────
  const handleAsset = async () => {
    const value = Number(assetValue);
    if (!assetName.trim() || value <= 0) {
      coachToast.fail(isFr ? 'Renseignez le nom et la valeur' : 'Fill name and value');
      return;
    }
    setBusy(true);
    try {
      // 1. Create the asset in the wealth module
      const { error: aErr } = await supabase.from('assets').insert({
        user_id: userId,
        name: assetName.trim(),
        asset_type: assetCategory,
        category: assetCategory,
        current_value: value,
        acquisition_cost: value,
        acquisition_date: new Date().toISOString().split('T')[0],
        notes: isFr
          ? `Acquis grâce à l'objectif d'épargne « ${goal.name} »`
          : `Acquired from savings goal "${goal.name}"`,
      });
      if (aErr) throw aErr;

      // 2. Record the spending: withdrawal from the savings account
      //    + (optional) corresponding outflow on the chosen debit account if different
      const today = new Date().toISOString().split('T')[0];
      const desc = isFr ? `Achat actif: ${assetName.trim()}` : `Asset purchase: ${assetName.trim()}`;

      if (goal.account_id && debitAccountId && debitAccountId !== goal.account_id) {
        const { error: tErr } = await supabase.rpc('perform_transfer', {
          p_user_id: userId,
          p_from_account_id: goal.account_id,
          p_to_account_id: debitAccountId,
          p_amount: value,
          p_description: isFr ? `Sortie épargne pour ${assetName}` : `Savings withdrawal for ${assetName}`,
        });
        if (tErr) throw tErr;
        // The actual spending leaves debit account
        await supabase.from('transactions').insert({
          user_id: userId, type: 'expense', amount: value,
          description: desc, account_id: debitAccountId, date: today,
          notes: isFr ? `🏛️ Conversion en actif patrimoine` : `🏛️ Converted to wealth asset`,
        });
      } else if (goal.account_id) {
        // Direct: spend straight from the savings account
        await supabase.from('transactions').insert({
          user_id: userId, type: 'expense', amount: value,
          description: desc, account_id: goal.account_id, date: today,
          notes: isFr ? `🏛️ Conversion en actif patrimoine` : `🏛️ Converted to wealth asset`,
        });
      }

      // 3. Archive the goal (trigger auto-archives the linked account)
      await supabase.from('savings_goals').update({ status: 'completed' } as any).eq('id', goal.id);

      coachToast.win(isFr
        ? `Actif "${assetName}" créé dans Patrimoine 🏛️`
        : `Asset "${assetName}" added to Wealth 🏛️`);
      onSuccess();
      close();
    } catch (e: any) {
      coachToast.fail(e.message || 'Erreur');
    } finally {
      setBusy(false);
    }
  };

  // ── Action 4: Just archive ────────────────────────────────────────────
  const handleArchive = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.from('savings_goals').update({ status: 'completed' } as any).eq('id', goal.id);
      if (error) throw error;
      coachToast.win(isFr ? `${goal.name} archivé 🎉` : `${goal.name} archived 🎉`);
      onSuccess();
      close();
    } catch (e: any) {
      coachToast.fail(e.message || 'Erreur');
    } finally {
      setBusy(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Trophy className="w-5 h-5 text-secondary" />
            {isFr ? 'Objectif atteint !' : 'Goal reached!'}
            <span className="text-muted-foreground font-normal">— {goal.icon} {goal.name}</span>
          </DialogTitle>
          <DialogDescription>
            {isFr
              ? `Vous avez accumulé ${fmt(Number(goal.current_amount))}. Que souhaitez-vous faire de ce capital ?`
              : `You have accumulated ${fmt(Number(goal.current_amount))}. What do you want to do with this capital?`}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: choose an action */}
        {!action && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
            <ActionCard
              icon={<Sparkles className="w-5 h-5" />}
              title={isFr ? 'Réinvestir' : 'Reinvest'}
              desc={isFr ? 'Créer un nouvel objectif plus ambitieux' : 'Create a more ambitious new goal'}
              onClick={() => setAction('reinvest')}
              accent="primary"
            />
            <ActionCard
              icon={<ArrowRightLeft className="w-5 h-5" />}
              title={isFr ? 'Transférer' : 'Transfer'}
              desc={isFr ? 'Vers un autre objectif d\'épargne actif' : 'To another active savings goal'}
              onClick={() => setAction('transfer')}
              disabled={!goal.account_id || otherActiveGoals.length === 0}
              accent="secondary"
            />
            <ActionCard
              icon={<Building2 className="w-5 h-5" />}
              title={isFr ? 'Convertir en actif' : 'Convert to asset'}
              desc={isFr ? 'Acheter un bien (immobilier, véhicule…)' : 'Buy an asset (real estate, vehicle…)'}
              onClick={() => setAction('asset')}
              accent="primary"
            />
            <ActionCard
              icon={<Archive className="w-5 h-5" />}
              title={isFr ? 'Archiver simplement' : 'Just archive'}
              desc={isFr ? 'Garder le solde, marquer comme atteint' : 'Keep balance, mark as reached'}
              onClick={() => setAction('archive')}
              accent="muted"
            />
          </div>
        )}

        {/* Step 2 — Reinvest is delegated immediately */}
        {action === 'reinvest' && (
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              {isFr
                ? 'Le formulaire de création d\'un nouvel objectif va s\'ouvrir, pré-rempli depuis l\'actuel. L\'objectif atteint sera archivé après validation.'
                : 'The new-goal form will open, pre-filled from the current one. The reached goal will be archived after submission.'}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setAction(null)}>{isFr ? 'Retour' : 'Back'}</Button>
              <Button onClick={handleReinvest} className="text-primary-foreground" style={{ background: 'var(--gradient-primary)' }}>
                <Sparkles className="w-4 h-4 mr-1.5" />{isFr ? 'Continuer' : 'Continue'}
              </Button>
            </div>
          </div>
        )}

        {/* Step 2 — Transfer */}
        {action === 'transfer' && (
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label className="form-label">{isFr ? 'Objectif cible' : 'Target goal'}</Label>
              <Select value={targetGoalId} onValueChange={setTargetGoalId}>
                <SelectTrigger><SelectValue placeholder={isFr ? 'Choisir un objectif…' : 'Choose a goal…'} /></SelectTrigger>
                <SelectContent>
                  {otherActiveGoals.map(g => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.icon} {g.name} — {fmt(Number(g.current_amount))} / {fmt(Number(g.target_amount))}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-xl bg-muted/50 p-3 text-sm">
              <span className="text-muted-foreground">{isFr ? 'Montant transféré' : 'Amount transferred'}: </span>
              <span className="font-bold">{fmt(Number(goal.current_amount))}</span>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setAction(null)} disabled={busy}>{isFr ? 'Retour' : 'Back'}</Button>
              <Button onClick={handleTransfer} disabled={busy || !targetGoalId}>
                {busy && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
                <ArrowRightLeft className="w-4 h-4 mr-1.5" />
                {isFr ? 'Transférer' : 'Transfer'}
              </Button>
            </div>
          </div>
        )}

        {/* Step 2 — Convert to asset */}
        {action === 'asset' && (
          <div className="space-y-4 pt-2">
            <InputField
              label={isFr ? 'Nom de l\'actif' : 'Asset name'}
              value={assetName}
              onChange={e => setAssetName((e.target as HTMLInputElement).value)}
              placeholder={isFr ? 'Ex. Appartement Cocody' : 'e.g. Cocody apartment'}
            />
            <div className="space-y-2">
              <Label className="form-label">{isFr ? 'Catégorie' : 'Category'}</Label>
              <Select value={assetCategory} onValueChange={setAssetCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ASSET_CATEGORIES.map(c => (
                    <SelectItem key={c.value} value={c.value}>{isFr ? c.label_fr : c.label_en}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <InputField
              label={isFr ? 'Valeur de l\'actif' : 'Asset value'}
              type="number" min="0.01" step="0.01"
              value={assetValue}
              onChange={e => setAssetValue((e.target as HTMLInputElement).value)}
              placeholder={String(goal.current_amount)}
            />
            {goal.account_id && (
              <div className="space-y-2">
                <Label className="form-label">
                  {isFr ? 'Compte de débit (optionnel)' : 'Debit account (optional)'}
                </Label>
                <AccountCombobox
                  accounts={accounts}
                  value={debitAccountId}
                  onValueChange={setDebitAccountId}
                  placeholder={isFr ? 'Par défaut: depuis l\'épargne' : 'Default: from the savings'}
                  excludeId={goal.account_id}
                />
                <p className="text-xs text-muted-foreground">
                  {isFr
                    ? 'Si différent, l\'épargne est d\'abord transférée vers ce compte avant la dépense.'
                    : 'If different, savings are transferred to this account first, then spent.'}
                </p>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setAction(null)} disabled={busy}>{isFr ? 'Retour' : 'Back'}</Button>
              <Button onClick={handleAsset} disabled={busy || !assetName.trim() || Number(assetValue) <= 0}>
                {busy && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
                <Building2 className="w-4 h-4 mr-1.5" />
                {isFr ? 'Créer l\'actif' : 'Create asset'}
              </Button>
            </div>
          </div>
        )}

        {/* Step 2 — Archive */}
        {action === 'archive' && (
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              {isFr
                ? 'L\'objectif sera marqué comme atteint et archivé. Le compte d\'épargne lié sera également archivé automatiquement et n\'apparaîtra plus dans vos totaux actifs.'
                : 'The goal will be marked reached and archived. Its linked savings account will also be auto-archived and stop appearing in your active totals.'}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setAction(null)} disabled={busy}>{isFr ? 'Retour' : 'Back'}</Button>
              <Button onClick={handleArchive} disabled={busy} variant="secondary">
                {busy && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
                <Archive className="w-4 h-4 mr-1.5" />
                {isFr ? 'Archiver' : 'Archive'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

interface ActionCardProps {
  icon: React.ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
  disabled?: boolean;
  accent: 'primary' | 'secondary' | 'muted';
}

const ActionCard = ({ icon, title, desc, onClick, disabled, accent }: ActionCardProps) => {
  const accentClasses = {
    primary: 'bg-primary/10 text-primary border-primary/20 hover:bg-primary/15',
    secondary: 'bg-secondary/10 text-secondary border-secondary/20 hover:bg-secondary/15',
    muted: 'bg-muted/50 text-foreground border-border hover:bg-muted',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`group text-left rounded-xl border p-4 transition-all disabled:opacity-40 disabled:cursor-not-allowed ${accentClasses[accent]}`}
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5">{icon}</div>
        <div className="space-y-1">
          <div className="font-semibold text-sm">{title}</div>
          <div className="text-xs opacity-80 leading-snug">{desc}</div>
        </div>
      </div>
    </button>
  );
};
