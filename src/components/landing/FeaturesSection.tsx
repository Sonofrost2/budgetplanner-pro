import { TrendingUp, PieChart, BarChart3, Users, Target, FileText } from 'lucide-react';
import { useLanguage } from '@/i18n/LanguageContext';
import { motion } from 'framer-motion';

const FeaturesSection = () => {
  const { t } = useLanguage();

  const features = [
    { icon: TrendingUp, ...t.features.tracking, gradient: 'from-primary/20 to-primary/5', iconBg: 'bg-primary/15', iconColor: 'text-primary' },
    { icon: PieChart, ...t.features.budgets, gradient: 'from-secondary/20 to-secondary/5', iconBg: 'bg-secondary/15', iconColor: 'text-secondary' },
    { icon: BarChart3, ...t.features.forecasts, gradient: 'from-accent/20 to-accent/5', iconBg: 'bg-accent/15', iconColor: 'text-accent' },
    { icon: Users, ...t.features.family, gradient: 'from-primary/20 to-primary/5', iconBg: 'bg-primary/15', iconColor: 'text-primary' },
    { icon: Target, ...t.features.savings, gradient: 'from-secondary/20 to-secondary/5', iconBg: 'bg-secondary/15', iconColor: 'text-secondary' },
    { icon: FileText, ...t.features.reports, gradient: 'from-accent/20 to-accent/5', iconBg: 'bg-accent/15', iconColor: 'text-accent' },
  ];

  return (
    <section id="features" className="py-28 relative overflow-hidden">
      {/* Subtle bg */}
      <div className="absolute inset-0 bg-muted/30" />
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-20"
        >
          <span className="inline-block px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider bg-primary/10 text-primary mb-4">
            {t.nav.features}
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold">{t.features.sectionTitle}</h2>
          <p className="mt-5 text-lg text-muted-foreground max-w-2xl mx-auto">{t.features.sectionSubtitle}</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="group relative p-7 rounded-2xl bg-card border border-border/50 hover:border-primary/30 transition-all duration-500 hover:shadow-[var(--shadow-elevated)] hover:-translate-y-1"
            >
              {/* Gradient overlay on hover */}
              <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
              
              <div className="relative">
                <div className={`w-14 h-14 rounded-2xl ${feature.iconBg} flex items-center justify-center mb-5 transition-transform duration-300 group-hover:scale-110`}>
                  <feature.icon className={`w-7 h-7 ${feature.iconColor}`} />
                </div>
                <h3 className="text-lg font-bold mb-2.5">{feature.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{feature.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
