import { supabase } from '@/integrations/supabase/client';

export interface CategoryStats {
  category_id: string;
  total_amount: number;
  transaction_count: number;
  last_used: string | null;
  monthly_series: { month: string; total: number }[];
}

export async function fetchCategoryAnalytics(userId: string): Promise<Record<string, CategoryStats>> {
  const { data, error } = await supabase.rpc('get_category_analytics', { p_user_id: userId });
  if (error) throw error;
  const map: Record<string, CategoryStats> = {};
  (data ?? []).forEach((row: any) => {
    map[row.category_id] = {
      category_id: row.category_id,
      total_amount: Number(row.total_amount ?? 0),
      transaction_count: Number(row.transaction_count ?? 0),
      last_used: row.last_used ?? null,
      monthly_series: Array.isArray(row.monthly_series) ? row.monthly_series : [],
    };
  });
  return map;
}

/** Returns 6-point series, padding missing months with 0 */
export function normalizeSparkline(series: { month: string; total: number }[]): number[] {
  const now = new Date();
  const months: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(d.toISOString().slice(0, 10));
  }
  const map = new Map(series.map(s => [s.month?.slice(0, 10), Number(s.total) || 0]));
  return months.map(m => map.get(m) ?? 0);
}

/** Month-over-Month delta % between last 2 months */
export function momDelta(values: number[]): number | null {
  const n = values.length;
  if (n < 2) return null;
  const prev = values[n - 2];
  const curr = values[n - 1];
  if (prev === 0) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 100);
}

export const CATEGORY_TEMPLATE_PACKS = [
  {
    id: 'freelance',
    name: { fr: 'Freelance / Indépendant', en: 'Freelance' },
    icon: '💼',
    items: [
      { name: { fr: 'Revenus client', en: 'Client revenue' }, icon: '💰', color: '#10B981', type: 'income' },
      { name: { fr: 'Outils & SaaS', en: 'Tools & SaaS' }, icon: '🛠️', color: '#6366F1', type: 'expense' },
      { name: { fr: 'Coworking', en: 'Coworking' }, icon: '🏢', color: '#8B5CF6', type: 'expense' },
      { name: { fr: 'Impôts pro', en: 'Business tax' }, icon: '📊', color: '#EF4444', type: 'expense' },
      { name: { fr: 'Marketing', en: 'Marketing' }, icon: '📣', color: '#F59E0B', type: 'expense' },
    ],
  },
  {
    id: 'student',
    name: { fr: 'Étudiant', en: 'Student' },
    icon: '🎓',
    items: [
      { name: { fr: 'Bourse', en: 'Scholarship' }, icon: '🎓', color: '#10B981', type: 'income' },
      { name: { fr: 'Cantine', en: 'Cafeteria' }, icon: '🍽️', color: '#22C55E', type: 'expense' },
      { name: { fr: 'Livres', en: 'Books' }, icon: '📚', color: '#6366F1', type: 'expense' },
      { name: { fr: 'Transport étudiant', en: 'Student transport' }, icon: '🚌', color: '#3B82F6', type: 'expense' },
      { name: { fr: 'Sorties', en: 'Going out' }, icon: '🎉', color: '#EC4899', type: 'expense' },
    ],
  },
  {
    id: 'family',
    name: { fr: 'Famille', en: 'Family' },
    icon: '👨‍👩‍👧',
    items: [
      { name: { fr: 'Courses', en: 'Groceries' }, icon: '🛒', color: '#22C55E', type: 'expense' },
      { name: { fr: 'École enfants', en: 'School' }, icon: '🏫', color: '#6366F1', type: 'expense' },
      { name: { fr: 'Garde', en: 'Childcare' }, icon: '👶', color: '#EC4899', type: 'expense' },
      { name: { fr: 'Activités enfants', en: 'Kids activities' }, icon: '⚽', color: '#F59E0B', type: 'expense' },
      { name: { fr: 'Vacances famille', en: 'Family holidays' }, icon: '🏖️', color: '#14B8A6', type: 'expense' },
    ],
  },
  {
    id: 'investor',
    name: { fr: 'Investisseur', en: 'Investor' },
    icon: '📈',
    items: [
      { name: { fr: 'Dividendes', en: 'Dividends' }, icon: '💵', color: '#10B981', type: 'income' },
      { name: { fr: 'Loyers perçus', en: 'Rental income' }, icon: '🏘️', color: '#10B981', type: 'income' },
      { name: { fr: 'Frais courtage', en: 'Brokerage fees' }, icon: '🏦', color: '#EF4444', type: 'expense' },
      { name: { fr: 'Charges immobilières', en: 'Property charges' }, icon: '🔧', color: '#F97316', type: 'expense' },
    ],
  },
  {
    id: 'minimal',
    name: { fr: 'Minimaliste', en: 'Minimal' },
    icon: '✨',
    items: [
      { name: { fr: 'Revenu', en: 'Income' }, icon: '💰', color: '#10B981', type: 'income' },
      { name: { fr: 'Essentiels', en: 'Essentials' }, icon: '🏠', color: '#3B82F6', type: 'expense' },
      { name: { fr: 'Plaisirs', en: 'Joy' }, icon: '🎁', color: '#EC4899', type: 'expense' },
      { name: { fr: 'Épargne', en: 'Savings' }, icon: '🐷', color: '#8B5CF6', type: 'expense' },
    ],
  },
];
