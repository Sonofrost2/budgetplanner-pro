import { Link } from 'react-router-dom';
import { ArrowRight, Shield, Star, Users, TrendingUp, TrendingDown, PieChart, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/i18n/LanguageContext';
import { motion } from 'framer-motion';

const HeroSection = () => {
  const { t } = useLanguage();

  const handleLearnMore = () => {
    document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="relative min-h-[90vh] flex items-center pt-16 overflow-hidden">
      <div className="absolute inset-0" style={{ background: 'var(--gradient-hero)' }} />
      <div className="absolute top-20 right-10 w-72 h-72 rounded-full opacity-20 blur-3xl bg-primary" />
      <div className="absolute bottom-20 left-10 w-96 h-96 rounded-full opacity-15 blur-3xl bg-secondary" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <span className="inline-flex items-center px-4 py-1.5 rounded-full text-sm font-medium bg-primary/10 text-primary border border-primary/20">
              {t.hero.badge}
            </span>
          </motion.div>

          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
            className="mt-8 text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight">
            {t.hero.title}{' '}
            <span className="bg-clip-text text-transparent" style={{ backgroundImage: 'var(--gradient-primary)' }}>{t.hero.titleHighlight}</span>
          </motion.h1>

          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
            {t.hero.subtitle}
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/signup">
              <Button size="lg" className="w-full sm:w-auto text-primary-foreground text-base px-8" style={{ background: 'var(--gradient-primary)' }}>
                {t.hero.cta}<ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="w-full sm:w-auto text-base px-8" onClick={handleLearnMore}>
              {t.hero.ctaSecondary}
            </Button>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.5 }}
            className="mt-12 flex flex-wrap justify-center gap-6 sm:gap-10">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="w-4 h-4 text-primary" /><span className="font-semibold">{t.hero.users}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Star className="w-4 h-4 text-accent" /><span className="font-semibold">{t.hero.rating}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Shield className="w-4 h-4 text-secondary" /><span className="font-semibold">{t.hero.secure}</span>
            </div>
          </motion.div>
        </div>

        {/* Dashboard Mockup */}
        <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.6 }}
          className="mt-16 max-w-4xl mx-auto">
          <div className="rounded-2xl border border-border bg-card/80 backdrop-blur-sm shadow-2xl overflow-hidden">
            {/* Title bar */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/50">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-destructive/60" />
                <div className="w-3 h-3 rounded-full bg-accent/60" />
                <div className="w-3 h-3 rounded-full bg-secondary/60" />
              </div>
              <span className="text-xs text-muted-foreground ml-2">Budget Planner — Dashboard</span>
            </div>
            {/* Content */}
            <div className="p-6">
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="rounded-xl bg-muted/50 p-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                    <Wallet className="w-3 h-3" /> Solde total
                  </div>
                  <p className="text-lg font-bold">430,000 XOF</p>
                </div>
                <div className="rounded-xl bg-muted/50 p-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                    <TrendingUp className="w-3 h-3 text-secondary" /> Revenus
                  </div>
                  <p className="text-lg font-bold text-secondary">+850,000</p>
                </div>
                <div className="rounded-xl bg-muted/50 p-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                    <TrendingDown className="w-3 h-3 text-destructive" /> Dépenses
                  </div>
                  <p className="text-lg font-bold text-destructive">-420,000</p>
                </div>
              </div>
              {/* Mini chart bars */}
              <div className="flex items-end gap-2 h-20 px-2">
                {[40, 65, 50, 80, 60, 90, 45, 70, 55, 85, 75, 95].map((h, i) => (
                  <div key={i} className="flex-1 rounded-t-sm" style={{
                    height: `${h}%`,
                    background: i % 2 === 0 ? 'hsl(170, 65%, 45%)' : 'hsl(250, 70%, 58%)',
                    opacity: 0.7
                  }} />
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default HeroSection;
