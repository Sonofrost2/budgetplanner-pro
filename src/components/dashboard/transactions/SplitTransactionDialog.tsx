import { useState } from 'react';
import { ResponsiveFormDialog } from '@/components/ui/responsive-form-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CategoryCombobox } from '@/components/dashboard/CategoryCombobox';
import { Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SplitLine { id: string; amount: string; category_id: string; description: string; }

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  parentTransaction: { id: string; amount: number; type: string; user_id: string; account_id: string | null; date: string };
  categories: any[];
  onSplitted: () => void;
  locale?: string;
}

export const SplitTransactionDialog = ({ open, onOpenChange, parentTransaction, categories, onSplitted, locale = 'fr' }: Props) => {
  const fr = locale === 'fr';
  const [lines, setLines] = useState<SplitLine[]>([
    { id: '1', amount: '', category_id: '', description: '' },
    { id: '2', amount: '', category_id: '', description: '' },
  ]);
  const [saving, setSaving] = useState(false);

  const total = lines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
  const remaining = parentTransaction.amount - total;
  const filteredCats = categories.filter(c => c.type === parentTransaction.type);

  const addLine = () => setLines(l => [...l, { id: Date.now().toString(), amount: '', category_id: '', description: '' }]);
  const removeLine = (id: string) => setLines(l => l.filter(x => x.id !== id));

  const handleSave = async () => {
    if (Math.abs(remaining) > 0.01) {
      toast.error(fr ? `Le total doit égaler ${parentTransaction.amount}` : `Total must equal ${parentTransaction.amount}`);
      return;
    }
    if (lines.some(l => !l.amount || !l.category_id || !l.description)) {
      toast.error(fr ? 'Remplissez toutes les lignes' : 'Fill all lines');
      return;
    }
    setSaving(true);
    try {
      const inserts = lines.map(l => ({
        user_id: parentTransaction.user_id,
        type: parentTransaction.type,
        amount: parseFloat(l.amount),
        description: l.description,
        category_id: l.category_id,
        account_id: parentTransaction.account_id,
        date: parentTransaction.date,
        parent_transaction_id: parentTransaction.id,
      }));
      const { error } = await supabase.from('transactions').insert(inserts as never);
      if (error) throw error;
      // Soft-delete parent (replaced by splits)
      await supabase.from('transactions').update({ deleted_at: new Date().toISOString() } as never).eq('id', parentTransaction.id);
      toast.success(fr ? 'Transaction fractionnée' : 'Transaction split');
      onOpenChange(false);
      onSplitted();
    } catch (e: any) {
      toast.error(e.message || 'Error');
    } finally { setSaving(false); }
  };

  return (
    <ResponsiveFormDialog
      open={open} onOpenChange={onOpenChange}
      title={fr ? 'Fractionner la transaction' : 'Split transaction'}
      description={fr ? `Total à répartir : ${parentTransaction.amount}` : `Total to split: ${parentTransaction.amount}`}
      footer={<>
        <Button variant="outline" onClick={() => onOpenChange(false)}>{fr ? 'Annuler' : 'Cancel'}</Button>
        <Button onClick={handleSave} disabled={saving || Math.abs(remaining) > 0.01}>
          {saving ? '...' : (fr ? 'Fractionner' : 'Split')}
        </Button>
      </>}
    >
      <div className="space-y-3">
        {lines.map((line, idx) => (
          <div key={line.id} className="p-3 rounded-xl border border-border space-y-2 bg-card/50">
            <div className="flex justify-between items-center">
              <Label className="text-xs">{fr ? `Ligne ${idx + 1}` : `Line ${idx + 1}`}</Label>
              {lines.length > 2 && (
                <Button size="sm" variant="ghost" onClick={() => removeLine(line.id)} className="h-7 w-7 p-0">
                  <Trash2 className="w-3 h-3 text-destructive" />
                </Button>
              )}
            </div>
            <Input placeholder={fr ? 'Description' : 'Description'} value={line.description}
              onChange={e => setLines(L => L.map(l => l.id === line.id ? { ...l, description: e.target.value } : l))} />
            <div className="grid grid-cols-2 gap-2">
              <Input type="number" placeholder={fr ? 'Montant' : 'Amount'} value={line.amount}
                onChange={e => setLines(L => L.map(l => l.id === line.id ? { ...l, amount: e.target.value } : l))} />
              <CategoryCombobox categories={filteredCats} value={line.category_id}
                onValueChange={v => setLines(L => L.map(l => l.id === line.id ? { ...l, category_id: v } : l))}
                placeholder={fr ? 'Catégorie' : 'Category'} />
            </div>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={addLine} className="w-full">
          <Plus className="w-3 h-3 mr-1" />{fr ? 'Ajouter une ligne' : 'Add line'}
        </Button>
        <div className={`p-3 rounded-xl text-sm font-semibold flex justify-between ${Math.abs(remaining) < 0.01 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
          <span>{fr ? 'Restant' : 'Remaining'}</span>
          <span className="tabular-nums">{remaining.toFixed(2)}</span>
        </div>
      </div>
    </ResponsiveFormDialog>
  );
};
