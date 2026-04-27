import { Link } from 'react-router-dom';
import { Sparkles, X, Crown } from 'lucide-react';
import { useState } from 'react';
import { useLanguage } from '@/i18n/LanguageContext';
import { useDemoMode } from '@/hooks/useDemoMode';
import { Button } from '@/components/ui/button';

/**
 * Persistent banner shown to users signed into the public demo account.
 * Explains the ephemeral nature of changes and surfaces an upgrade CTA.
 */
const DemoBanner = () => {
  const isDemo = useDemoMode();
  const { locale } = useLanguage();
  const [hidden, setHidden] = useState(false);

  if (!isDemo || hidden) return null;

  return (
    <div className="sticky top-0 z-40 w-full border-b border-primary/30 bg-gradient-to-r from-primary/15 via-primary/10 to-primary/15 backdrop-blur-xl">
      <div className="px-4 lg:px-6 py-2 flex items-center gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 shrink-0 rounded-lg flex items-center justify-center shadow-sm" style={{ background: 'var(--gradient-primary)' }}>
            <Sparkles className="w-3.5 h-3.5 text-primary-foreground" />
          </div>
          <p className="text-xs sm:text-sm leading-snug truncate">
            <span className="font-semibold">
              {locale === 'fr' ? 'Mode démo actif' : 'Demo mode active'}
            </span>
            <span className="hidden sm:inline text-muted-foreground">
              {' — '}
              {locale === 'fr'
                ? 'vos modifications sont éphémères et réinitialisées chaque jour.'
                : 'your changes are ephemeral and reset every day.'}
            </span>
          </p>
        </div>
        <div className="flex-1" />
        <Button asChild size="sm" className="h-7 rounded-lg text-xs px-3 gap-1.5 text-primary-foreground shadow-md shadow-primary/30" style={{ background: 'var(--gradient-primary)' }}>
          <Link to="/signup">
            <Crown className="w-3.5 h-3.5" />
            {locale === 'fr' ? 'Créer mon compte' : 'Create my account'}
          </Link>
        </Button>
        <button
          onClick={() => setHidden(true)}
          aria-label={locale === 'fr' ? 'Masquer' : 'Dismiss'}
          className="p-1 rounded-md hover:bg-foreground/10 transition-colors"
        >
          <X className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </div>
    </div>
  );
};

export default DemoBanner;