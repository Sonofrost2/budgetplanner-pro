import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, FolderTree, Sparkles, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import ConfirmDeleteDialog from '@/components/dashboard/ConfirmDeleteDialog';
import type { Tables } from '@/integrations/supabase/types';

const ICON_PALETTE = ['👨‍👩‍👧', '🛒', '🏠', '👶', '💊', '🎉', '🚗', '🎒', '🍽️', '📚', '🐾', '🎁', '✈️', '⚡', '📁'];
const COLOR_PALETTE = ['#8B5CF6', '#22C55E', '#F59E0B', '#EF4444', '#3B82F6', '#EC4899', '#10B981', '#6366F1', '#F97316', '#14B8A6'];

interface Props {
  groupId: string;
  isOwner: boolean;
}

type FamilyCat = Tables<'family_categories'>;

export const FamilyCategoriesTab = ({ groupId, isOwner }: Props) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FamilyCat | null>(null);
  const [form, setForm] = useState({ name: '', icon: '👨‍👩‍👧', color: '#8B5CF6' });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['family-categories-tab', groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('family_categories')
        .select('*')
        .eq('group_id', groupId)
        .order('name', { ascending: true });
      if (error) throw error;
      return (data ?? []) as FamilyCat[];
    },
    enabled: !!groupId,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['family-categories-tab', groupId] });
    queryClient.invalidateQueries({ queryKey: ['family-categories'] });
    queryClient.invalidateQueries({ queryKey: ['family-data'] });
  };

  const openNew = () => {
    setEditing(null);
    setForm({ name: '', icon: '👨‍👩‍👧', color: '#8B5CF6' });
    setDialogOpen(true);
  };

  const openEdit = (cat: FamilyCat) => {
    setEditing(cat);
    setForm({ name: cat.name, icon: cat.icon, color: cat.color });
    setDialogOpen(true);
  };

  const canModify = (cat: FamilyCat) => isOwner || cat.created_by === user?.id;

  const handleSave = async () => {
    if (!user || !form.name.trim()) { toast.error('Nom requis'); return; }
    setSaving(true);
    if (editing) {
      const { error } = await supabase
        .from('family_categories')
        .update({ name: form.name.trim(), icon: form.icon, color: form.color })
        .eq('id', editing.id);
      setSaving(false);
      if (error) { toast.error(error.message); return; }
      toast.success('Catégorie mise à jour ✨');
    } else {
      const { error } = await supabase
        .from('family_categories')
        .insert({ group_id: groupId, name: form.name.trim(), icon: form.icon, color: form.color, created_by: user.id });
      setSaving(false);
      if (error) { toast.error(error.message); return; }
      toast.success('Catégorie famille créée 🎉');
    }
    setDialogOpen(false);
    invalidate();
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    const { error } = await supabase.from('family_categories').delete().eq('id', deletingId);
    if (error) { toast.error(error.message); return; }
    setDeletingId(null);
    toast.success('Catégorie supprimée');
    invalidate();
  };

  const sortedCats = useMemo(() => [...categories].sort((a, b) => a.name.localeCompare(b.name)), [categories]);

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="py-4 flex items-center justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
              <FolderTree className="w-5 h-5 text-primary" />
            </div>
            <div className="space-y-1 min-w-0">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                Catégories partagées
                <Badge variant="outline" className="border-primary/40 text-primary text-[10px] gap-1 h-5">
                  <ShieldCheck className="w-2.5 h-2.5" />Synchronisées
                </Badge>
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Ces catégories sont visibles par tous les membres. Quand un membre tague une transaction avec l'une d'elles, elle devient partagée dans le groupe.
              </p>
            </div>
          </div>
          <Button onClick={openNew} size="sm" className="text-primary-foreground shrink-0" style={{ background: 'var(--gradient-primary)' }}>
            <Plus className="w-4 h-4 mr-1" />Nouvelle
          </Button>
        </CardContent>
      </Card>

      {/* Categories grid */}
      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-xl bg-muted/30 animate-pulse" />)}
        </div>
      ) : sortedCats.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Sparkles className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-4">Aucune catégorie famille — crée la première pour commencer à partager !</p>
            <Button onClick={openNew} size="sm" variant="outline">
              <Plus className="w-4 h-4 mr-1" />Créer une catégorie
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {sortedCats.map(cat => {
            const editable = canModify(cat);
            return (
              <Card key={cat.id} className="group hover:border-primary/40 transition-all">
                <CardContent className="p-3 flex items-center gap-3">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 ring-1 ring-border/40"
                    style={{ background: `${cat.color}15`, color: cat.color }}
                  >
                    {cat.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{cat.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {cat.created_by === user?.id ? 'Créée par vous' : 'Créée par un membre'}
                    </p>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => openEdit(cat)}
                      disabled={!editable}
                      title={editable ? 'Modifier' : 'Seul le créateur ou le propriétaire peut modifier'}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setDeletingId(cat.id)}
                      disabled={!editable}
                      title={editable ? 'Supprimer' : 'Seul le créateur ou le propriétaire peut supprimer'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Modifier la catégorie' : 'Nouvelle catégorie famille'}</DialogTitle>
            <DialogDescription>
              {editing ? 'Modifiez le nom, l\'icône ou la couleur. Les transactions déjà taguées restent liées.' : 'Cette catégorie sera visible par tous les membres du groupe.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nom</Label>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Ex: Courses ménage"
                maxLength={50}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Icône</Label>
              <div className="flex flex-wrap gap-1.5">
                {ICON_PALETTE.map(icon => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, icon }))}
                    className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg transition-all ${
                      form.icon === icon ? 'bg-primary/15 ring-2 ring-primary' : 'bg-muted/40 hover:bg-muted'
                    }`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Couleur</Label>
              <div className="flex flex-wrap gap-2">
                {COLOR_PALETTE.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, color }))}
                    className={`w-8 h-8 rounded-full transition-all ${form.color === color ? 'ring-2 ring-offset-2 ring-offset-background ring-foreground scale-110' : 'hover:scale-105'}`}
                    style={{ background: color }}
                  />
                ))}
              </div>
            </div>
            {/* Preview */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/40">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center text-xl ring-1 ring-border/40"
                style={{ background: `${form.color}15`, color: form.color }}
              >
                {form.icon}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Aperçu</p>
                <p className="text-sm font-semibold">{form.name || 'Nom de la catégorie'}</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Annuler</Button>
            <Button
              onClick={handleSave}
              disabled={!form.name.trim() || saving}
              className="text-primary-foreground"
              style={{ background: 'var(--gradient-primary)' }}
            >
              {saving ? 'Enregistrement…' : editing ? 'Enregistrer' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={!!deletingId}
        onOpenChange={(o) => !o && setDeletingId(null)}
        onConfirm={handleDelete}
        title="Supprimer cette catégorie ?"
        description="Les transactions déjà taguées avec cette catégorie ne seront plus visibles dans le groupe famille (mais resteront dans les comptes personnels des membres)."
      />
    </div>
  );
};
