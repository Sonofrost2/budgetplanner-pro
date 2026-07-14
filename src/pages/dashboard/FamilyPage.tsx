import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/i18n/LanguageContext';
import { useSubscription } from '@/hooks/useSubscription';
import { useProfile } from '@/hooks/useProfile';
import { dashT } from '@/i18n/dashTranslations';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { LayoutDashboard, Users, Share2, Activity, Mail, Plus, Lock, CheckCheck, Settings2, ShieldCheck, X, FolderTree } from 'lucide-react';
import { toast } from 'sonner';

import { useFamilyData } from '@/hooks/useFamilyData';
import { FamilyHeroHeader } from '@/components/dashboard/family/FamilyHeroHeader';
import { FamilyGroupSelector } from '@/components/dashboard/family/FamilyGroupSelector';
import { FamilyOverviewTab } from '@/components/dashboard/family/FamilyOverviewTab';
import { FamilyMembersTab } from '@/components/dashboard/family/FamilyMembersTab';
import { FamilySharedBudgetsTab } from '@/components/dashboard/family/FamilySharedBudgetsTab';
import { FamilyActivityTab } from '@/components/dashboard/family/FamilyActivityTab';
import { FamilySettingsTab } from '@/components/dashboard/family/FamilySettingsTab';
import { FamilyCategoriesTab } from '@/components/dashboard/family/FamilyCategoriesTab';
import ConfirmDeleteDialog from '@/components/dashboard/ConfirmDeleteDialog';
import UpgradeBanner from '@/components/dashboard/UpgradeBanner';
import PlanLockedView from '@/components/dashboard/PlanLockedView';

const FamilyPage = () => {
  const { user } = useAuth();
  const { locale } = useLanguage();
  const isFr = locale === 'fr';
  const { canUseFamily } = useSubscription();
  const { currency } = useProfile();

  // Period: current month
  const period = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
    return { start, end };
  }, []);

  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const { groups, members, pendingForMe, sentInvitations, budgets, sharedBudgets, dashboard, activity, loading, refetch } =
    useFamilyData(selectedGroup, period.start, period.end);

  // Auto-select first group
  useEffect(() => {
    if (!selectedGroup && groups.length > 0) setSelectedGroup(groups[0].id);
  }, [groups, selectedGroup]);

  // Dialogs
  const [createOpen, setCreateOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [deleteGroupId, setDeleteGroupId] = useState<string | null>(null);
  const [privacyDismissed, setPrivacyDismissed] = useState<boolean>(
    () => typeof window !== 'undefined' && localStorage.getItem('family-privacy-banner-dismissed') === '1'
  );
  const dismissPrivacy = () => {
    localStorage.setItem('family-privacy-banner-dismissed', '1');
    setPrivacyDismissed(true);
  };

  const selectedGroupData = groups.find((g) => g.id === selectedGroup) || null;
  const isOwner = selectedGroupData?.owner_id === user?.id;
  const groupMembers = selectedGroup ? members[selectedGroup] || [] : [];
  const myMembership = groupMembers.find((m) => m.user_id === user?.id);
  const canEditSettings = !!isOwner || myMembership?.role === 'admin';
  const groupPendingInvitations = useMemo(
    () => sentInvitations.filter((i) => i.group_id === selectedGroup),
    [sentInvitations, selectedGroup],
  );

  // KPIs
  const totalMembers = useMemo(() => Object.values(members).reduce((s, arr) => s + arr.length, 0), [members]);
  const totalShared = sharedBudgets.length;
  const monthlyExpense = dashboard?.total_expense || 0;

  const handleCreateGroup = async () => {
    if (!user || !groupName.trim()) return;
    const { data, error } = await supabase.from('family_groups').insert({ name: groupName.trim(), owner_id: user.id }).select('id').single();
    if (error) { toast.error(error.message); return; }
    setCreateOpen(false);
    setGroupName('');
    if (data?.id) setSelectedGroup(data.id);
    refetch();
    toast.success(isFr ? 'Groupe créé 🎉' : 'Group created 🎉');
  };

  const handleInvite = async () => {
    if (!user || !inviteEmail.trim() || !selectedGroup) return;
    setInviting(true);
    const { error } = await supabase.functions.invoke('send-family-invitation', {
      body: { groupId: selectedGroup, email: inviteEmail.trim().toLowerCase() },
    });
    setInviting(false);
    if (error) { toast.error(error.message || (isFr ? "Erreur lors de l'envoi" : 'Sending failed')); return; }
    setInviteOpen(false);
    setInviteEmail('');
    refetch();
    toast.success(isFr ? 'Invitation envoyée par email 📧' : 'Invitation sent by email 📧');
  };

  const handleAcceptInvite = async (token: string) => {
    const { error } = await supabase.rpc('accept_family_invitation', { p_token: token });
    if (error) { toast.error(error.message); return; }
    toast.success(isFr ? 'Invitation acceptée !' : 'Invitation accepted!');
    refetch();
  };

  const handleDeclineInvite = async (id: string) => {
    await supabase.from('family_invitations').update({ status: 'declined' }).eq('id', id);
    refetch();
  };

  const handleDeleteGroup = async () => {
    if (!deleteGroupId) return;
    const { error } = await supabase.rpc('delete_family_group_cascade', { p_group_id: deleteGroupId });
    if (error) { toast.error(error.message); return; }
    if (selectedGroup === deleteGroupId) setSelectedGroup(null);
    setDeleteGroupId(null);
    refetch();
    toast.success(isFr ? 'Groupe supprimé' : 'Group deleted');
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48 rounded-3xl" />
        <Skeleton className="h-12 rounded-2xl" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  if (!canUseFamily) {
    return <PlanLockedView message={dashT[locale].upgradeFamily} />;
  }

  return (
    <div className="space-y-6">
      <FamilyHeroHeader
        groupCount={groups.length}
        memberCount={totalMembers}
        sharedBudgetsCount={totalShared}
        monthlyExpense={monthlyExpense}
        currency={currency}
        selectedGroupName={selectedGroupData?.name}
        onCreate={() => setCreateOpen(true)}
        canCreate={canUseFamily}
      />

      {/* Privacy by Design — Onboarding banner */}
      {!privacyDismissed && (
        <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-accent/5 to-transparent backdrop-blur">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold flex items-center gap-1.5">
                    🔒 Vie privée respectée — <span className="text-primary">Privacy by Design</span>
                  </h3>
                  <Button variant="ghost" size="icon" className="h-6 w-6 -mr-1 -mt-1" onClick={dismissPrivacy}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Vos transactions personnelles restent <strong className="text-foreground">privées</strong> par défaut.
                  Seules celles que vous taguez avec une <strong className="text-foreground">Catégorie Famille</strong> sont visibles
                  par les autres membres du groupe. Idem pour les budgets : seuls ceux rattachés à la racine
                  <span className="inline-flex items-center gap-1 mx-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-semibold">👨‍👩‍👧 Famille</span>
                  peuvent être partagés.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pending invitations FOR me */}
      {pendingForMe.length > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-4 space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <Mail className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold">Vous avez {pendingForMe.length} invitation{pendingForMe.length > 1 ? 's' : ''}</span>
            </div>
            {pendingForMe.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between gap-3 p-2 rounded-lg bg-background/60">
                <span className="text-sm">Invitation à rejoindre un groupe familial</span>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleAcceptInvite(inv.token)}>
                    <CheckCheck className="w-3.5 h-3.5 mr-1" />Accepter
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleDeclineInvite(inv.id)}>Refuser</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {groups.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <Users className="w-16 h-16 text-muted-foreground/40 mx-auto mb-4" />
            <p className="text-lg font-medium text-muted-foreground mb-4">Aucun groupe familial</p>
            <Button onClick={() => setCreateOpen(true)} disabled={!canUseFamily} className="text-primary-foreground" style={{ background: 'var(--gradient-primary)' }}>
              {!canUseFamily ? <Lock className="w-4 h-4 mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
              Créer un groupe
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <FamilyGroupSelector
            groups={groups}
            selectedId={selectedGroup}
            onSelect={setSelectedGroup}
            currentUserId={user?.id || ''}
            onDeleteRequest={setDeleteGroupId}
          />

          {selectedGroup && selectedGroupData && (
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid grid-cols-6 w-full max-w-3xl">
                <TabsTrigger value="overview"><LayoutDashboard className="w-3.5 h-3.5 mr-1.5" />Vue</TabsTrigger>
                <TabsTrigger value="members"><Users className="w-3.5 h-3.5 mr-1.5" />Membres</TabsTrigger>
                <TabsTrigger value="categories"><FolderTree className="w-3.5 h-3.5 mr-1.5" />Catégories</TabsTrigger>
                <TabsTrigger value="budgets"><Share2 className="w-3.5 h-3.5 mr-1.5" />Budgets</TabsTrigger>
                <TabsTrigger value="activity"><Activity className="w-3.5 h-3.5 mr-1.5" />Activité</TabsTrigger>
                <TabsTrigger value="settings"><Settings2 className="w-3.5 h-3.5 mr-1.5" />Réglages</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-4">
                <FamilyOverviewTab dashboard={dashboard} currency={selectedGroupData.currency || currency} />
              </TabsContent>

              <TabsContent value="members" className="mt-4">
                <FamilyMembersTab
                  members={groupMembers}
                  pendingInvitations={groupPendingInvitations}
                  groupId={selectedGroup}
                  isOwner={!!isOwner}
                  currentUserId={user?.id || ''}
                  onInvite={() => setInviteOpen(true)}
                  onChange={refetch}
                />
              </TabsContent>

              <TabsContent value="categories" className="mt-4">
                <FamilyCategoriesTab groupId={selectedGroup} isOwner={!!isOwner} />
              </TabsContent>

              <TabsContent value="budgets" className="mt-4">
                <FamilySharedBudgetsTab
                  dashboard={dashboard}
                  groupId={selectedGroup}
                  isOwner={!!isOwner}
                  myBudgets={budgets}
                  sharedBudgets={sharedBudgets}
                  currency={selectedGroupData.currency || currency}
                  currentUserId={user?.id || ''}
                  onChange={refetch}
                />
              </TabsContent>

              <TabsContent value="activity" className="mt-4">
                <FamilyActivityTab activity={activity} members={groupMembers} currency={selectedGroupData.currency || currency} />
              </TabsContent>

              <TabsContent value="settings" className="mt-4">
                <FamilySettingsTab
                  group={{
                    id: selectedGroupData.id,
                    name: selectedGroupData.name,
                    currency: selectedGroupData.currency || 'XOF',
                    large_tx_threshold: Number(selectedGroupData.large_tx_threshold ?? 100000),
                  }}
                  canEdit={canEditSettings}
                  onChange={refetch}
                />
              </TabsContent>
            </Tabs>
          )}
        </>
      )}

      {/* Create group dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Créer un groupe familial</DialogTitle>
            <DialogDescription>Vous serez automatiquement le propriétaire et pourrez inviter des membres.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Nom du groupe</Label>
            <Input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Ma famille" maxLength={100} autoFocus />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button onClick={handleCreateGroup} disabled={!groupName.trim()} className="text-primary-foreground" style={{ background: 'var(--gradient-primary)' }}>Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Inviter un membre</DialogTitle>
            <DialogDescription>Un email avec un lien d'invitation sera envoyé. L'invitation expire dans 7 jours.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="exemple@email.com" autoFocus />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)} disabled={inviting}>Annuler</Button>
            <Button onClick={handleInvite} disabled={!inviteEmail.trim() || inviting} className="text-primary-foreground" style={{ background: 'var(--gradient-primary)' }}>
              {inviting ? (locale === 'fr' ? 'Envoi…' : 'Sending…') : (locale === 'fr' ? "Envoyer l'invitation" : 'Send invitation')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={!!deleteGroupId}
        onOpenChange={(o) => !o && setDeleteGroupId(null)}
        onConfirm={handleDeleteGroup}
        title={locale === 'fr' ? 'Supprimer ce groupe ?' : 'Delete this group?'}
        description={locale === 'fr'
          ? 'Cette action supprime définitivement le groupe, ses invitations et budgets partagés. Les transactions des membres ne sont pas affectées.'
          : 'This permanently deletes the group, its invitations, and shared budgets. Members\' transactions are not affected.'}
      />
    </div>
  );
};

export default FamilyPage;
