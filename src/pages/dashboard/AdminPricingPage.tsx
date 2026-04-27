import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRole } from '@/hooks/useRole';
import { useLanguage } from '@/i18n/LanguageContext';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Pencil, Shield, Loader2, Users, TrendingUp, DollarSign, CreditCard, Search, Crown, Star, Zap, Activity } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { HeroHeaderShell } from '@/components/dashboard/HeroHeaderShell';
import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';

const CURRENCIES = ['EUR', 'USD', 'XOF', 'XAF', 'GBP', 'CAD', 'CHF'];

type Sub = {
  id: string;
  user_id: string;
  plan_id: string | null;
  status: string;
  current_period_end: string;
  current_period_start: string;
  created_at: string;
  payment_method: string | null;
};

const AdminPricingPage = () => {
  const { user } = useAuth();
  const { isAdmin, loading: roleLoading } = useRole();
  const { locale } = useLanguage();
  const { fmt } = useProfile();
  const isFr = locale === 'fr';
  const [plans, setPlans] = useState<Tables<'subscription_plans'>[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [editingPlan, setEditingPlan] = useState<Tables<'subscription_plans'> | null>(null);
  const [form, setForm] = useState({ name: '', base_price: '', trial_days: '', features: '', active: true, currency_prices: {} as Record<string, string> });
  const [subSearch, setSubSearch] = useState('');
  const [subStatusFilter, setSubStatusFilter] = useState<'all' | 'active' | 'canceled' | 'pending'>('all');
  const [subPlanFilter, setSubPlanFilter] = useState<string>('all');

  const fetchAll = useCallback(async () => {
    const [plansRes, subsRes] = await Promise.all([
      supabase.from('subscription_plans').select('*').order('base_price'),
      supabase.from('subscriptions').select('*').order('created_at', { ascending: false }).limit(500),
    ]);
    setPlans(plansRes.data || []);
    setSubs((subsRes.data || []) as Sub[]);
  }, []);

  useEffect(() => { if (isAdmin) fetchAll(); }, [isAdmin, fetchAll]);

  // KPIs
  const kpis = useMemo(() => {
    const activeSubs = subs.filter(s => s.status === 'active');
    const planMap = new Map(plans.map(p => [p.id, p]));
    let mrr = 0;
    activeSubs.forEach(s => {
      const p = planMap.get(s.plan_id || '');
      if (p) mrr += Number(p.base_price) || 0;
    });
    const distribution: Record<string, number> = {};
    activeSubs.forEach(s => {
      const p = planMap.get(s.plan_id || '');
      const name = p?.name || 'unknown';
      distribution[name] = (distribution[name] || 0) + 1;
    });
    const canceledCount = subs.filter(s => s.status === 'canceled').length;
    const churn = subs.length > 0 ? (canceledCount / subs.length) * 100 : 0;
    return { mrr, activeCount: activeSubs.length, totalCount: subs.length, distribution, churn };
  }, [subs, plans]);

  const filteredSubs = useMemo(() => {
    const planMap = new Map(plans.map(p => [p.id, p.name]));
    return subs.filter(s => {
      if (subStatusFilter !== 'all' && s.status !== subStatusFilter) return false;
      if (subPlanFilter !== 'all' && s.plan_id !== subPlanFilter) return false;
      if (subSearch) {
        const q = subSearch.toLowerCase();
        const planName = planMap.get(s.plan_id || '') || '';
        if (!s.user_id.toLowerCase().includes(q) && !planName.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [subs, plans, subStatusFilter, subPlanFilter, subSearch]);

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
    fetchAll();
    toast.success(isFr ? 'Plan mis à jour' : 'Plan updated');
  };

  if (roleLoading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  if (!isAdmin) return (
    <div className="text-center py-20">
      <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
      <p className="text-muted-foreground">{isFr ? 'Accès réservé aux administrateurs.' : 'Admin access only.'}</p>
    </div>
  );

  const planIcon = (name: string) => name === 'premium' ? Crown : name === 'pro' ? Star : Zap;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* HERO */}
      <HeroHeaderShell topBlobClassName="bg-primary/25" bottomBlobClassName="bg-accent/15">
        <div className="space-y-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0" style={{ background: 'var(--gradient-primary)' }}>
              <Shield className="w-7 h-7 text-primary-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Admin</span>
              <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight">{isFr ? 'Tarification' : 'Pricing'}</h1>
              <p className="text-xs text-muted-foreground mt-0.5">{isFr ? 'Plans, abonnés et statistiques globales' : 'Plans, subscribers and global stats'}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi icon={DollarSign} label="MRR" value={fmt(kpis.mrr, locale)} sub={isFr ? 'Estimé' : 'Estimated'} accent="primary" />
            <Kpi icon={Users} label={isFr ? 'Abonnés actifs' : 'Active subs'} value={String(kpis.activeCount)} sub={`/ ${kpis.totalCount} ${isFr ? 'total' : 'total'}`} accent="secondary" />
            <Kpi icon={TrendingUp} label={isFr ? 'Conversion' : 'Conversion'} value={`${kpis.totalCount > 0 ? Math.round((kpis.activeCount / kpis.totalCount) * 100) : 0}%`} sub={isFr ? 'Actifs / Total' : 'Active / Total'} accent="accent" />
            <Kpi icon={Activity} label="Churn" value={`${kpis.churn.toFixed(1)}%`} sub={isFr ? 'Taux annulation' : 'Cancel rate'} accent="warning" />
          </div>
        </div>
      </HeroHeaderShell>

      <Tabs defaultValue="plans">
        <TabsList className="rounded-xl glass">
          <TabsTrigger value="plans" className="rounded-lg gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <CreditCard className="w-4 h-4" />Plans <span className="ml-0.5 text-[10px] rounded-full bg-background/30 px-1.5">{plans.length}</span>
          </TabsTrigger>
          <TabsTrigger value="subscribers" className="rounded-lg gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Users className="w-4 h-4" />{isFr ? 'Abonnés' : 'Subscribers'} <span className="ml-0.5 text-[10px] rounded-full bg-background/30 px-1.5">{subs.length}</span>
          </TabsTrigger>
          <TabsTrigger value="stats" className="rounded-lg gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <TrendingUp className="w-4 h-4" />Stats
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: PLANS */}
        <TabsContent value="plans" className="mt-6 animate-fade-in space-y-4">
          <div className="grid gap-4">
            {plans.map((plan, idx) => {
              const Icon = planIcon(plan.name);
              const subCount = subs.filter(s => s.plan_id === plan.id && s.status === 'active').length;
              return (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * idx }}
                >
                  <Card className={`border border-border/50 rounded-2xl glass ${!plan.active ? 'opacity-60' : ''}`}>
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                            <Icon className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <h3 className="font-bold text-base capitalize">{plan.name}</h3>
                            <div className="flex items-center gap-2 mt-0.5">
                              <Badge variant="secondary" className="text-[10px] rounded-full">
                                <Users className="w-2.5 h-2.5 mr-1" />{subCount} {isFr ? 'actifs' : 'active'}
                              </Badge>
                              {plan.active ? (
                                <Badge className="text-[10px] rounded-full bg-secondary/20 text-secondary border-0">● {isFr ? 'Actif' : 'Active'}</Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] rounded-full">{isFr ? 'Inactif' : 'Inactive'}</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <Button variant="outline" size="sm" className="rounded-xl shrink-0" onClick={() => openEdit(plan)}>
                          <Pencil className="w-3.5 h-3.5 mr-1" />{isFr ? 'Modifier' : 'Edit'}
                        </Button>
                      </div>

                      <div className="grid grid-cols-3 sm:grid-cols-7 gap-2 text-xs mb-3">
                        {CURRENCIES.map(c => {
                          const v = (plan.currency_prices as any)?.[c];
                          return (
                            <div key={c} className="rounded-lg bg-muted/30 px-2 py-1.5 text-center">
                              <p className="text-muted-foreground text-[10px] font-semibold">{c}</p>
                              <p className="font-bold tabular-nums">{v ?? '–'}</p>
                            </div>
                          );
                        })}
                      </div>

                      <div className="flex flex-wrap gap-1 mb-2">
                        {(Array.isArray(plan.features) ? plan.features : []).slice(0, 8).map((f: unknown, i: number) => (
                          <span key={i} className="text-[10px] bg-muted/40 px-2 py-0.5 rounded-full">{String(f)}</span>
                        ))}
                        {Array.isArray(plan.features) && plan.features.length > 8 && (
                          <span className="text-[10px] px-2 py-0.5 text-muted-foreground">+{plan.features.length - 8}</span>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {isFr ? `Essai : ${plan.trial_days}j` : `Trial: ${plan.trial_days}d`}
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </TabsContent>

        {/* TAB 2: SUBSCRIBERS */}
        <TabsContent value="subscribers" className="mt-6 animate-fade-in space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={subSearch} onChange={e => setSubSearch(e.target.value)} placeholder={isFr ? 'User ID ou plan…' : 'User ID or plan…'} className="h-10 pl-9 rounded-xl text-sm" />
            </div>
            <div className="flex gap-1 glass rounded-xl p-1">
              {(['all', 'active', 'canceled', 'pending'] as const).map(s => (
                <button key={s} onClick={() => setSubStatusFilter(s)} className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-lg transition-all ${subStatusFilter === s ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                  {s === 'all' ? (isFr ? 'Tous' : 'All') : s}
                </button>
              ))}
            </div>
            <div className="flex gap-1 glass rounded-xl p-1 overflow-x-auto">
              <button onClick={() => setSubPlanFilter('all')} className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-lg whitespace-nowrap transition-all ${subPlanFilter === 'all' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                {isFr ? 'Tous plans' : 'All plans'}
              </button>
              {plans.map(p => (
                <button key={p.id} onClick={() => setSubPlanFilter(p.id)} className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-lg whitespace-nowrap capitalize transition-all ${subPlanFilter === p.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          <Card className="border border-border/50 rounded-2xl glass overflow-hidden">
            <div className="px-5 py-3 border-b border-border/40 flex items-center gap-2.5">
              <Users className="w-4 h-4 text-primary" />
              <h3 className="font-bold text-sm">{isFr ? 'Abonnés' : 'Subscribers'}</h3>
              <Badge variant="secondary" className="ml-auto text-[10px] rounded-full">
                {filteredSubs.length}{filteredSubs.length !== subs.length ? `/${subs.length}` : ''}
              </Badge>
            </div>
            {filteredSubs.length === 0 ? (
              <div className="p-10 text-center text-xs text-muted-foreground">{isFr ? 'Aucun abonné' : 'No subscribers'}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/40 bg-muted/20">
                      <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground">User</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">Plan</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">Status</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">{isFr ? 'Depuis' : 'Since'}</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">{isFr ? 'Échéance' : 'Renews'}</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground hidden md:table-cell">Method</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSubs.slice(0, 100).map(s => {
                      const planName = plans.find(p => p.id === s.plan_id)?.name || '–';
                      const statusColor = s.status === 'active' ? 'bg-secondary/15 text-secondary' : s.status === 'canceled' ? 'bg-destructive/15 text-destructive' : 'bg-warning/15 text-warning';
                      return (
                        <tr key={s.id} className="border-b border-border/20 last:border-0 hover:bg-muted/20">
                          <td className="px-4 py-2.5 font-mono text-[10px] truncate max-w-[140px]">{s.user_id.slice(0, 8)}…</td>
                          <td className="px-3 py-2.5 capitalize font-semibold">{planName}</td>
                          <td className="px-3 py-2.5"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColor}`}>{s.status}</span></td>
                          <td className="px-3 py-2.5 text-muted-foreground">{format(new Date(s.created_at), 'dd/MM/yy', { locale: isFr ? fr : enUS })}</td>
                          <td className="px-3 py-2.5 text-muted-foreground">{format(new Date(s.current_period_end), 'dd/MM/yy', { locale: isFr ? fr : enUS })}</td>
                          <td className="px-3 py-2.5 text-muted-foreground hidden md:table-cell">{s.payment_method || '–'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {filteredSubs.length > 100 && (
                  <p className="text-center text-[10px] text-muted-foreground py-3">
                    {isFr ? `Affichage des 100 premiers sur ${filteredSubs.length}` : `Showing first 100 of ${filteredSubs.length}`}
                  </p>
                )}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* TAB 3: STATS */}
        <TabsContent value="stats" className="mt-6 animate-fade-in space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Card className="border border-border/50 rounded-2xl glass">
              <CardContent className="p-5">
                <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  {isFr ? 'Distribution par plan' : 'Plan distribution'}
                </h3>
                <div className="space-y-3">
                  {Object.entries(kpis.distribution).length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-6">{isFr ? 'Aucun abonné actif' : 'No active subscribers'}</p>
                  ) : Object.entries(kpis.distribution).map(([name, count]) => {
                    const pct = kpis.activeCount > 0 ? (count / kpis.activeCount) * 100 : 0;
                    return (
                      <div key={name}>
                        <div className="flex items-center justify-between mb-1 text-xs">
                          <span className="font-semibold capitalize">{name}</span>
                          <span className="tabular-nums text-muted-foreground">{count} ({pct.toFixed(0)}%)</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: 'var(--gradient-primary)' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border/50 rounded-2xl glass">
              <CardContent className="p-5">
                <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-primary" />
                  {isFr ? 'Revenus estimés' : 'Estimated revenue'}
                </h3>
                <div className="space-y-3 text-xs">
                  <Stat label={isFr ? 'MRR (Mensuel)' : 'MRR (Monthly)'} value={fmt(kpis.mrr, locale)} />
                  <Stat label={isFr ? 'ARR projeté' : 'Projected ARR'} value={fmt(kpis.mrr * 12, locale)} />
                  <Stat label={isFr ? 'Revenu moyen / abonné' : 'Avg revenue / sub'} value={kpis.activeCount > 0 ? fmt(Math.round(kpis.mrr / kpis.activeCount), locale) : fmt(0, locale)} />
                  <Stat label={isFr ? 'Total abonnés (vie)' : 'Lifetime subs'} value={String(kpis.totalCount)} />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* EDIT DIALOG */}
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
                <Label>{isFr ? "Jours d'essai" : 'Trial days'}</Label>
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

const Kpi = ({ icon: Icon, label, value, sub, accent }: any) => {
  const colors: Record<string, string> = {
    primary: 'bg-primary/15 text-primary',
    secondary: 'bg-secondary/15 text-secondary',
    accent: 'bg-accent/15 text-accent',
    warning: 'bg-warning/15 text-warning',
  };
  return (
    <div className="rounded-2xl bg-background/40 backdrop-blur-md border border-border/40 p-3">
      <div className="flex items-center gap-2 mb-1.5">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${colors[accent] || colors.primary}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      <p className="text-lg font-bold tabular-nums truncate">{value}</p>
      <p className="text-[10px] text-muted-foreground">{sub}</p>
    </div>
  );
};

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-bold tabular-nums">{value}</span>
  </div>
);

export default AdminPricingPage;
