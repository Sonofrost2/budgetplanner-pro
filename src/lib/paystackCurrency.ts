/**
 * Paystack Africa account currency support.
 * Our merchant account only has channels active for African currencies + USD.
 * For EUR/GBP/CAD/CHF, we convert to XOF using fixed approximate rates and
 * charge the user in XOF via Paystack.
 */

// Currencies natively supported by our Paystack account (channels active)
export const PAYSTACK_SUPPORTED_CURRENCIES = ['XOF', 'XAF', 'NGN', 'GHS', 'KES', 'ZAR', 'USD'] as const;

// Approximate fixed rates → XOF (1 unit of currency = X XOF). Update as needed.
// XOF is pegged to EUR at 655.957.
const TO_XOF_RATES: Record<string, number> = {
  EUR: 655.957,
  XOF: 1,
  XAF: 1,
  GBP: 760,
  CHF: 700,
  CAD: 480,
  USD: 600,
  NGN: 0.4,
  GHS: 50,
  KES: 4.5,
  ZAR: 35,
};

export interface PaystackPriceResolution {
  /** Final amount sent to Paystack */
  amount: number;
  /** Final currency sent to Paystack */
  currency: string;
  /** True if a conversion happened from the user's display currency */
  converted: boolean;
  /** Original display currency (what the user saw on the pricing page) */
  originalCurrency: string;
  /** Original amount in display currency */
  originalAmount: number;
}

/**
 * Resolves the (amount, currency) pair to send to Paystack.
 * If the user's currency is supported, returns it as-is.
 * Otherwise, converts to XOF using fixed rates and rounds to integer (XOF has no decimals).
 */
export function resolvePaystackPrice(
  displayAmount: number,
  displayCurrency: string,
): PaystackPriceResolution {
  const cur = (displayCurrency || 'XOF').toUpperCase();
  if ((PAYSTACK_SUPPORTED_CURRENCIES as readonly string[]).includes(cur)) {
    return {
      amount: displayAmount,
      currency: cur,
      converted: false,
      originalCurrency: cur,
      originalAmount: displayAmount,
    };
  }
  const rate = TO_XOF_RATES[cur] ?? TO_XOF_RATES.EUR;
  const xof = Math.round(displayAmount * rate);
  return {
    amount: xof,
    currency: 'XOF',
    converted: true,
    originalCurrency: cur,
    originalAmount: displayAmount,
  };
}

export function formatXofConversionMessage(
  res: PaystackPriceResolution,
  isFr: boolean,
): string | null {
  if (!res.converted) return null;
  const orig = res.originalAmount.toLocaleString(isFr ? 'fr-FR' : 'en-US', {
    style: 'currency',
    currency: res.originalCurrency,
  });
  const xof = res.amount.toLocaleString(isFr ? 'fr-FR' : 'en-US') + ' XOF';
  return isFr
    ? `Le paiement sera prélevé en ${xof} (équivalent à ${orig}). Notre partenaire Paystack ne prend pas en charge ${res.originalCurrency} dans votre région.`
    : `Payment will be charged as ${xof} (equivalent to ${orig}). Our partner Paystack does not support ${res.originalCurrency} in your region.`;
}