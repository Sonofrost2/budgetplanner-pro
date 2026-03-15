import { Link } from 'react-router-dom';
import { Wallet, Heart } from 'lucide-react';
import { useLanguage } from '@/i18n/LanguageContext';

const Footer = () => {
  const { t } = useLanguage();

  return (
    <footer className="relative border-t border-glass-border glass-subtle">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {/* Brand */}
          <div>
            <Link to="/" className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center shadow-md" style={{ background: 'var(--gradient-primary)' }}>
                <Wallet className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="text-base font-bold font-display">Budget Planner</span>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed">{t.footer.description}</p>
          </div>

          {/* Product links */}
          <div>
            <h4 className="font-semibold text-sm mb-4">{t.footer.product}</h4>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              <li><a href="#features" className="hover:text-foreground transition-colors">{t.nav.features}</a></li>
              <li><a href="#pricing" className="hover:text-foreground transition-colors">{t.nav.pricing}</a></li>
              <li><Link to="/about" className="hover:text-foreground transition-colors">{locale === 'fr' ? 'À propos' : 'About'}</Link></li>
              <li><Link to="/blog" className="hover:text-foreground transition-colors">Blog</Link></li>
              <li><Link to="/contact" className="hover:text-foreground transition-colors">Contact</Link></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-semibold text-sm mb-4">{t.footer.legal}</h4>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              <li><Link to="/legal/privacy" className="hover:text-foreground transition-colors">{t.footer.privacy}</Link></li>
              <li><Link to="/legal/terms" className="hover:text-foreground transition-colors">{t.footer.terms}</Link></li>
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
