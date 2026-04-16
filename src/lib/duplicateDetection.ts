import { supabase } from '@/integrations/supabase/client';

export interface DuplicateCandidate {
  id: string;
  description: string;
  amount: number;
  date: string;
  created_at: string;
}

/**
 * Detect potential duplicate transactions:
 * - Same user, same amount, same account, same date
 * - Created within last 24h
 * - Excludes the current transaction (when editing)
 */
export async function findDuplicateTransactions(params: {
  userId: string;
  amount: number;
  accountId: string | null;
  date: string;
  excludeId?: string;
}): Promise<DuplicateCandidate[]> {
  const { userId, amount, accountId, date, excludeId } = params;
  if (!accountId || !amount) return [];

  let q = supabase
    .from('transactions')
    .select('id, description, amount, date, created_at')
    .eq('user_id', userId)
    .eq('amount', amount)
    .eq('account_id', accountId)
    .eq('date', date)
    .is('deleted_at', null)
    .gte('created_at', new Date(Date.now() - 24 * 3600_000).toISOString())
    .order('created_at', { ascending: false })
    .limit(5);

  if (excludeId) q = q.neq('id', excludeId);

  const { data, error } = await q;
  if (error) {
    console.warn('Duplicate detection failed:', error.message);
    return [];
  }
  return data ?? [];
}

// Backwards-compat alias used by newer Phase E callsites
export const detectDuplicates = (p: {
  user_id: string; amount: number; account_id: string | null; date: string; excludeId?: string;
}) => findDuplicateTransactions({ userId: p.user_id, amount: p.amount, accountId: p.account_id, date: p.date, excludeId: p.excludeId });
