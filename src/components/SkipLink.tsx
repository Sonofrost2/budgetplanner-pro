import { useLocale } from '@/i18n/LanguageContext';

/**
 * WCAG 2.4.1 — Skip to main content link.
 * Hidden until focused; jumps focus to #main-content.
 */
export function SkipLink() {
  const { locale } = useLocale();
  const label = locale === 'en' ? 'Skip to main content' : 'Aller au contenu principal';
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-primary focus:text-primary-foreground focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring"
    >
      {label}
    </a>
  );
}

export default SkipLink;