import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, Globe, Wallet, Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/i18n/LanguageContext';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { motion, AnimatePresence } from 'framer-motion';

const Navbar = () => {
  const { t, locale, toggleLocale } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const goToSection = (section: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    setMobileOpen(false);
    if (location.pathname === '/') {
      document.getElementById(section)?.scrollIntoView({ behavior: 'smooth' });
      history.replaceState(null, '', `/#${section}`);
    } else {
      navigate(`/#${section}`);
    }
  };

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const logoTo = user ? '/dashboard' : '/';

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'glass border-b border-glass-border shadow-sm'
          : 'bg-transparent border-b border-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          <Link to={logoTo} className="flex items-center gap-2">
            <motion.div
              initial={{ scale: 0.8, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ duration: 0.4, type: 'spring', bounce: 0.4, delay: 0.1 }}
              className="w-8 h-8 rounded-xl flex items-center justify-center shadow-md"
              style={{ background: 'var(--gradient-primary)' }}
            >
              <Wallet className="w-4 h-4 text-primary-foreground" />
            </motion.div>
            <span className="text-lg font-bold font-display">Budget Planner</span>
          </Link>

          <div className="hidden md:flex items-center gap-6">
            {['features', 'pricing', 'testimonials'].map((section, i) => (
              <motion.a
                key={section}
                href={`/#${section}`}
                onClick={goToSection(section)}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.06 }}
                className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {section === 'features' ? t.nav.features : section === 'pricing' ? t.nav.pricing : t.nav.testimonials}
              </motion.a>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
            className="hidden md:flex items-center gap-1.5"
          >
            <Button aria-label="Changer de thème" variant="ghost" size="icon" onClick={toggleTheme} className="text-muted-foreground rounded-xl h-8 w-8">
              {theme === 'light' ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
            </Button>
            <Button aria-label="Changer de langue" variant="ghost" size="icon" onClick={toggleLocale} className="text-muted-foreground rounded-xl h-8 w-8">
              <Globe className="w-3.5 h-3.5" />
            </Button>
            <span className="text-[10px] font-bold text-muted-foreground uppercase">{locale}</span>
            <div className="w-px h-5 bg-border mx-1" />
            {user ? (
              <Link to="/dashboard">
                <Button size="sm" className="text-primary-foreground rounded-xl h-8 text-xs" style={{ background: 'var(--gradient-primary)' }}>
                  Dashboard
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" size="sm" className="rounded-xl h-8 text-xs">{t.nav.login}</Button>
                </Link>
                <Link to="/signup">
                  <Button size="sm" className="text-primary-foreground rounded-xl h-8 text-xs shadow-md" style={{ background: 'var(--gradient-primary)' }}>{t.nav.signup}</Button>
                </Link>
              </>
            )}
          </motion.div>

          <div className="md:hidden flex items-center gap-1">
            <Button aria-label="Changer de thème" variant="ghost" size="icon" onClick={toggleTheme} className="rounded-xl h-8 w-8">
              {theme === 'light' ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
            </Button>
            <Button aria-label="Fermer" variant="ghost" size="icon" onClick={() => setMobileOpen(!mobileOpen)} className="rounded-xl h-8 w-8">
              {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="md:hidden glass-strong border-b border-glass-border overflow-hidden">
            <div className="px-4 py-4 space-y-2">
              <a href="/#features" onClick={goToSection('features')} className="block py-2 text-sm font-medium text-muted-foreground">{t.nav.features}</a>
              <a href="/#pricing" onClick={goToSection('pricing')} className="block py-2 text-sm font-medium text-muted-foreground">{t.nav.pricing}</a>
              <a href="/#testimonials" onClick={goToSection('testimonials')} className="block py-2 text-sm font-medium text-muted-foreground">{t.nav.testimonials}</a>
              <div className="pt-3 flex flex-col gap-2">
                {user ? (
                  <Link to="/dashboard" onClick={() => setMobileOpen(false)}>
                    <Button className="w-full text-primary-foreground rounded-xl h-9 text-xs" style={{ background: 'var(--gradient-primary)' }}>
                      Dashboard
                    </Button>
                  </Link>
                ) : (
                  <>
                    <Link to="/login" onClick={() => setMobileOpen(false)}>
                      <Button variant="outline" className="w-full rounded-xl h-9 text-xs">{t.nav.login}</Button>
                    </Link>
                    <Link to="/signup" onClick={() => setMobileOpen(false)}>
                      <Button className="w-full text-primary-foreground rounded-xl h-9 text-xs" style={{ background: 'var(--gradient-primary)' }}>{t.nav.signup}</Button>
                    </Link>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
};

export default Navbar;
