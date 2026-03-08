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
import { Check, X, Crown, Zap, Loader2, AlertCircle } from 'lucide-react';
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
  const [subscribing, setSubscribing] = useState(false);
  const [canceling, setCanceling] = useState(false);

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
    const prices = plan.currency_prices;
    return prices[currency] ?? plan.base_price;
  };

  const handleSubscribe = async (plan: Plan) => {
    if (!user) return;
    setSubscribing(true);
    try {
      const price = getPrice(plan);
      const desc = locale === 'fr'
        ? `Abonnement ${plan.name} - Budget Planner Pro`
        : `${plan.name} Subscription - Budget Planner Pro`;

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
        // Save pending subscription
        await supabase.from('subscriptions').insert({
          user_id: user.id,
          plan_id: plan.id,
          status: 'pending',
          payment_method: 'paydunya',
          last_payment_token: data.token || null,
        });

        // Also save receipt
        await supabase.from('payment_receipts').insert({
          user_id: user.id,
          plan_name: plan.name,
          amount: price,
          currency,
          status: 'pending',
          payment_token: data.token || null,
        });

        window.open(data.response_text, '_blank');
        toast.success(locale === 'fr' ? 'Redirection vers le paiement...' : 'Redirecting to payment...');
      } else {
        toast.error(data?.response_text || (locale === 'fr' ? 'Erreur lors de la création du paiement' : 'Error creating payment'));
      }
    } catch (err: any) {
      toast.error(err.message || 'Error');
    } finally {
      setSubscribing(false);
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
    toast.success(locale === 'fr' ? 'Abonnement résilié. Accès actif jusqu\'à la fin de la période.' : 'Subscription canceled. Access active until end of period.');
    setSubscription({ ...subscription, status: 'canceled', canceled_at: new Date().toISOString() });
  };

  // Check URL params for payment return
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'true' && params.get('plan')) {
      // Confirm pending subscription
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

          // Confirm receipt
          if (pendingSubs[0].last_payment_token) {
            await supabase.from('payment_receipts').update({ status: 'confirmed' })
              .eq('payment_token', pendingSubs[0].last_payment_token).eq('user_id', user.id);
          }

          setSubscription({ ...pendingSubs[0], status: 'active' } as Subscription);
          toast.success(locale === 'fr' ? '🎉 Abonnement Premium activé !' : '🎉 Premium subscription activated!');
        }
        // Clean URL
        window.history.replaceState({}, '', '/dashboard/payment');
      };
      confirmSub();
    }
    if (params.get('canceled') === 'true') {
      toast.info(locale === 'fr' ? 'Paiement annulé' : 'Payment canceled');
      window.history.replaceState({}, '', '/dashboard/payment');
    }
  }, [user, locale]);

  const freePlan = plans.find(p => p.name === 'free');
  const premiumPlan = plans.find(p => p.name === 'premium');
  const isSubscribed = subscription?.status === 'active' && subscription?.plan_id === premiumPlan?.id;

  const freeFeatures = freePlan?.features || [];
  const premiumFeatures = premiumPlan?.features || [];

  // Features the free plan DOESN'T have (shown as X)
  const freeDisabled = locale === 'fr'
    ? ['Comptes illimités', 'Budgets illimités', 'Catégories illimitées', 'Prévisions IA', 'Rapports avancés & exports', 'Gestion familiale', "Objectifs d'épargne", 'Support prioritaire']
    : ['Unlimited accounts', 'Unlimited budgets', 'Unlimited categories', 'AI Forecasts', 'Advanced reports & exports', 'Family management', 'Savings goals', 'Priority support'];

  if (loading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <div className="grid md:grid-cols-2 gap-6">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold font-display">
          {locale === 'fr' ? 'Choisissez votre plan' : 'Choose your plan'}
        </h2>
        <p className="text-muted-foreground max-w-lg mx-auto">
          {locale === 'fr'
            ? 'Débloquez toutes les fonctionnalités pour maîtriser vos finances'
            : 'Unlock all features to master your finances'}
        </p>
      </div>

      {/* Current subscription status */}
      {isSubscribed && (
        <Card className="border-secondary/30 bg-secondary/5">
          <CardContent className="flex items-center gap-3 py-4">
            <Crown className="w-5 h-5 text-secondary" />
            <div className="flex-1">
              <p className="font-semibold text-sm">
                {locale === 'fr' ? 'Abonnement Premium actif' : 'Active Premium subscription'}
              </p>
              <p className="text-xs text-muted-foreground">
                {locale === 'fr' ? 'Prochain renouvellement :' : 'Next renewal:'}{' '}
                {new Date(subscription!.current_period_end).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US')}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={handleCancel} disabled={canceling}>
              {canceling ? <Loader2 className="w-4 h-4 animate-spin" /> : (locale === 'fr' ? 'Résilier' : 'Cancel')}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Free Plan */}
        <Card className="border-border relative">
          {!isSubscribed && !subscription && (
            <div className="absolute -top-3 left-4">
              <Badge variant="secondary" className="text-xs">
                {locale === 'fr' ? 'Plan actuel' : 'Current plan'}
              </Badge>
            </div>
          )}
          <CardHeader className="pb-4">
            <CardTitle className="text-xl flex items-center gap-2">
              <Zap className="w-5 h-5 text-muted-foreground" />
              {locale === 'fr' ? 'Gratuit' : 'Free'}
            </CardTitle>
            <CardDescription>
              {locale === 'fr' ? 'Pour découvrir l\'application' : 'To discover the app'}
            </CardDescription>
            <div className="pt-2">
              <span className="text-4xl font-bold">0</span>
              <span className="text-muted-foreground text-sm ml-1">{currency}/{locale === 'fr' ? 'mois' : 'mo'}</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {freeFeatures.map((f, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <Check className="w-4 h-4 text-secondary flex-shrink-0" />
                <span>{f}</span>
              </div>
            ))}
            {freeDisabled.map((f, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground/50">
                <X className="w-4 h-4 flex-shrink-0" />
                <span className="line-through">{f}</span>
              </div>
            ))}
          </CardContent>
          <CardFooter>
            <Button variant="outline" className="w-full" disabled>
              {locale === 'fr' ? 'Plan actuel' : 'Current plan'}
            </Button>
          </CardFooter>
        </Card>

        {/* Premium Plan */}
        <Card className="border-primary relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 rounded-bl-full" />
          {isSubscribed && (
            <div className="absolute -top-3 left-4">
              <Badge className="text-xs bg-primary text-primary-foreground">
                {locale === 'fr' ? 'Plan actuel' : 'Current plan'}
              </Badge>
            </div>
          )}
          {premiumPlan?.trial_days ? (
            <div className="absolute -top-3 right-4">
              <Badge variant="destructive" className="text-xs">
                {premiumPlan.trial_days} {locale === 'fr' ? 'jours d\'essai' : 'days trial'}
              </Badge>
            </div>
          ) : null}
          <CardHeader className="pb-4">
            <CardTitle className="text-xl flex items-center gap-2">
              <Crown className="w-5 h-5 text-primary" />
              Premium
            </CardTitle>
            <CardDescription>
              {locale === 'fr' ? 'Pour maîtriser ses finances' : 'To master your finances'}
            </CardDescription>
            <div className="pt-2">
              <span className="text-4xl font-bold">{premiumPlan ? fmt(getPrice(premiumPlan), locale).replace(/\s/g, ' ') : '—'}</span>
              <span className="text-muted-foreground text-sm ml-1">/{locale === 'fr' ? 'mois' : 'mo'}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {locale === 'fr' ? 'Prélèvement mensuel automatique' : 'Automatic monthly billing'}
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {premiumFeatures.map((f, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <Check className="w-4 h-4 text-primary flex-shrink-0" />
                <span className="font-medium">{f}</span>
              </div>
            ))}
          </CardContent>
          <CardFooter>
            {isSubscribed ? (
              <Button className="w-full" disabled>
                <Crown className="w-4 h-4 mr-2" />
                {locale === 'fr' ? 'Abonnement actif' : 'Active subscription'}
              </Button>
            ) : (
              <Button
                className="w-full text-primary-foreground"
                style={{ background: 'var(--gradient-primary)' }}
                onClick={() => premiumPlan && handleSubscribe(premiumPlan)}
                disabled={subscribing}
              >
                {subscribing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {locale === 'fr' ? 'Souscrire à Premium' : 'Subscribe to Premium'}
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>

      {/* Payment methods info */}
      <Card className="border-none shadow-[var(--shadow-card)]">
        <CardContent className="flex flex-wrap items-center justify-center gap-4 py-4">
          <p className="text-sm text-muted-foreground">
            {locale === 'fr' ? 'Moyens de paiement acceptés :' : 'Accepted payment methods:'}
          </p>
          {['🟠 Orange Money', '🟡 MTN Money', '🔵 Moov Money', '🌊 Wave', '💳 Carte bancaire'].map(m => (
            <Badge key={m} variant="secondary" className="text-xs">{m}</Badge>
          ))}
        </CardContent>
      </Card>

      <div className="text-center text-xs text-muted-foreground space-y-1">
        <p className="flex items-center justify-center gap-1">
          <AlertCircle className="w-3 h-3" />
          {locale === 'fr'
            ? 'Vous pouvez résilier à tout moment. L\'accès reste actif jusqu\'à la fin de la période payée.'
            : 'You can cancel anytime. Access remains active until the end of the paid period.'}
        </p>
      </div>
    </div>
  );
};

export default PaymentPage;
