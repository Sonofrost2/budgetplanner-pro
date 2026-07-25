import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Sparkles, Loader2, RefreshCw } from 'lucide-react';
import { invokeAuthedEdgeFunction } from '@/lib/aiEdge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import type { Category } from '@/hooks/useDashboardData';

interface Proposal {
  name: string;
  icon: string;
  color: string;
  type: 'expense' | 'income';
  parent_name?: string | null;
  rationale?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  categories: Category[];
  isFr: boolean;
  onApplied: () => void;
  onPrefill?: (p: Proposal) => void;
}

export const AICategoriesProposeDialog = ({ open, onOpenChange, categories, isFr, onApplied, onPrefill }: Props) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [cached, setCached] = useState(false);
  const [busy, setBusy] = useState(false);

  const fetchProposals = async () => {
    setLoading(true);
    setSelected(new Set());
    try {
      const payload = categories.map(c => ({
        id: c.id, name: c.name, type: c.type,
        parent_id: c.parent_category_id ?? null, tx_count: 0, total: 0,
      }));
      const currency = (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('geo_currency')) || 'XOF';
      const data = await invokeAuthedEdgeFunction<{ proposals: Proposal[]; cached?: boolean }>(
        'ai-categories-suggest',
        { locale: isFr ? 'fr' : 'en', body: { mode: 'propose', categories: payload, locale: isFr ? 'fr' : 'en', context: { currency } } },
      );
      setProposals(Array.isArray(data?.proposals) ? data.proposals : []);
      setCached(!!data?.cached);
    } catch (e: any) {
      toast.error(e?.message ?? (isFr ? 'Erreur IA' : 'AI error'));
    } finally {
      setLoading(false);
    }
  };

  const toggle = (i: number) => {
    setSelected(prev => {
      const n = new Set(prev);
      if (n.has(i)) n.delete(i); else n.add(i);
      return n;
    });
  };
  const toggleAll = () => {
    setSelected(prev => prev.size === proposals.length ? new Set() : new Set(proposals.map((_, i) => i)));
  };

  const createSelected = async () => {
    if (!user || selected.size === 0) return;
    setBusy(true);
    const byName = new Map(categories.map(c => [c.name.toLowerCase().trim(), c] as const));
    const inserts = Array.from(selected).map(i => {
      const p = proposals[i];
      const parent = p.parent_name ? byName.get(p.parent_name.toLowerCase().trim()) : undefined;
      return {
        user_id: user.id,
        name: p.name,
        icon: p.icon,
        color: p.color,
        type: p.type,
        parent_category_id: parent && parent.type === p.type ? parent.id : null,
      };
    });
    const { error } = await supabase.from('categories').insert(inserts);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(isFr ? `${inserts.length} catégorie(s) créée(s) ✓` : `${inserts.length} categor${inserts.length > 1 ? 'ies' : 'y'} created ✓`);
    onApplied();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (v && proposals.length === 0 && !loading) void fetchProposals(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            {isFr ? 'Suggestions IA de catégories' : 'AI category suggestions'}
          </DialogTitle>
          <DialogDescription>
            {isFr
              ? 'Le coach analyse ta taxonomie et propose des catégories utiles à ajouter.'
              : 'The coach analyses your taxonomy and proposes useful categories.'}
            {cached && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{isFr ? 'cache' : 'cached'}</span>}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-[240px] max-h-[55vh] overflow-y-auto pr-1 space-y-2">
          {loading && (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> {isFr ? 'Analyse en cours…' : 'Analysing…'}
            </div>
          )}
          {!loading && proposals.length === 0 && (
            <div className="text-center py-12 text-sm text-muted-foreground">
              {isFr ? 'Aucune proposition pour l’instant.' : 'No proposals yet.'}
            </div>
          )}
          {!loading && proposals.map((p, i) => {
            const isSel = selected.has(i);
            return (
              <Card key={i} className={`p-3 rounded-2xl transition-all cursor-pointer ${isSel ? 'ring-2 ring-primary bg-primary/5' : 'hover:bg-muted/40'}`} onClick={() => toggle(i)}>
                <div className="flex items-center gap-3">
                  <Checkbox checked={isSel} onCheckedChange={() => toggle(i)} onClick={e => e.stopPropagation()} />
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0" style={{ background: p.color + '22' }}>
                    {p.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm">{p.name}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-md border font-semibold ${p.type === 'income' ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/25' : 'bg-rose-500/15 text-rose-500 border-rose-500/25'}`}>
                        {p.type === 'income' ? (isFr ? 'Revenu' : 'Income') : (isFr ? 'Dépense' : 'Expense')}
                      </span>
                      {p.parent_name && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground">
                          ↳ {p.parent_name}
                        </span>
                      )}
                    </div>
                    {p.rationale && <p className="text-[11px] text-muted-foreground truncate">{p.rationale}</p>}
                  </div>
                  {onPrefill && (
                    <Button size="sm" variant="ghost" className="rounded-xl" onClick={(e) => { e.stopPropagation(); onPrefill(p); onOpenChange(false); }}>
                      {isFr ? 'Préremplir' : 'Prefill'}
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>

        <DialogFooter className="gap-2 flex-wrap">
          <Button variant="ghost" size="sm" className="rounded-xl gap-1.5" onClick={fetchProposals} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            {isFr ? 'Régénérer' : 'Regenerate'}
          </Button>
          <div className="flex-1" />
          <Button variant="outline" size="sm" className="rounded-xl" onClick={toggleAll} disabled={proposals.length === 0}>
            {selected.size === proposals.length && proposals.length > 0 ? (isFr ? 'Aucune' : 'None') : (isFr ? 'Tout' : 'All')}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
            {isFr ? 'Fermer' : 'Close'}
          </Button>
          <Button
            className="text-primary-foreground rounded-xl"
            style={{ background: 'var(--gradient-primary)' }}
            onClick={createSelected}
            disabled={busy || selected.size === 0}
          >
            {busy ? (isFr ? 'Création…' : 'Creating…') : (isFr ? `Créer (${selected.size})` : `Create (${selected.size})`)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};