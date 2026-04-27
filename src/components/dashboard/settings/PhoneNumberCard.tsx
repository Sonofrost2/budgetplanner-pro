import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Phone } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CountryPhoneInput } from '@/components/ui/country-phone-input';
import { useGeoCountry } from '@/hooks/useGeoCountry';
import { DEFAULT_COUNTRY_CODE, findCountryByCode } from '@/lib/countries';
import { detectCountryFromE164 } from '@/lib/phoneValidation';

interface Props { locale: string }

const PhoneNumberCard = ({ locale }: Props) => {
  const { user } = useAuth();
  const geo = useGeoCountry();
  const isFr = locale === 'fr';
  const [phone, setPhone] = useState('');
  const [phoneValid, setPhoneValid] = useState(true); // empty is valid (optional)
  const [countryCode, setCountryCode] = useState<string>(DEFAULT_COUNTRY_CODE);
  const [initial, setInitial] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('phone, country_code')
        .eq('user_id', user.id)
        .maybeSingle();
      const row = data as { phone?: string | null; country_code?: string | null } | null;
      const p = row?.phone ?? '';
      const cc = row?.country_code
        || (p ? detectCountryFromE164(p) : null)
        || geo.country
        || DEFAULT_COUNTRY_CODE;
      if (findCountryByCode(cc)) setCountryCode(cc);
      setPhone(p);
      setInitial(p);
      setLoading(false);
    })();
  }, [user, geo.country]);

  const save = async () => {
    if (!user) return;
    if (phone && !phoneValid) {
      toast.error(isFr
        ? 'Numéro invalide pour le pays sélectionné.'
        : 'Invalid number for the selected country.');
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ phone: phone || null, country_code: countryCode } as never)
      .eq('user_id', user.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setInitial(phone);
    toast.success(isFr ? 'Numéro enregistré' : 'Phone number saved');
  };

  const dirty = phone !== initial;

  return (
    <Card className="border-none shadow-[var(--shadow-card)]">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Phone className="w-4 h-4" />
          {isFr ? 'Téléphone (SMS & WhatsApp)' : 'Phone (SMS & WhatsApp)'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            {isFr ? 'Pays et numéro' : 'Country and number'}
          </Label>
          {!loading && (
            <CountryPhoneInput
              value={phone}
              countryCode={countryCode}
              onCountryChange={setCountryCode}
              onChange={(e164, _cc, valid) => { setPhone(e164); setPhoneValid(valid || !e164); }}
              detectedCountry={geo.country}
              locale={isFr ? 'fr' : 'en'}
            />
          )}
          <p className="text-[11px] text-muted-foreground">
            {isFr
              ? 'Utilisé pour les reçus de paiement, rappels d’expiration et alertes financières.'
              : 'Used for payment receipts, expiry reminders and financial alerts.'}
          </p>
        </div>
        <Button size="sm" onClick={save} disabled={!dirty || saving} className="rounded-xl">
          {saving ? '...' : (isFr ? 'Enregistrer' : 'Save')}
        </Button>
      </CardContent>
    </Card>
  );
};

export default PhoneNumberCard;
