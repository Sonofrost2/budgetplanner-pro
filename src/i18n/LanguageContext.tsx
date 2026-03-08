import React, { createContext, useContext, useState, useCallback } from 'react';
import { translations, type Locale } from './translations';

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
    const saved = localStorage.getItem('budgetplan-locale');
    return (saved === 'en' || saved === 'fr') ? saved : 'fr';
  });

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem('budgetplan-locale', newLocale);
  }, []);

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
