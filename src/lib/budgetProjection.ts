/**
 * Budget period calculation utilities.
 * Used by NotificationBell, BudgetsPage, BudgetAnalysisTab, and check-alerts edge function.
 */

/**
 * Compute period boundaries for a budget.
 * @param offset - number of periods to shift backwards (e.g. 1 = previous period)
 */
export function getBudgetPeriodBounds(
  period: string,
  now: Date,
  referenceDate?: string | null,
  offset: number = 0
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
      while (new Date(periodStart.getFullYear(), periodStart.getMonth() + 3, periodStart.getDate()) <= now) {
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
    const s = (now.getMonth() < 6 ? 0 : 1) - offset;
    const year = now.getFullYear() + Math.floor(s / 2);
    const sIdx = ((s % 2) + 2) % 2;
    periodStart = new Date(year, sIdx * 6, 1);
    periodEnd = new Date(year, sIdx * 6 + 6, 0);
  } else if (period === 'yearly') {
    const year = now.getFullYear() - offset;
    periodStart = new Date(year, 0, 1);
    periodEnd = new Date(year, 11, 31);
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

export function formatDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
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
): { daysLeft: number; label?: string } {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const { expectedDay, occurrenceFrequency, referenceDate, periodEnd } = opts;

  // ── 1. expected_day takes priority ──
  if (expectedDay) {
    if (period === 'weekly') {
      // expectedDay is ISO weekday 1=Mon..7=Sun
      const todayIso = today.getDay() === 0 ? 7 : today.getDay();
      let diff = expectedDay - todayIso;
      if (diff < 0) diff += 7;
      return { daysLeft: diff, label: diff === 0 ? 'today' : undefined };
    }
    // For monthly / quarterly / etc → expected_day is day of month
    const thisMonth = new Date(today.getFullYear(), today.getMonth(), expectedDay);
    if (thisMonth >= today) {
      const diff = Math.floor((thisMonth.getTime() - today.getTime()) / 86400000);
      return { daysLeft: diff, label: diff === 0 ? 'today' : undefined };
    }
    // Already past this month → next month
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, expectedDay);
    const diff = Math.floor((nextMonth.getTime() - today.getTime()) / 86400000);
    return { daysLeft: diff };
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
      return { daysLeft: Math.max(0, diff), label: diff === 0 ? 'today' : diff < 0 ? 'passed' : undefined };
    }
    if (occurrenceFrequency === 'weekly') {
      return { daysLeft: 0, label: 'thisWeek' };
    }
    if (occurrenceFrequency === 'biweekly' && referenceDate) {
      const ref = parseLocalDateLoose(referenceDate);
      const daysSinceRef = Math.floor((today.getTime() - ref.getTime()) / 86400000);
      const daysIntoCycle = ((daysSinceRef % 14) + 14) % 14;
      const daysLeft = daysIntoCycle === 0 ? 0 : 14 - daysIntoCycle;
      return { daysLeft, label: daysLeft === 0 ? 'today' : undefined };
    }
    if (occurrenceFrequency === 'monthly') {
      const refDay = referenceDate ? parseLocalDateLoose(referenceDate).getDate() : 1;
      const thisMonth = new Date(today.getFullYear(), today.getMonth(), refDay);
      if (thisMonth >= today) {
        const diff = Math.floor((thisMonth.getTime() - today.getTime()) / 86400000);
        return { daysLeft: diff, label: diff === 0 ? 'today' : undefined };
      }
      const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, refDay);
      return { daysLeft: Math.floor((nextMonth.getTime() - today.getTime()) / 86400000) };
    }
  }

  // ── 3. Fallback: days until end of period ──
  if (periodEnd) {
    const pe = new Date(periodEnd.getFullYear(), periodEnd.getMonth(), periodEnd.getDate());
    const diff = Math.floor((pe.getTime() - today.getTime()) / 86400000);
    return { daysLeft: Math.max(0, diff) };
  }

  return { daysLeft: 0 };
}

/**
 * Compute the precise annualized budget amount.
 *
 * Rules:
 * - daily:  amount × active_days_per_week × 52.18 (or × 365 if 7 days)
 * - weekly: amount × 52
 * - monthly: amount × 12
 * - quarterly: amount × 4
 * - semi_annual: amount × 2
 * - yearly: amount × 1
 *
 * If occurrence_frequency is set:
 * - The `amount` field is the budget for the PERIOD.
 *   occurrence_frequency tells how it's distributed but does NOT change the total.
 *   e.g. monthly budget of 500k with freq=once → 500k/month → 6M/year
 *   e.g. monthly budget of 500k with freq=weekly → still 500k/month → 6M/year
 */
export function computeAnnualizedAmount(
  amount: number,
  period: string,
  activeDays?: string | null,
): number {
  if (period === 'daily') {
    const activeDaysArr = activeDays ? String(activeDays).split(',').filter(Boolean) : [];
    if (activeDaysArr.length > 0 && activeDaysArr.length < 7) {
      return Math.round(amount * activeDaysArr.length * 52.18);
    }
    return Math.round(amount * 365);
  }
  const multipliers: Record<string, number> = {
    weekly: 52,
    monthly: 12,
    quarterly: 4,
    semi_annual: 2,
    yearly: 1,
  };
  return Math.round(amount * (multipliers[period] || 12));
}
