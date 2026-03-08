import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X, Globe, Wallet, Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/i18n/LanguageContext';
import { useTheme } from '@/hooks/useTheme';
import { motion, AnimatePresence } from 'framer-motion';

const Navbar = () => {
  const { t, locale, toggleLocale } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--gradient-primary)' }}>
              <Wallet className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold font-[Space_Grotesk]">Budget Planner</span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">{t.nav.features}</a>
            <a href="#pricing" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">{t.nav.pricing}</a>
            <a href="#testimonials" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">{t.nav.testimonials}</a>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={toggleTheme} className="text-muted-foreground">
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={toggleLocale} className="text-muted-foreground">
              <Globe className="w-4 h-4" />
              <span className="sr-only">{locale === 'fr' ? 'English' : 'Français'}</span>
            </Button>
            <span className="text-xs font-semibold text-muted-foreground uppercase">{locale}</span>
            <Link to="/login">
              <Button variant="ghost" size="sm">{t.nav.login}</Button>
            </Link>
            <Link to="/signup">
              <Button size="sm" className="text-primary-foreground" style={{ background: 'var(--gradient-primary)' }}>{t.nav.signup}</Button>
            </Link>
          </div>

          <div className="md:hidden flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={toggleTheme}>
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={toggleLocale}>
              <Globe className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-background border-b border-border overflow-hidden">
            <div className="px-4 py-4 space-y-3">
              <a href="#features" onClick={() => setMobileOpen(false)} className="block py-2 text-sm font-medium text-muted-foreground">{t.nav.features}</a>
              <a href="#pricing" onClick={() => setMobileOpen(false)} className="block py-2 text-sm font-medium text-muted-foreground">{t.nav.pricing}</a>
              <a href="#testimonials" onClick={() => setMobileOpen(false)} className="block py-2 text-sm font-medium text-muted-foreground">{t.nav.testimonials}</a>
              <div className="pt-2 flex flex-col gap-2">
                <Link to="/login" onClick={() => setMobileOpen(false)}>
                  <Button variant="outline" className="w-full">{t.nav.login}</Button>
                </Link>
                <Link to="/signup" onClick={() => setMobileOpen(false)}>
                  <Button className="w-full text-primary-foreground" style={{ background: 'var(--gradient-primary)' }}>{t.nav.signup}</Button>
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;
