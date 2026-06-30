import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import type { DuplicateCandidate } from '@/lib/duplicateDetection';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  duplicates: DuplicateCandidate[];
  onConfirm: () => void;
  currency?: string;
  locale?: string;
}

import { currencySymbol, formatNumber, bcp47 } from '@/lib/currency';

export const DuplicateWarningDialog = ({ open, onOpenChange, duplicates, onConfirm, currency = DEFAULT_CURRENCY, locale = 'fr' }: Props) => {
  const sym = currencySymbol(currency);
  const fr = locale === 'fr';
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-warning" />
            {fr ? 'Possible doublon détecté' : 'Possible duplicate detected'}
          </DialogTitle>
          <DialogDescription>
            {fr
              ? `${duplicates.length} transaction(s) similaire(s) ont été enregistrée(s) dans les dernières 24h. Souhaitez-vous quand même l'enregistrer ?`
              : `${duplicates.length} similar transaction(s) recorded in the last 24h. Save anyway?`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 max-h-60 overflow-y-auto">
          {duplicates.map(d => (
            <div key={d.id} className="p-3 rounded-lg border border-border bg-muted/30">
              <div className="flex justify-between items-start gap-2">
                <span className="font-medium text-sm truncate">{d.description}</span>
                <span className="text-sm font-semibold whitespace-nowrap">{formatNumber(Number(d.amount), locale)} {sym}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {new Date(d.created_at).toLocaleString(bcp47(locale))}
              </p>
            </div>
          ))}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {fr ? 'Annuler' : 'Cancel'}
          </Button>
          <Button onClick={onConfirm} className="bg-warning hover:bg-warning/90 text-warning-foreground">
            {fr ? 'Enregistrer quand même' : 'Save anyway'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
