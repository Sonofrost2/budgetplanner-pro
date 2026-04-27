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

/**
 * Typical example amounts adapted to the active currency.
 * CFA-zone uses local realistic amounts (loyer, salaire, café…),
 * other currencies fall back to ~1/1000 of CFA values.
 */
export type ExampleKey =
  | 'coffee' | 'taxi' | 'salary' | 'rent' | 'groceries'
  | 'subscription' | 'goal' | 'monthly' | 'debt' | 'large' | 'low';

const CFA_EXAMPLES: Record<ExampleKey, number> = {
  coffee: 1500, taxi: 3000, salary: 250000, rent: 250000, groceries: 50000,
  subscription: 4990, goal: 500000, monthly: 50000, debt: 150000, large: 125000, low: 2500,
};
const FIAT_EXAMPLES: Record<ExampleKey, number> = {
  coffee: 3, taxi: 8, salary: 2500, rent: 800, groceries: 120,
  subscription: 9.99, goal: 2000, monthly: 200, debt: 1500, large: 500, low: 25,
};

const isCfaCode = (code: string) => code === 'XOF' || code === 'XAF' || code === 'GNF';

/** Numeric example for a given semantic key, scaled to the active currency. */
export const exampleValue = (key: ExampleKey, currency?: string | null): number => {
  const code = (currency || 'EUR').toUpperCase();
  return (isCfaCode(code) ? CFA_EXAMPLES : FIAT_EXAMPLES)[key];
};

/** Formatted example "amount + symbol" string, locale-aware. */
export const formatExample = (
  key: ExampleKey,
  currency?: string | null,
  locale: string = 'fr',
): string => {
  const code = (currency || 'EUR').toUpperCase();
  const value = exampleValue(key, code);
  const formatted = value.toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-US', {
    minimumFractionDigits: isCfaCode(code) ? 0 : (value % 1 ? 2 : 0),
    maximumFractionDigits: 2,
  });
  const sym = currencySymbol(code);
  // Symbols before for €/$/£/₦, after for codes (FCFA, GNF, CHF…)
  const symbolFirst = ['€', '$', '£', '₦', 'GH₵', 'DH'].includes(sym);
  return symbolFirst ? `${sym}${formatted}` : `${formatted} ${sym}`;
};
