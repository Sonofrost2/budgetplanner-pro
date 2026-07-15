/**
 * Budget period + projection utilities.
 *
 * `getBudgetPeriodBounds`, `parseLocalDateLoose`, and `formatDateStr` are
 * re-exported from the shared module under `supabase/functions/_shared/` so
 * that this file (frontend) and the `check-alerts` edge function are
 * GUARANTEED to compute periods identically. Do not fork the logic.
 */

export {
  getBudgetPeriodBounds,
  parseLocalDateLoose,
  formatDateStr,
} from '../../supabase/functions/_shared/budgetPeriod';
import { parseLocalDateLoose } from '../../supabase/functions/_shared/budgetPeriod';

/**
 * Check if an alert should fire based on expected_day.
 */
export function shouldAlertForExpectedDay(
  expectedDay: number | null | undefined,
  now: Date,
  daysElapsed: number,
  daysTotal: number
): boolean {
  if (!expectedDay) {
    return daysElapsed > daysTotal * 0.5;
  }
  return now.getDate() >= expectedDay;
}

/**
 * Compute the number of days until the next budget occurrence.
 *
 * Logic:
 * 1. If expected_day is set → days until the next expected_day within or after the current period.
 *    - For monthly+ periods: expected_day = day of month (1-31)
 *    - For weekly periods: expected_day = ISO weekday (1=Mon..7=Sun)
 * 2. If occurrence_frequency is set:
 *    - 'once' with reference_date → days until reference_date (or 0 if past)
 *    - 'daily' → always 0 (next occurrence is today)
 *    - 'weekly' → days until next occurrence in current week cycle
 *    - 'biweekly' / 'monthly' / 'quarterly' → compute next from reference or period start
 * 3. Fallback: days until end of period (original behaviour).
 */
export function computeDaysRemaining(
  period: string,
  now: Date,
  opts: {
    expectedDay?: number | null;
    occurrenceFrequency?: string | null;
    referenceDate?: string | null;
    activeDays?: string | null;
    periodStart?: Date;
    periodEnd?: Date;
  } = {}
): { daysLeft: number; label?: string; targetDate?: Date } {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const { expectedDay, occurrenceFrequency, referenceDate, periodEnd } = opts;

  // Long periods where "expected_day of current month" is meaningless.
  // For these, expected_day alone MUST NOT drive the countdown — otherwise a
  // yearly budget with expected_day=31 shows "16 days" every mid-July.
  const isLongPeriod = period === 'yearly' || period === 'semi_annual' || period === 'quarterly';

  // ── 0. Long periods: prefer reference_date (day+month) inside the current period ──
  if (isLongPeriod && referenceDate) {
    const ref = parseLocalDateLoose(referenceDate);
    // Snap the reference month/day to the current period window
    const candidates: Date[] = [];
    if (periodEnd) {
      const ps = opts.periodStart ?? new Date(today.getFullYear(), 0, 1);
      // try each year that intersects the window
      for (let y = ps.getFullYear(); y <= periodEnd.getFullYear() + 1; y++) {
        const d = new Date(y, ref.getMonth(), ref.getDate());
        if (d >= ps && d <= periodEnd) candidates.push(d);
      }
    }
    const upcoming = candidates.find(d => d >= today);
    if (upcoming) {
      const diff = Math.floor((upcoming.getTime() - today.getTime()) / 86400000);
      return { daysLeft: diff, targetDate: upcoming, label: diff === 0 ? 'today' : undefined };
    }
    // reference already passed inside the window → fall through to periodEnd fallback
  }

  // ── 1. expected_day (weekly / monthly only) ──
  if (expectedDay && !isLongPeriod) {
    if (period === 'weekly') {
      // expectedDay is ISO weekday 1=Mon..7=Sun
      const todayIso = today.getDay() === 0 ? 7 : today.getDay();
      let diff = expectedDay - todayIso;
      if (diff < 0) diff += 7;
      const target = new Date(today);
      target.setDate(today.getDate() + diff);
      return { daysLeft: diff, targetDate: target, label: diff === 0 ? 'today' : undefined };
    }
    // monthly → expected_day is day of month
    const thisMonth = new Date(today.getFullYear(), today.getMonth(), expectedDay);
    if (thisMonth >= today) {
      const diff = Math.floor((thisMonth.getTime() - today.getTime()) / 86400000);
      return { daysLeft: diff, targetDate: thisMonth, label: diff === 0 ? 'today' : undefined };
    }
    // Already past this month → next month
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, expectedDay);
    const diff = Math.floor((nextMonth.getTime() - today.getTime()) / 86400000);
    return { daysLeft: diff, targetDate: nextMonth };
  }

  // ── 2. occurrence_frequency ──
  if (occurrenceFrequency) {
    if (occurrenceFrequency === 'daily') {
      return { daysLeft: 0, label: 'today' };
    }
    if (occurrenceFrequency === 'once' && referenceDate) {
      const ref = parseLocalDateLoose(referenceDate);
      const refDay = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
      const diff = Math.floor((refDay.getTime() - today.getTime()) / 86400000);
      if (diff >= 0) {
        return { daysLeft: diff, targetDate: refDay, label: diff === 0 ? 'today' : undefined };
      }
      // reference passed → fall through to periodEnd fallback so the card
      // still shows a useful "N days left in the current cycle" indicator.
    }
    if (occurrenceFrequency === 'weekly') {
      return { daysLeft: 0, label: 'thisWeek' };
    }
    if (occurrenceFrequency === 'biweekly' && referenceDate) {
      const ref = parseLocalDateLoose(referenceDate);
      const daysSinceRef = Math.floor((today.getTime() - ref.getTime()) / 86400000);
      const daysIntoCycle = ((daysSinceRef % 14) + 14) % 14;
      const daysLeft = daysIntoCycle === 0 ? 0 : 14 - daysIntoCycle;
      const target = new Date(today);
      target.setDate(today.getDate() + daysLeft);
      return { daysLeft, targetDate: target, label: daysLeft === 0 ? 'today' : undefined };
    }
    if (occurrenceFrequency === 'monthly') {
      const refDay = referenceDate ? parseLocalDateLoose(referenceDate).getDate() : 1;
      const thisMonth = new Date(today.getFullYear(), today.getMonth(), refDay);
      if (thisMonth >= today) {
        const diff = Math.floor((thisMonth.getTime() - today.getTime()) / 86400000);
        return { daysLeft: diff, targetDate: thisMonth, label: diff === 0 ? 'today' : undefined };
      }
      const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, refDay);
      return { daysLeft: Math.floor((nextMonth.getTime() - today.getTime()) / 86400000), targetDate: nextMonth };
    }
  }

  // ── 3. Fallback: days until end of period ──
  if (periodEnd) {
    const pe = new Date(periodEnd.getFullYear(), periodEnd.getMonth(), periodEnd.getDate());
    const diff = Math.floor((pe.getTime() - today.getTime()) / 86400000);
    return { daysLeft: Math.max(0, diff), targetDate: pe };
  }

  return { daysLeft: 0 };
}

/**
 * Compute the precise annualized budget amount.
 *
 * Annualization base — harmonized on the Gregorian mean year of 365.25 days
 * (≈ 52.1786 weeks). This guarantees that two equivalent budgets expressed in
 * days or in weeks yield the SAME annual total. Previously `daily` used 52.18
 * (partial week) or 365 (full week) while `weekly` used 52, so a 7 000/week
 * budget and a 1 000/day 7-day budget didn't match.
 *
 * Rules (DAYS_PER_YEAR = 365.25, WEEKS_PER_YEAR = 365.25 / 7 ≈ 52.1786):
 * - daily (7 j/7):        amount × 365.25
 * - daily (n j/7, n<7):   amount × n × WEEKS_PER_YEAR
 * - weekly:               amount × WEEKS_PER_YEAR
 * - monthly:              amount × 12
 * - quarterly:            amount × 4
 * - semi_annual:          amount × 2
 * - yearly:               amount × 1
 *
 * If occurrence_frequency is set:
 * - The `amount` field is the budget for the PERIOD.
 *   occurrence_frequency tells how it's distributed but does NOT change the total.
 *   e.g. monthly budget of 500k with freq=once → 500k/month → 6M/year
 *   e.g. monthly budget of 500k with freq=weekly → still 500k/month → 6M/year
 */
export const DAYS_PER_YEAR = 365.25;
export const WEEKS_PER_YEAR = DAYS_PER_YEAR / 7; // ≈ 52.17857

export function computeAnnualizedAmount(
  amount: number,
  period: string,
  activeDays?: string | null,
): number {
  if (period === 'daily') {
    const activeDaysArr = activeDays ? String(activeDays).split(',').filter(Boolean) : [];
    if (activeDaysArr.length > 0 && activeDaysArr.length < 7) {
      return Math.round(amount * activeDaysArr.length * WEEKS_PER_YEAR);
    }
    return Math.round(amount * DAYS_PER_YEAR);
  }
  const multipliers: Record<string, number> = {
    weekly: WEEKS_PER_YEAR,
    monthly: 12,
    quarterly: 4,
    semi_annual: 2,
    yearly: 1,
  };
  return Math.round(amount * (multipliers[period] || 12));
}

/**
 * Return the effective duration in days that ONE occurrence of a budget
 * `amount` covers. Derived from the same constants as
 * `computeAnnualizedAmount` so the two helpers stay perfectly consistent —
 * i.e. `normalizeAmountToDays(amount, period, ad, DAYS_PER_YEAR)` always
 * equals `computeAnnualizedAmount(amount, period, ad)`.
 *
 * For `daily` with `active_days` set to n<7, one weekly cycle contains
 * n active days, so a single "amount" covers 7/n calendar days on average.
 */
export function getBudgetPeriodDays(
  period: string,
  activeDays?: string | null,
): number {
  if (period === 'daily') {
    const activeDaysArr = activeDays ? String(activeDays).split(',').filter(Boolean) : [];
    if (activeDaysArr.length > 0 && activeDaysArr.length < 7) {
      return 7 / activeDaysArr.length;
    }
    return 1;
  }
  const daysMap: Record<string, number> = {
    weekly: 7,
    monthly: DAYS_PER_YEAR / 12,       // ≈ 30.4375
    quarterly: DAYS_PER_YEAR / 4,      // ≈ 91.3125
    semi_annual: DAYS_PER_YEAR / 2,    // ≈ 182.625
    yearly: DAYS_PER_YEAR,             // 365.25
  };
  return daysMap[period] || daysMap.monthly;
}

/**
 * Normalize a budget `amount` (expressed in its own period) to an arbitrary
 * duration in days. Single source of truth for any temporal projection —
 * the analysis tab, weekly planner, reports, etc. must call this helper
 * rather than reimplementing their own period tables.
 */
export function normalizeAmountToDays(
  amount: number,
  period: string,
  activeDays: string | null | undefined,
  targetDays: number,
): number {
  const budgetPeriodDays = getBudgetPeriodDays(period, activeDays);
  if (budgetPeriodDays <= 0) return amount;
  return amount * (targetDays / budgetPeriodDays);
}
