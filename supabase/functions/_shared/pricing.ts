/**
 * Server-side pricing constants. Single source of truth for the annual
 * discount applied to subscriptions.
 *
 * IMPORTANT: keep this value in sync with `src/lib/pricing.ts`. The client
 * uses it to display the discounted price; the server uses it to compute
 * the actual amount debited via Paystack. The two MUST never diverge.
 */
export const ANNUAL_DISCOUNT_RATE = 0.8;

/** Total billed amount for an annual subscription (integer in CFA, kept as-is otherwise). */
export function getAnnualTotal(monthlyPrice: number): number {
  return Math.round(monthlyPrice * 12 * ANNUAL_DISCOUNT_RATE);
}