import { Link } from 'react-router-dom';
import { ArrowRight, Shield, Star, Users, TrendingUp, TrendingDown, Wallet, Sparkles, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/i18n/LanguageContext';
import { motion } from 'framer-motion';

const HeroSection = () => {
  const { t } = useLanguage();

  const handleLearnMore = () => {
    document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="relative min-h-screen flex items-center pt-16 overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0" style={{ background: 'var(--gradient-hero)' }} />
      <div className="absolute top-20 right-[10%] w-[500px] h-[500px] rounded-full opacity-[0.07] blur-[100px] bg-primary animate-pulse" />
      <div className="absolute bottom-10 left-[5%] w-[400px] h-[400px] rounded-full opacity-[0.05] blur-[80px] bg-secondary" />
      <div className="absolute top-[40%] left-[50%] w-[300px] h-[300px] rounded-full opacity-[0.04] blur-[60px] bg-accent" />

      {/* Floating grid dots */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: 'radial-gradient(circle, hsl(var(--foreground)) 1px, transparent 1px)',
        backgroundSize: '40px 40px'
      }} />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 w-full">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Left: Text content */}
          <div className="text-center lg:text-left">
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold bg-primary/10 text-primary border border-primary/20 backdrop-blur-sm">
                <Sparkles className="w-4 h-4" />
                {t.hero.badge}
              </span>
            </motion.div>

            <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}
              className="mt-8 text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-extrabold tracking-tight leading-[1.1]">
              {t.hero.title}{' '}
              <span className="bg-clip-text text-transparent" style={{ backgroundImage: 'var(--gradient-primary)' }}>{t.hero.titleHighlight}</span>
            </motion.h1>

            <motion.p initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}
              className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-xl mx-auto lg:mx-0 leading-relaxed">
              {t.hero.subtitle}
            </motion.p>

            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }}
              className="mt-10 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Link to="/signup">
                <Button size="lg" className="w-full sm:w-auto text-primary-foreground text-base px-8 h-12 rounded-xl shadow-lg hover:shadow-xl transition-shadow" style={{ background: 'var(--gradient-primary)' }}>
                  {t.hero.cta}<ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Button size="lg" variant="outline" className="w-full sm:w-auto text-base px-8 h-12 rounded-xl" onClick={handleLearnMore}>
                {t.hero.ctaSecondary}
              </Button>
            </motion.div>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.5 }}
              className="mt-10 flex flex-wrap justify-center lg:justify-start gap-8">
              {[
                { icon: Users, label: t.hero.users, color: 'text-primary' },
                { icon: Star, label: t.hero.rating, color: 'text-accent' },
                { icon: Shield, label: t.hero.secure, color: 'text-secondary' },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                  <div className="w-8 h-8 rounded-lg bg-muted/80 flex items-center justify-center">
                    <item.icon className={`w-4 h-4 ${item.color}`} />
                  </div>
                  <span className="font-semibold">{item.label}</span>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Right: Dashboard Mockup */}
          <motion.div initial={{ opacity: 0, y: 40, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.8, delay: 0.4 }}
            className="relative hidden lg:block">
            {/* Glow behind card */}
            <div className="absolute -inset-4 rounded-3xl opacity-20 blur-2xl" style={{ background: 'var(--gradient-primary)' }} />
            
            <div className="relative rounded-2xl border border-border/50 bg-card/90 backdrop-blur-xl shadow-2xl overflow-hidden">
              {/* Title bar */}
              <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border/50 bg-muted/30">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-destructive/70" />
                  <div className="w-3 h-3 rounded-full bg-accent/70" />
                  <div className="w-3 h-3 rounded-full bg-secondary/70" />
                </div>
                <span className="text-xs text-muted-foreground ml-2 font-medium">Budget Planner — Dashboard</span>
              </div>
              {/* Content */}
              <div className="p-5">
                <div className="grid grid-cols-3 gap-3 mb-5">
                  {[
                    { icon: Wallet, label: 'Solde total', value: '430,000 XOF', color: '' },
                    { icon: TrendingUp, label: 'Revenus', value: '+850,000', color: 'text-secondary' },
                    { icon: TrendingDown, label: 'Dépenses', value: '-420,000', color: 'text-destructive' },
                  ].map((item, i) => (
                    <motion.div key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.8 + i * 0.15 }}
                      className="rounded-xl bg-muted/40 p-3.5 border border-border/30"
                    >
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1.5">
                        <item.icon className={`w-3 h-3 ${item.color || 'text-primary'}`} /> {item.label}
                      </div>
                      <p className={`text-base font-bold ${item.color}`}>{item.value}</p>
                    </motion.div>
                  ))}
                </div>
                {/* Mini chart bars */}
                <div className="flex items-end gap-1.5 h-24 px-1">
                  {[40, 65, 50, 80, 60, 90, 45, 70, 55, 85, 75, 95].map((h, i) => (
                    <motion.div
                      key={i}
                      initial={{ height: 0 }}
                      animate={{ height: `${h}%` }}
                      transition={{ delay: 1.2 + i * 0.05, duration: 0.5, ease: 'easeOut' }}
                      className="flex-1 rounded-t-md"
                      style={{
                        background: i % 2 === 0
                          ? 'hsl(var(--secondary))'
                          : 'hsl(var(--primary))',
                        opacity: 0.75
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Floating mini card */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.5, duration: 0.5 }}
              className="absolute -right-4 top-[40%] bg-card border border-border/50 rounded-xl px-4 py-3 shadow-xl backdrop-blur-sm"
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-secondary" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Épargne</p>
                  <p className="text-sm font-bold text-secondary">+12.5%</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <button onClick={handleLearnMore} className="flex flex-col items-center gap-2 text-muted-foreground/50 hover:text-muted-foreground transition-colors">
          <span className="text-xs font-medium">Scroll</span>
          <ChevronRight className="w-4 h-4 rotate-90 animate-bounce" />
        </button>
      </motion.div>
    </section>
  );
};

export default HeroSection;
