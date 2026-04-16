import { supabase } from '@/integrations/supabase/client';

export async function skipRecurringOccurrence(id: string, currentSkipped: string[], dateToSkip: string) {
  const next = Array.from(new Set([...(currentSkipped || []), dateToSkip]));
  return supabase.from('recurring_transactions').update({ skipped_dates: next } as never).eq('id', id);
}

export async function setRecurringEndDate(id: string, endDate: string | null) {
  return supabase.from('recurring_transactions').update({ end_date: endDate } as never).eq('id', id);
}
