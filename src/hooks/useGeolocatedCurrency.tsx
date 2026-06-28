import { useEffect, useState } from 'react';
import { DEFAULT_CURRENCY } from '@/lib/currency';
import { useLanguage } from '@/i18n/LanguageContext';

const CURRENCY_SYMBOLS: Record<string, string> = {
  EUR: '€', USD: '$', GBP: '£', CAD: '$', CHF: 'CHF', XOF: 'CFA', XAF: 'CFA',
};

export const useGeolocatedCurrency = () => {
  const [detectedCurrency, setDetectedCurrency] = useState<string>(DEFAULT_CURRENCY);
  const [loading, setLoading] = useState(true);
  const { locale } = useLanguage();
  const lang = locale === 'fr' ? 'fr-FR' : 'en-US';

  useEffect(() => {
    const cached = sessionStorage.getItem('geo_currency');
    if (cached) {
      setDetectedCurrency(cached);
      setLoading(false);
      return;
    }
    fetch('https://ipapi.co/json/')
      .then(r => r.json())
      .then(data => {
        const c = data?.currency || DEFAULT_CURRENCY;
        setDetectedCurrency(c);
        sessionStorage.setItem('geo_currency', c);
      })
      .catch(() => setDetectedCurrency(DEFAULT_CURRENCY))
      .finally(() => setLoading(false));
  }, []);

  const formatPrice = (prices: Record<string, number>, fallbackCurrency: string = DEFAULT_CURRENCY) => {
    const currency = prices[detectedCurrency] !== undefined ? detectedCurrency : fallbackCurrency;
    const amount = prices[currency] ?? 0;
    const symbol = CURRENCY_SYMBOLS[currency] || currency;
    if (amount === 0) return { amount: 0, formatted: currency === 'XOF' || currency === 'XAF' ? '0 CFA' : `0 ${symbol}`, currency };
    const formatted = currency === 'XOF' || currency === 'XAF'
      ? `${amount.toLocaleString(lang)} CFA`
      : `${amount.toLocaleString(lang, { minimumFractionDigits: 2 })} ${symbol}`;
    return { amount, formatted, currency };
  };

  return { detectedCurrency, loading, formatPrice };
};
