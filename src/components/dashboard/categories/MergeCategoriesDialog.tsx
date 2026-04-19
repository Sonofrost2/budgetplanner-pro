import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Merge, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import type { Category } from '@/hooks/useDashboardData';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sources: Category[];
  candidates: Category[];
  isFr: boolean;
  onDone: () => void;
}

export const MergeCategoriesDialog = ({ open, onOpenChange, sources, candidates, isFr, onDone }: Props) => {
  const { user } = useAuth();
  const [targetId, setTargetId] = useState<string>('');
  const [busy, setBusy] = useState(false);

  const validTargets = candidates.filter(c => !sources.some(s => s.id === c.id));

  const handleMerge = async () => {
    if (!user || !targetId || sources.length === 0) return;
    setBusy(true);
    const { data, error } = await supabase.rpc('merge_categories', {
      p_user_id: user.id,
      p_source_ids: sources.map(s => s.id),
      p_target_id: targetId,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    const r = data as any;
    toast.success(isFr
      ? `${r.merged_count} fusionnées · ${r.transactions_reassigned} tx réassignées`
      : `${r.merged_count} merged · ${r.transactions_reassigned} tx reassigned`);
    onOpenChange(false);
    setTargetId('');
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Merge className="w-5 h-5 text-primary" />{isFr ? 'Fusionner les catégories' : 'Merge categories'}</DialogTitle>
          <DialogDescription>
            {isFr
              ? `${sources.length} catégories source seront archivées et toutes leurs données réassignées vers la cible.`
              : `${sources.length} source categories will be archived and all their data reassigned to the target.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-xl bg-muted/40 p-3 border border-border/50">
            <p className="text-xs font-medium mb-2 text-muted-foreground">{isFr ? 'Sources (seront archivées) :' : 'Sources (will be archived):'}</p>
            <div className="flex flex-wrap gap-1.5">
              {sources.map(s => (
                <span key={s.id} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-background text-xs">
                  {s.icon} {s.name}
                </span>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">{isFr ? 'Catégorie cible' : 'Target category'}</label>
            <Select value={targetId} onValueChange={setTargetId}>
              <SelectTrigger className="rounded-xl"><SelectValue placeholder={isFr ? 'Choisir la destination...' : 'Select destination...'} /></SelectTrigger>
              <SelectContent>
                {validTargets.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-start gap-2 rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 text-xs">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p>{isFr ? 'Action irréversible. Les transactions, budgets et récurrences seront déplacés.' : 'Irreversible action. Transactions, budgets and recurrences will be moved.'}</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">{isFr ? 'Annuler' : 'Cancel'}</Button>
          <Button onClick={handleMerge} disabled={!targetId || busy} className="text-primary-foreground rounded-xl" style={{ background: 'var(--gradient-primary)' }}>
            {busy ? (isFr ? 'Fusion...' : 'Merging...') : (isFr ? 'Fusionner' : 'Merge')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
