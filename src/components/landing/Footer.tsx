import { Link } from 'react-router-dom';
import { Wallet } from 'lucide-react';
import { useLanguage } from '@/i18n/LanguageContext';

const Footer = () => {
  const { t } = useLanguage();

  return (
    <footer className="border-t border-border bg-card">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-1">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--gradient-primary)' }}>
                <Wallet className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="text-lg font-bold font-[Space_Grotesk]">Budget Planner</span>
            </Link>
            <p className="text-sm text-muted-foreground">{t.footer.description}</p>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-semibold text-sm mb-4">{t.footer.product}</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#features" className="hover:text-foreground transition-colors">{t.nav.features}</a></li>
              <li><a href="#pricing" className="hover:text-foreground transition-colors">{t.nav.pricing}</a></li>
              <li><a href="#testimonials" className="hover:text-foreground transition-colors">{t.nav.testimonials}</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-sm mb-4">{t.footer.company}</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/about" className="hover:text-foreground transition-colors">{t.footer.about}</Link></li>
              <li><Link to="/blog" className="hover:text-foreground transition-colors">{t.footer.blog}</Link></li>
              <li><Link to="/contact" className="hover:text-foreground transition-colors">{t.footer.contact}</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-sm mb-4">{t.footer.legal}</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/legal/privacy" className="hover:text-foreground transition-colors">{t.footer.privacy}</Link></li>
              <li><Link to="/legal/terms" className="hover:text-foreground transition-colors">{t.footer.terms}</Link></li>
              <li><Link to="/legal/cookies" className="hover:text-foreground transition-colors">{t.footer.cookies}</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-border text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} Budget Planner. {t.footer.rights}
        </div>
      </div>
    </footer>
  );
};

export default Footer;
