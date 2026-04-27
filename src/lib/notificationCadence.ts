/**
 * Shared cadence helpers for client-side notifications (NotificationBell + Coach toasts).
 * Aligned with edge functions: alerts fire at J-5, J-2, J-0 only; status alerts respect
 * user-defined frequency; quiet hours are honored client-side.
 */

const STEP_KEY = 'notif_steps_v1';

export interface CadencePrefs {
  quiet_hours_enabled?: boolean;
  quiet_hours_start?: number;
  quiet_hours_end?: number;
  status_reminder_frequency?: 'weekly' | 'every_3d' | 'on_change_only' | 'monthly';
  budget_alerts?: boolean;
  budget_projections?: boolean;
  savings_reminders?: boolean;
  recurring_reminders?: boolean;
  balance_discrepancy?: boolean;
  goal_reached?: boolean;
}

/** Should an "upcoming" reminder fire today? Triggers at J-5, J-2, J-0. */
export function shouldFireUpcoming(daysUntil: number): boolean {
  return daysUntil === 0 || daysUntil === 2 || daysUntil === 5;
}

/** Wider deadline cadence for goals/debts (J-30, J-7, J-2, J-0). */
export function shouldFireDeadline(daysUntil: number): boolean {
  return daysUntil === 0 || daysUntil === 2 || daysUntil === 7 || daysUntil === 30;
}

/** Bilan fires only on the exact period-end day. */
export function shouldFireBilan(periodEnd: Date, now: Date): boolean {
  return (
    periodEnd.getFullYear() === now.getFullYear() &&
    periodEnd.getMonth() === now.getMonth() &&
    periodEnd.getDate() === now.getDate()
  );
}

/** True if `now` is inside the user's configured quiet-hours window. */
export function inQuietHours(now: Date, prefs?: CadencePrefs | null): boolean {
  if (!prefs?.quiet_hours_enabled) return false;
  const h = now.getHours();
  const start = prefs.quiet_hours_start ?? 22;
  const end = prefs.quiet_hours_end ?? 7;
  if (start === end) return false;
  if (start < end) return h >= start && h < end;
  // Wraps midnight
  return h >= start || h < end;
}

/** Round a percentage to its 10-pt bucket (so 0..9 → 0, 10..19 → 10, etc.). */
export function getStepBucket(pct: number): number {
  if (!isFinite(pct)) return 0;
  return Math.max(0, Math.min(200, Math.floor(pct / 10) * 10));
}

function readSteps(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STEP_KEY);
    if (!raw) return {};
    return JSON.parse(raw) || {};
  } catch {
    return {};
  }
}

function writeSteps(map: Record<string, number>) {
  try {
    localStorage.setItem(STEP_KEY, JSON.stringify(map));
  } catch {
    /* ignore quota */
  }
}

/**
 * True if `currentBucket` differs from the last-seen bucket for `key`.
 * Updates the stored bucket as a side-effect.
 */
export function hasStepChanged(key: string, currentBucket: number): boolean {
  const map = readSteps();
  const prev = map[key];
  if (prev === currentBucket) return false;
  map[key] = currentBucket;
  writeSteps(map);
  return true;
}

/** Days between two calendar dates (ignores time of day). */
export function daysBetween(from: Date, to: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

/** Local-timezone YYYY-MM-DD (avoids the off-by-one around midnight that
 *  `Date.toISOString()` introduces for users east/west of UTC). */
export function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parse a `YYYY-MM-DD` string as a LOCAL date (midnight local time),
 *  not UTC. Required for fields stored as DATE in Postgres so that day-diffs
 *  computed against `new Date()` don't drift by one day in non-UTC zones. */
export function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** Days until next monthly anniversary of `day-of-month` (handles month rollover). */
export function daysUntilMonthDay(targetDay: number, now: Date): number {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = new Date(now.getFullYear(), now.getMonth(), targetDay);
  if (next < today) next = new Date(now.getFullYear(), now.getMonth() + 1, targetDay);
  return daysBetween(today, next);
}

/** Localized "in N days" / "today" / "passed" / "this week" label. */
export function formatDaysLeftLabel(daysLeft: number, locale: string, special?: string): string {
  const isFr = locale === 'fr';
  if (special === 'thisWeek') return isFr ? 'cette semaine' : 'this week';
  if (special === 'passed') return isFr ? 'passé' : 'passed';
  if (daysLeft === 0) return isFr ? "aujourd'hui" : 'today';
  if (daysLeft === 1) return isFr ? 'demain' : 'tomorrow';
  return isFr ? `dans ${daysLeft} jours` : `in ${daysLeft} days`;
}
