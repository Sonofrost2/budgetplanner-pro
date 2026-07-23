import { z } from 'zod';

// ─── Transaction ───
export const transactionSchema = (t: { descriptionRequired: string; invalidAmount: string; amountTooHigh: string; dateRequired: string; maxChars: (n: number) => string }, locale: string) =>
  z.object({
    description: z.string().trim()
      .min(1, t.descriptionRequired)
      .max(200, t.maxChars(200)),
    amount: z.string()
      .min(1, t.invalidAmount)
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

// ─── Transfer ───
// Shares amount/date/description/notes rules with transactions so both flows
// speak the same validation language. Adds the two account fields specific
// to transfers and enforces distinct source/destination.
export const transferSchema = (
  t: { descriptionRequired: string; invalidAmount: string; amountTooHigh: string; dateRequired: string; maxChars: (n: number) => string; transferSameAccount: string },
  locale: string,
) => {
  const fr = locale === 'fr';
  return z.object({
    // Description is optional for transfers (UI labels it "(optionnel)").
    // Accept undefined, null, or '' — the API layer normalizes to NULL.
    description: z
      .union([z.string().trim().max(200, t.maxChars(200)), z.literal(''), z.null()])
      .optional(),
    amount: z.string()
      .min(1, t.invalidAmount)
      .refine(v => Number(v) > 0, t.invalidAmount)
      .refine(v => Number(v) <= 999_999_999, t.amountTooHigh),
    date: z.string().min(1, t.dateRequired),
    from_account_id: z.string().min(1, fr ? 'Compte source requis' : 'Source account required'),
    to_account_id: z.string().min(1, fr ? 'Compte destinataire requis' : 'Destination account required'),
    notes: z.string().max(500, t.maxChars(500)).optional().or(z.literal('')),
  }).superRefine((data, ctx) => {
    if (data.from_account_id && data.to_account_id && data.from_account_id === data.to_account_id) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['to_account_id'], message: t.transferSameAccount });
    }
  });
};

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
    name: z.string().trim().min(1, fr ? 'Nom requis' : 'Name required').max(100, fr ? 'Nom max 100 car.' : 'Max 100 chars'),
    target_amount: z.string()
      .refine(v => Number(v) > 0, fr ? 'Montant cible > 0' : 'Target > 0')
      .refine(v => Number(v) <= 999_999_999, fr ? 'Montant trop élevé' : 'Amount too high'),
    icon: z.string().default('🎯'),
    deadline: z.string().optional().or(z.literal('')),
    account_id: z.string().optional().or(z.literal('')),
    monthly_contribution: z.string().optional().or(z.literal(''))
      .refine(v => !v || Number(v) >= 0, fr ? 'Cotisation ≥ 0' : 'Contribution ≥ 0')
      .refine(v => !v || Number(v) <= 999_999_999, fr ? 'Cotisation trop élevée' : 'Contribution too high'),
    start_date: z.string().optional().or(z.literal('')),
    contribution_day: z.string().optional().or(z.literal(''))
      .refine(v => !v || (Number(v) >= 1 && Number(v) <= 31), fr ? 'Jour entre 1 et 31' : 'Day 1–31'),
    is_locked: z.boolean(),
    interest_rate: z.string().optional().or(z.literal(''))
      .refine(v => !v || (Number(v) >= 0 && Number(v) <= 100), fr ? 'Taux entre 0 et 100' : 'Rate 0–100'),
    interest_frequency: z.enum(['daily','weekly','monthly','quarterly','semi_annual','yearly']).default('yearly'),
    bank_name: z.string().max(100).optional().or(z.literal('')),
    opening_balance: z.string().optional().or(z.literal(''))
      .refine(v => !v || Number(v) >= 0, fr ? 'Solde initial ≥ 0' : 'Opening balance ≥ 0'),
    is_renewable: z.boolean().optional(),
    renewal_frequency: z.enum(['monthly','quarterly','semi_annual','yearly']).optional(),
    priority: z.string().optional(),
    purpose: z.string().optional(),
    notes: z.string().max(500, fr ? 'Notes max 500 car.' : 'Notes max 500 chars').optional().or(z.literal('')),
  }).superRefine((data, ctx) => {
    // Cohérence : deadline > start_date
    if (data.start_date && data.deadline) {
      if (new Date(data.deadline) <= new Date(data.start_date)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['deadline'],
          message: fr ? 'La date de fin doit être postérieure au début' : 'End date must be after start date',
        });
      }
    }
    // Cohérence : opening_balance ≤ target_amount
    if (data.opening_balance && data.target_amount) {
      if (Number(data.opening_balance) > Number(data.target_amount)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['opening_balance'],
          message: fr ? 'Le solde initial dépasse la cible' : 'Opening balance exceeds target',
        });
      }
    }
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

// ─── Category ───
// Shared schema used by the unified CategoryForm (create + edit).
// Enforces uniqueness (name + type), max depth via depthOfParent + 1 ≤ 5
// and consistent icon/color/type. The `existing` list is passed in so we can
// detect name collisions without requiring a DB round-trip.
export const categorySchema = (
  locale: string,
  ctx: {
    existingByTypeName: Set<string>; // key = `${type}::${normalizedName}`
    editingId?: string | null;
    depthOfSelectedParent: number; // 0 when parent = root
    maxDepth: number;
  },
) => {
  const fr = locale === 'fr';
  return z.object({
    name: z.string().trim()
      .min(1, fr ? 'Le nom est requis' : 'Name is required')
      .max(50, fr ? 'Max 50 caractères' : 'Max 50 characters'),
    icon: z.string().min(1, fr ? 'Icône requise' : 'Icon required').max(4),
    color: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, fr ? 'Couleur invalide' : 'Invalid color'),
    type: z.enum(['expense', 'income']),
    parent_category_id: z.string().optional().nullable().or(z.literal('')),
  }).superRefine((data, zctx) => {
    // Unique by type + normalized name (excluding editing row)
    const key = `${data.type}::${data.name.trim().toLowerCase()}`;
    if (ctx.existingByTypeName.has(key)) {
      zctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['name'],
        message: fr ? 'Ce nom existe déjà pour ce type' : 'This name already exists for this type',
      });
    }
    // Max depth
    if (data.parent_category_id && ctx.depthOfSelectedParent + 1 > ctx.maxDepth) {
      zctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['parent_category_id'],
        message: fr
          ? `Hiérarchie max ${ctx.maxDepth} niveaux`
          : `Max ${ctx.maxDepth}-level hierarchy`,
      });
    }
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
