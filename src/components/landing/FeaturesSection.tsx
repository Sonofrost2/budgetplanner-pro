import { TrendingUp, PieChart, BarChart3, Users, Target, FileText } from 'lucide-react';
import { useLanguage } from '@/i18n/LanguageContext';
import { motion } from 'framer-motion';

const FeaturesSection = () => {
  const { t } = useLanguage();

  const features = [
    { icon: TrendingUp, ...t.features.tracking, color: 'text-primary', bg: 'bg-primary/10' },
    { icon: PieChart, ...t.features.budgets, color: 'text-secondary', bg: 'bg-secondary/10' },
    { icon: BarChart3, ...t.features.forecasts, color: 'text-accent', bg: 'bg-accent/10' },
    { icon: Users, ...t.features.family, color: 'text-primary', bg: 'bg-primary/10' },
    { icon: Target, ...t.features.savings, color: 'text-secondary', bg: 'bg-secondary/10' },
    { icon: FileText, ...t.features.reports, color: 'text-accent', bg: 'bg-accent/10' },
  ];

  return (
    <section id="features" className="py-24 bg-muted/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold">{t.features.sectionTitle}</h2>
          <p className="mt-4 text-lg text-muted-foreground">{t.features.sectionSubtitle}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="group p-6 rounded-2xl bg-card border border-border hover:border-primary/30 transition-all duration-300 hover:shadow-[var(--shadow-soft)]"
            >
              <div className={`w-12 h-12 rounded-xl ${feature.bg} flex items-center justify-center mb-4`}>
                <feature.icon className={`w-6 h-6 ${feature.color}`} />
              </div>
              <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
