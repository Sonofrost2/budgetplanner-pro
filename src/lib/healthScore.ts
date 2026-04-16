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

export function scoreLabel(score: number, locale: 'fr' | 'en' = 'fr'): { label: string; color: string } {
  const fr = locale === 'fr';
  if (score >= 80) return { label: fr ? 'Excellent' : 'Excellent', color: 'text-emerald-500' };
  if (score >= 60) return { label: fr ? 'Bon' : 'Good', color: 'text-green-500' };
  if (score >= 40) return { label: fr ? 'Moyen' : 'Fair', color: 'text-amber-500' };
  if (score >= 20) return { label: fr ? 'Faible' : 'Weak', color: 'text-orange-500' };
  return { label: fr ? 'Critique' : 'Critical', color: 'text-destructive' };
}
