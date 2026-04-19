// Superadmin console: list users, filter by plan/search, ban/unban, force plan,
// reset password, impersonate via magic link, hard-delete, view audit log.
// All actions go through the `admin-user-action` edge function which re-verifies
// the admin role server-side and writes audit entries.

import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRole } from '@/hooks/useRole';
import { useLanguage } from '@/i18n/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Loader2, Search, MoreVertical, Shield, Ban, KeyRound, UserCog, Trash2, Eye, EyeOff, Crown,
  AlertTriangle, Activity, Users, ShieldAlert,
} from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { UserSnapshotDrawer } from '@/components/dashboard/admin/UserSnapshotDrawer';

type AdminUser = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  effective_plan: string | null;
  subscription_status: string | null;
  plan_expires_at: string | null;
  signup_at: string | null;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  banned_until: string | null;
  is_admin: boolean | null;
  account_count: number | null;
  tx_count: number | null;
  currency: string | null;
};

const AdminUsersPage = () => {
  const { isAdmin, loading: roleLoading } = useRole();
  const { locale } = useLanguage();
  const navigate = useNavigate();
  const isFr = locale === 'fr';

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Dialogs
  const [planDialog, setPlanDialog] = useState<{ user: AdminUser; plan: string; days: number } | null>(null);
  const [banDialog, setBanDialog] = useState<{ user: AdminUser; days: number; reason: string } | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ user: AdminUser; reason: string; confirm: string } | null>(null);
  const [auditDialog, setAuditDialog] = useState<{ user: AdminUser; logs: any[] } | null>(null);
  const [impersonateDialog, setImpersonateDialog] = useState<{ user: AdminUser; link: string } | null>(null);
  const [snapshotUserId, setSnapshotUserId] = useState<string | null>(null);

  const callAdmin = useCallback(async (action: string, payload: Record<string, any> = {}) => {
    const { data, error } = await supabase.functions.invoke('admin-user-action', {
      body: { action, ...payload },
    });
    if (error) throw new Error(error.message || 'admin call failed');
    if (data?.error) throw new Error(data.error);
    return data;
  }, []);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const { users: list } = await callAdmin('list_users', {
        search: search || null,
        plan: planFilter === 'all' ? null : planFilter,
        limit: 200,
      });
      setUsers(list || []);
    } catch (e: any) {
      toast.error(isFr ? 'Erreur de chargement' : 'Load error', { description: e.message });
    } finally {
      setLoading(false);
    }
  }, [isAdmin, search, planFilter, callAdmin, isFr]);

  useEffect(() => { load(); }, [load]);

  const onSetPlan = async () => {
    if (!planDialog) return;
    setActionLoading('plan');
    try {
      await callAdmin('set_plan', {
        user_id: planDialog.user.user_id,
        plan: planDialog.plan,
        duration_days: planDialog.days,
      });
      toast.success(isFr ? 'Plan mis à jour' : 'Plan updated');
      setPlanDialog(null);
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally { setActionLoading(null); }
  };

  const onBan = async () => {
    if (!banDialog) return;
    setActionLoading('ban');
    try {
      await callAdmin('ban', {
        user_id: banDialog.user.user_id,
        days: banDialog.days,
        reason: banDialog.reason,
      });
      toast.success(isFr ? `Utilisateur banni ${banDialog.days}j` : `Banned ${banDialog.days}d`);
      setBanDialog(null);
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally { setActionLoading(null); }
  };

  const onUnban = async (u: AdminUser) => {
    setActionLoading(u.user_id);
    try {
      await callAdmin('unban', { user_id: u.user_id });
      toast.success(isFr ? 'Bannissement levé' : 'Unbanned');
      await load();
    } catch (e: any) { toast.error(e.message); }
    finally { setActionLoading(null); }
  };

  const onResetPwd = async (u: AdminUser) => {
    setActionLoading(u.user_id);
    try {
      await callAdmin('reset_password', { user_id: u.user_id });
      toast.success(isFr ? 'Email envoyé' : 'Email sent');
    } catch (e: any) { toast.error(e.message); }
    finally { setActionLoading(null); }
  };

  const onImpersonate = async (u: AdminUser) => {
    setActionLoading(u.user_id);
    try {
      const res = await callAdmin('impersonate', { user_id: u.user_id, reason: 'Admin support session' });
      setImpersonateDialog({ user: u, link: res.action_link });
    } catch (e: any) { toast.error(e.message); }
    finally { setActionLoading(null); }
  };

  const onDelete = async () => {
    if (!deleteDialog) return;
    if (deleteDialog.confirm !== 'SUPPRIMER') {
      toast.error(isFr ? 'Tapez SUPPRIMER pour confirmer' : 'Type SUPPRIMER to confirm');
      return;
    }
    setActionLoading('delete');
    try {
      await callAdmin('delete_user', {
        user_id: deleteDialog.user.user_id,
        reason: deleteDialog.reason,
      });
      toast.success(isFr ? 'Compte supprimé définitivement' : 'Account permanently deleted');
      setDeleteDialog(null);
      await load();
    } catch (e: any) { toast.error(e.message); }
    finally { setActionLoading(null); }
  };

  const onShowAudit = async (u: AdminUser) => {
    setActionLoading(u.user_id);
    try {
      const res = await callAdmin('get_audit_logs', { user_id: u.user_id });
      setAuditDialog({ user: u, logs: res.logs || [] });
    } catch (e: any) { toast.error(e.message); }
    finally { setActionLoading(null); }
  };

  if (roleLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }
  if (!isAdmin) {
    return (
      <Card className="max-w-md mx-auto mt-12">
        <CardContent className="p-8 text-center">
          <ShieldAlert className="w-10 h-10 mx-auto mb-3 text-destructive" />
          <h2 className="text-lg font-semibold">{isFr ? 'Accès refusé' : 'Access denied'}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {isFr ? 'Cette page est réservée aux administrateurs.' : 'This page is admin-only.'}
          </p>
        </CardContent>
      </Card>
    );
  }

  const planBadge = (plan: string | null) => {
    if (!plan || plan === 'free') return 'bg-muted/60 text-muted-foreground border-border';
    if (plan === 'pro') return 'bg-primary/15 text-primary border-primary/20';
    return 'bg-accent/15 text-accent border-accent/20';
  };

  return (
    <div className="space-y-5">
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/[0.06] to-transparent">
          <CardContent className="p-5 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: 'var(--gradient-primary)' }}>
                <Shield className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-lg font-bold font-display">
                  {isFr ? 'Console superadmin' : 'Superadmin console'}
                </h1>
                <p className="text-xs text-muted-foreground">
                  {isFr ? 'Gérer les comptes, plans et sécurité.' : 'Manage accounts, plans and security.'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="font-semibold tabular-nums">{users.length}</span>
                <span className="text-muted-foreground">{isFr ? 'utilisateurs' : 'users'}</span>
              </div>
              <Button size="sm" variant="outline" onClick={() => navigate('/dashboard/admin/security')}>
                <ShieldAlert className="w-3.5 h-3.5 mr-1" />
                {isFr ? 'Sécurité' : 'Security'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isFr ? 'Rechercher email ou nom…' : 'Search email or name…'}
            className="pl-8 h-9 text-sm"
          />
        </div>
        <Select value={planFilter} onValueChange={setPlanFilter}>
          <SelectTrigger className="w-36 h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{isFr ? 'Tous plans' : 'All plans'}</SelectItem>
            <SelectItem value="free">Free</SelectItem>
            <SelectItem value="pro">Pro</SelectItem>
            <SelectItem value="premium">Premium</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : (isFr ? 'Rafraîchir' : 'Refresh')}
        </Button>
      </div>

      {/* Users table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{isFr ? 'Utilisateur' : 'User'}</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead className="hidden md:table-cell">{isFr ? 'Inscription' : 'Signup'}</TableHead>
                <TableHead className="hidden lg:table-cell">{isFr ? 'Dernière connexion' : 'Last sign-in'}</TableHead>
                <TableHead className="hidden xl:table-cell text-right">Tx</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && users.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                </TableCell></TableRow>
              ) : users.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground text-sm">
                  {isFr ? 'Aucun utilisateur.' : 'No users.'}
                </TableCell></TableRow>
              ) : users.map((u) => {
                const initials = (u.display_name || u.email || '?').slice(0, 2).toUpperCase();
                const banned = u.banned_until && new Date(u.banned_until) > new Date();
                return (
                  <TableRow key={u.user_id} className={banned ? 'bg-destructive/5' : ''}>
                    <TableCell>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar className="w-8 h-8 shrink-0">
                          <AvatarImage src={u.avatar_url || undefined} />
                          <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate flex items-center gap-1.5">
                            {u.display_name || (isFr ? 'Sans nom' : 'No name')}
                            {u.is_admin && <Crown className="w-3 h-3 text-accent" />}
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate">{u.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={planBadge(u.effective_plan)}>
                        {u.effective_plan || 'free'}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                      {u.signup_at ? format(new Date(u.signup_at), 'dd MMM yyyy', { locale: isFr ? fr : enUS }) : '—'}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                      {u.last_sign_in_at ? format(new Date(u.last_sign_in_at), 'dd/MM HH:mm', { locale: isFr ? fr : enUS }) : '—'}
                    </TableCell>
                    <TableCell className="hidden xl:table-cell text-right tabular-nums text-xs">
                      {u.tx_count ?? 0}
                    </TableCell>
                    <TableCell>
                      {banned ? (
                        <Badge variant="outline" className="bg-destructive/15 text-destructive border-destructive/20 gap-1">
                          <Ban className="w-2.5 h-2.5" /> {isFr ? 'Banni' : 'Banned'}
                        </Badge>
                      ) : !u.email_confirmed_at ? (
                        <Badge variant="outline" className="bg-amber-500/15 text-amber-600 border-amber-500/20">
                          {isFr ? 'Non confirmé' : 'Unconfirmed'}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-emerald-500/15 text-emerald-600 border-emerald-500/20">
                          {isFr ? 'Actif' : 'Active'}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7" disabled={actionLoading === u.user_id}>
                            {actionLoading === u.user_id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MoreVertical className="w-3.5 h-3.5" />}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuLabel>{u.email}</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setPlanDialog({ user: u, plan: u.effective_plan || 'pro', days: 30 })}>
                            <Crown className="w-3.5 h-3.5 mr-2" />{isFr ? 'Forcer un plan' : 'Force plan'}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onShowAudit(u)}>
                            <Activity className="w-3.5 h-3.5 mr-2" />{isFr ? "Journal d'audit" : 'Audit log'}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onResetPwd(u)}>
                            <KeyRound className="w-3.5 h-3.5 mr-2" />{isFr ? 'Réinit. mot de passe' : 'Reset password'}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onImpersonate(u)}>
                            <UserCog className="w-3.5 h-3.5 mr-2" />{isFr ? 'Se connecter en tant que' : 'Impersonate'}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {banned ? (
                            <DropdownMenuItem onClick={() => onUnban(u)}>
                              <Ban className="w-3.5 h-3.5 mr-2" />{isFr ? 'Lever le ban' : 'Unban'}
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => setBanDialog({ user: u, days: 30, reason: '' })}>
                              <Ban className="w-3.5 h-3.5 mr-2" />{isFr ? 'Bannir' : 'Ban'}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => setDeleteDialog({ user: u, reason: '', confirm: '' })}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-2" />{isFr ? 'Supprimer définitivement' : 'Hard delete'}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Set plan dialog */}
      <Dialog open={!!planDialog} onOpenChange={(o) => !o && setPlanDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isFr ? 'Forcer le plan' : 'Force plan'}</DialogTitle>
            <DialogDescription>{planDialog?.user.email}</DialogDescription>
          </DialogHeader>
          {planDialog && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium">{isFr ? 'Plan' : 'Plan'}</label>
                <Select value={planDialog.plan} onValueChange={(v) => setPlanDialog({ ...planDialog, plan: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="pro">Pro</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium">{isFr ? 'Durée (jours)' : 'Duration (days)'}</label>
                <Input type="number" min={1} value={planDialog.days}
                  onChange={(e) => setPlanDialog({ ...planDialog, days: Number(e.target.value) || 30 })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlanDialog(null)}>{isFr ? 'Annuler' : 'Cancel'}</Button>
            <Button onClick={onSetPlan} disabled={actionLoading === 'plan'}>
              {actionLoading === 'plan' && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              {isFr ? 'Appliquer' : 'Apply'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ban dialog */}
      <Dialog open={!!banDialog} onOpenChange={(o) => !o && setBanDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ban className="w-4 h-4 text-destructive" />
              {isFr ? 'Bannir l\'utilisateur' : 'Ban user'}
            </DialogTitle>
            <DialogDescription>{banDialog?.user.email}</DialogDescription>
          </DialogHeader>
          {banDialog && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium">{isFr ? 'Durée (jours)' : 'Duration (days)'}</label>
                <Input type="number" min={1} value={banDialog.days}
                  onChange={(e) => setBanDialog({ ...banDialog, days: Number(e.target.value) || 30 })} />
              </div>
              <div>
                <label className="text-xs font-medium">{isFr ? 'Raison' : 'Reason'}</label>
                <Input value={banDialog.reason}
                  onChange={(e) => setBanDialog({ ...banDialog, reason: e.target.value })}
                  placeholder={isFr ? 'Spam, fraude…' : 'Spam, fraud…'} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setBanDialog(null)}>{isFr ? 'Annuler' : 'Cancel'}</Button>
            <Button variant="destructive" onClick={onBan} disabled={actionLoading === 'ban'}>
              {actionLoading === 'ban' && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              {isFr ? 'Bannir' : 'Ban'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={!!deleteDialog} onOpenChange={(o) => !o && setDeleteDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-4 h-4" />
              {isFr ? 'Suppression définitive' : 'Hard delete'}
            </DialogTitle>
            <DialogDescription>
              {isFr ? 'Toutes les données seront supprimées. Action irréversible.' : 'All data will be wiped. Irreversible.'}
            </DialogDescription>
          </DialogHeader>
          {deleteDialog && (
            <div className="space-y-3">
              <div className="text-sm">
                <span className="text-muted-foreground">{isFr ? 'Utilisateur:' : 'User:'} </span>
                <span className="font-medium">{deleteDialog.user.email}</span>
              </div>
              <div>
                <label className="text-xs font-medium">{isFr ? 'Raison' : 'Reason'}</label>
                <Input value={deleteDialog.reason}
                  onChange={(e) => setDeleteDialog({ ...deleteDialog, reason: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-medium">{isFr ? 'Tapez SUPPRIMER pour confirmer' : 'Type SUPPRIMER to confirm'}</label>
                <Input value={deleteDialog.confirm}
                  onChange={(e) => setDeleteDialog({ ...deleteDialog, confirm: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(null)}>{isFr ? 'Annuler' : 'Cancel'}</Button>
            <Button variant="destructive" onClick={onDelete} disabled={actionLoading === 'delete' || deleteDialog?.confirm !== 'SUPPRIMER'}>
              {actionLoading === 'delete' && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              {isFr ? 'Supprimer' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Audit dialog */}
      <Dialog open={!!auditDialog} onOpenChange={(o) => !o && setAuditDialog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              {isFr ? "Journal d'audit" : 'Audit log'}
            </DialogTitle>
            <DialogDescription>{auditDialog?.user.email}</DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto space-y-1.5 -mx-1 px-1">
            {auditDialog?.logs.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                {isFr ? 'Aucune entrée.' : 'No entries.'}
              </div>
            ) : auditDialog?.logs.map((log: any) => (
              <div key={log.id} className="text-xs border border-border/40 rounded-lg p-2.5 bg-muted/20">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className={
                      log.status === 'denied' ? 'bg-destructive/15 text-destructive border-destructive/20' :
                      log.status === 'success' ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/20' :
                      'bg-muted text-muted-foreground'
                    }>
                      {log.status}
                    </Badge>
                    <span className="font-mono text-[10px]">{log.event_type}/{log.event_subtype}</span>
                  </div>
                  <span className="text-muted-foreground tabular-nums">
                    {format(new Date(log.created_at), 'dd/MM HH:mm:ss')}
                  </span>
                </div>
                {log.reason && <div className="text-muted-foreground">{log.reason}</div>}
                {log.ip_address && <div className="text-[10px] text-muted-foreground/70 font-mono">{String(log.ip_address)}</div>}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Impersonate dialog */}
      <Dialog open={!!impersonateDialog} onOpenChange={(o) => !o && setImpersonateDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="w-4 h-4" />
              {isFr ? 'Lien magique généré' : 'Magic link generated'}
            </DialogTitle>
            <DialogDescription>
              {isFr
                ? 'Ouvrez ce lien dans une fenêtre privée pour vous connecter en tant que cet utilisateur. Action enregistrée.'
                : 'Open this link in a private window to sign in as this user. Action audited.'}
            </DialogDescription>
          </DialogHeader>
          {impersonateDialog && (
            <div className="space-y-3">
              <div className="text-sm">{impersonateDialog.user.email}</div>
              <textarea
                readOnly
                value={impersonateDialog.link}
                className="w-full h-24 text-xs font-mono p-2 rounded-md border border-border bg-muted/30"
                onClick={(e) => (e.target as HTMLTextAreaElement).select()}
              />
              <Button
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(impersonateDialog.link);
                  toast.success(isFr ? 'Lien copié' : 'Link copied');
                }}
              >
                {isFr ? 'Copier' : 'Copy'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminUsersPage;
