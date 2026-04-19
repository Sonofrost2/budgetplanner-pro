import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CATEGORY_TEMPLATE_PACKS } from '@/lib/categoryAnalytics';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Check, FlaskConical } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  isFr: boolean;
  onApplied: () => void;
}

export const CategoryTemplatesDialog = ({ open, onOpenChange, isFr, onApplied }: Props) => {
  const { user } = useAuth();
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const apply = async () => {
    if (!user || !selected) return;
    const pack = CATEGORY_TEMPLATE_PACKS.find(p => p.id === selected);
    if (!pack) return;
    setBusy(true);
    const inserts = pack.items.map(it => ({
      user_id: user.id,
      name: it.name[isFr ? 'fr' : 'en'],
      icon: it.icon,
      color: it.color,
      type: it.type,
    }));
    const { error } = await supabase.from('categories').insert(inserts);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(isFr ? `${pack.items.length} catégories ajoutées ✓` : `${pack.items.length} categories added ✓`);
    onOpenChange(false);
    setSelected(null);
    onApplied();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FlaskConical className="w-5 h-5 text-primary" />{isFr ? 'Templates de catégories' : 'Category templates'}</DialogTitle>
          <DialogDescription>{isFr ? 'Choisis un pack pré-configuré pour démarrer rapidement' : 'Pick a pre-configured pack to start quickly'}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[55vh] overflow-y-auto pr-1">
          {CATEGORY_TEMPLATE_PACKS.map(pack => (
            <Card
              key={pack.id}
              onClick={() => setSelected(pack.id)}
              className={`cursor-pointer transition-all rounded-2xl ${selected === pack.id ? 'ring-2 ring-primary shadow-[var(--shadow-glass)]' : 'hover:shadow-md'}`}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{pack.icon}</span>
                    <h4 className="font-semibold text-sm">{pack.name[isFr ? 'fr' : 'en']}</h4>
                  </div>
                  {selected === pack.id && <Check className="w-4 h-4 text-primary" />}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {pack.items.map((it, i) => (
                    <span key={i} className="text-[10px] px-2 py-1 rounded-full bg-muted/60" title={it.name[isFr ? 'fr' : 'en']}>
                      {it.icon} {it.name[isFr ? 'fr' : 'en']}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">{isFr ? 'Annuler' : 'Cancel'}</Button>
          <Button onClick={apply} disabled={!selected || busy} className="text-primary-foreground rounded-xl" style={{ background: 'var(--gradient-primary)' }}>
            {busy ? (isFr ? 'Ajout...' : 'Adding...') : (isFr ? 'Appliquer' : 'Apply')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
