CREATE OR REPLACE FUNCTION public.get_account_theoretical_balances(p_user_id uuid)
RETURNS TABLE(account_id uuid, theoretical_balance numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    pa.id AS account_id,
    pa.opening_balance
      + COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END), 0)
      - COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0)
      AS theoretical_balance
  FROM public.payment_accounts pa
  LEFT JOIN public.transactions t
    ON t.account_id = pa.id
   AND t.user_id = pa.user_id
   AND t.deleted_at IS NULL
  WHERE pa.user_id = p_user_id
  GROUP BY pa.id, pa.opening_balance;
$function$;