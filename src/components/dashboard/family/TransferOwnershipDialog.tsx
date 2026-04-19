import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { MemberWithProfile } from '@/hooks/useFamilyData';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  groupId: string;
  members: MemberWithProfile[];
  onSuccess: () => void;
}

export const TransferOwnershipDialog = ({ open, onOpenChange, groupId, members, onSuccess }: Props) => {
  const [target, setTarget] = useState('');
  const [loading, setLoading] = useState(false);

  const handleTransfer = async () => {
    if (!target) return;
    setLoading(true);
    const { error } = await supabase.rpc('transfer_family_ownership', { p_group_id: groupId, p_new_owner_id: target });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Propriété transférée');
    onOpenChange(false);
    setTarget('');
    onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transférer la propriété</DialogTitle>
          <DialogDescription>
            Vous deviendrez membre standard. Cette action est irréversible.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Label>Nouveau propriétaire</Label>
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger><SelectValue placeholder="Choisir un membre" /></SelectTrigger>
            <SelectContent>
              {members.map((m) => (
                <SelectItem key={m.user_id} value={m.user_id}>{m.display_name || 'Membre'}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleTransfer} disabled={!target || loading}>Transférer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
