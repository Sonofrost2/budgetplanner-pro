/**
 * Centralized currency symbol/code helpers.
 * Use across the app for input prefixes and inline labels so the UI
 * always reflects the user's selected currency (never hardcoded "FCFA"/"$").
 */

const SYMBOLS: Record<string, string> = {
  EUR: '€',
  USD: '$',
  GBP: '£',
  CAD: '$',
  CHF: 'CHF',
  XOF: 'FCFA',
  XAF: 'FCFA',
  GNF: 'GNF',
  NGN: '₦',
  GHS: 'GH₵',
  MAD: 'DH',
};

/** Short label suitable for input prefixes (e.g. "FCFA", "€", "$"). */
export const currencySymbol = (currency?: string | null): string => {
  if (!currency) return '€';
  return SYMBOLS[currency.toUpperCase()] || currency.toUpperCase();
};

/** Example amount string for placeholders, localized. */
export const exampleAmount = (currency?: string | null, locale: string = 'fr'): string => {
  const code = (currency || 'EUR').toUpperCase();
  const isCfa = code === 'XOF' || code === 'XAF' || code === 'GNF';
  const value = isCfa ? 50000 : 50;
  return value.toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-US');
};
