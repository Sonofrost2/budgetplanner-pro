/**
 * Centralized currency symbol/code helpers.
 * Use across the app for input prefixes and inline labels so the UI
 * always reflects the user's selected currency (never hardcoded "FCFA"/"$").
 */

/**
 * Single default currency used as fallback across the app.
 * Change this once to switch the global default.
 */
export const DEFAULT_CURRENCY = 'XOF';

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
  if (!currency) return SYMBOLS[DEFAULT_CURRENCY] || DEFAULT_CURRENCY;
  return SYMBOLS[currency.toUpperCase()] || currency.toUpperCase();
};

/** Example amount string for placeholders, localized. */
export const exampleAmount = (currency?: string | null, locale: string = 'fr'): string => {
  const code = (currency || DEFAULT_CURRENCY).toUpperCase();
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

/**
 * Append the currency unit to a field label for clarity.
 * Example: amountLabel('Montant', 'XOF') → "Montant (FCFA)"
 * Use on amount inputs so users instantly know which unit the
 * placeholder/value represents.
 */
export const amountLabel = (label: string, currency?: string | null): string => {
  const sym = currencySymbol(currency);
  return `${label} (${sym})`;
};

/** Map our short locale codes to BCP-47 tags used by Intl. */
export const bcp47 = (locale?: string | null): string =>
  (locale || 'fr').toLowerCase().startsWith('fr') ? 'fr-FR' : 'en-US';

/**
 * Format a number with the active locale's separators
 * (e.g. 1 234,56 in fr-FR, 1,234.56 in en-US).
 * Use this everywhere instead of `n.toLocaleString()` (which silently uses
 * the browser locale and breaks consistency).
 */
export const formatNumber = (
  n: number,
  locale?: string | null,
  options?: Intl.NumberFormatOptions,
): string => {
  const v = Number.isFinite(n) ? n : 0;
  return v.toLocaleString(bcp47(locale), options);
};

/**
 * Format a percentage with the active locale.
 * `value` is the raw percent (e.g. 12.5 → "12,5 %").
 */
export const formatPercent = (
  value: number,
  locale?: string | null,
  fractionDigits = 1,
): string => {
  const v = Number.isFinite(value) ? value : 0;
  const lang = bcp47(locale);
  const formatted = v.toLocaleString(lang, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
  // fr-FR uses a non-breaking space before %, en-US has no space.
  return lang.startsWith('fr') ? `${formatted} %` : `${formatted}%`;
};

/** Numeric example for a given semantic key, scaled to the active currency. */
export const exampleValue = (key: ExampleKey, currency?: string | null): number => {
  const code = (currency || DEFAULT_CURRENCY).toUpperCase();
  return (isCfaCode(code) ? CFA_EXAMPLES : FIAT_EXAMPLES)[key];
};

/** Formatted example "amount + symbol" string, locale-aware. */
export const formatExample = (
  key: ExampleKey,
  currency?: string | null,
  locale: string = 'fr',
): string => {
  const code = (currency || DEFAULT_CURRENCY).toUpperCase();
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

/**
 * Format a monetary amount with the active currency symbol and locale.
 * Use this everywhere instead of inline `.toLocaleString()` + manual symbol concat.
 *
 * - CFA-zone currencies (XOF/XAF/GNF) → "50 000 FCFA" (no decimals, symbol after).
 * - Symbol-first currencies (€/$/£/₦…) → "€1,234.56".
 * - Other codes (CHF, etc.) → "1 234,56 CHF".
 */
export const formatAmount = (
  value: number,
  currency?: string | null,
  locale?: string | null,
  options?: { minimumFractionDigits?: number; maximumFractionDigits?: number },
): string => {
  const code = (currency || DEFAULT_CURRENCY).toUpperCase();
  const lang = bcp47(locale);
  const sym = currencySymbol(code);
  const cfa = isCfaCode(code);
  const min = options?.minimumFractionDigits ?? (cfa ? 0 : (value % 1 ? 2 : 0));
  const max = options?.maximumFractionDigits ?? (cfa ? 0 : 2);
  const formatted = (Number.isFinite(value) ? value : 0).toLocaleString(lang, {
    minimumFractionDigits: min,
    maximumFractionDigits: max,
  });
  const symbolFirst = ['€', '$', '£', '₦', 'GH₵', 'DH'].includes(sym);
  return symbolFirst ? `${sym}${formatted}` : `${formatted} ${sym}`;
};
