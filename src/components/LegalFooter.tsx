import { Link } from 'react-router-dom';
import { useLanguage } from '@/i18n/LanguageContext';

interface LegalFooterProps {
  variant?: 'full' | 'compact';
  className?: string;
}

export const LegalFooter = ({ variant = 'full', className = '' }: LegalFooterProps) => {
  const { locale } = useLanguage();
  const fr = locale === 'fr';

  const links = [
    { to: '/legal/terms', label: fr ? 'Mentions légales' : 'Legal notice' },
    { to: '/legal/privacy', label: fr ? 'Confidentialité' : 'Privacy' },
    { to: '/legal/cookies', label: 'Cookies' },
    ...(variant === 'full'
      ? [
          { to: '/legal/sales', label: fr ? 'CGV' : 'Terms of sale' },
          { to: '/legal/refund', label: fr ? 'Remboursement' : 'Refund' },
        ]
      : []),
  ];

  return (
    <footer
      className={`w-full border-t border-border/40 bg-background/40 backdrop-blur-sm py-3 px-4 ${className}`}
      aria-label={fr ? 'Liens légaux' : 'Legal links'}
    >
      <nav className="max-w-6xl mx-auto flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="opacity-70">
          © {new Date().getFullYear()} Budget Planner
        </span>
        {links.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            className="hover:text-foreground transition-colors underline-offset-2 hover:underline"
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </footer>
  );
};

export default LegalFooter;