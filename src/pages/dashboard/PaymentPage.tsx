import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/i18n/LanguageContext';
import { useProfile } from '@/hooks/useProfile';
import { dashT } from '@/i18n/dashTranslations';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Check, X, Crown, Zap, Loader2, AlertCircle, Star, Shield, Sparkles, Receipt, Clock, Download } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import jsPDF from 'jspdf';

const downloadReceiptPDF = (receipt: any, locale: string, fmtFn: (v: number, l: string) => string) => {
  const doc = new jsPDF({ unit: 'mm', format: 'a5' });
  const w = doc.internal.pageSize.getWidth();
  const isFr = locale === 'fr';
  const dateStr = format(new Date(receipt.created_at), 'dd MMMM yyyy · HH:mm', { locale: isFr ? fr : enUS });
  const amountStr = `${fmtFn(receipt.amount, locale)} ${receipt.currency}`;
  const statusLabel = receipt.status === 'confirmed' ? (isFr ? 'Confirmé' : 'Confirmed') : receipt.status;

  // Header band
  doc.setFillColor(99, 102, 241);
  doc.rect(0, 0, w, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Budget Planner', w / 2, 12, { align: 'center' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(isFr ? 'Reçu de paiement' : 'Payment Receipt', w / 2, 20, { align: 'center' });

  // Body
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
  if (receipt.payment_token) {
    addRow('Ref', receipt.payment_token);
  }

  // Footer
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
  canceled_at: string | null;
};

const PaymentPage = () => {
  const { user } = useAuth();
  const { locale } = useLanguage();
  const { currency, fmt } = useProfile();
  const t = dashT[locale];

  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [canceling, setCanceling] = useState(false);
  const [annual, setAnnual] = useState(false);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [receiptsLoading, setReceiptsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [plansRes, subRes] = await Promise.all([
        supabase.from('subscription_plans').select('*').eq('active', true).order('base_price', { ascending: true }),
        supabase.from('subscriptions').select('*').eq('user_id', user.id).eq('status', 'active').order('created_at', { ascending: false }).limit(1),
      ]);
      setPlans((plansRes.data || []).map(p => ({ ...p, features: Array.isArray(p.features) ? p.features as string[] : [], currency_prices: (p.currency_prices || {}) as Record<string, number> })));
      setSubscription(subRes.data && subRes.data.length > 0 ? subRes.data[0] as Subscription : null);
      setLoading(false);
    };
    load();

    // Load receipts
    supabase.from('payment_receipts').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20)
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
      const { data, error } = await supabase.functions.invoke('paydunya-checkout', {
        body: {
          action: 'create', amount: price, description: desc,
          return_url: window.location.origin + '/dashboard/payment?success=true&plan=' + plan.id,
          cancel_url: window.location.origin + '/dashboard/payment?canceled=true',
        },
      });
      if (error) throw error;
      if (data?.response_code === '00' && data?.response_text) {
        await supabase.from('subscriptions').insert({ user_id: user.id, plan_id: plan.id, status: 'pending', payment_method: 'paydunya', last_payment_token: data.token || null });
        await supabase.from('payment_receipts').insert({ user_id: user.id, plan_name: plan.name, amount: price, currency, status: 'pending', payment_token: data.token || null });
        window.open(data.response_text, '_blank');
        toast.success(t.redirectingPayment);
      } else {
        toast.error(data?.response_text || t.paymentError);
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
    if (params.get('success') === 'true' && params.get('plan')) {
      const confirmSub = async () => {
        if (!user) return;
        const { data: pendingSubs } = await supabase.from('subscriptions').select('*').eq('user_id', user.id).eq('status', 'pending').order('created_at', { ascending: false }).limit(1);
        if (pendingSubs && pendingSubs.length > 0) {
          await supabase.from('subscriptions').update({ status: 'active', current_period_start: new Date().toISOString(), current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() }).eq('id', pendingSubs[0].id);
          if (pendingSubs[0].last_payment_token) {
            await supabase.from('payment_receipts').update({ status: 'confirmed' }).eq('payment_token', pendingSubs[0].last_payment_token).eq('user_id', user.id);
          }
          setSubscription({ ...pendingSubs[0], status: 'active' } as Subscription);
          toast.success(t.subscriptionActivated);

          // Send payment confirmation email
          const planId = params.get('plan');
          const confirmedPlan = plans.find(p => p.id === planId);
          if (confirmedPlan) {
            const { data: profile } = await supabase.from('profiles').select('display_name').eq('user_id', user.id).single();
            supabase.functions.invoke('send-email', {
              body: {
                template: 'payment-confirmation',
                to: user.email,
                data: {
                  displayName: profile?.display_name || user.email,
                  planName: confirmedPlan.name,
                  amount: getPrice(confirmedPlan),
                  currency,
                },
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

  const freePlan = plans.find(p => p.name === 'free');
  const proPlan = plans.find(p => p.name === 'pro');
  const premiumPlan = plans.find(p => p.name === 'premium');
  const currentPlanId = subscription?.plan_id;

  if (loading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <Skeleton className="h-10 w-64 mx-auto" />
        <Skeleton className="h-4 w-80 mx-auto" />
        <div className="grid md:grid-cols-3 gap-6 mt-8">
          <Skeleton className="h-[480px] rounded-2xl" />
          <Skeleton className="h-[520px] rounded-2xl" />
          <Skeleton className="h-[480px] rounded-2xl" />
        </div>
      </div>
    );
  }

  const cardConfigs = [
    {
      plan: freePlan,
      icon: <Zap className="w-5 h-5" />,
      iconBg: 'bg-muted/60',
      iconColor: 'text-muted-foreground',
      isCurrent: !subscription || subscription.status !== 'active',
      isHighlighted: false,
      isPremium: false,
      disabledFeatures: [...t.freeExcluded],
    },
    {
      plan: proPlan,
      icon: <Star className="w-5 h-5" />,
      iconBg: 'bg-primary/15',
      iconColor: 'text-primary',
      isCurrent: currentPlanId === proPlan?.id && subscription?.status === 'active',
      isHighlighted: true,
      isPremium: false,
      disabledFeatures: [...t.proExcluded],
    },
    {
      plan: premiumPlan,
      icon: <Crown className="w-5 h-5" />,
      iconBg: 'bg-primary/15',
      iconColor: 'text-primary',
      isCurrent: currentPlanId === premiumPlan?.id && subscription?.status === 'active',
      isHighlighted: false,
      isPremium: true,
      disabledFeatures: [],
    },
  ];

  return (
    <div className="space-y-10 max-w-5xl mx-auto pb-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-center space-y-3"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass text-xs font-bold uppercase tracking-wider text-accent mb-2">
          <Sparkles className="w-3.5 h-3.5" />
          {locale === 'fr' ? 'Abonnement' : 'Subscription'}
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold font-display">{t.choosePlan}</h2>
        <p className="text-muted-foreground max-w-lg mx-auto text-sm">{t.choosePlanDesc}</p>
      </motion.div>

      {/* Toggle */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.3 }}
        className="flex items-center justify-center gap-3"
      >
        <span className={`text-xs font-semibold transition-colors ${!annual ? 'text-foreground' : 'text-muted-foreground'}`}>
          {t.monthly}
        </span>
        <button
          onClick={() => setAnnual(!annual)}
          className={`relative w-12 h-6 rounded-full transition-all duration-300 ${annual ? 'bg-primary shadow-[0_0_12px_hsl(var(--primary)/0.35)]' : 'bg-muted-foreground/20'}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-primary-foreground shadow-sm transition-transform duration-300 ${annual ? 'translate-x-6' : 'translate-x-0'}`} />
        </button>
        <span className={`text-xs font-semibold transition-colors ${annual ? 'text-foreground' : 'text-muted-foreground'}`}>
          {t.yearly}
        </span>
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
      </motion.div>

      {/* Plan Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start">
        {cardConfigs.map((config, idx) => {
          const { plan, icon, iconBg, iconColor, isCurrent, isHighlighted, isPremium, disabledFeatures } = config;
          if (!plan) return null;
          const price = getPrice(plan);

          return (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 + idx * 0.08, duration: 0.4 }}
              className={`relative rounded-2xl ${isHighlighted ? 'p-px md:-mt-2 md:mb-[-8px]' : ''}`}
              style={isHighlighted ? { background: 'var(--gradient-primary)' } : {}}
            >
              {/* Trial badge */}
              {plan.trial_days > 0 && !isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                  <span className="px-3 py-1 rounded-full text-[10px] font-bold text-primary-foreground shadow-lg" style={{ background: 'var(--gradient-primary)' }}>
                    {plan.trial_days} {t.daysTrial}
                  </span>
                </div>
              )}

              {/* Current plan badge */}
              {isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                  <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-secondary text-secondary-foreground shadow-lg">
                    {t.currentPlan}
                  </span>
                </div>
              )}

              <div className={`rounded-2xl p-6 h-full flex flex-col ${isHighlighted ? 'bg-card shadow-[0_8px_32px_hsl(var(--primary)/0.15)]' : 'glass'} transition-shadow duration-300 hover:shadow-[var(--shadow-card)]`}>
                {/* Icon + Name */}
                <div className="flex items-center gap-2.5 mb-5">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBg}`}>
                    <span className={iconColor}>{icon}</span>
                  </div>
                  <h3 className="text-lg font-bold capitalize">
                    {plan.name === 'free' ? t.freePlan : plan.name.charAt(0).toUpperCase() + plan.name.slice(1)}
                  </h3>
                </div>

                {/* Price */}
                <div className="mb-6">
                  <div className="flex flex-wrap items-baseline gap-x-1.5">
                    <span className="text-3xl sm:text-4xl font-extrabold tabular-nums">
                      {price === 0 ? '0' : fmt(price, locale).replace(/\s/g, '\u00A0')}
                    </span>
                    {plan.name !== 'free' && (
                      <span className="text-xs text-muted-foreground">
                        {currency}/{annual ? (locale === 'fr' ? 'an' : 'yr') : t.perMonth}
                      </span>
                    )}
                    {plan.name === 'free' && (
                      <span className="text-xs text-muted-foreground">
                        {currency}/{t.perMonth}
                      </span>
                    )}
                  </div>
                  {annual && price > 0 && (
                    <p className="text-[11px] text-muted-foreground mt-1">
                      ≈ {fmt(getMonthlyEquivalent(plan), locale)}{t.perMonth}
                    </p>
                  )}
                </div>

                {/* Separator */}
                <div className="h-px bg-border/50 mb-5" />

                {/* Features */}
                <ul className="space-y-2.5 flex-1 mb-6">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-xs">
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${isHighlighted || isPremium ? 'bg-primary/15' : 'bg-secondary/15'}`}>
                        <Check className={`w-2.5 h-2.5 ${isHighlighted || isPremium ? 'text-primary' : 'text-secondary'}`} />
                      </div>
                      <span className={isHighlighted ? 'font-medium' : ''}>{f}</span>
                    </li>
                  ))}
                  {disabledFeatures.map((f, i) => (
                    <li key={`d-${i}`} className="flex items-start gap-2.5 text-xs text-muted-foreground/40">
                      <div className="w-4 h-4 rounded-full bg-muted/60 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <X className="w-2.5 h-2.5" />
                      </div>
                      <span className="line-through">{f}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <div className="space-y-2 mt-auto">
                  {isCurrent ? (
                    <>
                      <Button className="w-full h-11 rounded-xl font-semibold text-xs" disabled>
                        {t.currentPlan}
                      </Button>
                      {plan.name !== 'free' && (
                        <Button variant="outline" size="sm" className="w-full rounded-xl glass border-border/50 text-xs" onClick={handleCancel} disabled={canceling}>
                          {canceling ? <Loader2 className="w-4 h-4 animate-spin" /> : t.cancelLabel}
                        </Button>
                      )}
                    </>
                  ) : plan.name === 'free' ? (
                    <Button variant="outline" className="w-full h-11 rounded-xl font-semibold text-xs glass border-border/50" disabled>
                      {t.included}
                    </Button>
                  ) : (
                    <Button
                      className={`w-full h-11 rounded-xl font-semibold text-xs transition-all hover:scale-[1.02] hover:shadow-lg ${isHighlighted ? 'text-primary-foreground shadow-md' : ''}`}
                      style={isHighlighted ? { background: 'var(--gradient-primary)' } : undefined}
                      variant={isHighlighted ? 'default' : 'outline'}
                      onClick={() => handleSubscribe(plan)}
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

      {/* Payment methods */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.35 }}
        className="glass rounded-2xl px-6 py-4 flex flex-wrap items-center justify-center gap-3"
      >
        <Shield className="w-4 h-4 text-muted-foreground" />
        <p className="text-xs text-muted-foreground font-medium">{t.paymentMethods}</p>
        <div className="flex flex-wrap gap-2">
          {['🟠 Orange Money', '🟡 MTN Money', '🔵 Moov Money', '🌊 Wave', '💳 Carte bancaire'].map(m => (
            <Badge key={m} variant="secondary" className="text-[10px] font-medium rounded-full px-2.5 py-0.5 bg-muted/50 border-0">
              {m}
            </Badge>
          ))}
        </div>
      </motion.div>

      {/* Payment History */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55, duration: 0.35 }}
        className="glass rounded-2xl overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-border/50 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Receipt className="w-4 h-4 text-primary" />
          </div>
          <h3 className="font-bold text-sm">{locale === 'fr' ? 'Historique des paiements' : 'Payment History'}</h3>
          <Badge variant="secondary" className="ml-auto text-[10px] rounded-full px-2 py-0.5">{receipts.length}</Badge>
        </div>

        {receiptsLoading ? (
          <div className="p-6 space-y-3">
            <Skeleton className="h-12 rounded-xl" />
            <Skeleton className="h-12 rounded-xl" />
            <Skeleton className="h-12 rounded-xl" />
          </div>
        ) : receipts.length === 0 ? (
          <div className="p-8 text-center">
            <Clock className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">{t.noReceipts}</p>
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {receipts.map((r, idx) => {
              const statusColor = r.status === 'confirmed'
                ? 'bg-secondary/15 text-secondary'
                : r.status === 'pending'
                  ? 'bg-amber-500/15 text-amber-600'
                  : 'bg-destructive/15 text-destructive';
              const statusLabel = r.status === 'confirmed'
                ? (locale === 'fr' ? 'Confirmé' : 'Confirmed')
                : r.status === 'pending'
                  ? (locale === 'fr' ? 'En attente' : 'Pending')
                  : r.status;

              return (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 * idx }}
                  className="px-6 py-3.5 flex items-center gap-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold capitalize truncate">
                      {locale === 'fr' ? 'Plan' : 'Plan'} {r.plan_name}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {format(new Date(r.created_at), 'dd MMM yyyy · HH:mm', { locale: locale === 'fr' ? fr : enUS })}
                    </p>
                  </div>
                  <span className="text-xs font-bold tabular-nums whitespace-nowrap">
                    {fmt(r.amount, locale)} {r.currency}
                  </span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusColor}`}>
                    {statusLabel}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-lg shrink-0"
                    onClick={() => downloadReceiptPDF(r, locale, fmt)}
                    title={locale === 'fr' ? 'Télécharger PDF' : 'Download PDF'}
                  >
                    <Download className="w-3.5 h-3.5" />
                  </Button>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* Footer note */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.65 }}
        className="text-center text-[11px] text-muted-foreground flex items-center justify-center gap-1.5"
      >
        <AlertCircle className="w-3 h-3" />
        {t.cancelAnytime}
      </motion.p>
    </div>
  );
};

export default PaymentPage;
