import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props { open: boolean; onOpenChange: (o: boolean) => void; groupId: string; onSuccess: () => void; }

export const LeaveGroupDialog = ({ open, onOpenChange, groupId, onSuccess }: Props) => {
  const [loading, setLoading] = useState(false);

  const handleLeave = async () => {
    setLoading(true);
    const { error } = await supabase.rpc('leave_family_group', { p_group_id: groupId });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Vous avez quitté le groupe');
    onOpenChange(false);
    onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Quitter le groupe ?</DialogTitle>
          <DialogDescription>
            Vous perdrez l'accès aux budgets partagés et aux transactions du foyer.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button variant="destructive" onClick={handleLeave} disabled={loading}>Quitter</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
