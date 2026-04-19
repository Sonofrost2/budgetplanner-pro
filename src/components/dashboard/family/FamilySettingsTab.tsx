import { useEffect, useState } from 'react';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { Settings2, Save, Lock } from 'lucide-react';
import { toast } from 'sonner';

const SettingsSchema = z.object({
  name: z.string().trim().min(1, 'Nom requis').max(100, 'Max 100 caractères'),
  currency: z.enum(['XOF', 'EUR', 'USD', 'GBP', 'NGN', 'GHS', 'MAD']),
  large_tx_threshold: z.number().min(0).max(1_000_000_000),
});

const CURRENCIES = ['XOF', 'EUR', 'USD', 'GBP', 'NGN', 'GHS', 'MAD'];

interface Group {
  id: string;
  name: string;
  currency: string;
  large_tx_threshold: number;
}

interface Props {
  group: Group;
  canEdit: boolean;
  onChange: () => void;
}

export const FamilySettingsTab = ({ group, canEdit, onChange }: Props) => {
  const [name, setName] = useState(group.name);
  const [currency, setCurrency] = useState(group.currency || 'XOF');
  const [threshold, setThreshold] = useState<string>(String(group.large_tx_threshold ?? 100000));
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setName(group.name);
    setCurrency(group.currency || 'XOF');
    setThreshold(String(group.large_tx_threshold ?? 100000));
    setErrors({});
  }, [group.id, group.name, group.currency, group.large_tx_threshold]);

  const handleSave = async () => {
    const parsed = SettingsSchema.safeParse({
      name,
      currency,
      large_tx_threshold: Number(threshold) || 0,
    });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.errors.forEach((e) => {
        if (e.path[0]) fieldErrors[String(e.path[0])] = e.message;
      });
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setSaving(true);
    const { error } = await supabase
      .from('family_groups')
      .update(parsed.data)
      .eq('id', group.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Réglages enregistrés ✓');
    onChange();
  };

  const dirty =
    name.trim() !== group.name ||
    currency !== (group.currency || 'XOF') ||
    Number(threshold) !== (group.large_tx_threshold ?? 100000);

  return (
    <div className="space-y-4">
      <Card className="glass-card">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-primary" />
            <CardTitle className="text-base">Identité du groupe</CardTitle>
          </div>
          <CardDescription>Nom affiché et devise par défaut pour les rapports famille.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="group-name">Nom du groupe</Label>
            <Input
              id="group-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              disabled={!canEdit}
              placeholder="Ma famille"
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="group-currency">Devise partagée</Label>
            <Select value={currency} onValueChange={setCurrency} disabled={!canEdit}>
              <SelectTrigger id="group-currency"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            {errors.currency && <p className="text-xs text-destructive">{errors.currency}</p>}
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base">Notifications collectives</CardTitle>
          <CardDescription>
            Seuil au-dessus duquel les autres membres reçoivent une notification push.
            Le seuil personnel de chaque membre s'applique aussi : la plus petite des deux valeurs déclenche l'alerte.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="group-threshold">Seuil de transaction importante ({currency})</Label>
            <Input
              id="group-threshold"
              type="number"
              inputMode="numeric"
              min={0}
              step={1000}
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              disabled={!canEdit}
              placeholder="100000"
            />
            {errors.large_tx_threshold && <p className="text-xs text-destructive">{errors.large_tx_threshold}</p>}
            <p className="text-xs text-muted-foreground">
              Recommandé : ~10% du revenu mensuel moyen du foyer.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-2">
        {!canEdit && (
          <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
            <Lock className="w-3 h-3" /> Réservé au propriétaire et aux admins
          </span>
        )}
        <Button
          onClick={handleSave}
          disabled={!canEdit || !dirty || saving}
          className="text-primary-foreground"
          style={{ background: 'var(--gradient-primary)' }}
        >
          <Save className="w-4 h-4 mr-1.5" />
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      </div>
    </div>
  );
};
