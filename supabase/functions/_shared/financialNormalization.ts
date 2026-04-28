/**
 * Helpers de normalisation financière (équivalent Deno de
 * src/lib/financialNormalization.ts) pour usage dans les edge functions IA.
 * Règle : tout ramener à l'année avant comparaison.
 */

export function annualizeRate(rate: number, frequency: string | null | undefined): number {
  const r = Number(rate) || 0;
  if (r === 0) return 0;
  const periodsPerYear: Record<string, number> = {
    daily: 365, weekly: 52, monthly: 12, quarterly: 4, semi_annual: 2, yearly: 1,
  };
  const n = periodsPerYear[String(frequency || "yearly")] ?? 1;
  if (n === 1) return r;
  const decimal = r / 100;
  const annual = Math.pow(1 + decimal, n) - 1;
  return Math.round(annual * 10000) / 100;
}

export function annualInterestCost(remaining: number, ratePct: number, interestType?: string | null): number {
  const r = Math.max(0, Number(ratePct) || 0) / 100;
  const principal = Math.max(0, Number(remaining) || 0);
  if (interestType === "compound") return Math.round(principal * (Math.pow(1 + r, 1) - 1));
  return Math.round(principal * r);
}

export function enrichSavingsList<T extends Record<string, any>>(goals: T[]): Array<T & {
  annualized_rate_pct: number;
}> {
  return (goals || []).map((g) => ({
    ...g,
    annualized_rate_pct: annualizeRate(Number(g.interest_rate) || 0, g.interest_frequency),
  }));
}

export function enrichDebtsList<T extends Record<string, any>>(debts: T[]): Array<T & {
  annualized_rate_pct: number;
  annual_interest_cost: number;
  remaining: number;
}> {
  return (debts || []).map((d) => {
    const remaining = Number(d.total_amount || d.total || 0) - Number(d.paid_amount || d.paid || 0);
    const annualRate = annualizeRate(Number(d.interest_rate) || 0, d.interest_frequency || "yearly");
    return {
      ...d,
      annualized_rate_pct: annualRate,
      annual_interest_cost: annualInterestCost(remaining, annualRate, d.interest_type),
      remaining,
    };
  });
}