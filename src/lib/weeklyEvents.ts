/**
 * Calcul des événements financiers réellement applicables sur une semaine donnée.
 * Couvre : cotisations d'épargne, échéances de dettes et transactions récurrentes.
 * Utilisé par le préparateur hebdomadaire pour offrir une vue concrète et fiable.
 */

export type WeekEventKind = 'savings' | 'debt' | 'recurring';

export interface WeekEvent {
  id: string;
  kind: WeekEventKind;
  date: string;            // YYYY-MM-DD
  title: string;
  amount: number;          // Montant attendu (positif)
  direction: 'in' | 'out'; // in = revenu attendu, out = sortie attendue
  icon: string;
  meta?: string;           // Sous-titre (compte, créancier, fréquence…)
  status?: 'pending' | 'done' | 'overdue';
  href?: string;
}

const ymd = (d: Date) => d.toISOString().split('T')[0];
const inRange = (date: string, start: string, end: string) => date >= start && date <= end;

/* ── Savings goals ──────────────────────────────────────────── */
interface SavingsGoalLite {
  id: string;
  name: string;
  icon?: string | null;
  status: string;
  start_date?: string | null;
  monthly_contribution?: number | null;
  contribution_day?: number | null;
  deadline?: string | null;
  current_amount?: number | null;
  target_amount?: number | null;
}

function savingsEventsForWeek(goals: SavingsGoalLite[], weekStart: Date, weekEnd: Date): WeekEvent[] {
  const events: WeekEvent[] = [];
  const startStr = ymd(weekStart);
  const endStr = ymd(weekEnd);

  for (const g of goals) {
    if (g.status !== 'active') continue;
    const amount = Number(g.monthly_contribution ?? 0);
    if (amount <= 0) continue;
    const day = g.contribution_day && g.contribution_day >= 1 && g.contribution_day <= 31 ? g.contribution_day : null;
    if (!day) continue;

    // Borne de démarrage : ne génère pas d'échéance avant start_date
    const startDate = g.start_date ? new Date(g.start_date) : null;

    // Cherche un jour du mois correspondant au contribution_day dans la semaine
    for (let d = new Date(weekStart); d <= weekEnd; d.setDate(d.getDate() + 1)) {
      const lastDayOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      const effectiveDay = Math.min(day, lastDayOfMonth);
      if (d.getDate() !== effectiveDay) continue;
      const occDate = new Date(d);
      if (startDate && occDate < startDate) continue;
      const occStr = ymd(occDate);
      if (!inRange(occStr, startStr, endStr)) continue;
      events.push({
        id: `sav-${g.id}-${occStr}`,
        kind: 'savings',
        date: occStr,
        title: g.name,
        amount,
        direction: 'out', // sortie depuis compte courant vers compte épargne
        icon: g.icon || '🎯',
        meta: 'Cotisation épargne',
        status: 'pending',
        href: '/dashboard/savings',
      });
    }
  }
  return events;
}

/* ── Debts ──────────────────────────────────────────────────── */
interface DebtLite {
  id: string;
  creditor_name: string;
  total_amount: number;
  paid_amount?: number | null;
  due_date?: string | null;
  payment_schedule?: any;
}

function debtEventsForWeek(debts: DebtLite[], weekStart: Date, weekEnd: Date, today: string): WeekEvent[] {
  const events: WeekEvent[] = [];
  const startStr = ymd(weekStart);
  const endStr = ymd(weekEnd);

  for (const debt of debts) {
    const remaining = Number(debt.total_amount) - Number(debt.paid_amount ?? 0);
    if (remaining <= 0) continue;

    // 1) payment_schedule = liste d'échéances [{ date, amount, paid? }]
    const schedule = Array.isArray(debt.payment_schedule) ? debt.payment_schedule : [];
    let hasScheduledItem = false;
    for (const item of schedule) {
      const date: string | undefined = item?.date;
      const amount: number = Number(item?.amount ?? 0);
      const paid = Boolean(item?.paid);
      if (!date || amount <= 0) continue;
      if (!inRange(date, startStr, endStr)) continue;
      hasScheduledItem = true;
      events.push({
        id: `debt-${debt.id}-${date}`,
        kind: 'debt',
        date,
        title: debt.creditor_name,
        amount,
        direction: 'out',
        icon: '💳',
        meta: 'Échéance dette',
        status: paid ? 'done' : (date < today ? 'overdue' : 'pending'),
        href: '/dashboard/debts',
      });
    }

    // 2) due_date globale si pas d'échéance ciblée dans la semaine
    if (!hasScheduledItem && debt.due_date && inRange(debt.due_date, startStr, endStr)) {
      events.push({
        id: `debt-${debt.id}-due`,
        kind: 'debt',
        date: debt.due_date,
        title: debt.creditor_name,
        amount: remaining,
        direction: 'out',
        icon: '💳',
        meta: 'Solde dette',
        status: debt.due_date < today ? 'overdue' : 'pending',
        href: '/dashboard/debts',
      });
    }
  }
  return events;
}

/* ── Recurring transactions ─────────────────────────────────── */
interface RecurringLite {
  id: string;
  description: string;
  amount: number;
  type: string;
  frequency?: string | null;
  next_date: string;
  end_date?: string | null;
  active?: boolean | null;
  skipped_dates?: string[] | null;
  categories?: { name: string; icon: string; color: string } | null;
}

function addInterval(d: Date, freq: string): Date {
  const next = new Date(d);
  switch (freq) {
    case 'daily': next.setDate(d.getDate() + 1); break;
    case 'weekly': next.setDate(d.getDate() + 7); break;
    case 'biweekly': next.setDate(d.getDate() + 14); break;
    case 'monthly': next.setMonth(d.getMonth() + 1); break;
    case 'quarterly': next.setMonth(d.getMonth() + 3); break;
    case 'semi_annual': next.setMonth(d.getMonth() + 6); break;
    case 'yearly': next.setFullYear(d.getFullYear() + 1); break;
    default: next.setMonth(d.getMonth() + 1);
  }
  return next;
}

function recurringEventsForWeek(items: RecurringLite[], weekStart: Date, weekEnd: Date, today: string): WeekEvent[] {
  const events: WeekEvent[] = [];
  const startStr = ymd(weekStart);
  const endStr = ymd(weekEnd);

  for (const r of items) {
    if (r.active === false) continue;
    const freq = (r.frequency || 'monthly');
    const skipped = new Set(r.skipped_dates || []);
    const endLimit = r.end_date ? new Date(r.end_date) : null;

    // Avance ou recule depuis next_date pour atteindre la fenêtre courante
    let cursor = new Date(r.next_date);
    if (Number.isNaN(cursor.getTime())) continue;

    // Si next_date est très en arrière, avance jusqu'à entrer dans la fenêtre (bornes raisonnables)
    let safety = 0;
    while (cursor < weekStart && safety < 500) {
      cursor = addInterval(cursor, freq);
      safety++;
    }
    if (safety >= 500) continue;

    // Itère dans la semaine uniquement
    while (cursor <= weekEnd && safety < 600) {
      if (endLimit && cursor > endLimit) break;
      const dStr = ymd(cursor);
      if (inRange(dStr, startStr, endStr) && !skipped.has(dStr)) {
        events.push({
          id: `rec-${r.id}-${dStr}`,
          kind: 'recurring',
          date: dStr,
          title: r.description,
          amount: Number(r.amount),
          direction: r.type === 'income' ? 'in' : 'out',
          icon: r.categories?.icon || (r.type === 'income' ? '💰' : '🔁'),
          meta: r.categories?.name || (r.type === 'income' ? 'Revenu récurrent' : 'Dépense récurrente'),
          status: dStr < today ? 'overdue' : 'pending',
          href: '/dashboard/recurring',
        });
      }
      cursor = addInterval(cursor, freq);
      safety++;
    }
  }
  return events;
}

/* ── Public API ─────────────────────────────────────────────── */
export function buildWeekEvents(
  weekStart: Date,
  weekEnd: Date,
  data: {
    savingsGoals: SavingsGoalLite[];
    debts: DebtLite[];
    recurring: RecurringLite[];
  }
): WeekEvent[] {
  const today = ymd(new Date());
  const events = [
    ...savingsEventsForWeek(data.savingsGoals, weekStart, weekEnd),
    ...debtEventsForWeek(data.debts, weekStart, weekEnd, today),
    ...recurringEventsForWeek(data.recurring, weekStart, weekEnd, today),
  ];
  // Tri chronologique puis par direction (sorties d'abord)
  return events.sort((a, b) => a.date.localeCompare(b.date) || a.direction.localeCompare(b.direction));
}

export function summarizeWeekEvents(events: WeekEvent[]) {
  let inflow = 0;
  let outflow = 0;
  let overdue = 0;
  for (const e of events) {
    if (e.status === 'overdue') overdue++;
    if (e.direction === 'in') inflow += e.amount;
    else outflow += e.amount;
  }
  return { inflow, outflow, net: inflow - outflow, overdue, count: events.length };
}