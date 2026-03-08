import { useEffect, useState } from 'react';
import { Check, X, Sparkles, Crown, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/i18n/LanguageContext';
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
  const { t } = useLanguage();
  const { formatPrice, loading: geoLoading } = useGeolocatedCurrency();
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
      <section id="pricing" className="py-28">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <Skeleton className="h-10 w-64 mx-auto" />
            <Skeleton className="h-5 w-96 mx-auto mt-4" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <Skeleton className="h-[500px] rounded-2xl" />
            <Skeleton className="h-[500px] rounded-2xl" />
            <Skeleton className="h-[500px] rounded-2xl" />
          </div>
        </div>
      </section>
    );
  }

  const getDisplayPrice = (plan: Plan) => {
    if (plan.name === 'free') {
      const base = formatPrice(plan.currency_prices);
      const currency = base?.currency || 'EUR';
      const isCfa = currency === 'XOF' || currency === 'XAF';
      const formatted = isCfa ? '0 CFA' : currency === 'EUR' ? '0 €' : currency === 'USD' ? '0 $' : currency === 'GBP' ? '0 £' : `0 ${currency}`;
      return { amount: 0, formatted, currency };
    }
    const base = formatPrice(plan.currency_prices);
    if (!base || base.amount === 0) return base;
    if (!annual) return base;
    // Apply 20% discount for annual
    const discounted = Math.round(base.amount * 0.8 * 100) / 100;
    const { currency } = base;
    const isCfa = currency === 'XOF' || currency === 'XAF';
    const formatted = isCfa
      ? `${Math.round(discounted).toLocaleString('fr-FR')} CFA`
      : `${discounted.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} ${currency === 'EUR' ? '€' : currency === 'USD' ? '$' : currency === 'GBP' ? '£' : currency}`;
    return { amount: discounted, formatted, currency };
  };

  const proPrice = proPlan ? getDisplayPrice(proPlan) : null;
  const premiumPrice = premiumPlan ? getDisplayPrice(premiumPlan) : null;

  const planCards = [
    {
      plan: freePlan,
      name: t.pricing.free,
      icon: Zap,
      price: { formatted: '0' },
      desc: t.pricing.freeDesc,
      cta: t.pricing.ctaFree,
      featured: false,
      features: freePlan?.features || [],
      excluded: t.pricing.excludedFree as readonly string[],
      trial: 0,
    },
    {
      plan: proPlan,
      name: 'Pro',
      icon: Sparkles,
      price: proPrice,
      desc: '',
      cta: t.pricing.ctaPro,
      featured: true,
      features: proPlan?.features || [],
      excluded: t.pricing.excludedPro as readonly string[],
      trial: proPlan?.trial_days || 0,
    },
    {
      plan: premiumPlan,
      name: 'Premium',
      icon: Crown,
      price: premiumPrice,
      desc: '',
      cta: t.pricing.ctaPremium,
      featured: false,
      features: premiumPlan?.features || [],
      excluded: [] as string[],
      trial: premiumPlan?.trial_days || 0,
    },
  ];

  return (
    <section id="pricing" className="py-28 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-muted/20 to-transparent" />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <span className="inline-block px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider bg-accent/10 text-accent mb-4">
            {t.pricing.badge}
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold">{t.pricing.sectionTitle}</h2>
          <p className="mt-5 text-lg text-muted-foreground max-w-2xl mx-auto">{t.pricing.sectionSubtitle}</p>
        </motion.div>

        {/* Annual toggle */}
        <div className="flex items-center justify-center gap-4 mb-14">
          <span className={`text-sm font-semibold transition-colors ${!annual ? 'text-foreground' : 'text-muted-foreground'}`}>
            {t.pricing.monthly}
          </span>
          <button
            onClick={() => setAnnual(!annual)}
            className={`relative w-14 h-7 rounded-full transition-all duration-300 ${annual ? 'bg-primary shadow-[0_0_12px_hsl(var(--primary)/0.4)]' : 'bg-muted-foreground/25'}`}
          >
            <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-transform duration-300 ${annual ? 'translate-x-7' : 'translate-x-0.5'}`} />
          </button>
          <span className={`text-sm font-semibold transition-colors ${annual ? 'text-foreground' : 'text-muted-foreground'}`}>
            {t.pricing.annual}
          </span>
          {annual && (
            <motion.span
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-xs font-bold text-primary-foreground px-3 py-1 rounded-full"
              style={{ background: 'var(--gradient-primary)' }}
            >
              -20%
            </motion.span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto items-start">
          {planCards.map((card, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className={`relative rounded-2xl p-px ${card.featured
                ? 'bg-gradient-to-b from-primary/50 to-primary/10 shadow-[var(--shadow-elevated)]'
                : ''
              }`}
            >
              {card.featured && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                  <span className="px-5 py-1.5 rounded-full text-xs font-bold text-primary-foreground shadow-lg" style={{ background: 'var(--gradient-primary)' }}>
                    {t.pricing.popular}
                  </span>
                </div>
              )}

              <div className={`rounded-2xl p-7 h-full bg-card ${card.featured ? '' : 'border border-border/50'}`}>
                {/* Header */}
                <div className="flex items-center gap-3 mb-5">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${card.featured ? 'bg-primary/15' : 'bg-muted'}`}>
                    <card.icon className={`w-5 h-5 ${card.featured ? 'text-primary' : 'text-muted-foreground'}`} />
                  </div>
                  <h3 className="text-xl font-bold">{card.name}</h3>
                </div>

                {/* Price */}
                <div className="mb-6">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
                    <span className="text-3xl sm:text-4xl font-extrabold">{card.price?.formatted ?? '—'}</span>
                    {card.plan?.name !== 'free' && (
                      <span className="text-sm text-muted-foreground font-medium whitespace-nowrap">
                        {annual ? t.pricing.perMonthAnnual : t.pricing.perMonth}
                      </span>
                    )}
                  </div>
                  {annual && card.plan && card.plan.name !== 'free' && (
                    <p className="mt-1 text-xs text-muted-foreground line-through">
                      {formatPrice(card.plan.currency_prices)?.formatted} {t.pricing.perMonth}
                    </p>
                  )}
                  {card.trial > 0 && (
                    <p className="mt-2 text-xs font-semibold text-primary bg-primary/10 inline-block px-3 py-1 rounded-full">
                      {card.trial} {t.pricing.trialDays}
                    </p>
                  )}
                </div>

                {/* Features */}
                <ul className="space-y-3 mb-8">
                  {card.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm">
                      <div className="w-5 h-5 rounded-full bg-secondary/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Check className="w-3 h-3 text-secondary" />
                      </div>
                      <span>{f}</span>
                    </li>
                  ))}
                  {card.excluded.map((f, i) => (
                    <li key={`ex-${i}`} className="flex items-start gap-3 text-sm text-muted-foreground/50">
                      <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                        <X className="w-3 h-3 text-muted-foreground/40" />
                      </div>
                      <span className="line-through">{f}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <Link to="/signup" className="block">
                  {card.featured ? (
                    <Button className="w-full h-11 text-primary-foreground font-semibold rounded-xl shadow-md hover:shadow-lg transition-shadow" style={{ background: 'var(--gradient-primary)' }}>
                      {card.cta}
                    </Button>
                  ) : (
                    <Button variant="outline" className="w-full h-11 font-semibold rounded-xl">
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
