import { supabase } from '@/integrations/supabase/client';

export interface HealthScore {
  score: number;
  income_3m: number;
  expense_3m: number;
  savings_total: number;
  debt_total: number;
  savings_rate: number;
  debt_ratio: number;
  account_count: number;
}

export async function fetchHealthScore(userId: string): Promise<HealthScore | null> {
  const { data, error } = await supabase.rpc('compute_health_score' as never, { p_user_id: userId } as never);
  if (error) { console.error('healthScore', error); return null; }
  return data as unknown as HealthScore;
}

export interface RegularizationStats {
  total: number;
  count: number;
  incomeTotal: number;
  expenseTotal: number;
}

export async function fetchMonthlyRegularizationStats(userId: string): Promise<RegularizationStats> {
  const empty: RegularizationStats = { total: 0, count: 0, incomeTotal: 0, expenseTotal: 0 };
  try {
    const { data: cats } = await supabase
      .from('categories')
      .select('id, name')
      .eq('user_id', userId);
    const ids = (cats || [])
      .filter(c => {
        const n = (c.name || '').toLowerCase();
        return n.includes('régularisation') || n.includes('regularisation') || n.includes('adjustment');
      })
      .map(c => c.id);
    if (ids.length === 0) return empty;

    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

    const { data: txs } = await supabase
      .from('transactions')
      .select('amount, type')
      .eq('user_id', userId)
      .in('category_id', ids)
      .is('deleted_at', null)
      .gte('date', start)
      .lte('date', end);

    let income = 0, expense = 0;
    (txs || []).forEach(t => {
      const a = Number(t.amount) || 0;
      if (t.type === 'income') income += a;
      else if (t.type === 'expense') expense += a;
    });
    return {
      total: income - expense,
      count: txs?.length || 0,
      incomeTotal: income,
      expenseTotal: expense,
    };
  } catch (e) {
    console.error('fetchMonthlyRegularizationStats', e);
    return empty;
  }
}

export function scoreLabel(score: number, locale: 'fr' | 'en' = 'fr'): { label: string; color: string } {
  const fr = locale === 'fr';
  if (score >= 80) return { label: fr ? 'Excellent' : 'Excellent', color: 'text-emerald-500' };
  if (score >= 60) return { label: fr ? 'Bon' : 'Good', color: 'text-green-500' };
  if (score >= 40) return { label: fr ? 'Moyen' : 'Fair', color: 'text-amber-500' };
  if (score >= 20) return { label: fr ? 'Faible' : 'Weak', color: 'text-orange-500' };
  return { label: fr ? 'Critique' : 'Critical', color: 'text-destructive' };
}
