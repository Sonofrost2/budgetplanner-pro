import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { MemberWithProfile } from '@/hooks/useFamilyData';
import { useLanguage } from '@/i18n/LanguageContext';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  groupId: string;
  members: MemberWithProfile[];
  onSuccess: () => void;
}

export const TransferOwnershipDialog = ({ open, onOpenChange, groupId, members, onSuccess }: Props) => {
  const { locale } = useLanguage();
  const fr = locale === 'fr';
  const [target, setTarget] = useState('');
  const [loading, setLoading] = useState(false);

  const handleTransfer = async () => {
    if (!target) return;
    setLoading(true);
    const { error } = await supabase.rpc('transfer_family_ownership', { p_group_id: groupId, p_new_owner_id: target });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success(fr ? 'Propriété transférée' : 'Ownership transferred');
    onOpenChange(false);
    setTarget('');
    onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{fr ? 'Transférer la propriété' : 'Transfer ownership'}</DialogTitle>
          <DialogDescription>
            {fr
              ? 'Vous deviendrez membre standard. Cette action est irréversible.'
              : 'You will become a regular member. This action is irreversible.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Label>{fr ? 'Nouveau propriétaire' : 'New owner'}</Label>
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger><SelectValue placeholder={fr ? 'Choisir un membre' : 'Choose a member'} /></SelectTrigger>
            <SelectContent>
              {members.map((m) => (
                <SelectItem key={m.user_id} value={m.user_id}>{m.display_name || (fr ? 'Membre' : 'Member')}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{fr ? 'Annuler' : 'Cancel'}</Button>
          <Button onClick={handleTransfer} disabled={!target || loading}>{fr ? 'Transférer' : 'Transfer'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
