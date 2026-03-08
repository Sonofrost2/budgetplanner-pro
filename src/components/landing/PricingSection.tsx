import { Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/i18n/LanguageContext';
import { motion } from 'framer-motion';

const PricingSection = () => {
  const { t } = useLanguage();

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
              <span className="text-4xl font-bold">{t.pricing.freePlan.price}</span>
              <span className="text-muted-foreground">{t.pricing.perMonth}</span>
            </div>
            <ul className="mt-8 space-y-4">
              {t.pricing.freePlan.features.map((f, i) => (
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
              <span className="text-4xl font-bold">{t.pricing.premiumPlan.price}</span>
              <span className="text-muted-foreground">{t.pricing.perMonth}</span>
            </div>
            <p className="mt-2 text-xs text-primary font-medium">{t.pricing.trialNote}</p>
            <ul className="mt-6 space-y-4">
              {t.pricing.premiumPlan.features.map((f, i) => (
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
