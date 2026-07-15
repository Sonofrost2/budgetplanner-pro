import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { translations, type Locale } from './translations';
import { safeGet, safeSet } from '@/lib/safeStorage';

type TranslationType = typeof translations.fr | typeof translations.en;

interface LanguageContextType {
  locale: Locale;
  t: TranslationType;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window !== 'undefined') {
      const urlLang = new URLSearchParams(window.location.search).get('lang');
      if (urlLang === 'fr' || urlLang === 'en') {
        safeSet('budgetplan-locale', urlLang);
        return urlLang;
      }
    }
    const saved = safeGet('budgetplan-locale');
    return (saved === 'en' || saved === 'fr') ? saved : 'fr';
  });

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    safeSet('budgetplan-locale', newLocale);
  }, []);

  // Mirror the active locale on <html lang="…"> so generic UI helpers
  // (charts, animated numbers, native date pickers) can pick up the right
  // number/date separators when they don't have access to React context.
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale === 'fr' ? 'fr-FR' : 'en-US';
    }
  }, [locale]);

  const toggleLocale = useCallback(() => {
    setLocale(locale === 'fr' ? 'en' : 'fr');
  }, [locale, setLocale]);

  return (
    <LanguageContext.Provider value={{ locale, t: translations[locale], setLocale, toggleLocale }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within LanguageProvider');
  return context;
};
