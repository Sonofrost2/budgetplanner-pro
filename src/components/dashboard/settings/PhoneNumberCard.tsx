import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Phone } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props { locale: string }

const E164 = /^\+[1-9]\d{6,14}$/;

const PhoneNumberCard = ({ locale }: Props) => {
  const { user } = useAuth();
  const isFr = locale === 'fr';
  const [phone, setPhone] = useState('');
  const [initial, setInitial] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('phone')
        .eq('user_id', user.id)
        .maybeSingle();
      const p = (data as { phone?: string | null } | null)?.phone ?? '';
      setPhone(p);
      setInitial(p);
      setLoading(false);
    })();
  }, [user]);

  const save = async () => {
    if (!user) return;
    const trimmed = phone.trim();
    if (trimmed && !E164.test(trimmed)) {
      toast.error(isFr
        ? 'Format invalide. Utilisez le format international: +225...'
        : 'Invalid format. Use international format: +225...');
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ phone: trimmed || null } as never)
      .eq('user_id', user.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setInitial(trimmed);
    toast.success(isFr ? 'Numéro enregistré' : 'Phone number saved');
  };

  const dirty = phone.trim() !== initial.trim();

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
            {isFr ? 'Numéro au format international' : 'International format'}
          </Label>
          <Input
            type="tel"
            placeholder="+2250700000000"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={loading}
            className="rounded-xl"
          />
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
