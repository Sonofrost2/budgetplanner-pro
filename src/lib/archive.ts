import { supabase } from '@/integrations/supabase/client';

type ArchivableTable = 'payment_accounts' | 'categories';

export async function archiveItem(table: ArchivableTable, id: string) {
  return supabase.from(table).update({ archived_at: new Date().toISOString() } as never).eq('id', id);
}

export async function unarchiveItem(table: ArchivableTable, id: string) {
  return supabase.from(table).update({ archived_at: null } as never).eq('id', id);
}

type PausableTable = 'budgets' | 'savings_goals';

export async function pauseItem(table: PausableTable, id: string) {
  return supabase.from(table).update({ paused_at: new Date().toISOString() } as never).eq('id', id);
}

export async function resumeItem(table: PausableTable, id: string) {
  return supabase.from(table).update({ paused_at: null } as never).eq('id', id);
}
