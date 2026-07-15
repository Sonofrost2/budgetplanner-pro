import { Link } from 'react-router-dom';
import { Wallet, Heart } from 'lucide-react';
import { useLanguage } from '@/i18n/LanguageContext';

const Footer = () => {
  const { t, locale } = useLanguage();

  return (
    <footer className="relative border-t border-glass-border glass-subtle">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Brand */}
          <div>
            <Link to="/" className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center shadow-md" style={{ background: 'var(--gradient-primary)' }}>
                <Wallet className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="text-base font-bold font-display">Budget Planner</span>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed">{t.footer.description}</p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <Link to="/signup" className="px-3 py-1.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-medium">
                {locale === 'fr' ? 'Créer un compte' : 'Sign up'}
              </Link>
              <Link to="/login" className="px-3 py-1.5 rounded-full border border-glass-border hover:bg-muted/40 transition-colors">
                {locale === 'fr' ? 'Se connecter' : 'Log in'}
              </Link>
            </div>
          </div>

          {/* Product links */}
          <div>
            <h4 className="font-semibold text-sm mb-4">{t.footer.product}</h4>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              <li><Link to="/#features" className="hover:text-foreground transition-colors">{t.nav.features}</Link></li>
              <li><Link to="/#pricing" className="hover:text-foreground transition-colors">{t.nav.pricing}</Link></li>
              <li><Link to="/#testimonials" className="hover:text-foreground transition-colors">{locale === 'fr' ? 'Témoignages' : 'Testimonials'}</Link></li>
              <li><Link to="/dashboard" className="hover:text-foreground transition-colors">{locale === 'fr' ? "Ouvrir l'app" : 'Open app'}</Link></li>
              <li><Link to="/demo" className="hover:text-foreground transition-colors">{locale === 'fr' ? 'Démo' : 'Demo'}</Link></li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="font-semibold text-sm mb-4">{locale === 'fr' ? 'Ressources' : 'Resources'}</h4>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              <li><Link to="/about" className="hover:text-foreground transition-colors">{locale === 'fr' ? 'À propos' : 'About'}</Link></li>
              <li><Link to="/blog" className="hover:text-foreground transition-colors">Blog</Link></li>
              <li><Link to="/blog/budget-planner-vs-excel" className="hover:text-foreground transition-colors">{locale === 'fr' ? 'Comparatif vs Excel' : 'vs Excel comparison'}</Link></li>
              <li><Link to="/blog/astuces-budget-mensuel" className="hover:text-foreground transition-colors">{locale === 'fr' ? 'Astuces budget mensuel' : 'Monthly budget tips'}</Link></li>
              <li><Link to="/contact" className="hover:text-foreground transition-colors">Contact</Link></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-semibold text-sm mb-4">{t.footer.legal}</h4>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              <li><Link to="/legal/privacy" className="hover:text-foreground transition-colors">{t.footer.privacy}</Link></li>
              <li><Link to="/legal/terms" className="hover:text-foreground transition-colors">{t.footer.terms}</Link></li>
              <li><Link to="/legal/sales" className="hover:text-foreground transition-colors">CGV</Link></li>
              <li><Link to="/legal/refund" className="hover:text-foreground transition-colors">Remboursement</Link></li>
              <li><Link to="/legal/cookies" className="hover:text-foreground transition-colors">{t.footer.cookies}</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-glass-border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} Budget Planner. {t.footer.rights}</span>
          <span className="flex items-center gap-1">
            Made with <Heart className="w-3 h-3 text-destructive fill-destructive" /> in Africa
          </span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
