import { Link } from 'react-router-dom';
import { Wallet, Heart } from 'lucide-react';
import { useLanguage } from '@/i18n/LanguageContext';

const Footer = () => {
  const { t } = useLanguage();

  return (
    <footer className="relative border-t border-border bg-card">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="md:col-span-1">
            <Link to="/" className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-md" style={{ background: 'var(--gradient-primary)' }}>
                <Wallet className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="text-lg font-extrabold font-display">Budget Planner</span>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed">{t.footer.description}</p>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-bold text-sm mb-5 text-foreground">{t.footer.product}</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li><a href="#features" className="hover:text-foreground transition-colors">{t.nav.features}</a></li>
              <li><a href="#pricing" className="hover:text-foreground transition-colors">{t.nav.pricing}</a></li>
              <li><a href="#testimonials" className="hover:text-foreground transition-colors">{t.nav.testimonials}</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-sm mb-5 text-foreground">{t.footer.company}</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li><Link to="/about" className="hover:text-foreground transition-colors">{t.footer.about}</Link></li>
              <li><Link to="/blog" className="hover:text-foreground transition-colors">{t.footer.blog}</Link></li>
              <li><Link to="/contact" className="hover:text-foreground transition-colors">{t.footer.contact}</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-sm mb-5 text-foreground">{t.footer.legal}</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li><Link to="/legal/privacy" className="hover:text-foreground transition-colors">{t.footer.privacy}</Link></li>
              <li><Link to="/legal/terms" className="hover:text-foreground transition-colors">{t.footer.terms}</Link></li>
              <li><Link to="/legal/cookies" className="hover:text-foreground transition-colors">{t.footer.cookies}</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-14 pt-8 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <span>© {new Date().getFullYear()} Budget Planner. {t.footer.rights}</span>
          <span className="flex items-center gap-1.5">
            Made with <Heart className="w-3.5 h-3.5 text-destructive fill-destructive" /> in Africa
          </span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
