import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/i18n/LanguageContext';
import { useSubscription } from '@/hooks/useSubscription';
import { dashT } from '@/i18n/dashTranslations';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Users, Mail, Crown, UserMinus, Trash2, Share2, Inbox, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import ConfirmDeleteDialog from '@/components/dashboard/ConfirmDeleteDialog';
import UpgradeBanner from '@/components/dashboard/UpgradeBanner';

const FamilyPage = () => {
  const { user } = useAuth();
  const { locale } = useLanguage();
  const { canUseFamily } = useSubscription();
  const t = dashT[locale];

  const [groups, setGroups] = useState<any[]>([]);
  const [members, setMembers] = useState<Record<string, any[]>>({});
  const [invitations, setInvitations] = useState<any[]>([]);
  const [pendingForMe, setPendingForMe] = useState<any[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [sharedBudgets, setSharedBudgets] = useState<any[]>([]);
  const [memberTransactions, setMemberTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteGroupId, setInviteGroupId] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [shareOpen, setShareOpen] = useState(false);
  const [shareGroupId, setShareGroupId] = useState('');
  const [shareBudgetId, setShareBudgetId] = useState('');
  const [deleteGroupId, setDeleteGroupId] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!user) return;

    const [groupsRes, invRes, budRes] = await Promise.all([
      supabase.from('family_groups').select('*').order('created_at', { ascending: false }),
      supabase.from('family_invitations').select('*').eq('status', 'pending'),
      supabase.from('budgets').select('*').eq('user_id', user.id),
    ]);

    const grps = groupsRes.data || [];
    setGroups(grps);
    setBudgets(budRes.data || []);

    // Get members for each group
    const membersMap: Record<string, any[]> = {};
    for (const g of grps) {
      const { data: rawMembers } = await supabase
        .from('family_members')
        .select('*')
        .eq('group_id', g.id);
      
      // Fetch profiles separately since there's no direct FK
      const membersList = rawMembers || [];
      if (membersList.length > 0) {
        const userIds = membersList.map((m: any) => m.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, display_name, avatar_url')
          .in('user_id', userIds);
        
        const profileMap: Record<string, any> = {};
        (profiles || []).forEach((p: any) => { profileMap[p.user_id] = p; });
        membersMap[g.id] = membersList.map((m: any) => ({
          ...m,
          profiles: profileMap[m.user_id] || null,
        }));
      } else {
        membersMap[g.id] = [];
      }
    }
    setMembers(membersMap);

    // Invitations sent by me
    setInvitations((invRes.data || []).filter((i: any) => i.invited_by === user.id));

    // Pending invitations for me
    const { data: userProfile } = await supabase.from('profiles').select('*').eq('user_id', user.id).single();
    const userEmail = user.email;
    setPendingForMe((invRes.data || []).filter((i: any) => i.invited_email === userEmail));

    // Shared budgets
    const sharedRes = await supabase.from('shared_budgets').select('*, budgets(name, amount, period, category_id)');
    setSharedBudgets(sharedRes.data || []);

    // If a group is selected, get member transactions
    if (selectedGroup) {
      const memberIds = (membersMap[selectedGroup] || []).map((m: any) => m.user_id);
      if (memberIds.length > 0) {
        const { data: txs } = await supabase
          .from('transactions')
          .select('*, categories(name, icon)')
          .in('user_id', memberIds)
          .order('date', { ascending: false })
          .limit(50);
        
        // Fetch profiles for transaction users
        const txUserIds = [...new Set((txs || []).map((tx: any) => tx.user_id))];
        const { data: txProfiles } = await supabase.from('profiles').select('user_id, display_name').in('user_id', txUserIds);
        const profileMap: Record<string, any> = {};
        (txProfiles || []).forEach((p: any) => { profileMap[p.user_id] = p; });
        
        setMemberTransactions((txs || []).map((tx: any) => ({
          ...tx,
          profiles: profileMap[tx.user_id] || null,
        })));
      }
    }

    setLoading(false);
  }, [user, selectedGroup]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Listen for invitation changes
  useEffect(() => {
    const channel = supabase
      .channel('family-invitations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'family_invitations' }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  const handleCreateGroup = async () => {
    if (!user || !groupName.trim()) return;
    const { error } = await supabase.from('family_groups').insert({ name: groupName.trim(), owner_id: user.id });
    if (error) { toast.error(error.message); return; }
    setCreateOpen(false);
    setGroupName('');
    fetchData();
    toast.success(t.saved);
  };

  const handleInvite = async () => {
    if (!user || !inviteEmail.trim() || !inviteGroupId) return;
    const { error } = await supabase.from('family_invitations').insert({
      group_id: inviteGroupId, invited_email: inviteEmail.trim().toLowerCase(), invited_by: user.id,
    });
    if (error) { toast.error(error.message); return; }
    setInviteOpen(false);
    setInviteEmail('');
    fetchData();
    toast.success(t.invitationSent || 'Invitation envoyée !');
  };

  const handleAcceptInvite = async (inv: any) => {
    if (!user) return;
    // Add user as member
    const { error: memberErr } = await supabase.from('family_members').insert({ group_id: inv.group_id, user_id: user.id, role: 'member' });
    if (memberErr) { toast.error(memberErr.message); return; }
    // Update invitation status
    await supabase.from('family_invitations').update({ status: 'accepted' }).eq('id', inv.id);
    fetchData();
    toast.success(t.invitationAccepted || 'Invitation acceptée !');
  };

  const handleDeclineInvite = async (inv: any) => {
    await supabase.from('family_invitations').update({ status: 'declined' }).eq('id', inv.id);
    fetchData();
  };

  const handleShareBudget = async () => {
    if (!user || !shareGroupId || !shareBudgetId) return;
    const { error } = await supabase.from('shared_budgets').insert({
      budget_id: shareBudgetId, group_id: shareGroupId, shared_by: user.id,
    });
    if (error) { toast.error(error.message); return; }
    setShareOpen(false);
    fetchData();
    toast.success(t.saved);
  };

  const handleRemoveMember = async (memberId: string) => {
    await supabase.from('family_members').delete().eq('id', memberId);
    fetchData();
    toast.success(t.delete + ' ✓');
  };

  const handleDeleteGroup = async () => {
    if (!deleteGroupId) return;
    await supabase.from('family_groups').delete().eq('id', deleteGroupId);
    setDeleteGroupId(null);
    if (selectedGroup === deleteGroupId) setSelectedGroup(null);
    fetchData();
    toast.success(t.delete + ' ✓');
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between"><Skeleton className="h-8 w-48" /><Skeleton className="h-9 w-40" /></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-48 rounded-xl" /><Skeleton className="h-48 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!canUseFamily && (
        <UpgradeBanner message={t.upgradeFamily} />
      )}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-2xl font-bold font-display">{t.family}</h2>
        <Button size="sm" className="text-primary-foreground" style={{ background: 'var(--gradient-primary)' }} onClick={() => setCreateOpen(true)} disabled={!canUseFamily}>
          {!canUseFamily ? <Lock className="w-4 h-4 mr-1" /> : <Plus className="w-4 h-4 mr-1" />}{t.createGroup}
        </Button>
      </div>

      {/* Pending invitations for me */}
      {pendingForMe.length > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="w-4 h-4" /> {t.pendingInvitations}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingForMe.map(inv => (
              <div key={inv.id} className="flex items-center justify-between">
                <span className="text-sm">{t.invitedToGroup || "Vous êtes invité à rejoindre un groupe familial"}</span>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleAcceptInvite(inv)}>{t.accept || 'Accepter'}</Button>
                  <Button size="sm" variant="outline" onClick={() => handleDeclineInvite(inv)}>{t.decline || 'Refuser'}</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Groups */}
      {groups.length === 0 ? (
        <Card className="border-none shadow-[var(--shadow-card)]">
          <CardContent className="py-16 text-center">
            <Users className="w-16 h-16 text-muted-foreground/40 mx-auto mb-4" />
            <p className="text-lg font-medium text-muted-foreground mb-2">{t.noGroups}</p>
            <Button size="sm" className="text-primary-foreground mt-2" style={{ background: 'var(--gradient-primary)' }} onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-1" />{t.createGroup}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {groups.map(group => {
            const isOwner = group.owner_id === user?.id;
            const groupMembers = members[group.id] || [];
            const groupShared = sharedBudgets.filter(sb => sb.group_id === group.id);

            return (
              <Card key={group.id} className={`border-none shadow-[var(--shadow-card)] cursor-pointer transition-all ${selectedGroup === group.id ? 'ring-2 ring-primary' : ''}`}
                onClick={() => setSelectedGroup(selectedGroup === group.id ? null : group.id)}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Users className="w-4 h-4 text-primary" />
                      {group.name}
                      {isOwner && <Badge variant="secondary" className="text-xs"><Crown className="w-3 h-3 mr-1" />{t.owner || 'Propriétaire'}</Badge>}
                    </CardTitle>
                    {isOwner && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={e => { e.stopPropagation(); setDeleteGroupId(group.id); }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Members */}
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">{t.members} ({groupMembers.length})</p>
                    <div className="flex flex-wrap gap-2">
                      {groupMembers.map((m: any) => (
                        <div key={m.id} className="flex items-center gap-1.5 bg-muted rounded-full px-3 py-1 text-xs">
                          <span>{m.profiles?.display_name || 'User'}</span>
                          {m.role === 'owner' && <Crown className="w-3 h-3 text-accent" />}
                          {isOwner && m.user_id !== user?.id && (
                            <button onClick={e => { e.stopPropagation(); handleRemoveMember(m.id); }} className="ml-1 text-destructive hover:text-destructive/80">
                              <UserMinus className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Shared budgets count */}
                  {groupShared.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      <Share2 className="w-3 h-3 inline mr-1" />
                      {groupShared.length} {t.sharedBudgets}
                    </p>
                  )}

                  {/* Action buttons */}
                  {isOwner && (
                    <div className="flex gap-2 pt-2" onClick={e => e.stopPropagation()}>
                      <Button size="sm" variant="outline" onClick={() => { setInviteGroupId(group.id); setInviteOpen(true); }}>
                        <Mail className="w-3 h-3 mr-1" />{t.invite}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setShareGroupId(group.id); setShareOpen(true); }}>
                        <Share2 className="w-3 h-3 mr-1" />{t.shareBudget}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Member transactions for selected group */}
      {selectedGroup && memberTransactions.length > 0 && (
        <Card className="border-none shadow-[var(--shadow-card)]">
          <CardHeader>
            <CardTitle className="text-base">{t.memberExpenses}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {memberTransactions.map(tx => (
                <div key={tx.id} className="flex items-center justify-between px-6 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-lg">{tx.categories?.icon || '📁'}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{tx.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {tx.profiles?.display_name || 'User'} · {tx.categories?.name || '-'} · {new Date(tx.date).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US')}
                      </p>
                    </div>
                  </div>
                  <span className={`text-sm font-semibold ${tx.type === 'income' ? 'text-secondary' : 'text-destructive'}`}>
                    {tx.type === 'income' ? '+' : '-'}{Number(tx.amount).toLocaleString()} 
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create group dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t.createGroup}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t.groupName}</Label>
              <Input value={groupName} onChange={e => setGroupName(e.target.value)} placeholder={t.groupNamePlaceholder || 'Ma famille'} maxLength={100} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>{t.cancel}</Button>
            <Button className="text-primary-foreground" style={{ background: 'var(--gradient-primary)' }} onClick={handleCreateGroup}>{t.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t.inviteMember}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t.email || 'Email'}</Label>
              <Input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="membre@exemple.com" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>{t.cancel}</Button>
            <Button className="text-primary-foreground" style={{ background: 'var(--gradient-primary)' }} onClick={handleInvite}>{t.invite}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Share budget dialog */}
      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t.shareBudget}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t.budgets}</Label>
              <Select value={shareBudgetId} onValueChange={setShareBudgetId}>
                <SelectTrigger><SelectValue placeholder={t.selectBudget || 'Sélectionner un budget'} /></SelectTrigger>
                <SelectContent>
                  {budgets.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShareOpen(false)}>{t.cancel}</Button>
            <Button className="text-primary-foreground" style={{ background: 'var(--gradient-primary)' }} onClick={handleShareBudget}>{t.share || 'Partager'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={!!deleteGroupId}
        onOpenChange={() => setDeleteGroupId(null)}
        onConfirm={handleDeleteGroup}
        title={t.confirmDelete}
        description={t.confirmDeleteMessage}
        cancelLabel={t.cancel}
        confirmLabel={t.delete}
      />
    </div>
  );
};

export default FamilyPage;
