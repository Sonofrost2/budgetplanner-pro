import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRole } from '@/hooks/useRole';
import { useLanguage } from '@/i18n/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Pencil, Shield, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const CURRENCIES = ['EUR', 'USD', 'XOF', 'XAF', 'GBP', 'CAD', 'CHF'];

const AdminPricingPage = () => {
  const { user } = useAuth();
  const { isAdmin, loading: roleLoading } = useRole();
  const { locale } = useLanguage();
  const isFr = locale === 'fr';
  const [plans, setPlans] = useState<Tables<'subscription_plans'>[]>([]);
  const [editingPlan, setEditingPlan] = useState<Tables<'subscription_plans'> | null>(null);
  const [form, setForm] = useState({ name: '', base_price: '', trial_days: '', features: '', active: true, currency_prices: {} as Record<string, string> });

  const fetchPlans = useCallback(async () => {
    // Admins need to see all plans including inactive - we query directly
    const { data } = await supabase.from('subscription_plans').select('*').order('created_at');
    setPlans(data || []);
  }, []);

  useEffect(() => { if (isAdmin) fetchPlans(); }, [isAdmin, fetchPlans]);

  const openEdit = (plan: any) => {
    setEditingPlan(plan);
    const cp: Record<string, string> = {};
    CURRENCIES.forEach(c => { cp[c] = String(plan.currency_prices?.[c] ?? ''); });
    setForm({
      name: plan.name,
      base_price: String(plan.base_price),
      trial_days: String(plan.trial_days),
      features: (plan.features || []).join('\n'),
      active: plan.active,
      currency_prices: cp,
    });
  };

  const handleSave = async () => {
    if (!editingPlan) return;
    const cp: Record<string, number> = {};
    CURRENCIES.forEach(c => { if (form.currency_prices[c]) cp[c] = Number(form.currency_prices[c]); });
    const { error } = await supabase.from('subscription_plans').update({
      name: form.name,
      base_price: Number(form.base_price),
      trial_days: Number(form.trial_days),
      features: form.features.split('\n').filter(f => f.trim()),
      active: form.active,
      currency_prices: cp,
    }).eq('id', editingPlan.id);
    if (error) { toast.error(error.message); return; }
    setEditingPlan(null);
    fetchPlans();
    toast.success(isFr ? 'Plan mis à jour' : 'Plan updated');
  };

  if (roleLoading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  if (!isAdmin) return (
    <div className="text-center py-20">
      <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
      <p className="text-muted-foreground">{isFr ? 'Accès réservé aux administrateurs.' : 'Admin access only.'}</p>
    </div>
  );

  return (
    <div className="space-y-6 max-w-3xl">
      <h2 className="text-2xl font-bold font-display flex items-center gap-2">
        <Shield className="w-6 h-6 text-primary" />
        {isFr ? 'Administration des plans' : 'Plan Administration'}
      </h2>

      <div className="grid gap-4">
        {plans.map(plan => (
          <Card key={plan.id} className={`border-none shadow-[var(--shadow-card)] ${!plan.active ? 'opacity-50' : ''}`}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg capitalize">{plan.name}</CardTitle>
                <Button variant="outline" size="sm" onClick={() => openEdit(plan)}>
                  <Pencil className="w-3.5 h-3.5 mr-1" />{isFr ? 'Modifier' : 'Edit'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                {CURRENCIES.map(c => (
                  <div key={c}>
                    <p className="text-muted-foreground text-xs">{c}</p>
                    <p className="font-medium">{plan.currency_prices?.[c] ?? '-'}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                {(Array.isArray(plan.features) ? plan.features : []).map((f: unknown, i: number) => (
                  <span key={i} className="text-xs bg-muted px-2 py-0.5 rounded-full">{String(f)}</span>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {isFr ? `Essai : ${plan.trial_days}j` : `Trial: ${plan.trial_days}d`} · {plan.active ? '✅ Actif' : '❌ Inactif'}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!editingPlan} onOpenChange={() => setEditingPlan(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{isFr ? 'Modifier le plan' : 'Edit plan'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{isFr ? 'Nom' : 'Name'}</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>{isFr ? 'Jours d\'essai' : 'Trial days'}</Label>
                <Input type="number" value={form.trial_days} onChange={e => setForm(f => ({ ...f, trial_days: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{isFr ? 'Prix par devise' : 'Price per currency'}</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {CURRENCIES.map(c => (
                  <div key={c} className="flex items-center gap-2">
                    <span className="text-xs font-medium w-8">{c}</span>
                    <Input type="number" step="0.01" className="h-8 text-sm" value={form.currency_prices[c] || ''} onChange={e => setForm(f => ({ ...f, currency_prices: { ...f.currency_prices, [c]: e.target.value } }))} />
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>{isFr ? 'Fonctionnalités (une par ligne)' : 'Features (one per line)'}</Label>
              <textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[100px]" value={form.features} onChange={e => setForm(f => ({ ...f, features: e.target.value }))} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.active} onCheckedChange={v => setForm(f => ({ ...f, active: v }))} />
              <Label>{isFr ? 'Actif' : 'Active'}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPlan(null)}>{isFr ? 'Annuler' : 'Cancel'}</Button>
            <Button className="text-primary-foreground" style={{ background: 'var(--gradient-primary)' }} onClick={handleSave}>{isFr ? 'Sauvegarder' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPricingPage;
