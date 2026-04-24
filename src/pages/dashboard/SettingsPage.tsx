import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/i18n/LanguageContext';
import { dashT } from '@/i18n/dashTranslations';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { User, Bell, Lock, Database, Settings as Cog, ShieldCheck, Trash2, Download, AlertTriangle, LogOut, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import NotificationPreferencesCard from '@/components/dashboard/settings/NotificationPreferencesCard';
import PhoneNumberCard from '@/components/dashboard/settings/PhoneNumberCard';
import SmsTestCard from '@/components/dashboard/settings/SmsTestCard';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { exportToCSV } from '@/lib/export';
import { DataExportCard } from '@/components/dashboard/settings/DataExportCard';
import { TrashCard } from '@/components/dashboard/settings/TrashCard';
import { ArchivedItemsCard } from '@/components/dashboard/settings/ArchivedItemsCard';
import { PlanSwitcherCard } from '@/components/dashboard/settings/PlanSwitcherCard';
import { HeroHeaderShell } from '@/components/dashboard/HeroHeaderShell';
import { motion, AnimatePresence } from 'framer-motion';

type SectionId = 'profile' | 'preferences' | 'notifications' | 'security' | 'data' | 'advanced';
type Section = { id: SectionId; label: string; icon: any; hint?: string };

const SettingsPage = () => {
  const { user, signOut } = useAuth();
  const { locale, setLocale } = useLanguage();
  const t = dashT[locale];
  const isFr = locale === 'fr';

  const [displayName, setDisplayName] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [lang, setLang] = useState(locale);
  const [loading, setLoading] = useState(false);
  const [activeSection, setActiveSection] = useState<SectionId>('profile');

  const [passwordDialog, setPasswordDialog] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);

  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [exportLoading, setExportLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('display_name, currency, locale').eq('user_id', user.id).single()
      .then(({ data }) => {
        if (data) {
          setDisplayName(data.display_name || '');
          setCurrency(data.currency);
          setLang(data.locale as 'fr' | 'en');
        }
      });
  }, [user]);

  const sections: Section[] = [
    { id: 'profile', label: isFr ? 'Profil' : 'Profile', icon: User, hint: isFr ? 'Identité' : 'Identity' },
    { id: 'preferences', label: isFr ? 'Préférences' : 'Preferences', icon: Cog, hint: isFr ? 'Devise & langue' : 'Currency & language' },
    { id: 'notifications', label: 'Notifications', icon: Bell, hint: isFr ? 'Cadence & alertes' : 'Cadence & alerts' },
    { id: 'security', label: isFr ? 'Sécurité' : 'Security', icon: ShieldCheck, hint: isFr ? 'Mot de passe & 2FA' : 'Password & 2FA' },
    { id: 'data', label: isFr ? 'Données' : 'Data', icon: Database, hint: isFr ? 'Export & corbeille' : 'Export & trash' },
    { id: 'advanced', label: isFr ? 'Avancé' : 'Advanced', icon: AlertTriangle, hint: isFr ? 'Plan & suppression' : 'Plan & deletion' },
  ];

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    const { error } = await supabase.from('profiles').update({
      display_name: displayName.trim(), currency, locale: lang,
    }).eq('user_id', user.id);
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setLocale(lang as 'fr' | 'en');
    toast.success(t.saved);
  };

  const handlePasswordChange = async () => {
    if (newPassword.length < 8) { toast.error(isFr ? 'Min. 8 caractères' : 'Min. 8 characters'); return; }
    if (newPassword !== confirmPassword) { toast.error(isFr ? 'Les mots de passe ne correspondent pas' : 'Passwords do not match'); return; }
    setPasswordLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success(isFr ? 'Mot de passe modifié !' : 'Password updated!');
    setPasswordDialog(false);
    setNewPassword(''); setConfirmPassword('');
  };

  const handleExportAllData = async () => {
    if (!user) return;
    setExportLoading(true);
    try {
      const [txRes, accRes, budRes, savRes, debtRes] = await Promise.all([
        supabase.from('transactions').select('date, description, type, amount, notes').eq('user_id', user.id).order('date', { ascending: false }).limit(10000),
        supabase.from('payment_accounts').select('name, type, opening_balance, real_balance').eq('user_id', user.id),
        supabase.from('budgets').select('name, amount, period').eq('user_id', user.id),
        supabase.from('savings_goals').select('name, target_amount, current_amount, deadline').eq('user_id', user.id),
        supabase.from('debts').select('creditor_name, total_amount, paid_amount, due_date').eq('user_id', user.id),
      ]);
      const dateStr = new Date().toISOString().split('T')[0];
      if (txRes.data?.length) exportToCSV(txRes.data.map((tx: any) => ({ Date: tx.date, Description: tx.description, Type: tx.type === 'income' ? (isFr ? 'Revenu' : 'Income') : tx.type === 'transfer' ? (isFr ? 'Transfert' : 'Transfer') : (isFr ? 'Dépense' : 'Expense'), Montant: tx.amount, Notes: tx.notes || '' })), `transactions-${dateStr}`);
      if (accRes.data?.length) exportToCSV(accRes.data, `comptes-${dateStr}`);
      if (budRes.data?.length) exportToCSV(budRes.data, `budgets-${dateStr}`);
      if (savRes.data?.length) exportToCSV(savRes.data, `epargne-${dateStr}`);
      if (debtRes.data?.length) exportToCSV(debtRes.data, `dettes-${dateStr}`);
      toast.success(isFr ? 'Données exportées !' : 'Data exported!');
    } catch (err: any) { toast.error(err.message || 'Export error'); }
    finally { setExportLoading(false); }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    try {
      const { error } = await supabase.functions.invoke('delete-account');
      if (error) throw error;
      toast.success(isFr ? 'Compte supprimé' : 'Account deleted');
      await signOut();
    } catch (err: any) { toast.error(err.message || 'Error'); }
  };

  const activeMeta = sections.find(s => s.id === activeSection)!;
  const ActiveIcon = activeMeta.icon;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* HERO */}
      <HeroHeaderShell topBlobClassName="bg-primary/25" bottomBlobClassName="bg-accent/15">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0" style={{ background: 'var(--gradient-primary)' }}>
            <Cog className="w-7 h-7 text-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{isFr ? 'Compte' : 'Account'}</span>
            <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight truncate">{displayName || user?.email}</h1>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{user?.email}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl hidden sm:inline-flex shrink-0"
            onClick={() => signOut()}
          >
            <LogOut className="w-3.5 h-3.5 mr-1.5" />
            {isFr ? 'Déconnexion' : 'Sign out'}
          </Button>
        </div>
      </HeroHeaderShell>

      {/* MOBILE TAB BAR (scrollable horizontally) */}
      <nav className="lg:hidden glass rounded-2xl p-1.5 flex gap-1 overflow-x-auto scrollbar-none">
        {sections.map(s => {
          const Icon = s.icon;
          const active = activeSection === s.id;
          return (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all shrink-0 ${active ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted/40'}`}
            >
              <Icon className="w-3.5 h-3.5" />
              {s.label}
            </button>
          );
        })}
      </nav>

      <div className="grid lg:grid-cols-[240px_1fr] gap-6">
        {/* DESKTOP SIDEBAR */}
        <aside className="hidden lg:block sticky top-4 self-start">
          <nav className="glass rounded-2xl p-2 flex flex-col gap-1">
            {sections.map(s => {
              const Icon = s.icon;
              const active = activeSection === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setActiveSection(s.id)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all group ${active ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'}`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${active ? 'bg-primary-foreground/15' : 'bg-muted/40 group-hover:bg-muted/60'}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold leading-tight">{s.label}</p>
                    {s.hint && <p className={`text-[10px] leading-tight mt-0.5 ${active ? 'text-primary-foreground/70' : 'text-muted-foreground/70'}`}>{s.hint}</p>}
                  </div>
                </button>
              );
            })}
            <Separator className="my-1" />
            <button onClick={() => signOut()} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-destructive hover:bg-destructive/10 transition-all">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-destructive/10">
                <LogOut className="w-4 h-4" />
              </div>
              <p className="text-xs font-semibold">{isFr ? 'Se déconnecter' : 'Sign out'}</p>
            </button>
          </nav>
        </aside>

        {/* CONTENT (single section, swapped) */}
        <div className="min-w-0">
          {/* Section header */}
          <div className="flex items-center gap-3 mb-4 px-1">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${activeSection === 'advanced' ? 'bg-destructive/15 text-destructive' : 'bg-primary/15 text-primary'}`}>
              <ActiveIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold font-display leading-tight">{activeMeta.label}</h2>
              {activeMeta.hint && <p className="text-xs text-muted-foreground leading-tight">{activeMeta.hint}</p>}
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
              className="space-y-5"
            >
              {activeSection === 'profile' && (
                <Panel>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>{t.displayName}</Label>
                      <Input value={displayName} onChange={e => setDisplayName(e.target.value)} maxLength={100} className="rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <Label>{isFr ? 'Email' : 'Email'}</Label>
                      <Input value={user?.email || ''} disabled className="rounded-xl" />
                    </div>
                    <Button className="text-primary-foreground rounded-xl" style={{ background: 'var(--gradient-primary)' }} onClick={handleSave} disabled={loading}>
                      {loading ? '...' : t.saveChanges}
                    </Button>
                  </div>
                </Panel>
              )}

              {activeSection === 'preferences' && (
                <Panel>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t.currency}</Label>
                      <Select value={currency} onValueChange={setCurrency}>
                        <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="EUR">EUR (€)</SelectItem>
                          <SelectItem value="USD">USD ($)</SelectItem>
                          <SelectItem value="GBP">GBP (£)</SelectItem>
                          <SelectItem value="CAD">CAD ($)</SelectItem>
                          <SelectItem value="CHF">CHF</SelectItem>
                          <SelectItem value="XOF">XOF (CFA)</SelectItem>
                          <SelectItem value="XAF">XAF (CFA)</SelectItem>
                          <SelectItem value="MAD">MAD (DH)</SelectItem>
                          <SelectItem value="TND">TND</SelectItem>
                          <SelectItem value="GNF">GNF (FG)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{t.language}</Label>
                      <Select value={lang} onValueChange={v => setLang(v as 'fr' | 'en')}>
                        <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fr">🇫🇷 {t.french}</SelectItem>
                          <SelectItem value="en">🇬🇧 {t.english}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button className="text-primary-foreground rounded-xl mt-4" style={{ background: 'var(--gradient-primary)' }} onClick={handleSave} disabled={loading}>
                    {loading ? '...' : t.saveChanges}
                  </Button>
                </Panel>
              )}

              {activeSection === 'notifications' && (
                <div className="space-y-5">
                  <PhoneNumberCard locale={locale} />
                  <SmsTestCard locale={locale} />
                  <NotificationPreferencesCard locale={locale} />
                </div>
              )}

              {activeSection === 'security' && (
                <Panel>
                  <div className="space-y-4">
                    <Row
                      title={isFr ? 'Mot de passe' : 'Password'}
                      desc={isFr ? 'Modifier votre mot de passe de connexion' : 'Change your login password'}
                      icon={Lock}
                      action={<Button variant="outline" size="sm" className="rounded-xl" onClick={() => setPasswordDialog(true)}>{isFr ? 'Modifier' : 'Change'}</Button>}
                    />
                    <Separator />
                    <Row
                      title={isFr ? 'Authentification à 2 facteurs (2FA)' : 'Two-factor authentication (2FA)'}
                      desc={isFr ? 'Ajoutez une couche de sécurité supplémentaire (bientôt disponible)' : 'Add an extra layer of security (coming soon)'}
                      icon={Smartphone}
                      badge={isFr ? 'Bientôt' : 'Soon'}
                      action={<Switch checked={twoFAEnabled} onCheckedChange={(v) => { setTwoFAEnabled(v); toast.info(isFr ? '2FA bientôt disponible' : '2FA coming soon'); }} disabled />}
                    />
                    <Separator />
                    <Row
                      title={isFr ? 'Session active' : 'Active session'}
                      desc={isFr ? `Connecté en tant que ${user?.email}` : `Logged in as ${user?.email}`}
                      icon={ShieldCheck}
                      action={<Button variant="outline" size="sm" className="rounded-xl" onClick={() => signOut()}><LogOut className="w-3.5 h-3.5 mr-1" />{isFr ? 'Déconnexion' : 'Sign out'}</Button>}
                    />
                  </div>
                </Panel>
              )}

              {activeSection === 'data' && (
                <div className="space-y-5">
                  <Panel>
                    <Row
                      title={isFr ? 'Exporter au format CSV' : 'Export as CSV'}
                      desc={isFr ? 'Téléchargez tous vos enregistrements en CSV' : 'Download all your records as CSV'}
                      icon={Download}
                      action={<Button variant="outline" size="sm" className="rounded-xl" onClick={handleExportAllData} disabled={exportLoading}><Download className="w-3.5 h-3.5 mr-1" />{exportLoading ? '...' : 'CSV'}</Button>}
                    />
                  </Panel>
                  <DataExportCard />
                  <TrashCard />
                  <ArchivedItemsCard locale={locale} />
                </div>
              )}

              {activeSection === 'advanced' && (
                <div className="space-y-5">
                  <PlanSwitcherCard />
                  <Panel danger>
                    <Row
                      title={isFr ? 'Supprimer mon compte' : 'Delete my account'}
                      desc={isFr ? 'Supprime toutes vos données de manière irréversible' : 'Permanently delete all your data'}
                      icon={Trash2}
                      danger
                      action={<Button variant="destructive" size="sm" className="rounded-xl" onClick={() => setDeleteDialog(true)}><Trash2 className="w-3.5 h-3.5 mr-1" />{t.delete}</Button>}
                    />
                  </Panel>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Password Dialog */}
      <Dialog open={passwordDialog} onOpenChange={setPasswordDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isFr ? 'Modifier le mot de passe' : 'Change password'}</DialogTitle>
            <DialogDescription>{isFr ? 'Min. 8 caractères' : 'Min. 8 characters'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{isFr ? 'Nouveau mot de passe' : 'New password'}</Label>
              <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="rounded-xl h-11" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{isFr ? 'Confirmer' : 'Confirm'}</Label>
              <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="rounded-xl h-11" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordDialog(false)} className="rounded-xl">{t.cancel}</Button>
            <Button className="text-primary-foreground rounded-xl" style={{ background: 'var(--gradient-primary)' }} onClick={handlePasswordChange} disabled={passwordLoading}>
              {passwordLoading ? '...' : t.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Account Dialog */}
      <Dialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />{isFr ? 'Supprimer le compte' : 'Delete account'}
            </DialogTitle>
            <DialogDescription>
              {isFr ? 'Action irréversible. Tapez "SUPPRIMER" pour confirmer.' : 'Irreversible action. Type "DELETE" to confirm.'}
            </DialogDescription>
          </DialogHeader>
          <Input value={deleteConfirmText} onChange={e => setDeleteConfirmText(e.target.value)} placeholder={isFr ? 'SUPPRIMER' : 'DELETE'} className="rounded-xl h-11" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(false)} className="rounded-xl">{t.cancel}</Button>
            <Button variant="destructive" className="rounded-xl" disabled={deleteConfirmText !== (isFr ? 'SUPPRIMER' : 'DELETE')} onClick={handleDeleteAccount}>
              <Trash2 className="w-3.5 h-3.5 mr-1" />{isFr ? 'Supprimer définitivement' : 'Permanently delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const Panel = ({ children, danger }: { children: React.ReactNode; danger?: boolean }) => (
  <Card className={`border ${danger ? 'border-destructive/30' : 'border-border/50'} rounded-2xl glass`}>
    <CardContent className="p-5 sm:p-6">{children}</CardContent>
  </Card>
);

const Row = ({ title, desc, icon: Icon, action, danger, badge }: any) => (
  <div className="flex items-start sm:items-center justify-between gap-3 flex-wrap">
    <div className="flex items-start gap-3 flex-1 min-w-0">
      {Icon && (
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 sm:mt-0 ${danger ? 'bg-destructive/10 text-destructive' : 'bg-muted/50 text-muted-foreground'}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={`text-sm font-medium ${danger ? 'text-destructive' : ''}`}>{title}</p>
          {badge && <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-warning/15 text-warning">{badge}</span>}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
      </div>
    </div>
    <div className="shrink-0">{action}</div>
  </div>
);

export default SettingsPage;
