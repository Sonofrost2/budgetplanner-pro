import { Link } from 'react-router-dom';
import { ArrowRight, Shield, Star, Users, TrendingUp, TrendingDown, Wallet, Sparkles, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/i18n/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { motion } from 'framer-motion';

const HeroSection = () => {
  const { t, locale } = useLanguage();
  const { user } = useAuth();

  const handleLearnMore = () => {
    document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section aria-label="Hero – Budget Planner Pro" className="relative min-h-screen flex items-center pt-16 overflow-hidden">
      {/* Mesh gradient background */}
      <div className="absolute inset-0 mesh-bg" />

      {/* Animated orbs */}
      <div className="absolute top-20 right-[15%] w-[400px] h-[400px] rounded-full bg-primary/10 blur-[120px] animate-glow" />
      <div className="absolute bottom-20 left-[10%] w-[350px] h-[350px] rounded-full bg-secondary/8 blur-[100px] animate-glow" style={{ animationDelay: '2s' }} />
      <div className="absolute top-[50%] left-[40%] w-[250px] h-[250px] rounded-full bg-accent/6 blur-[80px] animate-glow" style={{ animationDelay: '4s' }} />

      {/* Subtle grid */}
      <div className="absolute inset-0 opacity-[0.02]" style={{
        backgroundImage: 'radial-gradient(circle, hsl(var(--foreground)) 1px, transparent 1px)',
        backgroundSize: '48px 48px'
      }} />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 w-full">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left: Text */}
          <div className="text-center lg:text-left">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold glass text-primary">
                <Sparkles className="w-3.5 h-3.5" />
                {t.hero.badge}
              </span>
            </motion.div>

            <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
              className="mt-8 text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-extrabold tracking-tight leading-[1.08]">
              {t.hero.title}{' '}
              <span className="bg-clip-text text-transparent" style={{ backgroundImage: 'var(--gradient-primary)' }}>{t.hero.titleHighlight}</span>
            </motion.h1>

            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}
              className="mt-6 text-base sm:text-lg text-muted-foreground max-w-lg mx-auto lg:mx-0 leading-relaxed">
              {t.hero.subtitle}
            </motion.p>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}
              className="mt-8 flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
              <Link to={user ? "/dashboard" : "/signup"}>
                <Button size="lg" className="w-full sm:w-auto text-primary-foreground text-sm px-7 h-11 rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-[1.02]" style={{ background: 'var(--gradient-primary)' }}>
                  {t.hero.cta}<ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Button size="lg" variant="outline" className="w-full sm:w-auto text-sm px-7 h-11 rounded-xl glass border-glass-border hover:bg-glass-hover" onClick={handleLearnMore}>
                {t.hero.ctaSecondary}
              </Button>
              <Link to="/demo">
                <Button size="lg" variant="ghost" className="w-full sm:w-auto text-sm px-7 h-11 rounded-xl text-primary hover:bg-primary/10 gap-2">
                  <Sparkles className="w-4 h-4" />
                  {locale === 'fr' ? 'Voir la démo' : 'Try the demo'}
                </Button>
              </Link>
            </motion.div>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.5 }}
              className="mt-10 flex flex-wrap justify-center lg:justify-start gap-6">
              {[
                { icon: Users, label: t.hero.users, color: 'text-primary' },
                { icon: Star, label: t.hero.rating, color: 'text-accent' },
                { icon: Shield, label: t.hero.secure, color: 'text-secondary' },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="w-7 h-7 rounded-lg glass flex items-center justify-center">
                    <item.icon className={`w-3.5 h-3.5 ${item.color}`} />
                  </div>
                  <span className="font-medium">{item.label}</span>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Right: Glass Dashboard Mockup */}
          <motion.div initial={{ opacity: 0, y: 30, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.7, delay: 0.3 }}
            className="relative hidden lg:block">
            {/* Glow */}
            <div className="absolute -inset-6 rounded-3xl opacity-30 blur-3xl" style={{ background: 'var(--gradient-primary)' }} />

            <div className="relative glass rounded-2xl shadow-[var(--shadow-elevated)] overflow-hidden">
              {/* Title bar */}
              <div className="flex items-center gap-2 px-5 py-3 border-b border-glass-border">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-destructive/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-accent/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-secondary/60" />
                </div>
                <span className="text-[10px] text-muted-foreground ml-2 font-medium">Budget Planner — Dashboard</span>
              </div>
              {/* Content */}
              <div className="p-5">
                <div className="grid grid-cols-3 gap-3 mb-5">
                  {[
                    { icon: Wallet, label: 'Solde total', value: '430K XOF', color: '' },
                    { icon: TrendingUp, label: 'Revenus', value: '+850K', color: 'text-secondary' },
                    { icon: TrendingDown, label: 'Dépenses', value: '-420K', color: 'text-destructive' },
                  ].map((item, i) => (
                    <motion.div key={i}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.7 + i * 0.12 }}
                      className="glass-subtle rounded-xl p-3"
                    >
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-1">
                        <item.icon className={`w-3 h-3 ${item.color || 'text-primary'}`} /> {item.label}
                      </div>
                      <p className={`text-sm font-bold ${item.color}`}>{item.value}</p>
                    </motion.div>
                  ))}
                </div>
                {/* Chart bars */}
                <div className="flex items-end gap-1.5 h-20 px-1">
                  {[40, 65, 50, 80, 60, 90, 45, 70, 55, 85, 75, 95].map((h, i) => (
                    <motion.div
                      key={i}
                      initial={{ height: 0 }}
                      animate={{ height: `${h}%` }}
                      transition={{ delay: 1 + i * 0.04, duration: 0.4, ease: 'easeOut' }}
                      className="flex-1 rounded-t-sm"
                      style={{
                        background: i % 2 === 0
                          ? 'hsl(var(--secondary) / 0.6)'
                          : 'hsl(var(--primary) / 0.5)',
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Floating card */}
            <motion.div
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.3 }}
              className="absolute -right-3 top-[38%] glass rounded-xl px-3.5 py-2.5 shadow-[var(--shadow-elevated)] animate-float"
            >
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-secondary/15 flex items-center justify-center">
                  <TrendingUp className="w-3.5 h-3.5 text-secondary" />
                </div>
                <div>
                  <p className="text-[9px] text-muted-foreground">Épargne</p>
                  <p className="text-xs font-bold text-secondary">+12.5%</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* Scroll indicator */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }}
        className="absolute bottom-6 left-1/2 -translate-x-1/2">
        <button onClick={handleLearnMore} className="flex flex-col items-center gap-1.5 text-muted-foreground/40 hover:text-muted-foreground transition-colors">
          <span className="text-[10px] font-medium">Scroll</span>
          <ChevronRight className="w-3.5 h-3.5 rotate-90 animate-bounce" />
        </button>
      </motion.div>
    </section>
  );
};

export default HeroSection;
