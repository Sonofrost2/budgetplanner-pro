import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/i18n/LanguageContext';
import { useProfile } from '@/hooks/useProfile';
import { dashT } from '@/i18n/dashTranslations';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Check, X, Crown, Zap, Loader2, AlertCircle, Star, Shield, Sparkles,
  Receipt, Clock, Download, Calendar, CreditCard, Search, TrendingUp, Gift,
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { format, differenceInDays } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import jsPDF from 'jspdf';
import { HeroHeaderShell } from '@/components/dashboard/HeroHeaderShell';
import { translateFeature } from '@/lib/planFeatures';

const downloadReceiptPDF = (receipt: any, locale: string, fmtFn: (v: number, l: string) => string) => {
  const doc = new jsPDF({ unit: 'mm', format: 'a5' });
  const w = doc.internal.pageSize.getWidth();
  const isFr = locale === 'fr';
  const dateStr = format(new Date(receipt.created_at), 'dd MMMM yyyy · HH:mm', { locale: isFr ? fr : enUS });
  const amountStr = `${fmtFn(receipt.amount, locale)} ${receipt.currency}`;
  const statusLabel = receipt.status === 'confirmed' ? (isFr ? 'Confirmé' : 'Confirmed') : receipt.status;

  doc.setFillColor(99, 102, 241);
  doc.rect(0, 0, w, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Budget Planner', w / 2, 12, { align: 'center' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(isFr ? 'Reçu de paiement' : 'Payment Receipt', w / 2, 20, { align: 'center' });

  doc.setTextColor(60, 60, 60);
  let y = 40;
  const labelX = 16;
  const valueX = w - 16;
  const addRow = (label: string, value: string) => {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 120, 120);
    doc.text(label, labelX, y);
    doc.setTextColor(40, 40, 40);
    doc.setFont('helvetica', 'bold');
    doc.text(value, valueX, y, { align: 'right' });
    y += 10;
    doc.setDrawColor(230, 230, 230);
    doc.line(labelX, y - 4, valueX, y - 4);
  };
  addRow('Plan', receipt.plan_name);
  addRow(isFr ? 'Montant' : 'Amount', amountStr);
  addRow('Date', dateStr);
  addRow(isFr ? 'Statut' : 'Status', statusLabel);
  if (receipt.payment_token) addRow('Ref', receipt.payment_token);

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(160, 160, 160);
  doc.text(`© ${new Date().getFullYear()} Budget Planner`, w / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
  doc.save(`receipt-${receipt.plan_name}-${format(new Date(receipt.created_at), 'yyyy-MM-dd')}.pdf`);
};

type Plan = {
  id: string;
  name: string;
  base_price: number;
  currency_prices: Record<string, number>;
  trial_days: number;
  features: string[];
  active: boolean;
};

type Subscription = {
  id: string;
  plan_id: string | null;
  status: string;
  current_period_end: string;
  current_period_start: string;
  canceled_at: string | null;
};

const PaymentPage = () => {
  const { user } = useAuth();
  const { locale } = useLanguage();
  const { currency, fmt } = useProfile();
  const t = dashT[locale];
  const isFr = locale === 'fr';

  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [canceling, setCanceling] = useState(false);
  const [annual, setAnnual] = useState(false);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [receiptsLoading, setReceiptsLoading] = useState(true);
  const [receiptSearch, setReceiptSearch] = useState('');
  const [receiptStatus, setReceiptStatus] = useState<'all' | 'confirmed' | 'pending'>('all');

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [plansRes, subRes] = await Promise.all([
        supabase.from('subscription_plans').select('*').eq('active', true).order('base_price', { ascending: true }),
        supabase.from('subscriptions').select('*').eq('user_id', user.id).eq('status', 'active').order('created_at', { ascending: false }).limit(1),
      ]);
      setPlans((plansRes.data || []).map(p => ({
        ...p,
        features: Array.isArray(p.features) ? p.features as string[] : [],
        currency_prices: (p.currency_prices || {}) as Record<string, number>,
      })));
      setSubscription(subRes.data && subRes.data.length > 0 ? subRes.data[0] as Subscription : null);
      setLoading(false);
    };
    load();

    supabase.from('payment_receipts').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50)
      .then(({ data }) => { setReceipts(data || []); setReceiptsLoading(false); });
  }, [user]);

  const getPrice = (plan: Plan) => {
    const price = plan.currency_prices[currency] ?? plan.base_price;
    if (!annual) return price;
    return Math.round(price * 12 * 0.8);
  };

  const getMonthlyEquivalent = (plan: Plan) => {
    const price = plan.currency_prices[currency] ?? plan.base_price;
    return Math.round(price * 0.8 * 100) / 100;
  };

  const handleSubscribe = async (plan: Plan) => {
    if (!user) return;
    setSubscribing(plan.id);
    try {
      const price = getPrice(plan);
      const desc = t.subscriptionDesc(plan.name);
      const { data, error } = await supabase.functions.invoke('paystack-checkout', {
        body: {
          action: 'initialize',
          amount: price,
          email: user.email,
          currency: currency || 'XOF',
          description: desc,
          callback_url: window.location.origin + '/dashboard/payment?success=true&plan=' + plan.id,
          metadata: { plan_id: plan.id, plan_name: plan.name, user_id: user.id },
        },
      });
      if (error) throw error;
      if (data?.status && data?.data?.authorization_url) {
        await supabase.from('subscriptions').insert({ user_id: user.id, plan_id: plan.id, status: 'pending', payment_method: 'paystack', last_payment_token: data.data.reference || null });
        await supabase.from('payment_receipts').insert({ user_id: user.id, plan_name: plan.name, amount: price, currency, status: 'pending', payment_token: data.data.reference || null });
        window.open(data.data.authorization_url, '_blank');
        toast.success(t.redirectingPayment);
      } else {
        toast.error(data?.message || t.paymentError);
      }
    } catch (err: any) {
      toast.error(err.message || 'Error');
    } finally {
      setSubscribing(null);
    }
  };

  const handleCancel = async () => {
    if (!subscription) return;
    setCanceling(true);
    const { error } = await supabase.from('subscriptions').update({ status: 'canceled', canceled_at: new Date().toISOString() }).eq('id', subscription.id);
    setCanceling(false);
    if (error) { toast.error(error.message); return; }
    toast.success(t.subscriptionCanceledMsg);
    setSubscription({ ...subscription, status: 'canceled', canceled_at: new Date().toISOString() });
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reference = params.get('reference') || params.get('trxref');
    if ((params.get('success') === 'true' && params.get('plan')) || reference) {
      const confirmSub = async () => {
        if (!user) return;
        if (reference) {
          try {
            const { data: verifyData } = await supabase.functions.invoke('paystack-checkout', {
              body: { action: 'verify', reference },
            });
            if (!verifyData?.status || verifyData?.data?.status !== 'success') {
              toast.error(isFr ? 'Le paiement n\'a pas été confirmé' : 'Payment was not confirmed');
              window.history.replaceState({}, '', '/dashboard/payment');
              return;
            }
          } catch (e) {
            console.error('Verification error:', e);
          }
        }
        const { data: pendingSubs } = await supabase.from('subscriptions').select('*').eq('user_id', user.id).eq('status', 'pending').order('created_at', { ascending: false }).limit(1);
        if (pendingSubs && pendingSubs.length > 0) {
          await supabase.from('subscriptions').update({ status: 'active', current_period_start: new Date().toISOString(), current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() }).eq('id', pendingSubs[0].id);
          if (pendingSubs[0].last_payment_token) {
            await supabase.from('payment_receipts').update({ status: 'confirmed' } as any).eq('payment_token', pendingSubs[0].last_payment_token).eq('user_id', user.id);
          }
          setSubscription({ ...pendingSubs[0], status: 'active' } as Subscription);
          toast.success(t.subscriptionActivated);
          const planId = params.get('plan');
          const confirmedPlan = plans.find(p => p.id === planId);
          if (confirmedPlan) {
            const { data: profile } = await supabase.from('profiles').select('display_name').eq('user_id', user.id).single();
            supabase.functions.invoke('send-email', {
              body: {
                template: 'payment-confirmation',
                to: user.email,
                data: { displayName: profile?.display_name || user.email, planName: confirmedPlan.name, amount: getPrice(confirmedPlan), currency },
              },
            }).catch(err => console.error('Payment email error:', err));
          }
        }
        window.history.replaceState({}, '', '/dashboard/payment');
      };
      confirmSub();
    }
    if (params.get('canceled') === 'true') {
      toast.info(t.paymentCanceled);
      window.history.replaceState({}, '', '/dashboard/payment');
    }
  }, [user, locale]);

  const currentPlan = useMemo(
    () => plans.find(p => p.id === subscription?.plan_id) ?? null,
    [plans, subscription]
  );
  const isOnFreePlan = !subscription || !currentPlan;
  const planLabel = isOnFreePlan ? t.freePlan : (currentPlan!.name.charAt(0).toUpperCase() + currentPlan!.name.slice(1));
  const daysLeft = subscription?.current_period_end
    ? Math.max(0, differenceInDays(new Date(subscription.current_period_end), new Date()))
    : null;

  const filteredReceipts = useMemo(() => {
    return receipts.filter(r => {
      if (receiptStatus !== 'all' && r.status !== receiptStatus) return false;
      if (receiptSearch && !`${r.plan_name} ${r.payment_token ?? ''}`.toLowerCase().includes(receiptSearch.toLowerCase())) return false;
      return true;
    });
  }, [receipts, receiptSearch, receiptStatus]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 rounded-3xl" />
        <Skeleton className="h-12 w-72 rounded-xl" />
        <div className="grid md:grid-cols-3 gap-5">
          <Skeleton className="h-[440px] rounded-2xl" />
          <Skeleton className="h-[480px] rounded-2xl" />
          <Skeleton className="h-[440px] rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-8">
      {/* HERO */}
      <HeroHeaderShell topBlobClassName="bg-primary/25" bottomBlobClassName="bg-accent/20">
        <div className="flex flex-col lg:flex-row lg:items-center gap-5 lg:gap-8">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0" style={{ background: 'var(--gradient-primary)' }}>
              {isOnFreePlan ? <Zap className="w-7 h-7 text-primary-foreground" /> : currentPlan!.name === 'premium' ? <Crown className="w-7 h-7 text-primary-foreground" /> : <Star className="w-7 h-7 text-primary-foreground" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {isFr ? 'Abonnement' : 'Subscription'}
                </span>
                {subscription?.status === 'active' && (
                  <span className="px-2 py-0.5 rounded-full bg-secondary/15 text-secondary text-[10px] font-bold">
                    ● {isFr ? 'Actif' : 'Active'}
                  </span>
                )}
                {subscription?.status === 'canceled' && (
                  <span className="px-2 py-0.5 rounded-full bg-destructive/15 text-destructive text-[10px] font-bold">
                    {isFr ? 'Résilié' : 'Canceled'}
                  </span>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight truncate">
                {isFr ? 'Plan' : 'Plan'} {planLabel}
              </h1>
              {daysLeft !== null && subscription?.status === 'active' && (
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                  <Calendar className="w-3 h-3" />
                  {isFr ? `Renouvellement dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}` : `Renews in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`}
                </p>
              )}
              {isOnFreePlan && (
                <p className="text-xs text-muted-foreground mt-1">
                  {isFr ? 'Passez à un plan supérieur pour débloquer toutes les fonctionnalités.' : 'Upgrade to unlock all features.'}
                </p>
              )}
            </div>
          </div>

          {isOnFreePlan && (
            <Button
              className="text-primary-foreground rounded-xl gap-2 h-11 px-5 shrink-0"
              style={{ background: 'var(--gradient-primary)' }}
              onClick={() => document.querySelector('[data-tab-compare]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))}
            >
              <Sparkles className="w-4 h-4" />
              {isFr ? 'Découvrir les plans' : 'Discover plans'}
            </Button>
          )}
        </div>
      </HeroHeaderShell>

      {/* TABS */}
      <Tabs defaultValue={isOnFreePlan ? 'compare' : 'plan'}>
        <TabsList className="rounded-xl glass">
          <TabsTrigger value="plan" className="rounded-lg gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Star className="w-4 h-4" />{isFr ? 'Mon plan' : 'My plan'}
          </TabsTrigger>
          <TabsTrigger value="compare" data-tab-compare className="rounded-lg gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <TrendingUp className="w-4 h-4" />{isFr ? 'Comparer' : 'Compare'}
          </TabsTrigger>
          <TabsTrigger value="billing" className="rounded-lg gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Receipt className="w-4 h-4" />{isFr ? 'Facturation' : 'Billing'}
            {receipts.length > 0 && (
              <span className="ml-0.5 text-[10px] rounded-full bg-background/30 px-1.5">{receipts.length}</span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: MON PLAN */}
        <TabsContent value="plan" className="mt-6 animate-fade-in space-y-4">
          <MyPlanTab
            plan={currentPlan}
            subscription={subscription}
            isFr={isFr}
            t={t}
            currency={currency}
            fmt={fmt}
            locale={locale}
            onCancel={handleCancel}
            canceling={canceling}
          />
        </TabsContent>

        {/* TAB 2: COMPARER */}
        <TabsContent value="compare" className="mt-6 animate-fade-in space-y-6">
          {/* Toggle */}
          <div className="flex items-center justify-center gap-3">
            <span className={`text-xs font-semibold transition-colors ${!annual ? 'text-foreground' : 'text-muted-foreground'}`}>{t.monthly}</span>
            <button
              onClick={() => setAnnual(!annual)}
              className={`relative w-12 h-6 rounded-full transition-all duration-300 ${annual ? 'shadow-[0_0_12px_hsl(var(--primary)/0.35)]' : 'bg-muted-foreground/20'}`}
              style={annual ? { background: 'var(--gradient-primary)' } : {}}
              aria-label="Toggle billing period"
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-primary-foreground shadow-sm transition-transform duration-300 ${annual ? 'translate-x-6' : 'translate-x-0'}`} />
            </button>
            <span className={`text-xs font-semibold transition-colors ${annual ? 'text-foreground' : 'text-muted-foreground'}`}>{t.yearly}</span>
            <AnimatePresence>
              {annual && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.7 }}
                  className="text-[10px] font-bold text-primary-foreground px-2.5 py-0.5 rounded-full"
                  style={{ background: 'var(--gradient-primary)' }}
                >
                  -20%
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          {/* Plan cards */}
          <PlanCards
            plans={plans}
            subscription={subscription}
            currency={currency}
            fmt={fmt}
            locale={locale}
            isFr={isFr}
            t={t}
            annual={annual}
            getPrice={getPrice}
            getMonthlyEquivalent={getMonthlyEquivalent}
            onSubscribe={handleSubscribe}
            subscribing={subscribing}
          />

          {/* Features comparison table */}
          <FeatureComparisonTable plans={plans} isFr={isFr} />

          {/* Payment methods */}
          <div className="glass rounded-2xl px-6 py-4 flex flex-wrap items-center justify-center gap-3">
            <Shield className="w-4 h-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground font-medium">{t.paymentMethods}</p>
            <div className="flex flex-wrap gap-2">
              {['💳 Carte', '📱 Mobile Money', '🏦 Virement'].map(m => (
                <Badge key={m} variant="secondary" className="text-[10px] font-medium rounded-full px-2.5 py-0.5 bg-muted/50 border-0">
                  {m}
                </Badge>
              ))}
            </div>
          </div>

          <p className="text-center text-[11px] text-muted-foreground flex items-center justify-center gap-1.5">
            <AlertCircle className="w-3 h-3" />
            {t.cancelAnytime}
          </p>
        </TabsContent>

        {/* TAB 3: FACTURATION */}
        <TabsContent value="billing" className="mt-6 animate-fade-in space-y-4">
          <BillingTab
            receipts={receipts}
            filteredReceipts={filteredReceipts}
            receiptsLoading={receiptsLoading}
            receiptSearch={receiptSearch}
            setReceiptSearch={setReceiptSearch}
            receiptStatus={receiptStatus}
            setReceiptStatus={setReceiptStatus}
            isFr={isFr}
            locale={locale}
            fmt={fmt}
            t={t}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

/* ============ MY PLAN TAB ============ */
const MyPlanTab = ({ plan, subscription, isFr, t, currency, fmt, locale, onCancel, canceling }: any) => {
  if (!plan || !subscription) {
    return (
      <Card className="border border-border/50 rounded-2xl glass">
        <CardContent className="p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-muted/40 flex items-center justify-center mx-auto mb-3">
            <Zap className="w-6 h-6 text-muted-foreground" />
          </div>
          <h3 className="font-bold mb-2">{t.freePlan}</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            {isFr
              ? 'Vous utilisez actuellement le plan gratuit. Passez à Pro ou Premium pour débloquer toutes les fonctionnalités.'
              : 'You are currently on the free plan. Upgrade to Pro or Premium to unlock all features.'}
          </p>
        </CardContent>
      </Card>
    );
  }

  const price = plan.currency_prices?.[currency] ?? plan.base_price;
  const startDate = format(new Date(subscription.current_period_start), 'dd MMMM yyyy', { locale: isFr ? fr : enUS });
  const endDate = format(new Date(subscription.current_period_end), 'dd MMMM yyyy', { locale: isFr ? fr : enUS });

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Card className="border border-border/50 rounded-2xl glass">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
              {plan.name === 'premium' ? <Crown className="w-4 h-4 text-primary" /> : <Star className="w-4 h-4 text-primary" />}
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{isFr ? 'Plan actif' : 'Active plan'}</p>
              <h3 className="font-bold text-lg capitalize">{plan.name}</h3>
            </div>
          </div>
          <div className="border-t border-border/40 pt-4 space-y-3">
            <Row label={isFr ? 'Tarif mensuel' : 'Monthly price'} value={`${fmt(price, locale)} ${currency}`} />
            <Row label={isFr ? 'Période en cours depuis' : 'Current period since'} value={startDate} />
            <Row label={isFr ? 'Renouvellement' : 'Renewal'} value={endDate} />
            <Row label={isFr ? 'Mode de paiement' : 'Payment method'} value={subscription.payment_method ?? 'Paystack'} />
          </div>
          {subscription.status === 'active' && (
            <Button variant="outline" size="sm" className="w-full rounded-xl glass border-border/50 text-xs" onClick={onCancel} disabled={canceling}>
              {canceling ? <Loader2 className="w-4 h-4 animate-spin" /> : t.cancelLabel}
            </Button>
          )}
        </CardContent>
      </Card>

      <Card className="border border-border/50 rounded-2xl glass">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-accent/15 flex items-center justify-center">
              <Gift className="w-4 h-4 text-accent" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{isFr ? 'Inclus dans votre plan' : 'Included in your plan'}</p>
              <h3 className="font-bold text-sm">{plan.features.length} {isFr ? 'avantages' : 'benefits'}</h3>
            </div>
          </div>
          <ul className="space-y-2 max-h-[260px] overflow-y-auto pr-2">
            {plan.features.map((f: string, i: number) => (
              <li key={i} className="flex items-start gap-2 text-xs">
                <Check className="w-3.5 h-3.5 text-secondary mt-0.5 shrink-0" />
                <span>{translateFeature(f, isFr ? 'fr' : 'en')}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between text-xs">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-semibold tabular-nums">{value}</span>
  </div>
);

/* ============ PLAN CARDS ============ */
const PlanCards = ({ plans, subscription, currency, fmt, locale, isFr, t, annual, getPrice, getMonthlyEquivalent, onSubscribe, subscribing }: any) => {
  const freePlan = plans.find((p: Plan) => p.name === 'free');
  const proPlan = plans.find((p: Plan) => p.name === 'pro');
  const premiumPlan = plans.find((p: Plan) => p.name === 'premium');
  const currentPlanId = subscription?.plan_id;

  const cardConfigs = [
    { plan: freePlan, icon: <Zap className="w-5 h-5" />, isCurrent: !subscription || subscription.status !== 'active', isHighlighted: false, isPremium: false, disabledFeatures: [...t.freeExcluded] },
    { plan: proPlan, icon: <Star className="w-5 h-5" />, isCurrent: currentPlanId === proPlan?.id && subscription?.status === 'active', isHighlighted: true, isPremium: false, disabledFeatures: [...t.proExcluded] },
    { plan: premiumPlan, icon: <Crown className="w-5 h-5" />, isCurrent: currentPlanId === premiumPlan?.id && subscription?.status === 'active', isHighlighted: false, isPremium: true, disabledFeatures: [] },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start">
      {cardConfigs.map((config, idx) => {
        const { plan, icon, isCurrent, isHighlighted, isPremium, disabledFeatures } = config;
        if (!plan) return null;
        const price = getPrice(plan);
        return (
          <motion.div
            key={plan.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 * idx, duration: 0.35 }}
            className={`relative rounded-2xl ${isHighlighted ? 'p-px md:-mt-2 md:mb-[-8px]' : ''}`}
            style={isHighlighted ? { background: 'var(--gradient-primary)' } : {}}
          >
            {plan.trial_days > 0 && !isCurrent && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                <span className="px-3 py-1 rounded-full text-[10px] font-bold text-primary-foreground shadow-lg" style={{ background: 'var(--gradient-primary)' }}>
                  {plan.trial_days} {t.daysTrial}
                </span>
              </div>
            )}
            {isCurrent && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-secondary text-secondary-foreground shadow-lg">
                  {t.currentPlan}
                </span>
              </div>
            )}
            <div className={`rounded-2xl p-6 h-full flex flex-col ${isHighlighted ? 'bg-card shadow-[0_8px_32px_hsl(var(--primary)/0.15)]' : 'glass'} transition-shadow duration-300 hover:shadow-[var(--shadow-card)]`}>
              <div className="flex items-center gap-2.5 mb-5">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isHighlighted || isPremium ? 'bg-primary/15 text-primary' : 'bg-muted/60 text-muted-foreground'}`}>
                  {icon}
                </div>
                <h3 className="text-lg font-bold capitalize">
                  {plan.name === 'free' ? t.freePlan : plan.name.charAt(0).toUpperCase() + plan.name.slice(1)}
                </h3>
              </div>
              <div className="mb-6">
                <div className="flex flex-wrap items-baseline gap-x-1.5">
                  <span className="text-3xl sm:text-4xl font-extrabold tabular-nums">
                    {price === 0 ? '0' : fmt(price, locale).replace(/\s/g, '\u00A0')}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {currency}/{plan.name !== 'free' && annual ? (isFr ? 'an' : 'yr') : t.perMonth}
                  </span>
                </div>
                {annual && price > 0 && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    ≈ {fmt(getMonthlyEquivalent(plan), locale)}{t.perMonth}
                  </p>
                )}
              </div>
              <div className="h-px bg-border/50 mb-5" />
              <ul className="space-y-2.5 flex-1 mb-6">
                {plan.features.map((f: string, i: number) => (
                  <li key={i} className="flex items-start gap-2.5 text-xs">
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${isHighlighted || isPremium ? 'bg-primary/15' : 'bg-secondary/15'}`}>
                      <Check className={`w-2.5 h-2.5 ${isHighlighted || isPremium ? 'text-primary' : 'text-secondary'}`} />
                    </div>
                    <span className={isHighlighted ? 'font-medium' : ''}>{translateFeature(f, isFr ? 'fr' : 'en')}</span>
                  </li>
                ))}
                {disabledFeatures.map((f: string, i: number) => (
                  <li key={`d-${i}`} className="flex items-start gap-2.5 text-xs text-muted-foreground/40">
                    <div className="w-4 h-4 rounded-full bg-muted/60 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <X className="w-2.5 h-2.5" />
                    </div>
                    <span className="line-through">{f}</span>
                  </li>
                ))}
              </ul>
              <div className="space-y-2 mt-auto">
                {isCurrent ? (
                  <Button className="w-full h-11 rounded-xl font-semibold text-xs" disabled>
                    {t.currentPlan}
                  </Button>
                ) : plan.name === 'free' ? (
                  <Button variant="outline" className="w-full h-11 rounded-xl font-semibold text-xs glass border-border/50" disabled>
                    {t.included}
                  </Button>
                ) : (
                  <Button
                    className={`w-full h-11 rounded-xl font-semibold text-xs transition-all hover:scale-[1.02] hover:shadow-lg ${isHighlighted ? 'text-primary-foreground shadow-md' : ''}`}
                    style={isHighlighted ? { background: 'var(--gradient-primary)' } : undefined}
                    variant={isHighlighted ? 'default' : 'outline'}
                    onClick={() => onSubscribe(plan)}
                    disabled={subscribing === plan.id}
                  >
                    {subscribing === plan.id && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {t.subscribeTo(plan.name.charAt(0).toUpperCase() + plan.name.slice(1))}
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

/* ============ FEATURE COMPARISON TABLE ============ */
const FeatureComparisonTable = ({ plans, isFr }: { plans: Plan[]; isFr: boolean }) => {
  const allFeatures = useMemo(() => {
    const set = new Set<string>();
    plans.forEach(p => p.features.forEach(f => set.add(f)));
    return Array.from(set);
  }, [plans]);

  if (allFeatures.length === 0 || plans.length === 0) return null;

  return (
    <Card className="border border-border/50 rounded-2xl glass overflow-hidden">
      <div className="px-5 py-4 border-b border-border/40 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <TrendingUp className="w-4 h-4 text-primary" />
        </div>
        <h3 className="font-bold text-sm">{isFr ? 'Comparaison détaillée' : 'Detailed comparison'}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border/40">
              <th className="text-left px-5 py-3 font-semibold text-muted-foreground">{isFr ? 'Fonctionnalité' : 'Feature'}</th>
              {plans.map(p => (
                <th key={p.id} className="text-center px-3 py-3 font-bold capitalize min-w-[100px]">{p.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allFeatures.map((feat, i) => (
              <tr key={i} className="border-b border-border/30 last:border-b-0 hover:bg-muted/20">
                <td className="px-5 py-2.5 text-foreground">{translateFeature(feat, isFr ? 'fr' : 'en')}</td>
                {plans.map(p => (
                  <td key={p.id} className="text-center px-3 py-2.5">
                    {p.features.includes(feat)
                      ? <Check className="w-4 h-4 text-secondary inline" />
                      : <X className="w-4 h-4 text-muted-foreground/30 inline" />}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

/* ============ BILLING TAB ============ */
const BillingTab = ({ receipts, filteredReceipts, receiptsLoading, receiptSearch, setReceiptSearch, receiptStatus, setReceiptStatus, isFr, locale, fmt, t }: any) => {
  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={receiptSearch}
            onChange={(e) => setReceiptSearch(e.target.value)}
            placeholder={isFr ? 'Rechercher un reçu…' : 'Search a receipt…'}
            className="h-10 pl-9 rounded-xl text-sm"
          />
        </div>
        <div className="flex gap-1 glass rounded-xl p-1">
          {(['all', 'confirmed', 'pending'] as const).map(s => (
            <button
              key={s}
              onClick={() => setReceiptStatus(s)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${receiptStatus === s ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {s === 'all' ? (isFr ? 'Tous' : 'All') : s === 'confirmed' ? (isFr ? 'Confirmés' : 'Confirmed') : (isFr ? 'En attente' : 'Pending')}
            </button>
          ))}
        </div>
      </div>

      <Card className="border border-border/50 rounded-2xl glass overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border/40 flex items-center gap-2.5">
          <Receipt className="w-4 h-4 text-primary" />
          <h3 className="font-bold text-sm">{isFr ? 'Historique des paiements' : 'Payment history'}</h3>
          <Badge variant="secondary" className="ml-auto text-[10px] rounded-full px-2 py-0.5">
            {filteredReceipts.length}{filteredReceipts.length !== receipts.length ? `/${receipts.length}` : ''}
          </Badge>
        </div>

        {receiptsLoading ? (
          <div className="p-5 space-y-3">
            <Skeleton className="h-12 rounded-xl" />
            <Skeleton className="h-12 rounded-xl" />
            <Skeleton className="h-12 rounded-xl" />
          </div>
        ) : filteredReceipts.length === 0 ? (
          <div className="p-10 text-center">
            <Clock className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">
              {receipts.length === 0 ? t.noReceipts : (isFr ? 'Aucun reçu correspondant' : 'No matching receipts')}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {filteredReceipts.map((r: any, idx: number) => {
              const statusColor = r.status === 'confirmed'
                ? 'bg-secondary/15 text-secondary'
                : r.status === 'pending'
                  ? 'bg-warning/15 text-warning'
                  : 'bg-destructive/15 text-destructive';
              const statusLabel = r.status === 'confirmed'
                ? (isFr ? 'Confirmé' : 'Confirmed')
                : r.status === 'pending'
                  ? (isFr ? 'En attente' : 'Pending')
                  : r.status;

              return (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(0.04 * idx, 0.4) }}
                  className="px-5 py-3.5 flex items-center gap-3 sm:gap-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <CreditCard className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold capitalize truncate">
                      {isFr ? 'Plan' : 'Plan'} {r.plan_name}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {format(new Date(r.created_at), 'dd MMM yyyy · HH:mm', { locale: locale === 'fr' ? fr : enUS })}
                    </p>
                  </div>
                  <span className="text-xs font-bold tabular-nums whitespace-nowrap hidden sm:inline">
                    {fmt(r.amount, locale)} {r.currency}
                  </span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${statusColor}`}>
                    {statusLabel}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-lg shrink-0"
                    onClick={() => downloadReceiptPDF(r, locale, fmt)}
                    title={isFr ? 'Télécharger PDF' : 'Download PDF'}
                  >
                    <Download className="w-3.5 h-3.5" />
                  </Button>
                </motion.div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};

export default PaymentPage;
