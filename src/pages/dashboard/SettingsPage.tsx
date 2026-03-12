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
import { Bell } from 'lucide-react';
import { toast } from 'sonner';
import { usePushNotifications } from '@/hooks/usePushNotifications';

const SettingsPage = () => {
  const { user } = useAuth();
  const { locale, setLocale } = useLanguage();
  const t = dashT[locale];
  const [displayName, setDisplayName] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [lang, setLang] = useState(locale);
  const [loading, setLoading] = useState(false);

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

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-2xl font-bold font-display">{t.settings}</h2>

      <Card className="border-none shadow-[var(--shadow-card)]">
        <CardHeader><CardTitle className="text-base">{t.profile}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t.displayName}</Label>
            <Input value={displayName} onChange={e => setDisplayName(e.target.value)} maxLength={100} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t.currency}</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EUR">EUR (€)</SelectItem>
                  <SelectItem value="USD">USD ($)</SelectItem>
                  <SelectItem value="GBP">GBP (£)</SelectItem>
                  <SelectItem value="CAD">CAD ($)</SelectItem>
                  <SelectItem value="CHF">CHF</SelectItem>
                  <SelectItem value="XOF">XOF (CFA)</SelectItem>
                  <SelectItem value="XAF">XAF (CFA)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t.language}</Label>
              <Select value={lang} onValueChange={v => setLang(v as 'fr' | 'en')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fr">🇫🇷 {t.french}</SelectItem>
                  <SelectItem value="en">🇬🇧 {t.english}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button className="text-primary-foreground" style={{ background: 'var(--gradient-primary)' }} onClick={handleSave} disabled={loading}>
            {loading ? '...' : t.saveChanges}
          </Button>
        </CardContent>
      </Card>

      <PushNotificationCard locale={locale} />
    </div>
  );
};

const PushNotificationCard = ({ locale }: { locale: string }) => {
  const { subscribed, subscribe, unsubscribe, loading, isSupported, permission } = usePushNotifications();

  if (!isSupported) return null;

  const handleToggle = async (checked: boolean) => {
    if (checked) {
      const ok = await subscribe();
      if (ok) toast.success(locale === 'fr' ? 'Notifications activées' : 'Notifications enabled');
      else if (permission === 'denied') toast.error(locale === 'fr' ? 'Notifications bloquées par le navigateur' : 'Notifications blocked by browser');
    } else {
      await unsubscribe();
      toast.success(locale === 'fr' ? 'Notifications désactivées' : 'Notifications disabled');
    }
  };

  return (
    <Card className="border-none shadow-[var(--shadow-card)]">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Bell className="w-4 h-4" />
          {locale === 'fr' ? 'Notifications push' : 'Push notifications'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">
              {locale === 'fr' ? 'Alertes budget & épargne' : 'Budget & savings alerts'}
            </p>
            <p className="text-xs text-muted-foreground">
              {locale === 'fr'
                ? 'Recevez des notifications même quand l\'app est fermée'
                : 'Get notified even when the app is closed'}
            </p>
          </div>
          <Switch checked={subscribed} onCheckedChange={handleToggle} disabled={loading} />
        </div>
      </CardContent>
    </Card>
  );
};

export default SettingsPage;
