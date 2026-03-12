import { supabase } from '@/integrations/supabase/client';

/**
 * Recalculate account balance using server-side SQL function.
 * Much more efficient than fetching all transactions client-side.
 */
export const recalculateAccountBalance = async (accountId: string | null) => {
  if (!accountId) return;
  const { error } = await supabase.rpc('recalculate_account_balance', {
    p_account_id: accountId,
  });
  if (error) console.error('recalculate_account_balance error:', error);
};

/**
 * Format locale string from app locale
 */
export const getLocaleStr = (locale: string) => locale === 'fr' ? 'fr-FR' : 'en-US';
