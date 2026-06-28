import { useEffect, useState } from 'react';
import { Check, X, Sparkles, Crown, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/i18n/LanguageContext';
import { currencySymbol } from '@/lib/currency';
import { translateFeatures } from '@/lib/planFeatures';
import { useAuth } from '@/hooks/useAuth';
import { useGeolocatedCurrency } from '@/hooks/useGeolocatedCurrency';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';

type Plan = {
  id: string;
  name: string;
  base_price: number;
  currency_prices: Record<string, number>;
  trial_days: number;
  features: string[];
};

const PricingSection = () => {
  const { t, locale } = useLanguage();
  const { user } = useAuth();
  const { formatPrice, loading: geoLoading, detectedCurrency } = useGeolocatedCurrency();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [annual, setAnnual] = useState(false);

  useEffect(() => {
    supabase.from('subscription_plans').select('*').eq('active', true).order('base_price')
      .then(({ data }) => {
        setPlans((data || []).map(p => ({
          ...p,
          features: Array.isArray(p.features) ? p.features as string[] : [],
          currency_prices: (p.currency_prices || {}) as Record<string, number>,
        })));
        setLoading(false);
      });
  }, []);

  const freePlan = plans.find(p => p.name === 'free');
  const proPlan = plans.find(p => p.name === 'pro');
  const premiumPlan = plans.find(p => p.name === 'premium');

  if (loading || geoLoading) {
    return (
      <section id="pricing" className="py-24">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-14">
            <Skeleton className="h-10 w-64 mx-auto" />
            <Skeleton className="h-4 w-80 mx-auto mt-4" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Skeleton className="h-[440px] rounded-2xl" />
            <Skeleton className="h-[440px] rounded-2xl" />
            <Skeleton className="h-[440px] rounded-2xl" />
          </div>
        </div>
      </section>
    );
  }

  const getDisplayPrice = (plan: Plan) => {
    if (plan.name === 'free') {
      const formatted = `0 ${currencySymbol(detectedCurrency)}`;
      return { amount: 0, formatted, currency: detectedCurrency, monthlyEquivalent: '' };
    }
    const base = formatPrice(plan.currency_prices);
    if (!base || base.amount === 0) return { ...base, monthlyEquivalent: '' };
    if (!annual) return { ...base, monthlyEquivalent: '' };

    const { currency } = base;
    // Annual: shared pricing helpers ensure parity with PaymentPage.
    const monthlyDiscounted = getDiscountedMonthly(base.amount, currency);
    const totalAnnual = getAnnualTotal(base.amount, currency);
    const isCfa = currency === 'XOF' || currency === 'XAF' || currency === 'GNF';
    const symbol = currencySymbol(currency);
    const formatted = isCfa
      ? `${totalAnnual.toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-US')} ${symbol}`
      : `${totalAnnual.toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-US', { minimumFractionDigits: 2 })} ${symbol}`;
    const monthlyFormatted = isCfa
      ? `${Math.round(monthlyDiscounted).toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-US')} ${symbol}`
      : `${monthlyDiscounted.toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-US', { minimumFractionDigits: 2 })} ${symbol}`;
    return { amount: totalAnnual, formatted, currency, monthlyEquivalent: monthlyFormatted };
  };

  const planCards = [
    {
      plan: freePlan, name: t.pricing.free, icon: Zap,
      price: freePlan ? getDisplayPrice(freePlan) : { formatted: '0', monthlyEquivalent: '' },
      cta: t.pricing.ctaFree, featured: false,
      features: translateFeatures(freePlan?.features || [], locale),
      excluded: t.pricing.excludedFree as readonly string[],
      trial: 0,
    },
    {
      plan: proPlan, name: 'Pro', icon: Sparkles,
      price: proPlan ? getDisplayPrice(proPlan) : null,
      cta: t.pricing.ctaPro, featured: true,
      features: translateFeatures(proPlan?.features || [], locale),
      excluded: t.pricing.excludedPro as readonly string[],
      trial: proPlan?.trial_days || 0,
    },
    {
      plan: premiumPlan, name: 'Premium', icon: Crown,
      price: premiumPlan ? getDisplayPrice(premiumPlan) : null,
      cta: t.pricing.ctaPremium, featured: false,
      features: translateFeatures(premiumPlan?.features || [], locale),
      excluded: [] as string[],
      trial: premiumPlan?.trial_days || 0,
    },
  ];

  return (
    <section id="pricing" className="py-24 relative">
      <div className="absolute inset-0 mesh-bg opacity-30" />

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider glass text-accent mb-4">
            {t.pricing.badge}
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold">{t.pricing.sectionTitle}</h2>
          <p className="mt-4 text-base text-muted-foreground max-w-xl mx-auto">{t.pricing.sectionSubtitle}</p>
        </motion.div>

        {/* Toggle */}
        <div className="flex items-center justify-center gap-3 mb-12">
          <span className={`text-xs font-semibold ${!annual ? 'text-foreground' : 'text-muted-foreground'}`}>{t.pricing.monthly}</span>
          <button
            onClick={() => setAnnual(!annual)}
            className={`relative w-12 h-6 rounded-full transition-all ${annual ? 'bg-primary shadow-[0_0_10px_hsl(var(--primary)/0.3)]' : 'bg-muted-foreground/20'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-primary-foreground shadow transition-transform ${annual ? 'translate-x-6' : 'translate-x-0'}`} />
          </button>
          <span className={`text-xs font-semibold ${annual ? 'text-foreground' : 'text-muted-foreground'}`}>{t.pricing.annual}</span>
          {annual && (
            <motion.span initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
              className="text-[10px] font-bold text-primary-foreground px-2.5 py-0.5 rounded-full" style={{ background: 'var(--gradient-primary)' }}>
              -20%
            </motion.span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
          {planCards.map((card, idx) => (
            <motion.div key={idx} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: idx * 0.08 }}
              className={`relative rounded-2xl ${card.featured ? 'p-px' : ''}`}
              style={card.featured ? { background: 'var(--gradient-primary)' } : {}}
            >
              {card.featured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                  <span className="px-4 py-1 rounded-full text-[10px] font-bold text-primary-foreground shadow-md" style={{ background: 'var(--gradient-primary)' }}>
                    {t.pricing.popular}
                  </span>
                </div>
              )}

              <div className={`rounded-2xl p-6 h-full ${card.featured ? 'bg-card' : 'glass'}`}>
                <div className="flex items-center gap-2.5 mb-4">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${card.featured ? 'bg-primary/15' : 'bg-muted/60'}`}>
                    <card.icon className={`w-4 h-4 ${card.featured ? 'text-primary' : 'text-muted-foreground'}`} />
                  </div>
                  <h3 className="text-lg font-bold">{card.name}</h3>
                </div>

                <div className="mb-5">
                  <div className="flex flex-wrap items-baseline gap-x-1.5">
                    <span className="text-3xl font-extrabold">{card.price?.formatted ?? '—'}</span>
                    {card.plan?.name !== 'free' && (
                      <span className="text-xs text-muted-foreground">{annual ? '/an' : t.pricing.perMonth}</span>
                    )}
                  </div>
                  {annual && card.price?.monthlyEquivalent && (
                    <p className="text-[11px] text-muted-foreground mt-1">
                      ≈ {card.price.monthlyEquivalent}{t.pricing.perMonth}
                    </p>
                  )}
                  {card.trial > 0 && (
                    <p className="mt-2 text-[10px] font-semibold text-primary bg-primary/10 inline-block px-2.5 py-0.5 rounded-full">
                      {card.trial} {t.pricing.trialDays}
                    </p>
                  )}
                </div>

                <ul className="space-y-2.5 mb-6">
                  {card.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-xs">
                      <div className="w-4 h-4 rounded-full bg-secondary/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Check className="w-2.5 h-2.5 text-secondary" />
                      </div>
                      <span>{f}</span>
                    </li>
                  ))}
                  {card.excluded.map((f, i) => (
                    <li key={`ex-${i}`} className="flex items-start gap-2.5 text-xs text-muted-foreground/40">
                      <div className="w-4 h-4 rounded-full bg-muted/60 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <X className="w-2.5 h-2.5" />
                      </div>
                      <span className="line-through">{f}</span>
                    </li>
                  ))}
                </ul>

                <Link to={user ? "/dashboard/payment" : "/signup"} className="block">
                  {card.featured ? (
                    <Button className="w-full h-10 text-primary-foreground text-xs font-semibold rounded-xl shadow-md hover:shadow-lg transition-all hover:scale-[1.02]" style={{ background: 'var(--gradient-primary)' }}>
                      {card.cta}
                    </Button>
                  ) : (
                    <Button variant="outline" className="w-full h-10 text-xs font-semibold rounded-xl glass border-glass-border hover:bg-glass-hover">
                      {card.cta}
                    </Button>
                  )}
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PricingSection;
