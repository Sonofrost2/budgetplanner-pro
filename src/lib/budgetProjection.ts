/**
 * Shared budget projection and period calculation utilities.
 * Used by NotificationBell, BudgetsPage, BudgetAnalysisTab, and check-alerts edge function.
 */

export interface ProjectionResult {
  projection: number;
  dailyRate: number;
  daysToExceed: number;
  paceRatio: number;
  paceLabel: 'fast' | 'slow' | 'on_track';
}

/**
 * Compute budget projection using weighted 7-day average.
 */
export function computeBudgetProjection(
  spent: number,
  daysElapsed: number,
  daysRemaining: number,
  daysTotal: number,
  amount: number,
  spent7d: number,
  recentDays: number,
  isMax: boolean
): ProjectionResult {
  const safeDaysElapsed = Math.max(1, daysElapsed);
  const safeRecentDays = Math.max(1, Math.min(recentDays, safeDaysElapsed));

  const dailyRate = safeRecentDays > 0 ? spent7d / safeRecentDays : spent / safeDaysElapsed;
  const projection = spent + dailyRate * daysRemaining;
  const daysToExceed = dailyRate > 0 ? Math.round((amount - spent) / dailyRate) : Infinity;

  const expectedPace = daysTotal > 0 ? amount / daysTotal : 0;
  const actualPace = spent / safeDaysElapsed;
  const paceRatio = expectedPace > 0 ? actualPace / expectedPace : 0;

  let paceLabel: 'fast' | 'slow' | 'on_track' = 'on_track';
  if (isMax) {
    if (paceRatio > 1.15) paceLabel = 'fast';
    else if (paceRatio < 0.85) paceLabel = 'slow';
  } else {
    if (paceRatio < 0.85) paceLabel = 'slow';
    else if (paceRatio > 1.15) paceLabel = 'on_track';
  }

  return { projection, dailyRate, daysToExceed, paceRatio, paceLabel };
}

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
      const ref = new Date(referenceDate);
      periodStart = new Date(ref);
      while (periodStart > now) periodStart.setMonth(periodStart.getMonth() - 3);
      while (new Date(periodStart.getFullYear(), periodStart.getMonth() + 3, periodStart.getDate()) <= now) {
        periodStart.setMonth(periodStart.getMonth() + 3);
      }
      // Apply offset
      periodStart.setMonth(periodStart.getMonth() - offset * 3);
      periodEnd = new Date(periodStart);
      periodEnd.setMonth(periodEnd.getMonth() + 3);
      periodEnd.setDate(periodEnd.getDate() - 1);
    } else {
      const q = Math.floor(now.getMonth() / 3) - offset;
      const adjustedYear = now.getFullYear() + Math.floor(q / 4) * (q < 0 ? 1 : 0);
      const adjustedQ = ((q % 4) + 4) % 4;
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
 * Returns true if we are past the expected day or no expected day is set.
 */
export function shouldAlertForExpectedDay(
  expectedDay: number | null | undefined,
  now: Date,
  daysElapsed: number,
  daysTotal: number
): boolean {
  if (!expectedDay) {
    // No expected day: use the old >50% rule
    return daysElapsed > daysTotal * 0.5;
  }
  // Alert only if we have passed the expected day in the current period
  return now.getDate() >= expectedDay;
}

export function formatDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}
