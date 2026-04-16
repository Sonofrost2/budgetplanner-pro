import { supabase } from '@/integrations/supabase/client';

type SoftDeletableTable =
  | 'transactions'
  | 'budgets'
  | 'debts'
  | 'savings_goals'
  | 'payment_accounts'
  | 'categories'
  | 'recurring_transactions';

/**
 * Soft delete a row by setting deleted_at = now().
 * Items remain in the trash for 30 days then auto-purged.
 */
export async function softDelete(table: SoftDeletableTable, id: string) {
  return supabase.from(table).update({ deleted_at: new Date().toISOString() } as never).eq('id', id);
}

/**
 * Soft delete multiple rows.
 */
export async function softDeleteMany(table: SoftDeletableTable, ids: string[]) {
  if (!ids.length) return { error: null, data: null };
  return supabase.from(table).update({ deleted_at: new Date().toISOString() } as never).in('id', ids);
}

/**
 * Restore a soft-deleted row.
 */
export async function restoreDeleted(table: SoftDeletableTable, id: string) {
  return supabase.from(table).update({ deleted_at: null } as never).eq('id', id);
}
