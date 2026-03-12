import { TrendingUp, PieChart, BarChart3, Users, Target, FileText } from 'lucide-react';
import { useLanguage } from '@/i18n/LanguageContext';
import { motion } from 'framer-motion';

const FeaturesSection = () => {
  const { t } = useLanguage();

  const features = [
    { icon: TrendingUp, ...t.features.tracking, color: 'text-primary', glow: 'bg-primary/10' },
    { icon: PieChart, ...t.features.budgets, color: 'text-secondary', glow: 'bg-secondary/10' },
    { icon: BarChart3, ...t.features.forecasts, color: 'text-accent', glow: 'bg-accent/10' },
    { icon: Users, ...t.features.family, color: 'text-primary', glow: 'bg-primary/10' },
    { icon: Target, ...t.features.savings, color: 'text-secondary', glow: 'bg-secondary/10' },
    { icon: FileText, ...t.features.reports, color: 'text-accent', glow: 'bg-accent/10' },
  ];

  return (
    <section id="features" aria-label="Fonctionnalités" className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 mesh-bg opacity-50" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider glass text-primary mb-4">
            {t.nav.features}
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold">{t.features.sectionTitle}</h2>
          <p className="mt-4 text-base text-muted-foreground max-w-xl mx-auto">{t.features.sectionSubtitle}</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.06 }}
              className="group relative p-6 rounded-2xl glass hover:bg-glass-hover transition-all duration-300 hover:shadow-[var(--shadow-elevated)] hover:-translate-y-0.5"
            >
              <div className={`w-11 h-11 rounded-xl ${feature.glow} flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110`}>
                <feature.icon className={`w-5 h-5 ${feature.color}`} />
              </div>
              <h3 className="text-base font-bold mb-2">{feature.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
