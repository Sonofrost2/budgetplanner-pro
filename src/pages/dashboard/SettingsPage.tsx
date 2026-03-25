import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/i18n/LanguageContext';
import { dashT } from '@/i18n/dashTranslations';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Bell, Lock, Trash2, Download, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import NotificationPreferencesCard from '@/components/dashboard/settings/NotificationPreferencesCard';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { exportToCSV } from '@/lib/export';
import ConfirmDeleteDialog from '@/components/dashboard/ConfirmDeleteDialog';

const SettingsPage = () => {
  const { user, signOut } = useAuth();
  const { locale, setLocale } = useLanguage();
  const t = dashT[locale];
  const [displayName, setDisplayName] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [lang, setLang] = useState(locale);
  const [loading, setLoading] = useState(false);

  // Password change
  const [passwordDialog, setPasswordDialog] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Delete account
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // Data export
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

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    const { error } = await supabase.from('profiles').update({
      display_name: displayName.trim(),
      currency,
      locale: lang,
    }).eq('user_id', user.id);
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setLocale(lang as 'fr' | 'en');
    toast.success(t.saved);
  };

  const handlePasswordChange = async () => {
    if (newPassword.length < 6) {
      toast.error(locale === 'fr' ? 'Le mot de passe doit contenir au moins 6 caractères' : 'Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(locale === 'fr' ? 'Les mots de passe ne correspondent pas' : 'Passwords do not match');
      return;
    }
    setPasswordLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success(locale === 'fr' ? 'Mot de passe modifié !' : 'Password updated!');
    setPasswordDialog(false);
    setNewPassword('');
    setConfirmPassword('');
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

      const transactions = (txRes.data || []).map(tx => ({
        Date: tx.date, Description: tx.description, Type: tx.type, Montant: tx.amount, Notes: tx.notes || '',
      }));
      const comptes = (accRes.data || []).map(a => ({
        Nom: a.name, Type: a.type, 'Solde initial': a.opening_balance, 'Solde réel': a.real_balance,
      }));
      const budgets = (budRes.data || []).map(b => ({
        Nom: b.name, Montant: b.amount, Période: b.period,
      }));
      const epargne = (savRes.data || []).map(s => ({
        Nom: s.name, Cible: s.target_amount, Actuel: s.current_amount, Échéance: s.deadline || '',
      }));
      const dettes = (debtRes.data || []).map(d => ({
        Créancier: d.creditor_name, Total: d.total_amount, Payé: d.paid_amount, Échéance: d.due_date || '',
      }));

      const dateStr = new Date().toISOString().split('T')[0];
      if (transactions.length) exportToCSV(transactions, `transactions-${dateStr}`);
      if (comptes.length) exportToCSV(comptes, `comptes-${dateStr}`);
      if (budgets.length) exportToCSV(budgets, `budgets-${dateStr}`);
      if (epargne.length) exportToCSV(epargne, `epargne-${dateStr}`);
      if (dettes.length) exportToCSV(dettes, `dettes-${dateStr}`);

      toast.success(locale === 'fr' ? 'Données exportées !' : 'Data exported!');
    } catch (err: any) {
      toast.error(err.message || 'Export error');
    } finally {
      setExportLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase.functions.invoke('delete-account');
      if (error) throw error;
      toast.success(locale === 'fr' ? 'Compte supprimé' : 'Account deleted');
      await signOut();
    } catch (err: any) {
      toast.error(err.message || 'Error');
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-2xl font-bold font-display">{t.settings}</h2>

      {/* Profile */}
      <Card className="border-none shadow-[var(--shadow-card)]">
        <CardHeader><CardTitle className="text-base">{t.profile}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t.displayName}</Label>
            <Input value={displayName} onChange={e => setDisplayName(e.target.value)} maxLength={100} className="rounded-xl" />
          </div>

          <div className="grid grid-cols-2 gap-4">
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

          <Button className="text-primary-foreground rounded-xl" style={{ background: 'var(--gradient-primary)' }} onClick={handleSave} disabled={loading}>
            {loading ? '...' : t.saveChanges}
          </Button>
        </CardContent>
      </Card>

      {/* Push Notifications */}
      <PushNotificationCard locale={locale} />

      {/* Security */}
      <Card className="border-none shadow-[var(--shadow-card)]">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="w-4 h-4" />
            {locale === 'fr' ? 'Sécurité' : 'Security'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{locale === 'fr' ? 'Mot de passe' : 'Password'}</p>
              <p className="text-xs text-muted-foreground">{locale === 'fr' ? 'Modifier votre mot de passe de connexion' : 'Change your login password'}</p>
            </div>
            <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setPasswordDialog(true)}>
              {locale === 'fr' ? 'Modifier' : 'Change'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Data */}
      <Card className="border-none shadow-[var(--shadow-card)]">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Download className="w-4 h-4" />
            {locale === 'fr' ? 'Données' : 'Data'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{locale === 'fr' ? 'Exporter toutes mes données' : 'Export all my data'}</p>
              <p className="text-xs text-muted-foreground">{locale === 'fr' ? 'Téléchargez un fichier CSV avec toutes vos transactions' : 'Download a CSV file with all your transactions'}</p>
            </div>
            <Button variant="outline" size="sm" className="rounded-xl" onClick={handleExportAllData} disabled={exportLoading}>
              <Download className="w-3.5 h-3.5 mr-1" />
              {exportLoading ? '...' : 'CSV'}
            </Button>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-destructive">{locale === 'fr' ? 'Supprimer mon compte' : 'Delete my account'}</p>
              <p className="text-xs text-muted-foreground">{locale === 'fr' ? 'Supprime toutes vos données de manière irréversible' : 'Permanently deletes all your data'}</p>
            </div>
            <Button variant="destructive" size="sm" className="rounded-xl" onClick={() => setDeleteDialog(true)}>
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              {t.delete}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Password Dialog */}
      <Dialog open={passwordDialog} onOpenChange={setPasswordDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{locale === 'fr' ? 'Modifier le mot de passe' : 'Change password'}</DialogTitle>
            <DialogDescription>{locale === 'fr' ? 'Choisissez un nouveau mot de passe sécurisé (min. 6 caractères)' : 'Choose a new secure password (min. 6 characters)'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{locale === 'fr' ? 'Nouveau mot de passe' : 'New password'}</Label>
              <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="rounded-xl h-11" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{locale === 'fr' ? 'Confirmer' : 'Confirm'}</Label>
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
              <AlertTriangle className="w-5 h-5" />
              {locale === 'fr' ? 'Supprimer le compte' : 'Delete account'}
            </DialogTitle>
            <DialogDescription>
              {locale === 'fr'
                ? 'Cette action est irréversible. Toutes vos données seront supprimées. Tapez "SUPPRIMER" pour confirmer.'
                : 'This action is irreversible. All your data will be deleted. Type "DELETE" to confirm.'}
            </DialogDescription>
          </DialogHeader>
          <Input
            value={deleteConfirmText}
            onChange={e => setDeleteConfirmText(e.target.value)}
            placeholder={locale === 'fr' ? 'SUPPRIMER' : 'DELETE'}
            className="rounded-xl h-11"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(false)} className="rounded-xl">{t.cancel}</Button>
            <Button
              variant="destructive"
              className="rounded-xl"
              disabled={deleteConfirmText !== (locale === 'fr' ? 'SUPPRIMER' : 'DELETE')}
              onClick={handleDeleteAccount}
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              {locale === 'fr' ? 'Supprimer définitivement' : 'Permanently delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const PushNotificationCard = ({ locale }: { locale: string }) => {
  const { subscribed, subscribe, unsubscribe, loading, isSupported, permission } = usePushNotifications();
  const { user } = useAuth();
  const [testLoading, setTestLoading] = useState(false);

  const handleToggle = async (checked: boolean) => {
    if (checked) {
      const ok = await subscribe();
      if (ok) toast.success(locale === 'fr' ? 'Notifications activées' : 'Notifications enabled');
      else if (permission === 'denied') toast.error(locale === 'fr' ? 'Notifications bloquées par le navigateur. Vérifiez les paramètres de votre navigateur.' : 'Notifications blocked by browser. Check your browser settings.');
    } else {
      await unsubscribe();
      toast.success(locale === 'fr' ? 'Notifications désactivées' : 'Notifications disabled');
    }
  };

  const handleTestPush = async () => {
    if (!user) return;
    setTestLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('push-notify', {
        body: {
          user_id: user.id,
          title: locale === 'fr' ? '🔔 Test réussi !' : '🔔 Test successful!',
          body: locale === 'fr' ? 'Les notifications push fonctionnent correctement sur cet appareil.' : 'Push notifications are working correctly on this device.',
          data: { url: '/dashboard/settings' },
        },
      });
      if (error) throw error;
      if (data?.sent > 0) {
        toast.success(locale === 'fr' ? 'Notification envoyée !' : 'Notification sent!');
      } else {
        toast.warning(locale === 'fr' ? 'Aucun appareil abonné trouvé' : 'No subscribed device found');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error');
    } finally {
      setTestLoading(false);
    }
  };

  const isDesktop = !/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const isFr = locale === 'fr';

  return (
    <Card className="border-none shadow-[var(--shadow-card)]">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Bell className="w-4 h-4" />
          {isFr ? 'Notifications push' : 'Push notifications'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">
              {isFr ? 'Alertes budget & épargne' : 'Budget & savings alerts'}
            </p>
            <p className="text-xs text-muted-foreground">
              {isFr
                ? 'Recevez des notifications même quand l\'app est fermée'
                : 'Get notified even when the app is closed'}
            </p>
          </div>
          <Switch checked={subscribed} onCheckedChange={handleToggle} disabled={loading} />
        </div>

        {/* Status indicator */}
        {!isSupported ? (
          <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 rounded-xl px-3 py-2">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            {isFr ? 'Ce navigateur ne supporte pas les notifications push' : 'This browser does not support push notifications'}
          </div>
        ) : permission === 'denied' ? (
          <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 rounded-xl px-3 py-2">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            {isFr
              ? 'Notifications bloquées. Allez dans les paramètres de votre navigateur pour les autoriser.'
              : 'Notifications blocked. Go to your browser settings to allow them.'}
          </div>
        ) : subscribed ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-secondary bg-secondary/10 rounded-xl px-3 py-2">
              <Bell className="w-3.5 h-3.5 flex-shrink-0" />
              {isFr ? '✅ Notifications actives sur cet appareil' : '✅ Notifications active on this device'}
              {isDesktop && (
                <span className="ml-auto text-muted-foreground">
                  {isFr ? '(Bureau)' : '(Desktop)'}
                </span>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl w-full"
              onClick={handleTestPush}
              disabled={testLoading}
            >
              <Bell className="w-3.5 h-3.5 mr-1.5" />
              {testLoading
                ? '...'
                : (isFr ? 'Envoyer une notification test' : 'Send a test notification')}
            </Button>
          </div>
        ) : null}

        {/* Desktop-specific tips */}
        {isDesktop && !subscribed && isSupported && permission !== 'denied' && (
          <div className="text-xs text-muted-foreground bg-muted/50 rounded-xl px-3 py-2 space-y-1">
            <p className="font-medium">{isFr ? '💡 Astuce PC' : '💡 Desktop tip'}</p>
            <p>{isFr
              ? 'Activez les notifications pour recevoir des alertes en temps réel : dépassements de budget, rappels d\'épargne et bilan hebdomadaire, même quand l\'app est en arrière-plan.'
              : 'Enable notifications to get real-time alerts: budget overruns, savings reminders, and weekly summaries, even when the app is in the background.'
            }</p>
          </div>
        )}

        {/* What you receive */}
        {subscribed && (
          <div className="text-xs text-muted-foreground space-y-1.5 border-t border-border/50 pt-3">
            <p className="font-medium text-foreground text-xs">
              {isFr ? 'Vous recevrez :' : 'You will receive:'}
            </p>
            <ul className="space-y-1 ml-1">
              <li>⚠️ {isFr ? 'Alertes de dépassement de budget (80% et 100%)' : 'Budget overrun alerts (80% and 100%)'}</li>
              <li>🐷 {isFr ? 'Rappels de cotisation épargne' : 'Savings contribution reminders'}</li>
              <li>📋 {isFr ? 'Échéances de transactions récurrentes' : 'Recurring transaction due dates'}</li>
              <li>📊 {isFr ? 'Bilan hebdomadaire chaque dimanche' : 'Weekly summary every Sunday'}</li>
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SettingsPage;
