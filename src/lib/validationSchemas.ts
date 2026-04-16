import { z } from 'zod';

// ─── Transaction ───
export const transactionSchema = (t: { descriptionRequired: string; invalidAmount: string; amountTooHigh: string; dateRequired: string; maxChars: (n: number) => string }, locale: string) =>
  z.object({
    description: z.string().trim()
      .min(1, t.descriptionRequired)
      .max(200, t.maxChars(200)),
    amount: z.string()
      .refine(v => Number(v) > 0, t.invalidAmount)
      .refine(v => Number(v) <= 999_999_999, t.amountTooHigh),
    type: z.enum(['income', 'expense']),
    category_id: z.string().optional(),
    account_id: z.string().optional(),
    date: z.string().min(1, t.dateRequired)
      .refine(v => {
        const y = new Date(v).getFullYear();
        return y >= 2000 && y <= new Date().getFullYear() + 2;
      }, locale === 'fr' ? 'Date invalide (2000–futur proche)' : 'Invalid date (2000–near future)'),
    notes: z.string().max(500, t.maxChars(500)).optional().or(z.literal('')),
  });

// ─── Budget ───
export const budgetSchema = (t: { nameRequired: string; invalidAmount: string; amountTooHigh: string; maxChars: (n: number) => string }, locale: string) =>
  z.object({
    name: z.string().trim().min(1, t.nameRequired).max(100, t.maxChars(100)),
    amount: z.string()
      .refine(v => Number(v) > 0, t.invalidAmount)
      .refine(v => Number(v) <= 999_999_999, t.amountTooHigh),
    category_id: z.string().optional(),
    period: z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'semi_annual', 'yearly']),
    alert_threshold: z.string().refine(v => { const n = Number(v); return n >= 1 && n <= 100; }, locale === 'fr' ? 'Seuil entre 1 et 100' : 'Threshold 1–100'),
    budget_type: z.enum(['expense', 'income']),
    control_type: z.enum(['max', 'min']),
    expected_day: z.string().optional().refine(v => !v || (Number(v) >= 1 && Number(v) <= 31), locale === 'fr' ? 'Jour entre 1 et 31' : 'Day 1–31'),
    occurrence_frequency: z.string().optional(),
    reference_date: z.string().optional(),
    active_days: z.string().optional(),
  });

// ─── Savings Goal ───
export const savingsGoalSchema = (locale: string) => {
  const fr = locale === 'fr';
  return z.object({
    name: z.string().trim().min(1, fr ? 'Nom requis' : 'Name required').max(100),
    target_amount: z.string().refine(v => Number(v) > 0, fr ? 'Montant cible > 0' : 'Target > 0'),
    icon: z.string().default('🎯'),
    deadline: z.string().optional().or(z.literal('')),
    account_id: z.string().optional().or(z.literal('')),
    monthly_contribution: z.string().optional().or(z.literal('')).refine(v => !v || Number(v) >= 0, fr ? 'Cotisation ≥ 0' : 'Contribution ≥ 0'),
    start_date: z.string().optional().or(z.literal('')),
    contribution_day: z.string().optional().or(z.literal('')).refine(v => !v || (Number(v) >= 1 && Number(v) <= 31), fr ? 'Jour entre 1 et 31' : 'Day 1–31'),
    is_locked: z.boolean(),
    interest_rate: z.string().optional().or(z.literal('')).refine(v => !v || (Number(v) >= 0 && Number(v) <= 100), fr ? 'Taux entre 0 et 100' : 'Rate 0–100'),
    interest_frequency: z.string().default('yearly'),
    bank_name: z.string().optional().or(z.literal('')),
  });
};

// ─── Debt ───
export const debtSchema = (locale: string) => {
  const fr = locale === 'fr';
  return z.object({
    creditor_name: z.string().trim().min(1, fr ? 'Le nom du créancier est requis' : 'Creditor name is required').max(200),
    total_amount: z.string().refine(v => Number(v) > 0, fr ? 'Le montant doit être supérieur à 0' : 'Amount must be greater than 0'),
    paid_amount: z.string().optional().or(z.literal('')).refine(v => !v || Number(v) >= 0, fr ? 'Le montant payé ne peut pas être négatif' : 'Paid amount cannot be negative'),
    due_date: z.string().optional().or(z.literal('')),
    notes: z.string().max(500).optional().or(z.literal('')),
    account_id: z.string().optional().or(z.literal('')),
  });
};

/** Parse a zod schema and return errors as Record<string, string> or null if valid */
export function validateForm<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; errors: Record<string, string> } {
  const result = schema.safeParse(data);
  if (result.success) return { success: true, data: result.data };
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0]?.toString();
    if (key && !errors[key]) errors[key] = issue.message;
  }
  return { success: false, errors };
}
