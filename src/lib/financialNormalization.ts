/**
 * Helpers de normalisation financière utilisés AVANT toute comparaison
 * entre objets ayant des périodicités hétérogènes (taux, contributions,
 * remboursements, etc.).
 *
 * Règle d'or : on ramène tout à l'année avant de comparer. Sinon on
 * compare des choux et des carottes (ex. taux 5% mensuel vs 5% annuel).
 */

export type RateFrequency =
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'quarterly'
  | 'semi_annual'
  | 'yearly';

/** Convertit n'importe quel taux périodique en équivalent annuel composé.
 *  Formule : (1 + r_period)^n - 1 où n = nombre de périodes par an.
 *  Pour r faibles (< ~10%), reste très proche d'un simple × n. */
export function annualizeRate(rate: number, frequency: RateFrequency | string | null | undefined): number {
  const r = Number(rate) || 0;
  if (r === 0) return 0;
  const periodsPerYear: Record<string, number> = {
    daily: 365,
    weekly: 52,
    monthly: 12,
    quarterly: 4,
    semi_annual: 2,
    yearly: 1,
  };
  const n = periodsPerYear[String(frequency || 'yearly')] ?? 1;
  if (n === 1) return r;
  // Composé : on travaille en %, donc on divise par 100 puis on remultiplie
  const decimal = r / 100;
  const annual = Math.pow(1 + decimal, n) - 1;
  return Math.round(annual * 10000) / 100; // 2 décimales en %
}

/** Convertit une contribution périodique en équivalent mensuel.
 *  Utile pour comparer des cotisations d'épargne hétérogènes. */
export function toMonthlyContribution(amount: number, frequency: string | null | undefined): number {
  const a = Number(amount) || 0;
  if (a === 0) return 0;
  const monthly: Record<string, number> = {
    daily: a * 30,
    weekly: a * 4.33,
    monthly: a,
    quarterly: a / 3,
    semi_annual: a / 6,
    yearly: a / 12,
  };
  return Math.round(monthly[String(frequency || 'monthly')] ?? a);
}

/** Enrichit un objectif d'épargne avec son taux annualisé pour une comparaison
 *  juste entre objectifs ayant des fréquences de capitalisation différentes. */
export function enrichSavingsForComparison<T extends { interest_rate?: any; interest_frequency?: any; monthly_contribution?: any }>(
  goal: T,
): T & { annualized_rate_pct: number; monthly_contribution_eq: number } {
  return {
    ...goal,
    annualized_rate_pct: annualizeRate(Number(goal.interest_rate) || 0, goal.interest_frequency),
    monthly_contribution_eq: Number(goal.monthly_contribution) || 0,
  };
}

/** Calcule le coût annuel d'intérêt d'une dette pour comparaison avalanche. */
export function annualInterestCost(remaining: number, ratePct: number, interestType?: string | null): number {
  const r = Math.max(0, Number(ratePct) || 0) / 100;
  const principal = Math.max(0, Number(remaining) || 0);
  if (interestType === 'compound') {
    return Math.round(principal * (Math.pow(1 + r, 1) - 1));
  }
  return Math.round(principal * r);
}