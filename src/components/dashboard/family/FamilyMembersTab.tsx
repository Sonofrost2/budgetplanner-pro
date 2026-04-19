import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Crown, Mail, UserMinus, ArrowRightLeft, LogOut, Trash2, Clock } from 'lucide-react';
import { MemberAvatar } from './MemberAvatar';
import { TransferOwnershipDialog } from './TransferOwnershipDialog';
import { LeaveGroupDialog } from './LeaveGroupDialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Tables } from '@/integrations/supabase/types';
import type { MemberWithProfile } from '@/hooks/useFamilyData';

interface Props {
  members: MemberWithProfile[];
  pendingInvitations: Tables<'family_invitations'>[];
  groupId: string;
  isOwner: boolean;
  currentUserId: string;
  onInvite: () => void;
  onChange: () => void;
}

export const FamilyMembersTab = ({ members, pendingInvitations, groupId, isOwner, currentUserId, onInvite, onChange }: Props) => {
  const [transferOpen, setTransferOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);

  const handleRemove = async (memberId: string, name: string) => {
    if (!confirm(`Retirer ${name} du groupe ?`)) return;
    const { error } = await supabase.from('family_members').delete().eq('id', memberId);
    if (error) { toast.error(error.message); return; }
    toast.success('Membre retiré');
    onChange();
  };

  const handleCancelInvite = async (id: string) => {
    const { error } = await supabase.from('family_invitations').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Invitation annulée');
    onChange();
  };

  return (
    <div className="space-y-4">
      <Card className="border-none shadow-[var(--shadow-card)]">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Membres ({members.length})</CardTitle>
          <div className="flex gap-2">
            {isOwner && (
              <Button size="sm" variant="outline" onClick={onInvite}>
                <Mail className="w-3.5 h-3.5 mr-1" />Inviter
              </Button>
            )}
            {!isOwner && (
              <Button size="sm" variant="outline" className="text-destructive" onClick={() => setLeaveOpen(true)}>
                <LogOut className="w-3.5 h-3.5 mr-1" />Quitter
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {members.map((m) => {
            const isMe = m.user_id === currentUserId;
            const isOwnerRole = m.role === 'owner';
            return (
              <div key={m.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/60 bg-card/50 hover:bg-card transition-colors">
                <MemberAvatar userId={m.user_id} displayName={m.display_name} size="md" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{m.display_name || 'Membre'} {isMe && <span className="text-muted-foreground">(vous)</span>}</span>
                    {isOwnerRole && (
                      <Badge variant="secondary" className="text-[10px] gap-1">
                        <Crown className="w-3 h-3" />Propriétaire
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">Rejoint le {new Date(m.joined_at).toLocaleDateString('fr-FR')}</p>
                </div>
                {isOwner && !isMe && !isOwnerRole && (
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8" title="Transférer la propriété" onClick={() => setTransferOpen(true)}>
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleRemove(m.id, m.display_name || 'ce membre')}>
                      <UserMinus className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {pendingInvitations.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600" />
              Invitations en attente ({pendingInvitations.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingInvitations.map((inv) => {
              const expired = new Date(inv.expires_at) < new Date();
              return (
                <div key={inv.id} className="flex items-center justify-between p-2.5 rounded-lg bg-background/60 border border-border/50">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{inv.invited_email}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {expired ? '⚠️ Expirée' : `Expire le ${new Date(inv.expires_at).toLocaleDateString('fr-FR')}`}
                    </p>
                  </div>
                  {isOwner && (
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleCancelInvite(inv.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <TransferOwnershipDialog
        open={transferOpen} onOpenChange={setTransferOpen}
        groupId={groupId}
        members={members.filter((m) => m.user_id !== currentUserId)}
        onSuccess={onChange}
      />
      <LeaveGroupDialog
        open={leaveOpen} onOpenChange={setLeaveOpen}
        groupId={groupId}
        onSuccess={onChange}
      />
    </div>
  );
};
