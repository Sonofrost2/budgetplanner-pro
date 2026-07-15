/**
 * Shared budget-period calculation.
 *
 * Imported by BOTH the frontend (`src/lib/budgetProjection.ts` re-exports these)
 * and the `check-alerts` edge function. Any divergence between what the UI
 * displays and what alerts compute causes ghost/late notifications, so this
 * file MUST be the single source of truth.
 *
 * Pure ES module — no Deno / Node / browser APIs. Safe in both runtimes.
 */

/**
 * Parse a date input that may be a `YYYY-MM-DD` string (Postgres DATE) or a
 * full ISO timestamp. Bare DATE strings are interpreted in the **local**
 * timezone — `new Date('2026-04-22')` would otherwise be UTC midnight and
 * shift by one day for users west of UTC.
 */
export function parseLocalDateLoose(input: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const [y, m, d] = input.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(input);
}

/** Local YYYY-MM-DD (avoid UTC shift around midnight in non-UTC zones). */
export function formatDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Compute period boundaries for a budget.
 * @param offset - number of periods to shift backwards (e.g. 1 = previous period)
 *
 * Supported periods: daily, weekly, monthly (default), quarterly, semi_annual, yearly.
 * `quarterly` and `semi_annual` respect `referenceDate` when provided so budgets
 * anchored to a custom start (e.g. fiscal quarter) shift accordingly.
 */
export function getBudgetPeriodBounds(
  period: string,
  now: Date,
  referenceDate?: string | null,
  offset: number = 0,
): { periodStart: Date; periodEnd: Date } {
  let periodStart: Date, periodEnd: Date;

  if (period === 'daily') {
    const d = new Date(now);
    d.setDate(d.getDate() - offset);
    periodStart = periodEnd = new Date(d);
  } else if (period === 'weekly') {
    const day = now.getDay();
    periodStart = new Date(now);
    periodStart.setDate(now.getDate() - (day === 0 ? 6 : day - 1) - offset * 7);
    periodEnd = new Date(periodStart);
    periodEnd.setDate(periodStart.getDate() + 6);
  } else if (period === 'quarterly') {
    if (referenceDate) {
      const ref = parseLocalDateLoose(referenceDate);
      periodStart = new Date(ref);
      while (periodStart > now) periodStart.setMonth(periodStart.getMonth() - 3);
      while (
        new Date(periodStart.getFullYear(), periodStart.getMonth() + 3, periodStart.getDate()) <= now
      ) {
        periodStart.setMonth(periodStart.getMonth() + 3);
      }
      periodStart.setMonth(periodStart.getMonth() - offset * 3);
      periodEnd = new Date(periodStart);
      periodEnd.setMonth(periodEnd.getMonth() + 3);
      periodEnd.setDate(periodEnd.getDate() - 1);
    } else {
      const year = now.getFullYear() + Math.floor((Math.floor(now.getMonth() / 3) - offset) / 4);
      const qIdx = (((Math.floor(now.getMonth() / 3) - offset) % 4) + 4) % 4;
      periodStart = new Date(year, qIdx * 3, 1);
      periodEnd = new Date(year, qIdx * 3 + 3, 0);
    }
  } else if (period === 'semi_annual') {
    if (referenceDate) {
      const ref = parseLocalDateLoose(referenceDate);
      periodStart = new Date(ref);
      while (periodStart > now) periodStart.setMonth(periodStart.getMonth() - 6);
      while (
        new Date(periodStart.getFullYear(), periodStart.getMonth() + 6, periodStart.getDate()) <= now
      ) {
        periodStart.setMonth(periodStart.getMonth() + 6);
      }
      periodStart.setMonth(periodStart.getMonth() - offset * 6);
      periodEnd = new Date(periodStart);
      periodEnd.setMonth(periodEnd.getMonth() + 6);
      periodEnd.setDate(periodEnd.getDate() - 1);
    } else {
      const s = (now.getMonth() < 6 ? 0 : 1) - offset;
      const year = now.getFullYear() + Math.floor(s / 2);
      const sIdx = ((s % 2) + 2) % 2;
      periodStart = new Date(year, sIdx * 6, 1);
      periodEnd = new Date(year, sIdx * 6 + 6, 0);
    }
  } else if (period === 'yearly') {
    if (referenceDate) {
      const ref = parseLocalDateLoose(referenceDate);
      periodStart = new Date(ref);
      while (periodStart > now) periodStart.setFullYear(periodStart.getFullYear() - 1);
      while (
        new Date(periodStart.getFullYear() + 1, periodStart.getMonth(), periodStart.getDate()) <= now
      ) {
        periodStart.setFullYear(periodStart.getFullYear() + 1);
      }
      periodStart.setFullYear(periodStart.getFullYear() - offset);
      periodEnd = new Date(periodStart);
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      periodEnd.setDate(periodEnd.getDate() - 1);
    } else {
      const year = now.getFullYear() - offset;
      periodStart = new Date(year, 0, 1);
      periodEnd = new Date(year, 11, 31);
    }
  } else {
    // monthly default
    const m = now.getMonth() - offset;
    const year = now.getFullYear() + Math.floor(m / 12);
    const mIdx = ((m % 12) + 12) % 12;
    periodStart = new Date(year, mIdx, 1);
    periodEnd = new Date(year, mIdx + 1, 0);
  }

  return { periodStart, periodEnd };
}