import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Pencil, FileText, Coins, AlertTriangle, CheckCircle2, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Account } from '@/hooks/useDashboardData';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: Account | null;
  theoreticalBalance: number;
  userId: string | undefined;
  locale: 'fr' | 'en' | string;
  fmt: (n: number) => string;
  onResolved: () => void;
  onLaunchCashCount: (acc: Account) => void;
}

type Mode = 'choose' | 'adjust' | 'transaction';

export const ReconciliationDialog = ({
  open, onOpenChange, account, theoreticalBalance, userId, locale, fmt, onResolved, onLaunchCashCount,
}: Props) => {
  const isFr = locale === 'fr';
  const [mode, setMode] = useState<Mode>('choose');
  const [newBalance, setNewBalance] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const real = Number(account?.real_balance ?? 0);
  const discrepancy = useMemo(() => real - theoreticalBalance, [real, theoreticalBalance]);
  const absDisc = Math.abs(discrepancy);
  const isPositive = discrepancy > 0;

  const reset = () => { setMode('choose'); setNewBalance(''); setNotes(''); };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  if (!account) return null;

  const handleAdjust = async () => {
    const val = Number(newBalance);
    if (isNaN(val)) { toast.error(isFr ? 'Montant invalide' : 'Invalid amount'); return; }
    setSaving(true);
    const { error } = await supabase.from('payment_accounts').update({ real_balance: val }).eq('id', account.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(isFr ? 'Solde réel ajusté' : 'Real balance adjusted');
    onResolved();
    handleClose(false);
  };

  const handleCreateAdjustment = async () => {
    if (!userId || absDisc < 0.01) { toast.error(isFr ? 'Aucun écart à régulariser' : 'No discrepancy'); return; }
    setSaving(true);
    const today = new Date().toISOString().split('T')[0];
    const desc = notes.trim() || (isFr ? `Régularisation d'écart - ${account.name}` : `Discrepancy adjustment - ${account.name}`);
    const { error } = await supabase.from('transactions').insert({
      user_id: userId,
      account_id: account.id,
      type: isPositive ? 'income' : 'expense',
      amount: absDisc,
      description: desc,
      date: today,
      notes: isFr
        ? `⚖️ Écart automatique : théorique=${fmt(theoreticalBalance)} / réel=${fmt(real)}`
        : `⚖️ Auto discrepancy: theoretical=${fmt(theoreticalBalance)} / real=${fmt(real)}`,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(isFr ? 'Transaction d\'écart créée' : 'Discrepancy transaction created');
    onResolved();
    handleClose(false);
  };

  const handleCashCount = () => {
    handleClose(false);
    setTimeout(() => onLaunchCashCount(account), 200);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-xl">{account.icon}</span> {account.name}
          </DialogTitle>
          <DialogDescription>
            {isFr ? 'Réconciliation assistée du solde' : 'Assisted balance reconciliation'}
          </DialogDescription>
        </DialogHeader>

        {/* Discrepancy summary */}
        <Card className={`p-4 rounded-xl border-2 ${absDisc >= 0.01 ? 'border-amber-500/40 bg-amber-500/5' : 'border-secondary/40 bg-secondary/5'}`}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              {absDisc >= 0.01 ? <AlertTriangle className="w-4 h-4 text-amber-500" /> : <CheckCircle2 className="w-4 h-4 text-secondary" />}
              {absDisc >= 0.01 ? (isFr ? 'Écart détecté' : 'Discrepancy detected') : (isFr ? 'Soldes alignés' : 'Balances aligned')}
            </span>
            {absDisc >= 0.01 && (
              <span className={`text-sm font-bold ${isPositive ? 'text-secondary' : 'text-destructive'}`}>
                {isPositive ? '+' : '−'}{fmt(absDisc)}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{isFr ? 'Théorique' : 'Theoretical'}</p>
              <p className="font-bold text-foreground">{fmt(theoreticalBalance)}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{isFr ? 'Réel' : 'Real'}</p>
              <p className="font-bold text-foreground">{fmt(real)}</p>
            </div>
          </div>
        </Card>

        {/* Step: Choose */}
        {mode === 'choose' && (
          <div className="space-y-2 pt-2">
            <p className="text-xs text-muted-foreground mb-2">
              {isFr ? 'Comment voulez-vous régulariser ?' : 'How would you like to reconcile?'}
            </p>

            <button
              onClick={() => { setMode('adjust'); setNewBalance(String(real)); }}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-border hover:border-primary/50 hover:bg-muted/40 transition-all text-left group"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Pencil className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{isFr ? 'Ajuster le solde réel' : 'Adjust real balance'}</p>
                <p className="text-xs text-muted-foreground">{isFr ? 'Modifie directement la valeur affichée (sans transaction)' : 'Directly edit the displayed value (no transaction)'}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </button>

            <button
              onClick={() => setMode('transaction')}
              disabled={absDisc < 0.01}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-border hover:border-primary/50 hover:bg-muted/40 transition-all text-left group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">
                  {isFr ? 'Créer une transaction d\'écart' : 'Create discrepancy transaction'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {absDisc < 0.01
                    ? (isFr ? 'Aucun écart à régulariser' : 'No discrepancy to fix')
                    : `${isPositive ? (isFr ? 'Revenu' : 'Income') : (isFr ? 'Dépense' : 'Expense')} de ${fmt(absDisc)} ${isFr ? 'pour aligner' : 'to align'}`}
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </button>

            <button
              onClick={handleCashCount}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-border hover:border-primary/50 hover:bg-muted/40 transition-all text-left group"
            >
              <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center shrink-0">
                <Coins className="w-5 h-5 text-secondary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{isFr ? 'Lancer un PV d\'espèces' : 'Run a cash count'}</p>
                <p className="text-xs text-muted-foreground">{isFr ? 'Comptage physique détaillé par coupures' : 'Detailed physical count by denominations'}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </button>
          </div>
        )}

        {/* Step: Adjust */}
        {mode === 'adjust' && (
          <div className="space-y-3 pt-2">
            <Label className="form-label">{isFr ? 'Nouveau solde réel' : 'New real balance'}</Label>
            <Input
              type="number"
              step="0.01"
              value={newBalance}
              onChange={e => setNewBalance(e.target.value)}
              className="rounded-xl h-11 text-lg font-bold"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              {isFr ? 'Cette modification ne crée pas de transaction.' : 'This change creates no transaction.'}
            </p>
          </div>
        )}

        {/* Step: Transaction */}
        {mode === 'transaction' && (
          <div className="space-y-3 pt-2">
            <div className="p-3 rounded-xl bg-muted/40">
              <p className="text-xs text-muted-foreground mb-1">
                {isFr ? 'Transaction qui sera créée' : 'Transaction that will be created'}
              </p>
              <p className="font-bold text-sm">
                {isPositive ? (isFr ? 'Revenu' : 'Income') : (isFr ? 'Dépense' : 'Expense')} : {fmt(absDisc)}
              </p>
            </div>
            <Label className="form-label">{isFr ? 'Note (optionnel)' : 'Note (optional)'}</Label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={isFr ? 'Ex: oubli de saisie, frais bancaires…' : 'E.g.: missed entry, bank fees…'}
              className="rounded-xl"
              rows={3}
            />
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {mode === 'choose' ? (
            <Button variant="outline" onClick={() => handleClose(false)} className="rounded-xl">
              {isFr ? 'Fermer' : 'Close'}
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => setMode('choose')} className="rounded-xl">
                {isFr ? 'Retour' : 'Back'}
              </Button>
              <Button
                disabled={saving}
                onClick={mode === 'adjust' ? handleAdjust : handleCreateAdjustment}
                className="text-primary-foreground rounded-xl"
                style={{ background: 'var(--gradient-primary)' }}
              >
                {saving ? '…' : (isFr ? 'Confirmer' : 'Confirm')}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
