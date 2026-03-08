import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/i18n/LanguageContext';
import { useProfile } from '@/hooks/useProfile';
import { dashT } from '@/i18n/dashTranslations';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Check, X, Crown, Zap, Loader2, AlertCircle, Star } from 'lucide-react';
import { toast } from 'sonner';

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
  }, [user]);

  const getPrice = (plan: Plan) => {
    const price = plan.currency_prices[currency] ?? plan.base_price;
    return annual ? Math.round(price * 0.8 * 100) / 100 : price;
  };

  const handleSubscribe = async (plan: Plan) => {
    if (!user) return;
    setSubscribing(plan.id);
    try {
      const price = getPrice(plan);
      const desc = t.subscriptionDesc(plan.name);

      const { data, error } = await supabase.functions.invoke('paydunya-checkout', {
        body: {
          action: 'create',
          amount: price,
          description: desc,
          return_url: window.location.origin + '/dashboard/payment?success=true&plan=' + plan.id,
          cancel_url: window.location.origin + '/dashboard/payment?canceled=true',
        },
      });

      if (error) throw error;

      if (data?.response_code === '00' && data?.response_text) {
        await supabase.from('subscriptions').insert({
          user_id: user.id,
          plan_id: plan.id,
          status: 'pending',
          payment_method: 'paydunya',
          last_payment_token: data.token || null,
        });

        await supabase.from('payment_receipts').insert({
          user_id: user.id,
          plan_name: plan.name,
          amount: price,
          currency,
          status: 'pending',
          payment_token: data.token || null,
        });

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
    const { error } = await supabase.from('subscriptions').update({
      status: 'canceled',
      canceled_at: new Date().toISOString(),
    }).eq('id', subscription.id);
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
        const { data: pendingSubs } = await supabase.from('subscriptions')
          .select('*').eq('user_id', user.id).eq('status', 'pending')
          .order('created_at', { ascending: false }).limit(1);

        if (pendingSubs && pendingSubs.length > 0) {
          await supabase.from('subscriptions').update({
            status: 'active',
            current_period_start: new Date().toISOString(),
            current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          }).eq('id', pendingSubs[0].id);

          if (pendingSubs[0].last_payment_token) {
            await supabase.from('payment_receipts').update({ status: 'confirmed' })
              .eq('payment_token', pendingSubs[0].last_payment_token).eq('user_id', user.id);
          }

          setSubscription({ ...pendingSubs[0], status: 'active' } as Subscription);
          toast.success(t.subscriptionActivated);
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
        <Skeleton className="h-8 w-48" />
        <div className="grid md:grid-cols-3 gap-6">
          <Skeleton className="h-96" /><Skeleton className="h-96" /><Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  const PlanCard = ({ plan, icon, isCurrent, isHighlighted, disabledFeatures }: {
    plan: Plan | undefined;
    icon: React.ReactNode;
    isCurrent: boolean;
    isHighlighted?: boolean;
    disabledFeatures?: string[];
  }) => {
    if (!plan) return null;
    const price = getPrice(plan);
    const originalPrice = plan.currency_prices[currency] ?? plan.base_price;
    return (
      <Card className={`relative overflow-hidden ${isHighlighted ? 'border-primary border-2' : 'border-border'}`}>
        {isHighlighted && <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 rounded-bl-full" />}
        {isCurrent && (
          <div className="absolute -top-3 left-4">
            <Badge className="text-xs bg-primary text-primary-foreground">
              {t.currentPlan}
            </Badge>
          </div>
        )}
        {plan.trial_days > 0 && !isCurrent && (
          <div className="absolute -top-3 right-4">
            <Badge variant="destructive" className="text-xs">
              {plan.trial_days} {t.daysTrial}
            </Badge>
          </div>
        )}
        <CardHeader className="pb-4">
          <CardTitle className="text-xl flex items-center gap-2">
            {icon}
            <span className="capitalize">{plan.name === 'free' ? t.freePlan : plan.name.charAt(0).toUpperCase() + plan.name.slice(1)}</span>
          </CardTitle>
          <div className="pt-2">
            <span className="text-4xl font-bold">{price === 0 ? '0' : fmt(price, locale).replace(/\s/g, ' ')}</span>
            <span className="text-muted-foreground text-sm ml-1">
              {currency}/{annual ? t.perMonthAnnual : t.perMonth}
            </span>
          </div>
          {annual && price > 0 && (
            <p className="text-xs text-muted-foreground line-through">{fmt(originalPrice, locale)}/{t.perMonth}</p>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {plan.features.map((f, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <Check className={`w-4 h-4 flex-shrink-0 ${isHighlighted ? 'text-primary' : 'text-secondary'}`} />
              <span className={isHighlighted ? 'font-medium' : ''}>{f}</span>
            </div>
          ))}
          {(disabledFeatures || []).map((f, i) => (
            <div key={`d-${i}`} className="flex items-center gap-2 text-sm text-muted-foreground/50">
              <X className="w-4 h-4 flex-shrink-0" />
              <span className="line-through">{f}</span>
            </div>
          ))}
        </CardContent>
        <CardFooter>
          {isCurrent ? (
            <div className="w-full space-y-2">
              <Button className="w-full" disabled>
                {t.currentPlan}
              </Button>
              {plan.name !== 'free' && (
                <Button variant="outline" size="sm" className="w-full" onClick={handleCancel} disabled={canceling}>
                  {canceling ? <Loader2 className="w-4 h-4 animate-spin" /> : t.cancelLabel}
                </Button>
              )}
            </div>
          ) : plan.name === 'free' ? (
            <Button variant="outline" className="w-full" disabled>
              {t.included}
            </Button>
          ) : (
            <Button
              className={`w-full ${isHighlighted ? 'text-primary-foreground' : ''}`}
              style={isHighlighted ? { background: 'var(--gradient-primary)' } : undefined}
              variant={isHighlighted ? 'default' : 'outline'}
              onClick={() => handleSubscribe(plan)}
              disabled={subscribing === plan.id}
            >
              {subscribing === plan.id && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t.subscribeTo(plan.name.charAt(0).toUpperCase() + plan.name.slice(1))}
            </Button>
          )}
        </CardFooter>
      </Card>
    );
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold font-display">{t.choosePlan}</h2>
        <p className="text-muted-foreground max-w-lg mx-auto">{t.choosePlanDesc}</p>
      </div>

      {/* Annual toggle */}
      <div className="flex items-center justify-center gap-4">
        <span className={`text-sm font-medium ${!annual ? 'text-foreground' : 'text-muted-foreground'}`}>
          {t.monthly}
        </span>
        <button
          onClick={() => setAnnual(!annual)}
          className={`relative w-14 h-7 rounded-full transition-colors ${annual ? 'bg-primary' : 'bg-muted-foreground/30'}`}
        >
          <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${annual ? 'translate-x-7' : 'translate-x-0.5'}`} />
        </button>
        <span className={`text-sm font-medium ${annual ? 'text-foreground' : 'text-muted-foreground'}`}>
          {t.yearly}
        </span>
        {annual && <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded-full">-20%</span>}
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <PlanCard plan={freePlan} icon={<Zap className="w-5 h-5 text-muted-foreground" />} isCurrent={!subscription || subscription.status !== 'active'} disabledFeatures={[...t.freeExcluded]} />
        <PlanCard plan={proPlan} icon={<Star className="w-5 h-5 text-primary" />} isCurrent={currentPlanId === proPlan?.id && subscription?.status === 'active'} isHighlighted disabledFeatures={[...t.proExcluded]} />
        <PlanCard plan={premiumPlan} icon={<Crown className="w-5 h-5 text-primary" />} isCurrent={currentPlanId === premiumPlan?.id && subscription?.status === 'active'} />
      </div>

      <Card className="border-none shadow-[var(--shadow-card)]">
        <CardContent className="flex flex-wrap items-center justify-center gap-4 py-4">
          <p className="text-sm text-muted-foreground">{t.paymentMethods}</p>
          {['🟠 Orange Money', '🟡 MTN Money', '🔵 Moov Money', '🌊 Wave', '💳 Carte bancaire'].map(m => (
            <Badge key={m} variant="secondary" className="text-xs">{m}</Badge>
          ))}
        </CardContent>
      </Card>

      <div className="text-center text-xs text-muted-foreground space-y-1">
        <p className="flex items-center justify-center gap-1">
          <AlertCircle className="w-3 h-3" />
          {t.cancelAnytime}
        </p>
      </div>
    </div>
  );
};

export default PaymentPage;
