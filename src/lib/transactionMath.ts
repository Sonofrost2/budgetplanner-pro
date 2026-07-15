/**
 * Transaction math — single source of truth.
 *
 * Rules of the house:
 *  - Transfers NEVER count as income or expense.
 *    A transfer is either flagged via `linked_transfer_id` or its description
 *    begins with "Transfert:" / "Transfer:" (legacy rows before backfill).
 *  - All helpers accept a permissive shape so callers using RPC rows or
 *    partial selects don't need to cast.
 */

export interface TxLike {
  type?: string | null;
  amount?: number | string | null;
  description?: string | null;
  linked_transfer_id?: string | null;
  date?: string | null;
  category_id?: string | null;
  account_id?: string | null;
}

export const isTransfer = (tx: TxLike | null | undefined): boolean => {
  if (!tx) return false;
  if (tx.linked_transfer_id) return true;
  const d = String(tx.description || '').trim().toLowerCase();
  return d.startsWith('transfert:') || d.startsWith('transfer:');
};

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? 0));
  return Number.isFinite(n) ? n : 0;
};

/** Sum of income rows, excluding transfers. */
export const sumIncome = (rows: TxLike[]): number =>
  rows.reduce((acc, tx) => (tx.type === 'income' && !isTransfer(tx) ? acc + num(tx.amount) : acc), 0);

/** Sum of expense rows, excluding transfers. */
export const sumExpense = (rows: TxLike[]): number =>
  rows.reduce((acc, tx) => (tx.type === 'expense' && !isTransfer(tx) ? acc + num(tx.amount) : acc), 0);

/** Net cash flow (income - expense), excluding transfers. */
export const netFlow = (rows: TxLike[]): number => sumIncome(rows) - sumExpense(rows);

/** Savings rate as a fraction of income (0..1). Returns 0 if no income. */
export const savingsRate = (rows: TxLike[]): number => {
  const inc = sumIncome(rows);
  if (inc <= 0) return 0;
  return Math.max(0, Math.min(1, (inc - sumExpense(rows)) / inc));
};

/** Filter out transfers — convenience for lists and charts. */
export const excludeTransfers = <T extends TxLike>(rows: T[]): T[] =>
  rows.filter((tx) => !isTransfer(tx));

export type Granularity = 'day' | 'week' | 'month';

const keyFor = (date: Date, g: Granularity): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  if (g === 'day') return `${y}-${m}-${d}`;
  if (g === 'month') return `${y}-${m}`;
  // ISO week (Mon-Sun)
  const tmp = new Date(Date.UTC(y, date.getMonth(), date.getDate()));
  const day = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((+tmp - +yearStart) / 86400000 + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
};

/** Bucketize rows by day/week/month (transfers excluded). */
export const groupByPeriod = (
  rows: TxLike[],
  granularity: Granularity = 'day',
): Map<string, { income: number; expense: number; net: number }> => {
  const out = new Map<string, { income: number; expense: number; net: number }>();
  for (const tx of rows) {
    if (!tx.date || isTransfer(tx)) continue;
    const d = new Date(tx.date);
    if (Number.isNaN(+d)) continue;
    const k = keyFor(d, granularity);
    const cur = out.get(k) ?? { income: 0, expense: 0, net: 0 };
    const a = num(tx.amount);
    if (tx.type === 'income') cur.income += a;
    else if (tx.type === 'expense') cur.expense += a;
    cur.net = cur.income - cur.expense;
    out.set(k, cur);
  }
  return out;
};

export interface PeriodDelta {
  current: number;
  previous: number;
  delta: number;
  pct: number | null; // null when previous is 0 and current is 0; +Infinity if previous is 0 and current > 0
  trend: 'up' | 'down' | 'flat';
}

export const comparePeriods = (current: number, previous: number): PeriodDelta => {
  const delta = current - previous;
  let pct: number | null;
  if (previous === 0 && current === 0) pct = null;
  else if (previous === 0) pct = Number.POSITIVE_INFINITY;
  else pct = (delta / Math.abs(previous)) * 100;
  const trend: PeriodDelta['trend'] = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
  return { current, previous, delta, pct, trend };
};

/** Split rows into two contiguous windows relative to a pivot date. */
export const splitByPivot = <T extends TxLike>(
  rows: T[],
  pivotISO: string,
): { before: T[]; onOrAfter: T[] } => {
  const pivot = pivotISO;
  const before: T[] = [];
  const onOrAfter: T[] = [];
  for (const tx of rows) {
    if (!tx.date) continue;
    if (tx.date < pivot) before.push(tx);
    else onOrAfter.push(tx);
  }
  return { before, onOrAfter };
};
