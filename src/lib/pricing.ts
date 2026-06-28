/**
 * Centralized pricing rules. Single source of truth for the annual discount
 * and any derived price calculations. Both the landing page and the in-app
 * billing page consume these helpers — if the discount changes, update here.
 */

/** Annual rebate vs. monthly billing (0.8 = 20% off). */
export const ANNUAL_DISCOUNT_RATE = 0.8;

/** Discount percentage shown to the user (e.g. for badges). */
export const ANNUAL_DISCOUNT_PERCENT = Math.round((1 - ANNUAL_DISCOUNT_RATE) * 100);

const isCfaCode = (code: string) =>
  code === 'XOF' || code === 'XAF' || code === 'GNF';

/** Monthly price after annual discount (kept fractional for non-CFA). */
export const getDiscountedMonthly = (monthlyPrice: number, currency?: string | null): number => {
  const code = (currency || '').toUpperCase();
  const raw = monthlyPrice * ANNUAL_DISCOUNT_RATE;
  return isCfaCode(code) ? Math.round(raw) : Math.round(raw * 100) / 100;
};

/** Total billed amount for an annual subscription. */
export const getAnnualTotal = (monthlyPrice: number, currency?: string | null): number => {
  return Math.round(monthlyPrice * 12 * ANNUAL_DISCOUNT_RATE);
};
