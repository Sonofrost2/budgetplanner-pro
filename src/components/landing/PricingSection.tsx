import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
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
  const premiumPlan = plans.find(p => p.name === 'premium');

  if (loading || geoLoading) {
    return (
      <section id="pricing" className="py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <Skeleton className="h-10 w-64 mx-auto" />
            <Skeleton className="h-5 w-96 mx-auto mt-4" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <Skeleton className="h-96 rounded-2xl" />
            <Skeleton className="h-96 rounded-2xl" />
          </div>
        </div>
      </section>
    );
  }

  const premiumPrice = premiumPlan ? formatPrice(premiumPlan.currency_prices) : null;

  return (
    <section id="pricing" className="py-24">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold">{t.pricing.sectionTitle}</h2>
          <p className="mt-4 text-lg text-muted-foreground">{t.pricing.sectionSubtitle}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Free */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="p-8 rounded-2xl border border-border bg-card"
          >
            <h3 className="text-xl font-bold">{t.pricing.free}</h3>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-4xl font-bold">0</span>
              <span className="text-muted-foreground">{t.pricing.perMonth}</span>
            </div>
            <ul className="mt-8 space-y-4">
              {(freePlan?.features || []).map((f, i) => (
                <li key={i} className="flex items-center gap-3 text-sm">
                  <Check className="w-4 h-4 text-secondary flex-shrink-0" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <Link to="/signup" className="block mt-8">
              <Button variant="outline" className="w-full">{t.pricing.ctaFree}</Button>
            </Link>
          </motion.div>

          {/* Premium */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="relative p-8 rounded-2xl border-2 border-primary bg-card shadow-[var(--shadow-elevated)]"
          >
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold text-primary-foreground" style={{ background: 'var(--gradient-primary)' }}>
              {t.pricing.popular}
            </span>
            <h3 className="text-xl font-bold">{t.pricing.premium}</h3>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-4xl font-bold">{premiumPrice?.formatted ?? '—'}</span>
              <span className="text-muted-foreground">{t.pricing.perMonth}</span>
            </div>
            <p className="mt-2 text-xs text-primary font-medium">{t.pricing.trialNote}</p>
            <ul className="mt-6 space-y-4">
              {(premiumPlan?.features || []).map((f, i) => (
                <li key={i} className="flex items-center gap-3 text-sm">
                  <Check className="w-4 h-4 text-primary flex-shrink-0" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <Link to="/signup" className="block mt-8">
              <Button className="w-full text-primary-foreground" style={{ background: 'var(--gradient-primary)' }}>
                {t.pricing.ctaPremium}
              </Button>
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default PricingSection;
