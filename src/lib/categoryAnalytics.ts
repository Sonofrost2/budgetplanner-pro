import { supabase } from '@/integrations/supabase/client';
import type { Category } from '@/hooks/useDashboardData';

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

/** Simple linear regression slope on a normalized series (index vs value) */
export function trendSlope(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const meanX = (n - 1) / 2;
  const meanY = values.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - meanX) * (values[i] - meanY);
    den += (i - meanX) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

export interface CategoryMetrics {
  id: string;
  currentMonth: number;
  previousMonth: number;
  delta: number | null;
  slope: number;
  shareOfType: number;
  txCount: number;
  last6mSum: number;
  hasBudget: boolean;
  isRoot: boolean;
  depth: number;
}

/** Aggregate per-category metrics used by the UI */
export function computeCategoryMetrics(
  categories: Category[],
  stats: Record<string, CategoryStats>,
  budgetCategoryIds: Set<string>,
  depthById: Map<string, number>,
): Map<string, CategoryMetrics> {
  // Totals per type over the current month
  const totalByType = new Map<string, number>();
  categories.forEach((c) => {
    const s = stats[c.id];
    const series = normalizeSparkline(s?.monthly_series ?? []);
    const current = series[series.length - 1] ?? 0;
    totalByType.set(c.type, (totalByType.get(c.type) ?? 0) + current);
  });

  const out = new Map<string, CategoryMetrics>();
  categories.forEach((c) => {
    const s = stats[c.id];
    const series = normalizeSparkline(s?.monthly_series ?? []);
    const current = series[series.length - 1] ?? 0;
    const prev = series[series.length - 2] ?? 0;
    const typeTotal = totalByType.get(c.type) ?? 0;
    out.set(c.id, {
      id: c.id,
      currentMonth: current,
      previousMonth: prev,
      delta: momDelta(series),
      slope: trendSlope(series),
      shareOfType: typeTotal > 0 ? current / typeTotal : 0,
      txCount: s?.transaction_count ?? 0,
      last6mSum: series.reduce((a, b) => a + b, 0),
      hasBudget: budgetCategoryIds.has(c.id),
      isRoot: !c.parent_category_id,
      depth: depthById.get(c.id) ?? 1,
    });
  });
  return out;
}

/**
 * Taxonomy score 0-100. Penalises: unused categories, no hierarchy at all,
 * catch-all names ("Autres"/"Other"/"Divers"), categories without budget on
 * high-spend expense buckets, duplicate names.
 */
export function computeTaxonomyScore(
  categories: Category[],
  metrics: Map<string, CategoryMetrics>,
): { score: number; issues: number } {
  if (categories.length === 0) return { score: 0, issues: 0 };

  let issues = 0;
  const CATCH_ALL = /^(autre|autres|divers|misc|other|others)$/i;

  // Unused count
  const unused = categories.filter((c) => (metrics.get(c.id)?.txCount ?? 0) === 0).length;
  issues += unused;

  // Flat hierarchy: everything at root and > 8 categories
  const roots = categories.filter((c) => !c.parent_category_id).length;
  const flat = roots === categories.length && categories.length > 8;
  if (flat) issues += Math.min(10, roots - 8);

  // Catch-all buckets
  const catchAll = categories.filter((c) => CATCH_ALL.test(c.name.trim())).length;
  issues += catchAll * 2;

  // Duplicate names (same normalized name & type)
  const seen = new Map<string, number>();
  categories.forEach((c) => {
    const k = `${c.type}::${c.name.trim().toLowerCase()}`;
    seen.set(k, (seen.get(k) ?? 0) + 1);
  });
  const dupes = Array.from(seen.values()).filter((n) => n > 1).length;
  issues += dupes * 3;

  // High-spend expense buckets without a linked budget
  const orphans = categories.filter((c) => {
    if (c.type !== 'expense') return false;
    const m = metrics.get(c.id);
    return m && !m.hasBudget && m.currentMonth > 0;
  }).length;
  issues += orphans;

  const raw = 100 - Math.min(100, Math.round((issues / Math.max(4, categories.length)) * 100));
  return { score: Math.max(0, Math.min(100, raw)), issues };
}

/** True if a category name matches known "catch-all" patterns */
export function isCatchAllCategory(name: string): boolean {
  return /^(autre|autres|divers|misc|other|others)$/i.test(name.trim());
}

/** Find potential duplicate categories (same type + fuzzy same name) */
export function findDuplicateCategories(categories: Category[]): Array<{ ids: string[]; name: string; type: string }> {
  const norm = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const bucket = new Map<string, Category[]>();
  categories.forEach((c) => {
    const key = `${c.type}::${norm(c.name)}`;
    (bucket.get(key) ?? bucket.set(key, []).get(key)!).push(c);
  });
  const out: Array<{ ids: string[]; name: string; type: string }> = [];
  for (const arr of bucket.values()) {
    if (arr.length > 1) out.push({ ids: arr.map((c) => c.id), name: arr[0].name, type: arr[0].type });
  }
  return out;
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
