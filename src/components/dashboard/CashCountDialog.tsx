import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Coins } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { recalculateAccountBalance } from '@/hooks/useAccountBalance';
import { toast } from 'sonner';
import type { DashTranslations } from '@/i18n/dashTranslations';

const DENOMINATIONS: Record<string, number[]> = {
  XOF: [10000, 5000, 2000, 1000, 500, 250, 200, 100, 50, 25, 10, 5],
  XAF: [10000, 5000, 2000, 1000, 500, 100, 50, 25, 10, 5],
  EUR: [500, 200, 100, 50, 20, 10, 5, 2, 1, 0.50, 0.20, 0.10, 0.05, 0.02, 0.01],
  USD: [100, 50, 20, 10, 5, 2, 1, 0.50, 0.25, 0.10, 0.05, 0.01],
  GNF: [20000, 10000, 5000, 2000, 1000, 500, 100],
};

interface CashCountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: { id: string; name: string; icon: string; real_balance: number } | null;
  theoreticalBalance: number;
  userId: string;
  currency: string;
  locale: string;
  fmt: (n: number) => string;
  t: DashTranslations;
  onSuccess: () => void;
}

const CashCountDialog = ({ open, onOpenChange, account, theoreticalBalance, userId, currency, locale, fmt, t, onSuccess }: CashCountDialogProps) => {
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const denoms = DENOMINATIONS[currency] || DENOMINATIONS.EUR;

  const totalCounted = useMemo(
    () => denoms.reduce((s, d) => s + (quantities[d] || 0) * d, 0),
    [quantities, denoms]
  );

  const expected = theoreticalBalance;
  const discrepancy = totalCounted - expected;

  const handleSave = async () => {
    if (!account) return;
    setSaving(true);

    // 1. Save the cash count record
    const { error: countError } = await supabase.from('cash_counts').insert({
      user_id: userId,
      account_id: account.id,
      denominations: quantities,
      total_counted: totalCounted,
      expected_balance: expected,
      discrepancy,
      notes: notes || null,
    });

    if (countError) {
      toast.error(countError.message);
      setSaving(false);
      return;
    }

    // 2. Update real_balance to the counted total (PV = source of truth for real balance)
    const { error: updateError } = await supabase
      .from('payment_accounts')
      .update({ real_balance: totalCounted })
      .eq('id', account.id);

    if (updateError) {
      toast.error(updateError.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    onOpenChange(false);
    setQuantities({});
    setNotes('');
    onSuccess();

    // Explicit toast with old → new balance
    const balanceUpdatedFn = (t as any).balanceUpdatedFromTo;
    if (balanceUpdatedFn) {
      toast.success(balanceUpdatedFn(expected, totalCounted, fmt));
    } else {
      toast.success(t.saved);
    }
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setQuantities({});
      setNotes('');
    }
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Coins className="w-5 h-5 text-primary" />
            {t.cashCount} — {account?.icon} {account?.name}
          </DialogTitle>
          <DialogDescription>
            {locale === 'fr'
              ? 'Comptez les billets et pièces. Le total deviendra le solde réel du compte.'
              : 'Count bills and coins. The total will become the account real balance.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Denominations grid */}
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t.denomination}</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {denoms.map(d => {
                const qty = quantities[d] || 0;
                const subtotal = qty * d;
                return (
                  <div key={d} className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
                    <span className="text-sm font-semibold w-16 tabular-nums">{d >= 1 ? d.toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-US') : d}</span>
                    <span className="text-muted-foreground text-xs">×</span>
                    <Input
                      type="number"
                      min="0"
                      value={qty || ''}
                      onChange={e => setQuantities(q => ({ ...q, [d]: Math.max(0, Number(e.target.value) || 0) }))}
                      className="h-8 w-16 text-center rounded-lg text-sm"
                    />
                    <span className={`text-xs ml-auto tabular-nums ${subtotal > 0 ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                      {fmt(subtotal)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Total + discrepancy */}
          <div className="bg-primary/5 rounded-xl p-4 text-center space-y-1">
            <p className="text-xs text-muted-foreground">{locale === 'fr' ? 'Total compté' : 'Total counted'}</p>
            <p className="text-2xl font-extrabold tabular-nums">{fmt(totalCounted)}</p>
            <div className="flex items-center justify-center gap-4 text-xs">
              <span className="text-muted-foreground">
                {t.expected}: {fmt(expected)}
              </span>
              <span className={`font-bold ${discrepancy === 0 ? 'text-secondary' : 'text-destructive'}`}>
                {t.discrepancy}: {discrepancy >= 0 ? '+' : ''}{fmt(discrepancy)}
              </span>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t.notes} ({t.optional})</Label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} className="rounded-xl h-11" placeholder={locale === 'fr' ? 'Observation...' : 'Observation...'} />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => handleOpenChange(false)} className="rounded-xl">{t.cancel}</Button>
          <Button
            className="text-primary-foreground rounded-xl"
            style={{ background: 'var(--gradient-primary)' }}
            onClick={handleSave}
            disabled={saving || totalCounted === 0}
          >
            {saving ? t.saving : t.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CashCountDialog;
