import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Share2, Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Tables } from '@/integrations/supabase/types';
import type { FamilyDashboard } from '@/hooks/useFamilyData';

interface Props {
  dashboard: FamilyDashboard | null;
  groupId: string;
  isOwner: boolean;
  myBudgets: Tables<'budgets'>[];
  sharedBudgets: (Tables<'shared_budgets'> & { budgets?: { name: string; amount: number; period: string } })[];
  currency: string;
  currentUserId: string;
  onChange: () => void;
}

const fmt = (n: number, c: string) => `${Math.round(n).toLocaleString('fr-FR')} ${c}`;

export const FamilySharedBudgetsTab = ({ dashboard, groupId, isOwner, myBudgets, sharedBudgets, currency, currentUserId, onChange }: Props) => {
  const [shareOpen, setShareOpen] = useState(false);
  const [budgetId, setBudgetId] = useState('');

  const groupShared = sharedBudgets.filter((sb) => sb.group_id === groupId);
  const sharedIds = new Set(groupShared.map((sb) => sb.budget_id));
  const availableBudgets = myBudgets.filter((b) => !sharedIds.has(b.id));

  const handleShare = async () => {
    if (!budgetId) return;
    const { error } = await supabase.from('shared_budgets').insert({ budget_id: budgetId, group_id: groupId, shared_by: currentUserId });
    if (error) { toast.error(error.message); return; }
    toast.success('Budget partagé');
    setShareOpen(false); setBudgetId('');
    onChange();
  };

  const handleUnshare = async (id: string) => {
    if (!confirm('Retirer ce budget partagé ?')) return;
    const { error } = await supabase.from('shared_budgets').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Budget retiré');
    onChange();
  };

  return (
    <Card className="border-none shadow-[var(--shadow-card)]">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm flex items-center gap-2">
          <Share2 className="w-4 h-4 text-primary" />Budgets partagés ({groupShared.length})
        </CardTitle>
        {isOwner && availableBudgets.length > 0 && (
          <Button size="sm" variant="outline" onClick={() => setShareOpen(true)}>
            <Plus className="w-3.5 h-3.5 mr-1" />Partager
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {groupShared.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Aucun budget partagé. {isOwner && availableBudgets.length > 0 && 'Cliquez sur "Partager" pour mettre un budget en commun.'}
          </p>
        ) : (
          <div className="space-y-3">
            {groupShared.map((sb) => {
              const dashEntry = dashboard?.shared_budgets.find((b) => b.budget_id === sb.budget_id);
              const name = sb.budgets?.name || dashEntry?.name || 'Budget';
              const amount = sb.budgets?.amount || dashEntry?.amount || 0;
              const spent = dashEntry?.spent || 0;
              const pct = dashEntry?.pct || 0;
              const over = pct > 100;
              return (
                <div key={sb.id} className="p-3 rounded-lg border border-border/60 bg-card/40">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-medium text-sm">{name}</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm tabular-nums font-semibold ${over ? 'text-destructive' : 'text-foreground'}`}>
                        {fmt(spent, currency)} / {fmt(amount, currency)}
                      </span>
                      {isOwner && (
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleUnshare(sb.id)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <Progress value={Math.min(100, pct)} className="h-2" />
                  <p className={`text-[11px] mt-1 ${over ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                    {pct.toFixed(0)}% {over && '· Dépassé'}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Partager un budget</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label>Budget</Label>
            <Select value={budgetId} onValueChange={setBudgetId}>
              <SelectTrigger><SelectValue placeholder="Choisir un budget" /></SelectTrigger>
              <SelectContent>
                {availableBudgets.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name} · {fmt(b.amount, currency)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShareOpen(false)}>Annuler</Button>
            <Button onClick={handleShare} disabled={!budgetId}>Partager</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
