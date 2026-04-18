/**
 * Savings logic — single source of truth for "what counts as live savings".
 *
 * Cross-module rule (validated with the user):
 *   Total savings = ONLY active goals (status='active') that are not paused
 *                   and not soft-deleted. Completed/archived/paused goals are
 *                   excluded everywhere (Dashboard, Wealth, Health, AI Coach).
 *
 *   Archived payment_accounts are excluded everywhere too — they no longer
 *   reflect a live position. Used by Wealth, Health, Forecast, etc.
 *
 *   Whenever you sum, count, or display "savings totals" in widgets, KPIs,
 *   AI prompts, projections, or notifications: route through these helpers.
 */

export interface MinimalGoal {
  status?: string | null;
  paused_at?: string | null;
  deleted_at?: string | null;
  current_amount?: number | string | null;
  target_amount?: number | string | null;
}

export interface MinimalAccount {
  archived_at?: string | null;
  deleted_at?: string | null;
  status?: string | null;
}

/** A goal that should still count toward live savings totals. */
export const isLiveGoal = (g: MinimalGoal | null | undefined): boolean => {
  if (!g) return false;
  if (g.deleted_at) return false;
  if (g.paused_at) return false;
  const status = g.status ?? 'active';
  return status === 'active';
};

/** A goal that has reached its target (regardless of current status). */
export const isReachedGoal = (g: MinimalGoal | null | undefined): boolean => {
  if (!g) return false;
  const cur = Number(g.current_amount ?? 0);
  const tgt = Number(g.target_amount ?? 0);
  return tgt > 0 && cur >= tgt;
};

/** A goal that is completed or archived (terminal state). */
export const isTerminalGoal = (g: MinimalGoal | null | undefined): boolean => {
  if (!g) return false;
  const status = g.status ?? 'active';
  return status === 'completed' || status === 'archived';
};

/** Account that should still count in active totals (not archived, not deleted). */
export const isLiveAccount = (a: MinimalAccount | null | undefined): boolean => {
  if (!a) return false;
  if (a.deleted_at) return false;
  if (a.archived_at) return false;
  const status = a.status ?? 'active';
  return status === 'active';
};

/** Sum of current_amount across only the live goals. */
export const liveSavingsTotal = (goals: MinimalGoal[] | null | undefined): number =>
  (goals ?? []).filter(isLiveGoal).reduce((s, g) => s + Number(g.current_amount ?? 0), 0);

/** Sum of target_amount across only the live goals. */
export const liveSavingsTarget = (goals: MinimalGoal[] | null | undefined): number =>
  (goals ?? []).filter(isLiveGoal).reduce((s, g) => s + Number(g.target_amount ?? 0), 0);

/** Count of goals that have hit their target but are still live (just-reached, awaiting user action). */
export const justReachedCount = (goals: MinimalGoal[] | null | undefined): number =>
  (goals ?? []).filter(g => isLiveGoal(g) && isReachedGoal(g)).length;

/** Partition helper for tabs and lists. */
export const partitionGoals = <T extends MinimalGoal>(goals: T[]) => ({
  active: goals.filter(g => isLiveGoal(g) && !isReachedGoal(g)),
  reached: goals.filter(g => isLiveGoal(g) && isReachedGoal(g)),
  archived: goals.filter(g => isTerminalGoal(g) || g.paused_at),
});
